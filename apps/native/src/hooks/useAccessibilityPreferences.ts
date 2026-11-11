import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useAccessibilityPreferences() {
  const [reduceMotion, setReduceMotion] = useState(false);
  const [reduceTransparency, setReduceTransparency] = useState(false);

  useEffect(() => {
    let active = true;
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    const transparency = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduceTransparency);
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => { if (active) setReduceTransparency(value); });
    return () => {
      active = false;
      motion.remove();
      transparency.remove();
    };
  }, []);

  return { reduceMotion, reduceTransparency };
}
