import React from 'react';
import Constants from 'expo-constants';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';

import { ScreenShell } from '../../components/ScreenShell';
import { BrushstrokeUnderline } from '../../components/BrushstrokeUnderline';
import { BodyText, DisplayText, Mono } from '../../components/Text';
import { palette, spacing } from '../../design';
import { useHaptics } from '../../hooks/useHaptics';
import { useWeekPlan } from '../../stores/weekPlan';
import { usePrefs } from '../../stores/prefs';
import { todayISO } from '../week/weekDates';

interface MoreRow {
  label: string;
  subtitle: string;
  kicker: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

interface MoreGroup {
  title: string;
  rows: MoreRow[];
}

export function MoreScreen() {
  const router = useRouter();
  const { tap, press, select } = useHaptics();

  const plan = useWeekPlan((s) => s.plan);
  const clearDay = useWeekPlan((s) => s.clearDay);
  const clearFuture = useWeekPlan((s) => s.clearFuture);
  const clearAll = useWeekPlan((s) => s.clearAll);

  const cuisineGroups = usePrefs((s) => s.cuisineGroups);
  const proteins = usePrefs((s) => s.proteins);
  const avoidList = usePrefs((s) => s.avoidList);
  const servings = usePrefs((s) => s.servings);
  const unitSystem = usePrefs((s) => s.unitSystem);
  const partnerName = usePrefs((s) => s.partnerName);
  const defaultTier = usePrefs((s) => s.defaultTier);

  const today = todayISO();
  const todayHasPlan = plan[today]?.recipes?.length || plan[today]?.energy;
  const futureCount = Object.keys(plan).filter((d) => d > today).length;
  const totalCount = Object.keys(plan).length;

  const confirm = (
    title: string,
    message: string,
    onConfirm: () => void,
    confirmLabel = 'Reset',
  ) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: confirmLabel,
        style: 'destructive',
        onPress: () => {
          select();
          onConfirm();
        },
      },
    ]);
  };

  const showPending = (what: string, detail: string) =>
    Alert.alert(what, detail, [{ text: 'OK' }]);

  // Short summary lines under each taste row, so the user sees their current
  // state without opening the detail screen.
  const preferencesSummary = (() => {
    const bits: string[] = [];
    if (cuisineGroups.length) bits.push(`${cuisineGroups.length} cuisine group${cuisineGroups.length === 1 ? '' : 's'}`);
    if (proteins.length) bits.push(`${proteins.length} protein${proteins.length === 1 ? '' : 's'}`);
    if (avoidList.length) bits.push(`${avoidList.length} avoid`);
    return bits.length ? bits.join(' · ') : 'No filters set — draft everything';
  })();

  const householdSummary = (() => {
    const parts: string[] = [
      `${servings} ${servings === 1 ? 'person' : 'people'}`,
      unitSystem === 'us' ? 'US units' : 'Metric',
    ];
    if (partnerName) parts.push(`with ${partnerName}`);
    return parts.join(' · ');
  })();

  const generationSummary = defaultTier
    ? `Default: ${defaultTier.replace(/-/g, ' ')}`
    : 'Ask every time';

  const groups: MoreGroup[] = [
    {
      title: 'taste',
      rows: [
        {
          label: 'Preferences',
          subtitle: preferencesSummary,
          kicker: 'you',
          onPress: () => {
            press();
            router.push('/preferences');
          },
        },
        {
          label: 'Household',
          subtitle: householdSummary,
          kicker: 'who',
          onPress: () => {
            press();
            router.push('/household');
          },
        },
        {
          label: 'Generation',
          subtitle: generationSummary,
          kicker: 'when',
          onPress: () => {
            press();
            router.push('/generation');
          },
        },
      ],
    },
    {
      title: 'plan',
      rows: [
        {
          label: 'Reset today',
          subtitle: todayHasPlan
            ? "Clear tonight's pick and energy tag"
            : 'Nothing planned for today yet',
          kicker: 'now',
          disabled: !todayHasPlan,
          onPress: () => {
            press();
            confirm(
              'Reset today?',
              "This clears tonight's spotlight pick and energy tag. Future days stay.",
              () => clearDay(today),
              'Reset today',
            );
          },
        },
        {
          label: 'Reset future days',
          subtitle:
            futureCount > 0
              ? `Clear ${futureCount} day${futureCount === 1 ? '' : 's'} after today`
              : 'No future days planned',
          kicker: 'plan',
          disabled: futureCount === 0,
          onPress: () => {
            press();
            confirm(
              'Reset future days?',
              `This clears ${futureCount} day${futureCount === 1 ? '' : 's'} after today. Today and past cooks stay.`,
              () => clearFuture(),
              'Reset future',
            );
          },
        },
        {
          label: 'Reset everything',
          subtitle:
            totalCount > 0
              ? `Wipe ${totalCount} day${totalCount === 1 ? '' : 's'} including history`
              : 'Nothing to reset',
          kicker: 'all',
          destructive: true,
          disabled: totalCount === 0,
          onPress: () => {
            press();
            confirm(
              'Reset everything?',
              'This wipes all picks, energy tags, and cook history. Cannot be undone. Your preferences stay.',
              () => clearAll(),
              'Wipe all',
            );
          },
        },
      ],
    },
    {
      title: 'account',
      rows: [
        {
          label: 'Sign in',
          subtitle: 'Email, Apple — required for syncing',
          kicker: 'id',
          disabled: true,
          onPress: () => {
            tap();
            showPending(
              'Sign in',
              'Auth ships with the first live backend cut. Until then the app runs locally on mock data.',
            );
          },
        },
        {
          label: 'Delete account',
          subtitle: 'Permanently remove your data',
          kicker: 'gone',
          destructive: true,
          disabled: true,
          onPress: () => {
            tap();
            showPending(
              'Delete account',
              "Required by Apple's 5.1.1(v). Ships with the auth cut before TestFlight.",
            );
          },
        },
      ],
    },
    {
      title: 'about',
      rows: [
        {
          label: 'Privacy policy',
          subtitle: 'Coming before TestFlight launch',
          kicker: 'read',
          disabled: true,
          onPress: () => {
            tap();
            showPending(
              'Privacy policy',
              "Drafting the policy alongside the first backend cut. It'll live at qook.app/privacy once the domain is provisioned.",
            );
          },
        },
        {
          label: 'Terms of service',
          subtitle: 'Coming before TestFlight launch',
          kicker: 'read',
          disabled: true,
          onPress: () => {
            tap();
            showPending(
              'Terms of service',
              "Drafting alongside the privacy policy. Will live at qook.app/terms.",
            );
          },
        },
        {
          label: 'Send feedback',
          subtitle: 'In-app feedback coming soon',
          kicker: 'talk',
          disabled: true,
          onPress: () => {
            tap();
            showPending(
              'Send feedback',
              "We're wiring this to an in-app form so you can tap-and-type. For now, any feedback goes straight to the tester TestFlight note.",
            );
          },
        },
      ],
    },
  ];

  const version = Constants.expoConfig?.version ?? '0.0.0';
  const apiMode = (Constants.expoConfig?.extra?.apiMode as string) ?? 'mock';

  return (
    <ScreenShell horizontalPadding={24}>
      <View style={styles.header}>
        <View style={styles.kickerRow}>
          <Mono size={10} bold color={palette.accentDeep}>
            more
          </Mono>
          <View style={styles.kickerDot} />
          <Mono size={10} color={palette.textSecondary}>
            settings · account · about
          </Mono>
        </View>
        <View style={styles.displayTitleWrap}>
          <DisplayText size={44} color={palette.primary} style={styles.displayTitle}>
            Settings
          </DisplayText>
          <BrushstrokeUnderline
            width={170}
            color={palette.utility}
            strokeWidth={2.4}
            style={styles.displayUnderline}
          />
        </View>
      </View>

      {groups.map((group, gIdx) => (
        <View
          key={group.title}
          style={gIdx === 0 ? { marginTop: spacing.xl + spacing.sm } : { marginTop: spacing.lg }}
        >
          <View style={styles.groupHeader}>
            <Mono size={10} bold color={palette.accentDeep}>
              {group.title}
            </Mono>
            <View style={styles.groupHeaderRule} />
          </View>
          <View style={styles.rowList}>
            {group.rows.map((row, idx) => (
              <MoreRowView key={row.label} row={row} showDivider={idx > 0} />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.footer}>
        <Mono size={10} color={palette.textTertiary}>
          qook · v{version} · {apiMode}
        </Mono>
      </View>

      <View style={{ height: 120 }} />
    </ScreenShell>
  );
}

function MoreRowView({
  row,
  showDivider,
}: {
  row: MoreRow;
  showDivider: boolean;
}) {
  const labelColor = row.disabled
    ? palette.textTertiary
    : row.destructive
      ? palette.accentDeep
      : palette.ink;
  const kickerColor = row.disabled ? palette.textTertiary : palette.accent;

  return (
    <Pressable
      onPress={row.onPress}
      style={({ pressed }) => [
        styles.row,
        showDivider ? styles.rowDivider : null,
        pressed ? { opacity: 0.85 } : null,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${row.label}. ${row.subtitle}`}
      accessibilityState={{ disabled: row.disabled }}
    >
      <View style={styles.rowKickerWrap}>
        <Mono size={10} bold color={kickerColor}>
          {row.kicker}
        </Mono>
      </View>
      <View style={{ flex: 1 }}>
        <BodyText size={16} weight="semi" color={labelColor}>
          {row.label}
        </BodyText>
        <View style={{ height: 2 }} />
        <BodyText size={12} color={palette.textSecondary} weight="medium">
          {row.subtitle}
        </BodyText>
      </View>
      {row.disabled ? null : (
        <ChevronRight size={16} color={palette.textTertiary} strokeWidth={2} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 6,
  },
  kickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  kickerDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: palette.textSecondary,
  },
  displayTitleWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  displayTitle: {
    letterSpacing: -1.2,
    lineHeight: 48,
  },
  displayUnderline: {
    position: 'absolute',
    left: -6,
    bottom: -8,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupHeaderRule: {
    flex: 1,
    height: 1,
    marginLeft: 10,
    backgroundColor: palette.ingredientRowBorder,
  },
  rowList: {
    borderRadius: 22,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.haloRing,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
  },
  rowDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.ingredientRowBorder,
  },
  rowKickerWrap: {
    width: 40,
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});
