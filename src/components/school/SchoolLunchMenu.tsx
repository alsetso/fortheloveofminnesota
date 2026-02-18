'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ListBulletIcon,
  ExclamationTriangleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

interface Meal {
  name: string;
  category: string;
  calories: number | null;
}

interface DayEvent {
  title: string;
}

interface CalendarDay {
  date: string;
  day_label: string;
  events: DayEvent[];
  meals: Meal[];
}

type MealType = 'lunch' | 'breakfast';

interface MenuResponse {
  available: boolean;
  mealType?: MealType;
  week_start?: string;
  calendar?: CalendarDay[];
}

interface SchoolLunchMenuProps {
  slug: string;
  primaryColor?: string;
}

const CATEGORY_ORDER = ['entree', 'side', 'grain', 'vegetable', 'fruit', 'milk', 'condiment', 'other'];
const MAX_PAST_WEEKS = 4;
const MAX_FUTURE_WEEKS = 1;

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6 && clean.length !== 3) return null;
  const full = clean.length === 3
    ? clean[0] + clean[0] + clean[1] + clean[1] + clean[2] + clean[2]
    : clean;
  const num = parseInt(full, 16);
  if (isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function colorBg(hex: string | undefined, alpha: number): string | undefined {
  if (!hex) return undefined;
  const rgb = hexToRgb(hex);
  if (!rgb) return undefined;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function categoryLabel(cat: string): string {
  const map: Record<string, string> = {
    entree: 'Entrée',
    side: 'Side',
    grain: 'Grain',
    vegetable: 'Vegetable',
    fruit: 'Fruit',
    milk: 'Milk',
    condiment: 'Condiment',
    other: 'Other',
  };
  return map[cat] ?? cat.charAt(0).toUpperCase() + cat.slice(1);
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatWeekLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `Week of ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

function getTodayStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMondayStr(date: Date): string {
  const d = new Date(date);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addWeeks(dateStr: string, weeks: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + weeks * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function pickDefaultDay(calendar: CalendarDay[], weekMonday: string): number {
  const today = getTodayStr();
  const currentMonday = getMondayStr(new Date());

  if (weekMonday === currentMonday) {
    const todayIdx = calendar.findIndex((d) => d.date === today);
    if (todayIdx !== -1) return todayIdx;
    const todayDate = new Date(today + 'T12:00:00');
    for (let i = 0; i < calendar.length; i++) {
      if (new Date(calendar[i].date + 'T12:00:00') >= todayDate) return i;
    }
  }
  return 0;
}

export default function SchoolLunchMenu({ slug, primaryColor }: SchoolLunchMenuProps) {
  const currentMonday = useMemo(() => getMondayStr(new Date()), []);
  const [mealType, setMealType] = useState<MealType>('lunch');
  const [weekMonday, setWeekMonday] = useState(currentMonday);
  const [data, setData] = useState<MenuResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);

  const minMonday = useMemo(() => addWeeks(currentMonday, -MAX_PAST_WEEKS), [currentMonday]);
  const maxMonday = useMemo(() => addWeeks(currentMonday, MAX_FUTURE_WEEKS), [currentMonday]);
  const canGoPrev = weekMonday > minMonday;
  const canGoNext = weekMonday < maxMonday;

  const fetchMenu = useCallback(
    (monday: string, meal: MealType) => {
      setLoading(true);
      fetch(
        `/api/atlas/schools/lunch?schoolSlug=${encodeURIComponent(slug)}&weekStart=${monday}&mealType=${meal}`,
      )
        .then((r) => (r.ok ? r.json() : { available: false, mealType: meal }))
        .then((d: MenuResponse) => {
          setData(d);
          if (d.calendar?.length) setActiveIdx(pickDefaultDay(d.calendar, monday));
        })
        .catch(() => setData({ available: false, mealType: meal }))
        .finally(() => setLoading(false));
    },
    [slug],
  );

  useEffect(() => {
    fetchMenu(weekMonday, mealType);
  }, [weekMonday, mealType, fetchMenu]);

  const handlePrev = useCallback(() => {
    if (!canGoPrev) return;
    setWeekMonday((m) => addWeeks(m, -1));
  }, [canGoPrev]);

  const handleNext = useCallback(() => {
    if (!canGoNext) return;
    setWeekMonday((m) => addWeeks(m, 1));
  }, [canGoNext]);

  const handleMealTypeChange = useCallback(
    (mt: MealType) => {
      if (mt === mealType) return;
      setMealType(mt);
      setWeekMonday(currentMonday);
    },
    [mealType, currentMonday],
  );

  const pc = primaryColor;

  if (loading) return <LunchSkeleton mealType={mealType} onMealTypeChange={handleMealTypeChange} primaryColor={pc} />;

  if (!data?.available || !data.calendar?.length) {
    const label = mealType === 'breakfast' ? 'Breakfast' : 'Lunch';
    return (
      <div className="space-y-3">
        <MenuHeader primaryColor={pc} />
        <MealTypeToggle active={mealType} onChange={handleMealTypeChange} primaryColor={pc} />
        <div className="rounded-md border border-border bg-surface p-8 text-center space-y-3">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
            style={{ backgroundColor: colorBg(pc, 0.1) ?? undefined }}
          >
            <ListBulletIcon className="w-6 h-6" style={{ color: pc ?? undefined }} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{label} Menu</h2>
            <p className="text-xs text-foreground-muted mt-1.5 leading-relaxed max-w-sm mx-auto">
              {label} menu data is not available for this school yet. Check back later or visit the school&apos;s website.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const calendar = data.calendar;
  const activeDay = calendar[activeIdx];
  const displayMonday = data.week_start ?? calendar[0].date;

  return (
    <div className="space-y-3">
      <MenuHeader primaryColor={pc} />

      <MealTypeToggle active={mealType} onChange={handleMealTypeChange} primaryColor={pc} />

      <WeekNavigator
        label={formatWeekLabel(displayMonday)}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        onPrev={handlePrev}
        onNext={handleNext}
        primaryColor={pc}
      />

      <DayTabs calendar={calendar} activeIdx={activeIdx} onSelect={setActiveIdx} primaryColor={pc} />

      {activeDay && <DayPanel day={activeDay} primaryColor={pc} />}
    </div>
  );
}

function MenuHeader({ primaryColor }: { primaryColor?: string }) {
  return (
    <div className="flex items-center gap-2">
      <ListBulletIcon
        className="w-4 h-4"
        style={{ color: primaryColor ?? undefined }}
      />
      <h2 className="text-sm font-semibold text-foreground">School Menu</h2>
    </div>
  );
}

function MealTypeToggle({
  active,
  onChange,
  primaryColor,
}: {
  active: MealType;
  onChange: (mt: MealType) => void;
  primaryColor?: string;
}) {
  const options: { value: MealType; label: string }[] = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
  ];
  return (
    <div className="flex rounded-md border border-border overflow-hidden w-fit">
      {options.map((opt) => {
        const isActive = active === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-4 py-1.5 text-[10px] font-medium transition-colors ${
              isActive
                ? primaryColor ? '' : 'bg-surface-accent text-foreground'
                : 'bg-surface text-foreground-muted hover:bg-surface-accent hover:text-foreground'
            }`}
            style={isActive && primaryColor ? {
              backgroundColor: colorBg(primaryColor, 0.1),
              color: primaryColor,
            } : undefined}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function WeekNavigator({
  label,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  primaryColor,
}: {
  label: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  primaryColor?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-surface px-1 py-1">
      <button
        onClick={onPrev}
        disabled={!canGoPrev}
        className="p-1.5 rounded hover:bg-surface-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={canGoPrev && primaryColor ? { color: primaryColor } : undefined}
      >
        <ChevronLeftIcon className="w-3.5 h-3.5" />
      </button>
      <span
        className="text-xs font-medium"
        style={{ color: primaryColor ?? undefined }}
      >
        {label}
      </span>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className="p-1.5 rounded hover:bg-surface-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        style={canGoNext && primaryColor ? { color: primaryColor } : undefined}
      >
        <ChevronRightIcon className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function DayTabs({
  calendar,
  activeIdx,
  onSelect,
  primaryColor,
}: {
  calendar: CalendarDay[];
  activeIdx: number;
  onSelect: (i: number) => void;
  primaryColor?: string;
}) {
  return (
    <div className="flex rounded-md border border-border overflow-hidden">
      {calendar.map((day, i) => {
        const isActive = i === activeIdx;
        const isEmpty = day.meals.length === 0;
        return (
          <button
            key={day.date}
            onClick={() => onSelect(i)}
            className={`flex-1 px-2 py-2 text-center transition-colors ${
              isActive
                ? primaryColor ? '' : 'bg-surface-accent text-foreground'
                : 'bg-surface text-foreground-muted hover:bg-surface-accent hover:text-foreground'
            } ${isEmpty ? 'opacity-50' : ''}`}
            style={isActive && primaryColor ? {
              backgroundColor: colorBg(primaryColor, 0.1),
              color: primaryColor,
            } : undefined}
          >
            <div className="text-[10px] font-medium leading-tight">
              {day.day_label.slice(0, 3)}
            </div>
            <div
              className="text-[9px] leading-tight mt-0.5"
              style={isActive && primaryColor ? { color: colorBg(primaryColor, 0.6) } : undefined}
            >
              {formatShortDate(day.date)}
            </div>
          </button>
        );
      })}
    </div>
  );
}

function DayPanel({ day, primaryColor }: { day: CalendarDay; primaryColor?: string }) {
  const grouped = useMemo(() => {
    const map = new Map<string, Meal[]>();
    for (const meal of day.meals) {
      const cat = meal.category || 'other';
      if (!map.has(cat)) map.set(cat, []);
      const bucket = map.get(cat)!;
      if (!bucket.some((m) => m.name === meal.name)) {
        bucket.push(meal);
      }
    }
    const sorted = [...map.entries()].sort(([a], [b]) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
    return sorted;
  }, [day]);

  if (day.meals.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-center">
        <p className="text-xs text-foreground-muted">No school this day</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {day.events.map((e, i) => (
        <div
          key={i}
          className="flex items-center gap-2 rounded-md border border-amber-300/40 bg-amber-500/5 px-3 py-2"
        >
          <ExclamationTriangleIcon className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{e.title}</span>
        </div>
      ))}

      <div className="rounded-md border border-border bg-surface divide-y divide-border">
        {grouped.map(([category, meals]) => (
          <div key={category} className="p-[10px] space-y-1.5">
            <h3
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: primaryColor ? colorBg(primaryColor, 0.7) : undefined }}
            >
              {categoryLabel(category)}
            </h3>
            <div className="space-y-1">
              {meals.map((meal, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs text-foreground">{meal.name}</span>
                  {meal.calories != null && (
                    <span className="text-[10px] text-foreground-subtle flex-shrink-0">
                      {Math.round(meal.calories)} cal
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LunchSkeleton({
  mealType,
  onMealTypeChange,
  primaryColor,
}: {
  mealType: MealType;
  onMealTypeChange: (mt: MealType) => void;
  primaryColor?: string;
}) {
  return (
    <div className="space-y-3">
      <MenuHeader primaryColor={primaryColor} />
      <MealTypeToggle active={mealType} onChange={onMealTypeChange} primaryColor={primaryColor} />
      <div className="h-8 rounded-md border border-border bg-surface animate-pulse" />
      <div className="flex rounded-md border border-border overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 px-2 py-3">
            <div className="h-3 w-8 mx-auto rounded bg-surface-accent animate-pulse" />
            <div className="h-2 w-10 mx-auto rounded bg-surface-accent animate-pulse mt-1" />
          </div>
        ))}
      </div>
      <div className="rounded-md border border-border bg-surface p-[10px] space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-2.5 w-16 rounded bg-surface-accent animate-pulse" />
            <div className="h-3.5 w-48 rounded bg-surface-accent animate-pulse" />
            <div className="h-3.5 w-36 rounded bg-surface-accent animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
