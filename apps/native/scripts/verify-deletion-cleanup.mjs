// Run in an isolated process: bun scripts/verify-deletion-cleanup.mjs
// Exercises the actual deletion callback and Zustand store with memory-only storage.
import { readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mock } from "bun:test";
const disk = new Map();
mock.module("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (key) => disk.get(key) ?? null,
    setItem: async (key, value) => {
      disk.set(key, value);
    },
    removeItem: async (key) => {
      disk.delete(key);
    },
  },
}));
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const { useGenerationSession } = await import(
  `${repo}/apps/native/src/stores/generationSession.ts`
);
await useGenerationSession.persist.rehydrate();
const source = await readFile(
  `${repo}/apps/native/src/features/more/MoreScreen.tsx`,
  "utf8",
);
const start = source.indexOf(
  "            if (accountBusy) return;",
  source.indexOf("  const deleteAccount ="),
);
const end = source.indexOf("\n          },", start);
assert.ok(start > 0 && end > start);
const body = source.slice(start, end);
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const keys = [
  "accountBusy",
  "setAccountBusy",
  "supabase",
  "clearAll",
  "usePrefs",
  "useCookSession",
  "queryClient",
  "clearAuthFlags",
  "router",
  "Alert",
  "__DEV__",
  "useGenerationSession",
];
const run = new AsyncFunction(...keys, body);
const signOutStart =
  source.indexOf(
    "      async () => {",
    source.indexOf("  const handleSignOut ="),
  ) + "      async () => {".length;
