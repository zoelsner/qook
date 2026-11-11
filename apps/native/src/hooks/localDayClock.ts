import { todayISO, type ISODate } from '../features/week/weekDates';

interface ClockEnvironment {
  now: () => Date;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
  onActive: (callback: () => void) => () => void;
}

// Refresh at local midnight and after suspension or a timezone change on resume.
// Calendar arithmetic handles 23/25-hour daylight-saving days.
export function watchLocalDay(notify: (day: ISODate) => void, env: ClockEnvironment) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const refresh = () => {
    if (stopped) return;
    if (timer !== undefined) env.cancel(timer);
    const now = env.now();
    notify(todayISO(now));
    const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    timer = env.schedule(refresh, Math.max(1, midnight.getTime() - now.getTime()));
  };
  const unsubscribe = env.onActive(refresh);
  refresh();
  return () => {
    stopped = true;
    if (timer !== undefined) env.cancel(timer);
    unsubscribe();
  };
}
