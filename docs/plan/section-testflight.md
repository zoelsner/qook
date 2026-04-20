# Qook — TestFlight Architecture & Ship Plan

**Owner:** testflight-architect
**Target ship:** 2026-05-24 (TestFlight, internal tier)
**Days remaining:** 32 (starting 2026-04-20)
**Repo:** `~/Projects/qook/` (fresh Expo + Supabase)

---

## 0. TL;DR

- Apple Dev Program: applied 2026-04-13 — assume ~7-day approval (enrollment typically 24-48h for individuals; budget a full week for ID verification edge cases).
- Bundle ID: **`com.kata.qook`** — "Kata" is the parent brand (per user memory), "qook" is the product. Keeps room for future sibling apps.
- EAS Build manages certs, provisioning, and build numbering. No Fastlane, no manual Xcode archive.
- One app icon, one splash, 5 screenshots x 2 device classes. That's it for v1.
- Internal TestFlight (<=100, no review) by Day 22. External TestFlight (review required) by Day 32 as stretch. **Internal is the ship target; external is bonus.**
- No IAP, no paywall, no ATT. Free app with sign-in; nothing Apple can reject on monetization grounds.
- Account deletion flow is a hard Apple requirement — implement in Days 15-21 polish window.
- Risk #1: Instacart Developer Platform approval (orthogonal to this doc, tracked by domain-architect). If not approved, ship with Copy-list fallback — no blocker.

---

## 1. Apple Developer Program checklist

### 1.1 Membership status

**Assumption:** Applied 2026-04-13 per weekly note. By 2026-04-20 (today), status should be "Pending" or "Approved."

**Day 1 action:**
```
1. Log in to https://developer.apple.com/account
2. Check status badge on landing page:
   - "Enrollment Complete" -> proceed
   - "Pending Review" -> nothing to do, watchful wait
   - "Action Required" -> respond immediately (usually ID verification)
3. If still "Pending Review" by Day 7 (2026-04-27):
   - Call Apple Developer Program Support: 1-800-633-2152
   - Reference enrollment ID, request status check
   - ID verification can get stuck; a call usually unsticks it same-day
```

**Fallback if approval slips past Day 14:** Pivot to Expo Go for personal device testing, delay TestFlight external beta but keep internal dogfooding. Does not change ship target because internal TestFlight requires approval too — this is the hard gate.

### 1.2 Team setup

Individual enrollment (not Organization — no LLC). Team ID = personal 10-char string (e.g., `ABC1234567`). This is what EAS needs.

