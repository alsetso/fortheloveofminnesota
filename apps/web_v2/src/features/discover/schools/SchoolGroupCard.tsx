'use client';

import Link from 'next/link';
import {
  ensureSchoolKind,
  formatSchoolType,
  removeSchool,
  removeSchoolKind,
  setSchoolNotify,
  SCHOOL_KIND_OPTIONS,
} from '@/lib/accountSchools/api';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import type { AccountSchoolGroup } from '@/lib/schools/groupAccountSchools';

export function SchoolGroupCard({
  group,
  accountId,
  busyKey,
  run,
}: {
  group: AccountSchoolGroup;
  accountId: string | null;
  busyKey: string | null;
  run: (key: string, work: () => Promise<void>) => void;
}) {
  const pagePath = directoryPageSharePath(group.pageSlug);
  const typeLabel = formatSchoolType(group.schoolType);
  const metaSuffix =
    typeLabel || group.districtName
      ? ` · ${[typeLabel, group.districtName].filter(Boolean).join(' · ')}`
      : '';

  return (
    <li className="rounded-2xl border border-black/[0.08] bg-white px-3.5 py-3">
      <div className="flex items-start gap-2">
        {pagePath ? (
          <Link href={pagePath} className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold tracking-tight text-foreground">
              {group.name}
            </span>
            <span className="mt-0.5 block text-[12px] text-foreground-muted">
              {group.notify ? 'Updates on' : 'Updates off'}
              {metaSuffix}
            </span>
          </Link>
        ) : (
          <div className="min-w-0 flex-1">
            <span className="block truncate text-[16px] font-bold tracking-tight text-foreground">
              {group.name}
            </span>
            <span className="mt-0.5 block text-[12px] text-foreground-muted">
              {group.notify ? 'Updates on' : 'Updates off'}
              {metaSuffix}
            </span>
          </div>
        )}
        <button
          type="button"
          role="switch"
          aria-checked={group.notify}
          aria-label={`Updates for ${group.name}`}
          disabled={!accountId || Boolean(busyKey)}
          onClick={() =>
            void run(`${group.schoolId}:notify`, async () => {
              await setSchoolNotify(accountId!, group.schoolId, !group.notify);
            })
          }
          className={`relative mt-0.5 h-7 w-11 shrink-0 rounded-full transition disabled:opacity-40 ${
            group.notify ? 'bg-lake-blue' : 'bg-black/[0.12]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
              group.notify ? 'left-[1.2rem]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {SCHOOL_KIND_OPTIONS.map((option) => {
          const on = group.kinds.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={on}
              disabled={!accountId || Boolean(busyKey)}
              onClick={() =>
                void run(`${group.schoolId}:${option.id}`, async () => {
                  if (on) {
                    await removeSchoolKind(accountId!, group.schoolId, option.id);
                  } else {
                    await ensureSchoolKind(accountId!, group.schoolId, option.id);
                  }
                })
              }
              className={`rounded-full border px-2.5 py-1.5 text-[12px] font-semibold transition disabled:opacity-40 ${
                on
                  ? 'border-lake-blue/40 bg-lake-blue/10 text-lake-blue'
                  : 'border-black/[0.08] bg-black/[0.03] text-foreground-muted'
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={!accountId || Boolean(busyKey)}
          onClick={() =>
            void run(`${group.schoolId}:remove`, async () => {
              await removeSchool(accountId!, group.schoolId);
            })
          }
          className="text-[12px] font-semibold text-foreground-muted transition active:opacity-60 disabled:opacity-40"
        >
          Remove school
        </button>
      </div>
    </li>
  );
}
