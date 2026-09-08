'use client';

import { useHealthSteps } from '@/features/health/useHealthSteps';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import {
  DockSection,
  DockSkeletonRows,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { openAppSettings } from '@/lib/despia/openAppSettings';
import { isDespia } from '@/lib/despia/despia';
import type { HealthKitDaySample } from '@/lib/despia/healthKit';

const CTA_BTN =
  'inline-flex w-full items-center justify-center rounded-2xl px-3 py-3.5 text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-50';

function formatSteps(n: number): string {
  return n.toLocaleString('en-US');
}

function weekdayLabel(dateStr: string): string {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'short' });
}

function GoalTrack({
  allDay,
  inApp,
  goal,
}: {
  allDay: number;
  inApp: number;
  goal: number;
}) {
  const allPct = Math.min(100, Math.round((allDay / goal) * 100));
  const inPct = Math.min(allPct, Math.round((inApp / goal) * 100));
  return (
    <div className="space-y-2">
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-black/[0.08]">
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-map-ink-subtle transition-[width] duration-500"
          style={{ width: `${allPct}%` }}
        />
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-lake-blue transition-[width] duration-500"
          style={{ width: `${inPct}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-foreground-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-lake-blue" />
          In app
          <span className="h-1.5 w-1.5 rounded-full bg-map-ink-subtle" />
          All day
        </span>
        <span className="tabular-nums">
          {formatSteps(allDay)} / {formatSteps(goal)}
        </span>
      </div>
    </div>
  );
}

function SplitStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div
      className={`min-w-0 flex-1 rounded-2xl px-3 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <p className="mt-1 text-[1.35rem] font-bold leading-none tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      {hint ? (
        <p className="mt-1.5 text-[11px] leading-snug text-foreground-muted">{hint}</p>
      ) : null}
    </div>
  );
}

function StepWeekBars({ samples }: { samples: HealthKitDaySample[] }) {
  const max = Math.max(1, ...samples.map((s) => s.value));
  return (
    <div
      className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-3.5 py-4`}
    >
      <div className="flex h-32 items-end justify-between gap-1.5">
        {samples.map((sample) => {
          const pct = Math.round((sample.value / max) * 100);
          const isToday =
            sample.date ===
            new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
          return (
            <div
              key={sample.date}
              className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5"
            >
              <span className="text-[9px] font-semibold tabular-nums text-foreground-muted">
                {sample.value >= 1000
                  ? `${Math.round(sample.value / 1000)}k`
                  : sample.value}
              </span>
              <span
                className={`w-full max-w-[28px] rounded-full transition-[height] duration-300 ${
                  isToday ? 'bg-lake-blue' : 'bg-lake-blue/55'
                }`}
                style={{ height: `${Math.max(10, pct)}%` }}
                title={`${formatSteps(sample.value)} steps`}
              />
              <span
                className={`text-[10px] font-medium uppercase tracking-wide ${
                  isToday ? 'text-lake-blue' : 'text-foreground-muted'
                }`}
              >
                {weekdayLabel(sample.date)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Account → Steps — Health share trigger; in-app hero + all-day context. */
export default function StepsDockCard() {
  const { openAccount, openDockCard } = useMapDock();
  const {
    status,
    samples,
    allDay,
    inApp,
    outside,
    goal,
    loading,
    requesting,
    showSteps,
    isNativeIos,
    share,
    stop,
  } = useHealthSteps();

  const canOpenSettings = isDespia() && status === 'denied';
  const showBrowserHint = !isDespia() && !isNativeIos;

  return (
    <DockCardShell
      titleMode="sub"
      backLabel="Account"
      onBack={() => openAccount()}
      eyebrow="Account"
      title="Steps"
      subtitle={
        showSteps
          ? 'In app vs Apple Health'
          : status === 'denied'
            ? 'Health access is off'
            : 'Walk more of Minnesota'
      }
    >
      {status === 'unset' ? (
        <div className="space-y-5 px-0.5">
          <div
            className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-4 py-5`}
          >
            <p className="text-[13px] font-semibold uppercase tracking-wide text-lake-blue">
              Apple Health
            </p>
            <p className="mt-2 text-[1.35rem] font-semibold leading-snug tracking-tight text-foreground">
              Share steps to see what you walk in Own — and the rest of your day.
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-foreground-muted">
              We only read step count. In-app steps update while you use Own;
              all-day comes from Apple Health.
            </p>
          </div>
          <button
            type="button"
            disabled={requesting}
            onClick={() => void share()}
            className={`${CTA_BTN} bg-lake-blue text-white hover:bg-lake-blue/90`}
          >
            {requesting ? 'Requesting…' : 'Share my steps'}
          </button>
          {showBrowserHint ? (
            <p className="text-center text-[12px] text-foreground-muted">
              Browser preview uses sample data. On iPhone this opens Apple Health.
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'denied' ? (
        <div className="space-y-4 px-0.5">
          <div
            className={`rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-4 py-4`}
          >
            <p className="text-[15px] font-semibold text-foreground">
              Steps are hidden
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-foreground-muted">
              Allow Health access for this app, then try again. We never show
              step totals without your share.
            </p>
          </div>
          <div className="space-y-2">
            {canOpenSettings ? (
              <button
                type="button"
                onClick={() => void openAppSettings()}
                className={`${CTA_BTN} bg-lake-blue text-white hover:bg-lake-blue/90`}
              >
                Open Settings
              </button>
            ) : null}
            <button
              type="button"
              disabled={requesting}
              onClick={() => void share()}
              className={`${CTA_BTN} bg-map-ink-faint text-foreground hover:bg-map-ink-subtle`}
            >
              {requesting ? 'Trying…' : 'Try again'}
            </button>
          </div>
        </div>
      ) : null}

      {status === 'shared' ? (
        <>
          <DockSection title="Today">
            {loading && !showSteps ? (
              <DockSkeletonRows count={2} />
            ) : showSteps && allDay != null ? (
              <div className="space-y-3">
                <div
                  className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} px-4 py-5 text-center`}
                >
                  <p className="text-[13px] font-medium uppercase tracking-wide text-lake-blue">
                    In app
                  </p>
                  <p className="mt-1 text-[44px] font-bold leading-none tabular-nums tracking-tight text-foreground">
                    {formatSteps(inApp)}
                  </p>
                  <p className="mt-2 text-[12px] text-foreground-muted">
                    Steps while Own was open today
                  </p>
                  <div className="mx-auto mt-4 max-w-[260px]">
                    <GoalTrack allDay={allDay} inApp={inApp} goal={goal} />
                  </div>
                </div>

                <div className="flex gap-2">
                  <SplitStat
                    label="All day"
                    value={formatSteps(allDay)}
                    hint="Apple Health"
                  />
                  <SplitStat
                    label="Outside"
                    value={formatSteps(outside ?? 0)}
                    hint="Rest of your day"
                  />
                </div>
              </div>
            ) : (
              <p className="px-0.5 text-[13px] text-foreground-muted">
                No step data yet for today.
              </p>
            )}
          </DockSection>

          {showSteps ? (
            <DockSection title="This week" subtitle="All-day totals from Apple Health">
              <StepWeekBars samples={samples} />
            </DockSection>
          ) : null}

          <button
            type="button"
            onClick={stop}
            className={`${CTA_BTN} mt-1 bg-transparent text-foreground-muted hover:bg-map-ink-faint hover:text-foreground`}
          >
            Stop sharing steps
          </button>
        </>
      ) : null}
    </DockCardShell>
  );
}