**One-time setup once enrolled:**
1. Sign in to https://developer.apple.com/account
2. Note Team ID (top-right user menu -> Membership Details)
3. Accept latest Program License Agreement (always do this first — builds fail silently if PLA is outdated)
4. In App Store Connect (https://appstoreconnect.apple.com): verify user has Admin + App Manager roles (individual enrollment grants both by default)

### 1.3 Bundle ID registration

**Chosen Bundle ID:** `com.kata.qook`

**Registration steps:**
1. developer.apple.com/account -> Certificates, IDs & Profiles -> Identifiers -> `+`
2. Type: App IDs -> App
3. Description: "Qook"
4. Bundle ID: Explicit -> `com.kata.qook`
5. Capabilities to enable:
   - **Sign in with Apple** (required — v1 has Apple auth)
   - **Associated Domains** (enable now, defer config until universal links ship in v1.1)
   - **Push Notifications** (enable now even though v1 ships without push — adding later requires re-provisioning)
6. Save -> note the App ID suffix for EAS config

**Do NOT enable yet:**
- In-App Purchase (v1.1 with RevenueCat)
- HealthKit (out of scope forever — we don't touch health data)
- iCloud (no CloudKit, Supabase handles sync)

### 1.4 App Store Connect app record

Create this **Day 22** (right before first build upload), not Day 1 — the record requires a Bundle ID that exists in Dev Portal.

```
1. appstoreconnect.apple.com -> My Apps -> +  -> New App
2. Platform: iOS (not "iOS/iPadOS" — we're not shipping iPad)
3. Name: Qook
4. Primary language: English (U.S.)
5. Bundle ID: com.kata.qook
6. SKU: QOOK-V1-2026  (internal identifier, never shown publicly)
7. User Access: Full Access (individual account default)
```

### 1.5 Signing certificates + provisioning profiles

**Decision:** Let EAS manage everything. Don't touch Xcode signing tabs.

EAS will on first `eas build`:
1. Generate Apple Distribution certificate (or reuse existing)
2. Generate App Store provisioning profile for `com.kata.qook`
3. Store both in EAS infrastructure, re-sign on every build

**Command:**
```bash
eas credentials --platform ios
# Prompts for Apple ID + app-specific password
# Select: Let EAS manage the credentials
```

Store the Apple ID credentials in 1Password under "Apple Developer - Qook" — EAS prompts for them on every non-cached machine.

---

## 2. EAS Build configuration

### 2.1 `eas.json`

Write to `~/Projects/qook/eas.json`:

```json
{
  "cli": {
    "version": ">= 13.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": {
        "simulator": true,
        "resourceClass": "m-medium"
      },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://qook-dev.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_DEV",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN_DEV",
        "EXPO_PUBLIC_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "resourceClass": "m-medium",
        "autoIncrement": true
      },
      "channel": "preview",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://qook-staging.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_STAGING",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN_STAGING",
        "EXPO_PUBLIC_ENV": "preview"
      }
    },
    "production": {
      "distribution": "store",
      "ios": {
        "resourceClass": "m-medium",
        "autoIncrement": true
      },
      "channel": "production",
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://qook-prod.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY_PROD",
        "EXPO_PUBLIC_SENTRY_DSN": "$SENTRY_DSN_PROD",
        "EXPO_PUBLIC_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "zachoelsner@gmail.com",
        "ascAppId": "TBD_AFTER_APP_STORE_CONNECT_RECORD",
        "appleTeamId": "TBD_FROM_MEMBERSHIP_PAGE"
      }
    }
  }
}
```

**Key decisions:**
- `appVersionSource: "remote"` — EAS owns build numbers in its cloud, not git. Prevents the "two machines -> two simultaneous build numbers" bug.
- `autoIncrement: true` on preview + production — EAS bumps `CFBundleVersion` on each build.
- `version` (semver, e.g., `1.0.0`) stays in `app.json` and is bumped manually per release cycle.
- `resourceClass: "m-medium"` — M1 build workers, ~8 min builds. `m-large` is overkill for this size project.
- Dev profile uses simulator builds — faster iteration, no device provisioning overhead.

### 2.2 EAS secrets (never in git)

Set once via CLI:
```bash
eas secret:create --scope project --name SUPABASE_ANON_KEY_DEV --value "eyJhbGci..."
eas secret:create --scope project --name SUPABASE_ANON_KEY_STAGING --value "eyJhbGci..."
eas secret:create --scope project --name SUPABASE_ANON_KEY_PROD --value "eyJhbGci..."
eas secret:create --scope project --name SENTRY_DSN_DEV --value "https://...@sentry.io/..."
eas secret:create --scope project --name SENTRY_DSN_STAGING --value "https://...@sentry.io/..."
eas secret:create --scope project --name SENTRY_DSN_PROD --value "https://...@sentry.io/..."
```

**Critical:** `OPENROUTER_API_KEY` lives **only** in Supabase Edge Function environment. Never in EAS, never in `app.json`, never in the client bundle. All AI calls proxy through Edge Functions.

### 2.3 Build caching

EAS caches `node_modules` and Pods by default based on lockfile hashes. No extra config needed.

### 2.4 First smoke-test build

**Day 3 (2026-04-22):** Run `eas build --profile development --platform ios` on a hello-world scaffolded Expo app BEFORE adding any dependencies. This catches:
- Credential issues
- Bundle ID registration mismatches
- Apple Dev Portal state problems
- EAS account quota limits

Cost: ~1 build credit (free tier has 30/month). Time: ~8 min. Value: de-risks Week 4.

---

## 3. `app.config.ts`

Use TS form (not `app.json`) so we can read env vars and conditionally set fields.

Write to `~/Projects/qook/app.config.ts`:

```typescript
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Qook',
  slug: 'qook',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'qook',
  userInterfaceStyle: 'light',
  newArchEnabled: true,

  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FAF5EC',
  },

  assetBundlePatterns: ['**/*'],

  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.kata.qook',
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSMicrophoneUsageDescription:
        'Qook uses your microphone so you can tell us what you feel like eating by voice.',
      NSCameraUsageDescription:
        'Qook uses the camera to scan recipe cards or photos of ingredients.',
      NSPhotoLibraryUsageDescription:
        'Qook saves and reads images from your photo library when you add your own recipes.',
      CFBundleDisplayName: 'Qook',
      UIBackgroundModes: [],
      LSApplicationCategoryType: 'public.app-category.food-and-drink',
    },
    associatedDomains: ['applinks:qook.app'],
    config: {
      usesNonExemptEncryption: false,
    },
  },

  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Fraunces-Bold.ttf',
          './assets/fonts/Fraunces-Regular.ttf',
          './assets/fonts/DMSans-Regular.ttf',
          './assets/fonts/DMSans-Medium.ttf',
          './assets/fonts/DMSans-SemiBold.ttf',
          './assets/fonts/JetBrainsMono-Regular.ttf',
        ],
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: '#FAF5EC',
        image: './assets/splash.png',
        imageWidth: 200,
        resizeMode: 'contain',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '16.0',
          useFrameworks: 'static',
        },
      },
    ],
    [
      '@sentry/react-native/expo',
      {
        organization: 'kata-qook',
        project: 'qook-ios',
        url: 'https://sentry.io/',
      },
    ],
    'expo-apple-authentication',
  ],

  experiments: {
    typedRoutes: true,
  },

  extra: {
    eas: {
      projectId: 'TBD_AFTER_FIRST_EAS_INIT',
    },
  },

  owner: 'zachoelsner',

  updates: {
    url: 'https://u.expo.dev/TBD_AFTER_FIRST_EAS_INIT',
  },

  runtimeVersion: {
    policy: 'appVersion',
  },
});
```

### 3.1 Why these choices

- **`userInterfaceStyle: 'light'`** — watercolor design is cream-first. Dark mode is v1.1. Telling iOS "light only" prevents system auto-switching that would break the palette.
- **`supportsTablet: false`** — iPhone-only ships faster. Tablet review requires iPad screenshots + layout checks.
- **`ITSAppUsesNonExemptEncryption: false`** — we use HTTPS only, no custom crypto. This flag skips the export compliance questionnaire on every build.
- **Camera + Photo Library permissions reserved** — adding them later requires re-provisioning, which is a TestFlight interruption. Declare now, use in v1.1.
- **Deployment target 16.0** — iOS 16 covers 95%+ of the last 3 iPhone generations.
- **`runtimeVersion: appVersion`** — OTA updates (via EAS Update) match the native shell version automatically.

---

## 4. Launch assets needed

### 4.1 App icon

**Master:** `assets/icon.png` — 1024x1024 PNG, no alpha, no rounded corners (iOS rounds for you).

**Design brief:**
- Cream background (`#FAF5EC`) with subtle watercolor paper grain
- Single stylized letter "Q" in Fraunces Bold — the tail of the Q painted as a loose rust-colored brush stroke (`#C36A48`)
- One focal color only. Do NOT add green, blue, or multiple accents.
- Margin: at least 80px of cream padding from letter to canvas edge
- No text other than the Q
- No photorealism; keep editorial/painted feel consistent with in-app recipe illustrations

**Tool:** Generate via Seedream 4.5 on OpenRouter using this prompt:
```
Square 1024x1024 app icon. Large serif letter "Q" centered on cream paper background.
Letter painted in muted rust-orange watercolor with visible brush texture.
The tail of the Q is a loose expressive brush stroke extending down-right.
Cream paper shows subtle grain and warmth. No other marks, no text, no frame.
High contrast, professional, editorial.
```

Generate 3 variants ($0.12 total), pick one, hand-clean in Figma if needed, export 1024x1024.

### 4.2 Splash screen

**File:** `assets/splash.png` — 1024x1024 PNG, transparent background.

**Content:** The wordmark "Qook" in Fraunces Bold, 200px tall, in forest green (`#2A3A26`). That's it.

### 4.3 Screenshots — required for App Store Connect

**Device classes required for v1:**
- iPhone 6.7" (iPhone 15 Pro Max / 16 Pro Max)
- iPhone 6.5" (iPhone 11 Pro Max, XS Max)

**5 screenshots each, same 5 scenes across both device classes:**

1. **Tonight — populated state** — hero recipe card, kicker "TONIGHT . WED APR 22"
2. **Swipe Night — mid-swipe** — card stack with top card mid-tilt
3. **Eat / Cook — recipe detail modal open** — full hero image, ingredients list, "Cook Tonight" button
4. **Shop — grocery list** — populated list with several items, "Shop with Instacart" button
5. **Saved — recipe bank grid** — 2-column grid of watercolor recipe cards

**Captions:**
1. "What's for dinner — sorted in 3 swipes."
2. "Swipe through this week's hand-picked dinners."
3. "Real recipes, painted fresh every week."
4. "Your grocery list — shop it in one tap."
5. "Save what you loved. Cook it again."

**Production tool:** Figma template. Real simulator screenshots overlaid with Fraunces Bold captions. Export at 1290x2796 (6.7"); 1242x2688 (6.5").

### 4.4 Preview video — SKIP for v1

Reserve for public App Store launch.

### 4.5 App Store metadata copy

**App name:** Qook
**Subtitle:** "Tonight's dinner, sorted."  (25 chars)

**Short description (170 chars):**
> Qook picks tonight's dinner for you. Swipe through hand-painted recipes, build your grocery list, cook. Made for evenings when you're too tired to decide.

**Long description (4000 chars max):**
> Qook is a meal-planning app that stops asking you what you want and starts telling you what's for dinner.
>
> Every week you get a hand-picked deck of twelve dinners — illustrated in watercolor, written for real weeknight cooking, built for the energy you actually have. Brain-fried? After-work? Full weekend project? Qook cycles you a deck for the night you're having.
>
> Swipe through your deck. Like the ones you'd actually cook. Qook builds your grocery list from your picks and hands it to Instacart in one tap.
>
> No endless scrolling. No 40-ingredient recipes. No stock-photo food that looks nothing like what you'll make. Just dinner, decided.
>
> Features:
> - Weekly watercolor-painted recipe decks
> - Swipe to pick what sounds good
> - Auto-generated grocery list from your picks
> - One-tap Instacart handoff
> - Save the recipes you loved and cook them again
> - Sign in with Apple
>
> Qook is free during beta. No subscription, no ads.

**Keywords (100 chars, comma-separated):**
```
dinner,meal plan,recipes,grocery,cooking,weeknight,instacart,what to cook,food,planner
```

### 4.6 URLs

- **Privacy Policy URL:** `https://qook.app/privacy` — host on Vercel as a plain HTML page. Domain purchase: Day 1. Policy template: modify existing `apps/native/assets/privacy-policy.html` from sashafood repo — already 90% of what we need.
- **Support URL:** `https://qook.app/support` — simple page with `mailto:support@qook.app` and 3-bullet FAQ.
- **Marketing URL:** `https://qook.app` — for v1, same landing page.

**Domain purchase:** $12/yr at Cloudflare Registrar. Buy Day 1, point DNS at Vercel same day. Hosting: Vercel free tier.

---

## 5. Privacy & data collection disclosures

Apple's App Privacy questionnaire (App Store Connect -> App Privacy). Answer these exactly:

### 5.1 Data types collected

| Category | Subtype | Collected? | Linked to user? | Tracking? | Purpose |
|---|---|---|---|---|---|
| Contact Info | Email | Yes | Yes | No | App Functionality, Account Management |
| Contact Info | Name | Yes (optional) | Yes | No | App Functionality |
| Contact Info | Phone | No | - | - | - |
| User Content | Other User Content (food prefs, saved recipes) | Yes | Yes | No | App Functionality, Personalization |
| Identifiers | User ID (Supabase UUID) | Yes | Yes | No | App Functionality |
| Identifiers | Device ID (IDFA) | No | - | - | - |
| Usage Data | Product Interaction | Yes | Yes | No | Analytics, Personalization |
| Usage Data | Advertising Data | No | - | - | - |
| Diagnostics | Crash Data | Yes | No | No | App Functionality (Sentry, PII stripped) |
| Diagnostics | Performance Data | Yes | No | No | App Functionality (Sentry) |
| Financial Info | Anything | No | - | - | - |
| Health & Fitness | Anything | No | - | - | - |
| Location | Anything | No | - | - | - |
| Sensitive Info | Anything | No | - | - | - |
| Contacts | Anything | No | - | - | - |
| Purchases | Anything | No | - | - | - |

### 5.2 Tracking

**Does Qook track users? NO.**
- No ad networks, no IDFA, no ATT prompt.

### 5.3 Sentry PII configuration

Critical — must be set in Sentry init:
```typescript
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

### 5.4 Data retention

Policy: "Deleted within 30 days of account deletion request." Covered by the account-deletion Edge Function (see Section 8.3).

---

## 6. Beta tester plan

### 6.1 Internal TestFlight group (<=100, no review)

**"Qook Internal"**
- Zach (builder + dogfood user 1)
- 5-10 NYC friends from pitch list
- 2-3 power-user friends who will file feedback
- 1-2 product/design friends for taste feedback

**Target:** 15 people by Day 25.
**Invite method:** TestFlight public link (faster for ad-hoc additions).

### 6.2 External TestFlight group (review required, <=10k)

**"Qook External — Wave 1"**
- Target: 30-50 by Day 32
- Pull from: Twitter/X circle, Reddit DMs (careful), Instagram close friends

**Apple external review:** First external build requires ~24-48h review. Plan first external upload Day 30 so review completes by Day 32.

### 6.3 Feedback collection

**Three channels, priority order:**
1. **TestFlight feedback** — built-in, screenshots + comments delivered to App Store Connect.
2. **In-app feedback button** — More tab -> "Send Feedback" -> `mailto:feedback@qook.app?subject=Qook%20Beta%20Feedback`
3. **Sentry crash reports** — passive. Zach reviews weekly.

**Do NOT build:** custom feedback form, Intercom, session replay.

### 6.4 Beta onboarding email

```
Subject: You're in the Qook beta

You've got a TestFlight invite sitting in your email — tap "View in TestFlight" to install.

Qook is my meal-planning app. Every week it hands you a deck of 12 dinners. Swipe through what sounds good, and it builds your grocery list.

I'd love to know:
- Did you actually cook from it?
- Did the illustrations feel right?
- What was the single moment you thought "ugh"?

Three ways to send feedback:
1. Shake the phone in-app + write a note (easiest)
2. TestFlight app -> Send Beta Feedback
3. Reply to this email

Thanks for trying it. Ship date is Memorial Day weekend.

— Zach
```

---

## 7. CI / release workflow

### 7.1 Branching strategy

```
main            -> always deployable to TestFlight (internal channel)
feature/*       -> day-to-day work, PR into main
release/v1.0.x  -> cut when prepping an App Store review
```

**Do NOT:**
- Merge to `main` without local smoke test
- Force-push to `main` once beta users installed
- Use GitFlow — overhead we don't need

### 7.2 Builds — manual, not CI

**Decision:** No GitHub Actions for v1 TestFlight.

```bash
# From ~/Projects/qook on clean main
eas build --profile production --platform ios --message "v1.0.0 Build N - $(git rev-parse --short HEAD)"
```

After build:
```bash
eas submit --platform ios --latest
```

Expo sends iMessage/email on completion, ~8-12 min.

### 7.3 Build number management

- `version` (semver in `app.config.ts`) -> manually bumped at milestones
- `buildNumber` (iOS `CFBundleVersion`) -> auto-incremented by EAS

### 7.4 OTA updates via EAS Update

For JS-only changes (no native module / plugin / config changes):
```bash
eas update --branch production --message "Fix: swipe-card offset on iPhone SE"
```

**Rule:** If diff touches `expo-*` packages, plugins in `app.config.ts`, or `ios/` folder -> new build. Otherwise OTA.

### 7.5 Rollback

**OTA rollback (fast):**
```bash
eas update:roll-back-to-embedded --branch production
```

**Build rollback:** App Store Connect -> TestFlight -> Versions -> expire bad build.

---

## 8. App Store Review readiness

### 8.1 Review notes

```
Qook is a meal-planning app currently in closed beta.

Test account:
  email: reviewer@qook.app
  password: Review2026Qook!

Demo flow:
1. Sign in with test account
2. Tap "Swipe Night" tab (bottom nav)
3. Pre-loaded deck of 12 recipes — swipe right to like, left to skip
4. After 12 swipes, Qook builds a grocery list
5. Tap "Shop" tab to see the grocery list
6. Tap "Shop with Instacart" for deep-link handoff (opens Safari)

All recipe content is AI-generated weekly (watercolor illustrations via Seedream 4.5; recipe text via Claude).
Food safety disclaimer shown on onboarding and in Settings -> About.
Account deletion at Settings -> Account -> Delete Account.

App does not collect health data, location, payment info, or advertising identifiers.
Free app, no in-app purchases.

Questions: zachoelsner@gmail.com
```

### 8.2 Potential review flags

| Risk | Mitigation |
|---|---|
| **AI-generated content (2.3.1)** | Disclose in review notes AND in-app. Onboarding banner: "Recipes are AI-generated. Use food-safety common sense." |
| **Food safety** | Onboarding screen: "Qook is a meal-planning tool, not a medical or dietary resource." |
| **Account deletion missing (5.1.1(v))** | **Hard requirement** — see Section 8.3. |
| **Sign in with Apple required** | Already in scope. |
| **Instacart deep-link** | `expo-web-browser` with user-initiated tap. Non-issue. |
| **Privacy manifest** | Required iOS 17+. EAS auto-generates. Double-check Day 21. |
| **Push entitlement declared but not used** | Worst case: strip capability from Bundle ID before final build. |

### 8.3 Account deletion flow (hard requirement)

**UI:** `app/(tabs)/more.tsx` -> "Account" -> "Delete Account" (red text)
- Tap -> native `Alert`: "This permanently deletes your account and all your data. Are you sure?"
- Confirm -> Edge Function `delete-account`
- Success -> sign out + return to auth

**Edge Function `delete-account` (SQL):**
```sql
DELETE FROM grocery_items WHERE user_id = auth.uid();
DELETE FROM recipe_saves WHERE user_id = auth.uid();
DELETE FROM swipe_events WHERE user_id = auth.uid();
DELETE FROM deck_assignments WHERE user_id = auth.uid();
DELETE FROM preferences WHERE user_id = auth.uid();
DELETE FROM users WHERE id = auth.uid();
-- Then delete from auth.users (requires service role)
```

**Apple requirements (5.1.1(v), updated 2023):**
- Deletion must be *in-app*, not "email support"
- Must delete account *and all associated data*
- Complete within reasonable time (we do immediate)

### 8.4 Subscription / paywall for v1

**NONE.** Paywall screen exists in current sashafood repo but will NOT be in `~/Projects/qook/`. Free access during TestFlight. Removes IAP review risk entirely.

**Post-TestFlight:** RevenueCat + StoreKit 2 in v1.1.

---

## 9. Monitoring & observability for beta

### 9.1 Sentry — crashes + errors

**Package:** `@sentry/react-native` (not Expo-specific wrapper).

**Setup in `app/_layout.tsx`:**
```typescript
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  environment: process.env.EXPO_PUBLIC_ENV ?? 'development',
  tracesSampleRate: 0.1,
  profilesSampleRate: 0.0,
  beforeSend(event) {
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
```

Source map upload automatic via EAS + `@sentry/react-native/expo` plugin.

### 9.2 Analytics — Supabase table, not Mixpanel

**Rationale:** 50-user TestFlight. Supabase `events` table + 2 SQL queries gives everything we need.

**Schema:**
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  properties JSONB,
  platform TEXT,
  app_version TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_events_user_time ON events(user_id, created_at DESC);
CREATE INDEX idx_events_name_time ON events(event_name, created_at DESC);
```

RLS: users INSERT own rows only; service_role SELECTs.

**Key events (v1):**

| Event | Fired when | Properties |
|---|---|---|
| `sign_up` | Supabase returns user | `method`: 'apple' or 'email' |
| `onboarding_complete` | Last onboarding screen | `household_size`, `avoid_count` |
| `deck_loaded` | Swipe Night mount | `deck_tier`, `recipe_count` |
| `swipe` | Per card | `direction`, `recipe_id` |
| `swipe_night_completed` | Last card swiped | `liked_count`, `skipped_count` |
| `recipe_viewed` | Modal opened | `recipe_id`, `source` |
| `recipe_saved` | Save tapped | `recipe_id` |
| `tonight_set` | Promote to Tonight | `recipe_id` |
| `grocery_added` | List item added | `item_count_after` |
| `instacart_tapped` | Instacart CTA | `item_count`, `recipe_count` |
| `copy_list_tapped` | Fallback used | `item_count` |
| `app_opened` | Foreground | `cold_start` |

**Do NOT track:** scroll depth, hover, PII.

### 9.3 Edge Function + OpenRouter observability

- Edge Function logs: Supabase dashboard -> Functions -> Logs. Filter ERROR. Weekly review.
- OpenRouter usage: openrouter.ai/activity. **$100/month cap. 80% alert.**
- Per-user rate limit in Edge Function:

```typescript
const { count } = await supabase
  .from('events')
  .select('*', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('event_name', 'ai_generation_request')
  .gte('created_at', new Date(Date.now() - 24*60*60*1000).toISOString());
if (count >= 10) return new Response('Daily limit reached', { status: 429 });
```

10 generations/user/day. Decks are pre-generated; per-user AI is a small delta.

### 9.4 Weekly review routine (Day 22+)

Every Sunday:
1. Sentry issues — any crashes affecting >2 users?
2. Supabase events — run activation.sql, retention.sql
3. OpenRouter usage — trending to $100 cap?
4. TestFlight feedback — new messages?
5. Decide: ship fix today, or batch with next build?

---

## 10. 32-day timeline (Day 1 = 2026-04-20)

### Legend
- [H] = hard gate; slip by more than 1 day requires scope cut
- [S] = soft; can shift
- [B] = buffer day

### Days 1-7 (Apr 20-26) — Foundation & Scaffolding

| Day | Date | Focus | Gate |
|---|---|---|---|
| 1 | Mon Apr 20 | Create `~/Projects/qook` repo. `npx create-expo-app`. Install Supabase, Sentry, Reanimated, Skia. Confirm Apple Dev approval. Buy `qook.app` domain. Host privacy/support stubs on Vercel. | [H] Apple Dev confirmed or escalated |
| 2 | Tue Apr 21 | Design tokens in `lib/theme.ts` (cream/forest/rust/prussian). Font loading. Global shell. `eas init`. | [S] |
| 3 | Wed Apr 22 | Smoke-test `eas build --profile development` with hello-world. Confirm certs end-to-end. Configure EAS secrets. | [H] First EAS build succeeds |
| 4 | Thu Apr 23 | Supabase: schema v1, RLS, auth (email + Sign in with Apple). Edge Function stub. | |
| 5 | Fri Apr 24 | Auth screens: sign-in, sign-up. End-to-end: create account, land in empty app. | |
| 6 | Sat Apr 25 | Tonight screen MVP — empty + populated. Mock data. | |
| 7 | Sun Apr 26 | Tonight wired to Supabase. Real flow on simulator. | [H] Day 7: auth + Tonight live |

### Days 8-14 (Apr 27 - May 3) — Content Pipeline + Core Flows

| Day | Date | Focus | Gate |
|---|---|---|---|
| 8 | Mon Apr 27 | Port recipe-generation worker to Edge Function. Watercolor prompt template. | |
| 9 | Tue Apr 28 | Generate first 4 decks (48 recipes). Manual QA. | |
| 10 | Wed Apr 29 | Deck assignment + cohort cycling. Swipe Night scaffold. | |
| 11 | Thu Apr 30 | Swipe Night gesture UX — card stack, pan, haptics. | |
| 12 | Fri May 1 | Swipe Night -> grocery aggregation. Shop tab MVP. | |
| 13 | Sat May 2 | Instacart deep-link (shallow). Copy-list fallback. | |
| 14 | Sun May 3 | Recipe modal — matched geometry transition. | [H] Day 14: full happy path works |

### Days 15-21 (May 4-10) — Polish, Edges, Compliance

| Day | Date | Focus | Gate |
|---|---|---|---|
| 15 | Mon May 4 | Saved tab. More tab (bare minimum). | |
| 16 | Tue May 5 | Onboarding — household + avoid ingredients. | |
| 17 | Wed May 6 | Account deletion flow (UI + Edge Function). | [H] Account deletion works |
| 18 | Thu May 7 | Privacy manifest audit. Info.plist audit. Sentry PII scrubbing verified. | |
| 19 | Fri May 8 | App icon master + splash finalized. Seedream generation. | |
| 20 | Sat May 9 | Haptic audit — every interaction. Animation audit. | |
| 21 | Sun May 10 | On-device test — slow network, airplane mode, cold start. | [H] Day 21: device-verified |

### Days 22-26 (May 11-15) — Build, Upload, Internal Beta

| Day | Date | Focus | Gate |
|---|---|---|---|
| 22 | Mon May 11 | First `eas build --profile production`. Create App Store Connect record. | [H] Production build in ASC |
| 23 | Tue May 12 | Screenshots — 5 scenes x 2 device classes. Figma captions. | |
| 24 | Wed May 13 | ASC metadata — description, keywords, privacy questionnaire, support URL. | |
| 25 | Thu May 14 | Submit TestFlight Internal. Invite Zach + 3-5 first testers. | [H] Internal TestFlight live |
| 26 | Fri May 15 | First real usage. Feedback collection starts. Sentry watch. | |

### Days 27-30 (May 16-19) — Feedback Fixes

| Day | Date | Focus | Gate |
|---|---|---|---|
| 27 | Sat May 16 | Feedback triage. OTA hotfixes for JS-only. | |
| 28 | Sun May 17 | Hotfix build if needed. Add 5-10 more internal testers. | |
| 29 | Mon May 18 | Second internal build with fixes. | |
| 30 | Tue May 19 | Submit External TestFlight for review (24-48h). | [H] External review submitted |

### Days 31-32 (May 20-21) — Final Build & External Invites

| Day | Date | Focus | Gate |
|---|---|---|---|
| 31 | Wed May 20 | Buffer. External review likely pending. | [B] |
| 32 | Thu May 21 | If external approved: send external invites. If not: more internal. | Ship day (soft) |

### Days 33-35 (May 22-24) — Buffer

| Day | Date | Focus | Gate |
|---|---|---|---|
| 33 | Fri May 22 | External approval / final polish. | [B] |
| 34 | Sat May 23 | Personal network push — Instagram close friends. | [B] |
| 35 | Sun May 24 | **Stated ship day.** External invites. | [H] FINAL GATE |

**Buffer total:** 5 days absorb Apple Dev lag, EAS flakiness, external review delay, scope creep.

---

## 11. Risk register

| # | Risk | Likelihood | Impact | Mitigation | Trigger |
|---|---|---|---|---|---|
| 1 | Apple Dev approval delay beyond Day 7 | Medium | High (blocks builds) | Call Apple Dev Support Day 7 if not approved. | Status = "Pending" Day 7 AM |
| 2 | EAS build failure on first smoke test | Medium | Medium (1-day delay) | Day 3 smoke test on empty template. Debug in isolation. | Build fails Day 3 |
| 3 | App Store review rejection on first external submit | Low | High (3-5 day delay) | Clean review notes, demo account, conservative copy. Account deletion verified Day 17. No monetization. | Reviewer rejects Day 31 |
| 4 | SVG filter / watercolor rendering gap (frontend-architect territory) | Medium | Medium | Skia fallback if react-native-svg filters underperform. Tracked separately. | Watercolor edges flat on device |
| 5 | AI cost blowup in beta | Low | Medium | Per-user daily cap (10/day). $100/mo OpenRouter cap with 80% alert. | OpenRouter usage >70% by Day 25 |
| 6 | Instacart Platform approval doesn't arrive (domain-architect) | Medium | Low (degradation) | Ship with Copy-list fallback as primary CTA. Instacart = v1.0.1 OTA. | No approval by Day 21 |
| 7 | User sign-in race condition at scale | Low | Medium | Supabase Auth battle-tested. 50 concurrent users is nothing. | Auth errors in Sentry |

---

## 12. Post-TestFlight roadmap

### 12.1 Criteria for public App Store launch (v1.0 GA)

All three must be true:
- Zero crashes affecting >2 users in last 7 days (Sentry)
- >=70% Day-7 retention from internal testers (events table)
- >=3 unprompted positive mentions of watercolor aesthetic (qualitative)

If not hit by Day 35, extend TestFlight, iterate. Do not ship publicly to chase a date.

### 12.2 v1.1 feature priorities (ordered)

1. **Paywall via RevenueCat + StoreKit 2** — "Generate for me" premium ($4.99/mo target)
2. **Recipe step-by-step walkthrough** — #1 missing piece if users cook
3. **Push notifications** — new weekly deck alert. Targets Day-7 retention.
4. **Voice context input** — wire existing stub to Edge Function + Whisper via OpenRouter
5. **Medium Instacart integration** — live price display. Requires Instacart Platform upgrade.
6. **Cuisine + protein preferences** — if cohort decks don't match taste
7. Recipe ranking tournament — v2, not v1.1

### 12.3 Android port

Target: v1.2, late 2026. Not before Q3.

Blocking:
- Re-do icon for adaptive spec
- Test NativeWind + Reanimated + Skia on Pixel
- Google Play Console + listing
- Privacy disclosure (Google's form similar but not identical)

### 12.4 Other parked items

| Feature | Target | Notes |
|---|---|---|
| Image style presets | v1.2 | Wait for taste divergence signal |
| Card display settings | v1.2 | Users will request |
| Household sharing | v2 | "Roommate shares grocery list" |
| Recipe imports (external URLs) | v2 | Needs scraping infra |
| Social / share | v2 | Only if asked |
| Web app | v3 | Only if signal overwhelming |

---

## 13. One-page checklist (pin to wall)

```
[ ] Apple Dev approved
[ ] qook.app registered + hosted on Vercel
[ ] /privacy + /support pages live
[ ] Supabase prod project created
[ ] Bundle ID com.kata.qook registered
[ ] Sign in with Apple capability enabled
[ ] App Store Connect record created
[ ] EAS project initialized
[ ] All 6 EAS secrets set
[ ] First EAS build succeeds (Day 3 smoke test)
[ ] App icon 1024x1024 finalized
[ ] Splash PNG finalized
[ ] 5 screenshots x 2 device classes
[ ] App Store description + keywords drafted
[ ] Privacy questionnaire answered
[ ] Sentry DSN live + PII scrubbed
[ ] Events table deployed + analytics queries saved
[ ] Account deletion flow shipped
[ ] Review notes drafted with test account
[ ] First production build uploaded
[ ] Internal TestFlight group created
[ ] External review submitted
[ ] First 5 internal testers invited
[ ] Feedback email template sent
```

When every box is checked, v1 is on TestFlight.
