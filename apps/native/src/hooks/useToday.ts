import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayISO } from '../features/week/weekDates';
import { watchLocalDay } from './localDayClock';

export function useToday() {
  const [today, setToday] = useState(() => todayISO());
  useEffect(() => watchLocalDay(setToday, {
    now: () => new Date(),
    schedule: (callback, delay) => setTimeout(callback, delay),
    cancel: (timer) => clearTimeout(timer),
    onActive: (callback) => {
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') callback();
      });
      return () => subscription.remove();
    },
  }), []);
  return today;
}
