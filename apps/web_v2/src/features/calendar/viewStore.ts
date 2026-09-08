'use client';

import { useSyncExternalStore } from 'react';
import {
  addCalendarDays,
  addCalendarMonths,
  parseCalendarISO,
  toCalendarISO,
} from '@/features/calendar/calendar';

export type CalendarView = 'month' | 'week' | 'day';

export type CalendarViewState = {
  view: CalendarView;
  anchorISO: string;
};

let state: CalendarViewState = {
  view: 'month',
  anchorISO: toCalendarISO(new Date()),
};

const listeners = new Set<() => void>();

function commit(next: CalendarViewState): void {
  if (next.view === state.view && next.anchorISO === state.anchorISO) return;
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): CalendarViewState {
  return state;
}

export function useCalendarViewState(): CalendarViewState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function setCalendarView(view: CalendarView): void {
  commit({ ...state, view });
}

export function setCalendarAnchor(date: Date): void {
  commit({ ...state, anchorISO: toCalendarISO(date) });
}

export function stepCalendar(direction: -1 | 1): void {
  const anchor = parseCalendarISO(state.anchorISO);
  const next =
    state.view === 'month'
      ? addCalendarMonths(anchor, direction)
      : addCalendarDays(anchor, direction * (state.view === 'week' ? 7 : 1));
  commit({ ...state, anchorISO: toCalendarISO(next) });
}

export function anchorCalendarToday(): void {
  commit({ ...state, anchorISO: toCalendarISO(new Date()) });
}
