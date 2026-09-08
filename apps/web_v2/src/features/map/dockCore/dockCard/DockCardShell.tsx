'use client';

/**
 * Shared layout frame for every in-dock card — mirrors DockPaneShell slots.
 *
 * Scroll lives on DockCardPopover (one DockScrollRegion). This shell only
 * registers sticky header/footer chrome and content-width, then renders the
 * card body. Variant is layout rhythm documentation; width defaults follow it.
 */

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import {
  useDockCardChrome,
  type DockCardContentWidth,
} from '@/features/map/dockCore/dockCard/DockCardChrome';
import { DockCardSubHeader } from '@/features/map/dockCore/dockCard/DockCardSubHeader';

export type DockCardVariant = 'stack' | 'entity' | 'feed' | 'pin' | 'confirm';

export type DockCardShellProps = {
  children: ReactNode;
  /** Layout rhythm — also picks a default content width. */
  variant?: DockCardVariant;
  contentWidth?: DockCardContentWidth;
  /** Sticky chrome above the scroll body (search, back title, etc.). */
  header?: ReactNode;
  /**
   * Convenience title when `header` is omitted:
   * - center — eyebrow + title (Wallet, Controls, …)
   * - sub — back + centered title (DockCardSubHeader)
   */
  titleMode?: 'none' | 'center' | 'sub';
  eyebrow?: string;
  title?: string;
  subtitle?: string | null;
  backLabel?: string;
  onBack?: () => void;
  /** Sticky chrome below the scroll body (actions, engagement pill). */
  footer?: ReactNode;
  /** Appended to the host scroll reset key. */
  scrollKey?: string;
  className?: string;
};

function DockCardCenterTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <div className="pb-1 pt-1 text-center">
      {eyebrow ? (
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`${eyebrow ? 'mt-0.5' : ''} text-[1.2rem] font-semibold tracking-tight text-foreground`}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-[13px] text-foreground-muted">{subtitle}</p>
      ) : null}
    </div>
  );
}

function defaultWidth(variant: DockCardVariant): DockCardContentWidth {
  return variant === 'entity' || variant === 'pin' ? 'sheet' : 'sm';
}

export function DockCardShell({
  children,
  variant = 'stack',
  contentWidth,
  header,
  titleMode = 'none',
  eyebrow,
  title,
  subtitle,
  backLabel,
  onBack,
  footer = null,
  scrollKey,
  className = '',
}: DockCardShellProps) {
  const { setChrome } = useDockCardChrome();

  const resolvedHeader = useMemo(() => {
    if (header !== undefined) return header;
    if (titleMode === 'center' && title) {
      return (
        <DockCardCenterTitle eyebrow={eyebrow} title={title} subtitle={subtitle} />
      );
    }
    if (titleMode === 'sub' && title && onBack) {
      return (
        <DockCardSubHeader
          backLabel={backLabel}
          onBack={onBack}
          eyebrow={eyebrow}
          title={title}
          subtitle={subtitle}
        />
      );
    }
    return null;
  }, [header, titleMode, eyebrow, title, subtitle, backLabel, onBack]);

  const width = contentWidth ?? defaultWidth(variant);
  const keySuffix = scrollKey ?? null;

  useLayoutEffect(() => {
    setChrome({
      header: resolvedHeader,
      footer,
      contentWidth: width,
      scrollKey: keySuffix,
    });
    return () => {
      setChrome({
        header: null,
        footer: null,
        contentWidth: 'sm',
        scrollKey: null,
      });
    };
  }, [resolvedHeader, footer, width, keySuffix, setChrome]);

  return (
    <div className={`space-y-4 ${className}`.trim()} data-dock-card-variant={variant}>
      {children}
    </div>
  );
}
