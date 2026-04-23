import { create } from 'zustand';

import type { ISODate } from '../features/week/weekDates';

export type PerDateStatus = 'pending' | 'in-progress' | 'success' | 'error';

interface BatchSessionState {
  total: number;
  completed: number;
  currentDate: ISODate | null;
  perDate: Record<ISODate, PerDateStatus>;
  status: 'idle' | 'drafting' | 'done' | 'error';
  error: string | null;

  begin: (dates: ISODate[]) => void;
  setDate: (date: ISODate, status: PerDateStatus) => void;
  complete: () => void;
  fail: (message: string) => void;
  reset: () => void;
}

export const useBatchSession = create<BatchSessionState>((set, get) => ({
  total: 0,
  completed: 0,
  currentDate: null,
  perDate: {},
  status: 'idle',
  error: null,

  begin: (dates) => {
    const perDate: Record<ISODate, PerDateStatus> = {};
    for (const date of dates) perDate[date] = 'pending';

    set({
      total: dates.length,
      completed: 0,
      currentDate: null,
      perDate,
      status: 'drafting',
      error: null,
    });
  },

  setDate: (date, status) => {
    const prev = get();
    const nextPerDate = { ...prev.perDate, [date]: status };
    const completed = Object.values(nextPerDate).filter(
      (value) => value === 'success' || value === 'error',
    ).length;

    set({
      perDate: nextPerDate,
      completed,
      currentDate: status === 'in-progress' ? date : prev.currentDate,
    });
  },

  complete: () => set({ status: 'done', currentDate: null }),
  fail: (message) => set({ status: 'error', error: message }),
  reset: () =>
    set({
      total: 0,
      completed: 0,
      currentDate: null,
      perDate: {},
      status: 'idle',
      error: null,
    }),
}));

export function pendingOrFailedDates(perDate: Record<ISODate, PerDateStatus>): ISODate[] {
  return Object.entries(perDate)
    .filter(([, status]) => status === 'pending' || status === 'error')
    .map(([date]) => date)
    .sort();
}
