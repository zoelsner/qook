import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';

export function useHaptics() {
  return useMemo(
    () => ({
      tap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
      press: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      crossThreshold: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
      select: () => Haptics.selectionAsync(),
      success: () =>
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
    }),
    []
  );
}