const signOutEnd = source.indexOf("\n      },", signOutStart);
assert.ok(signOutStart > 0 && signOutEnd > signOutStart);
const runSignOut = new AsyncFunction(
  ...keys,
  source.slice(signOutStart, signOutEnd),
);
for (const scenario of [
  "success",
  "serverFailure",
  "sessionThrows",
  "sessionReturnsError",
  "sessionNull",
  "deleteSignOutReturnsError",
  "deleteSignOutThrows",
  "ordinarySignOutReturnsError",
  "ordinarySignOutThrows",
  "ordinarySignOutSuccess",
]) {
  useGenerationSession.getState().setContext("private dinner context");
  useGenerationSession
    .getState()
    .setProposals([{ id: "saved recipe", title: "Test dinner" }]);
  const state = {
    busy: false,
    plan: "saved",
    prefs: "saved",
    cook: "saved",
    query: "saved",
    authFlag: "email",
    route: null,
    alerts: [],
    calls: [],
  };
  let failSignOut =
    scenario.includes("SignOut") && !scenario.endsWith("Success");
  const supabase = {
    auth: {
      getSession: async () => {
        if (scenario === "sessionNull") return { data: { session: null }, error: null };
        if (scenario === "sessionThrows") throw Error("storage unavailable");
        if (scenario === "sessionReturnsError")
          return {
            data: { session: null },
            error: Error("session unavailable"),
          };
        return { data: { session: { access_token: "fake" } } };
      },
      signOut: async () => {
        state.calls.push("signOut");
        if (failSignOut && scenario.endsWith("Throws")) throw Error("offline");
        if (failSignOut) return { error: Error("offline") };
        return { error: null };
      },
    },
    functions: {
      invoke: async () => {
        state.calls.push("delete-account");
        return {
          error: scenario === "serverFailure" ? Error("server failure") : null,
        };
      },
    },
  };
  const values = [
    false,
    (v) => (state.busy = v),
    supabase,
    () => (state.plan = null),
    { getState: () => ({ resetPrefs: () => (state.prefs = null) }) },
    { setState: () => (state.cook = null) },
    { clear: () => (state.query = null) },
    async () => (state.authFlag = null),
    { replace: (v) => (state.route = v) },
    { alert: (...args) => state.alerts.push(args) },
    false,
    useGenerationSession,
  ];
  const ordinary = scenario.startsWith("ordinary");
  await (ordinary ? runSignOut : run)(...values);
  if (ordinary) {
    assert.equal(state.plan, "saved");
    assert.equal(state.prefs, "saved");
    assert.equal(state.cook, "saved");
    assert.equal(state.query, "saved");
    assert.equal(
      useGenerationSession.getState().context,
      "private dinner context",
    );
    assert.ok(JSON.parse(disk.get("qook.generationSession.v1")).state.deck);
    assert.equal(state.busy, false);
    assert.deepEqual(state.calls, ["signOut"]);
    if (failSignOut) {
      assert.equal(state.authFlag, "email");
      assert.equal(state.route, null);
      assert.equal(state.alerts[0][0], "Could not sign out");
    } else {
      assert.equal(state.authFlag, null);
      assert.equal(state.route, "/(auth)/sign-in");
      assert.equal(state.alerts.length, 0);
    }
    console.log(
      `PASS: ${scenario} keeps saved data; auth flag/navigation change only on success.`,
    );
    continue;
  }
  if (scenario.startsWith("deleteSignOut")) {
    assert.equal(state.plan, null);
    assert.equal(state.prefs, null);
    assert.equal(state.cook, null);
    assert.equal(state.query, null);
    assert.equal(useGenerationSession.getState().context, "");
    const saved = JSON.parse(disk.get("qook.generationSession.v1"));
    assert.equal(saved.state.context, "");
    assert.equal(saved.state.deck, null);
    assert.equal(state.busy, false);
    assert.equal(state.authFlag, "email");
    assert.equal(state.route, null);
    assert.equal(state.alerts[0][0], "Account deleted");
    assert.match(state.alerts[0][1], /finish signing out/);
    assert.deepEqual(state.calls, ["delete-account", "signOut"]);
    failSignOut = false;
    await state.alerts[0][2]
      .find((button) => button.text === "Retry")
      .onPress();
    assert.deepEqual(state.calls, ["delete-account", "signOut", "signOut"]);
    assert.equal(state.authFlag, null);
    assert.equal(state.route, "/(auth)/sign-in");
    assert.equal(state.busy, false);
    console.log(
      `PASS: ${scenario} clears local app data; retry finishes sign-out without repeating deletion.`,
    );
    continue;
  }
  if (scenario === "success") {
    assert.equal(state.plan, null);
    assert.equal(useGenerationSession.getState().context, "");
    assert.equal(useGenerationSession.getState().deck, null);
    const saved = JSON.parse(disk.get("qook.generationSession.v1"));
    assert.equal(saved.state.context, "");
    assert.equal(saved.state.deck, null);
    assert.equal(state.route, "/(auth)/sign-in");
    console.log(
      "PASS: successful deletion clears actual Zustand generation state AND its persisted context/deck.",
    );
  }
  if (scenario !== "success") {
    assert.equal(state.plan, "saved");
    assert.equal(state.prefs, "saved");
    assert.equal(state.cook, "saved");
    assert.equal(state.query, "saved");
    assert.equal(state.authFlag, "email");
    assert.equal(state.alerts.length, 1);
    assert.equal(state.alerts[0][0], "Could not delete");
    assert.match(state.alerts[0][1], /Please try again/);
    assert.deepEqual(
      state.calls,
      scenario === "serverFailure" ? ["delete-account"] : [],
    );
    assert.equal(
      useGenerationSession.getState().context,
      "private dinner context",
    );
    assert.ok(useGenerationSession.getState().deck);
    const saved = JSON.parse(disk.get("qook.generationSession.v1"));
    assert.equal(saved.state.context, "private dinner context");
    assert.ok(saved.state.deck);
    assert.equal(state.busy, false);
    assert.equal(state.route, null);
    console.log(
      `PASS: ${scenario} preserves all local state and persisted context/deck, resets busy and offers retry; no later auth or cleanup calls.`,
    );
  }
}
console.log(
  "Verified without real accounts, device storage, or network calls.",
);
