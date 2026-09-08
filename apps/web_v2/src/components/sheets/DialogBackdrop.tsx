'use client';

/**
 * Shared dimmed backdrop + centered stage for modal dialogs.
 * Handles tap-outside dismiss and Escape. Product UI owns the dialog panel.
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { Z_LAYER_CLASS, type ZLayerName } from '@/lib/map/zLayers';

export type DialogBackdropProps = {
  children: ReactNode;
  /** Required when dismissible (default). Ignored when dismissible={false}. */
  onClose?: () => void;
  /** Stacking layer token — defaults to critical dialogs. */
  layer?: Extract<ZLayerName, 'CHOOSER' | 'SETUP' | 'CRITICAL_DIALOG'>;
  /** Dim fill class on the tap-catcher (default black/40). */
  dimClassName?: string;
  /** Extra classes on the outer fixed/absolute frame (padding, blur, etc.). */
  className?: string;
  style?: CSSProperties;
  /** Accessible name when this frame is itself the dialog. */
  ariaLabel?: string;
  /**
   * When true, the outer frame is `role="dialog"`. When false (default), the
   * frame is a presentation wrapper and the child panel owns dialog roles.
   */
  frameIsDialog?: boolean;
  /** Centered modal (default) or bottom-aligned sheet stage. */
  align?: 'center' | 'end';
  /** Positioning mode — most dialogs are fixed; setup overlays use absolute. */
  position?: 'fixed' | 'absolute';
  /**
   * When false, the dim is non-interactive and Escape is ignored (e.g. the
   * mandatory account picker). Defaults to true.
   */
  dismissible?: boolean;
};

export default function DialogBackdrop({
  children,
  onClose,
  layer = 'CRITICAL_DIALOG',
  dimClassName = 'bg-black/40',
  className = '',
  style,
  ariaLabel,
  frameIsDialog = false,
  align = 'center',
  position = 'fixed',
  dismissible = true,
}: DialogBackdropProps) {
  useEffect(() => {
    if (!dismissible || !onClose) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dismissible, onClose]);

  const alignClass =
    align === 'end' ? 'flex flex-col justify-end' : 'flex items-center justify-center';

  return (
    <div
      className={`${position} inset-0 ${Z_LAYER_CLASS[layer]} ${alignClass} pointer-events-auto ${className}`.trim()}
      role={frameIsDialog ? 'dialog' : 'presentation'}
      aria-modal={frameIsDialog ? true : undefined}
      aria-label={frameIsDialog ? ariaLabel : undefined}
      style={style}
    >
      {dismissible && onClose ? (
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={`absolute inset-0 ${dimClassName}`}
        />
      ) : (
        <div aria-hidden className={`absolute inset-0 ${dimClassName}`} />
      )}
      <div className="relative z-10 w-full">{children}</div>
    </div>
  );
}
