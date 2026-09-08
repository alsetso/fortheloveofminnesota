'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import { IconArrowLeft } from '@/features/map/dockCore/core/icons';
import { SETTINGS_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';

const SCROLLBAR_HIDE =
  '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden';

export function SettingsGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
        {label}
      </p>
      <div className="overflow-hidden rounded-[14px] border border-black/[0.08] bg-white shadow-sm">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  title,
  subtitle,
  trailing,
  onClick,
  destructive,
  disabled,
}: {
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  destructive?: boolean;
  disabled?: boolean;
}) {
  const body = (
    <>
      <span className="min-w-0 flex-1">
        <span
          className={`block text-[16px] font-medium ${
            destructive ? 'text-red-600' : 'text-foreground'
          }`}
        >
          {title}
        </span>
        {subtitle ? (
          <span className="mt-0.5 block text-[13px] text-foreground-muted">{subtitle}</span>
        ) : null}
      </span>
      {trailing}
      {onClick && !disabled ? (
        <span className="text-foreground-muted" aria-hidden>
          ›
        </span>
      ) : null}
    </>
  );

  if (!onClick) {
    return (
      <div className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left last:border-b-0">
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-black/[0.06] px-4 py-3.5 text-left last:border-b-0 transition active:bg-black/[0.03] disabled:opacity-45"
    >
      {body}
    </button>
  );
}

/**
 * Shared chrome for Settings hub + nested account / billing pushes.
 * Header is back-only (X/iOS push style) so labels never collide with a centered title.
 */
export function SettingsChrome({
  title,
  backLabel = 'Settings',
  backHref = SETTINGS_PATH,
  onBack,
  trailing,
  children,
  onRefresh,
}: {
  title: string;
  backLabel?: string;
  backHref?: string;
  /** When set, overrides `backHref` navigation (e.g. history.back). */
  onBack?: () => void;
  trailing?: ReactNode;
  children: ReactNode;
  onRefresh?: () => void | Promise<void>;
}) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(backHref);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="sticky top-0 z-10 border-b border-black/[0.08] bg-[#f7f5f1]/95 backdrop-blur-md"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="flex h-11 items-center gap-2 px-2">
          <button
            type="button"
            onClick={handleBack}
            aria-label="Back"
            className="inline-flex items-center gap-0.5 py-1.5 pl-1 pr-2 text-[17px] text-lake-blue active:opacity-60"
          >
            <IconArrowLeft className="h-5 w-5" />
            {backLabel}
          </button>
          <div className="ml-auto flex items-center">{trailing}</div>
        </div>
      </header>
      <PageScroll onRefresh={onRefresh} className={SCROLLBAR_HIDE}>
        <h1 className="sr-only">{title}</h1>
        {children}
      </PageScroll>
    </div>
  );
}
