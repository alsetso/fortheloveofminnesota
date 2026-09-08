'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useAccountMenu } from '@/features/appShell/AccountMenuContext';
import AccountMenu, {
  AccountMenuRouteCloser,
} from '@/features/appShell/AccountMenu';

/** Share of viewport width the left menu occupies (X-style ~80%). */
const DRAWER_WIDTH_RATIO = 0.82;
const DRAWER_MAX_PX = 360;
const DRAWER_MIN_PX = 280;
/** Soft left edge on the pushed stage — keep subtle, not phone-bezel round. */
const STAGE_OPEN_RADIUS_PX = 12;
/** Drag past this fraction of drawer width to dismiss. */
const DISMISS_RATIO = 0.28;
const DISMISS_VELOCITY = 0.55;

type DragState = {
  pointerId: number;
  startX: number;
  lastX: number;
  startT: number;
  moved: boolean;
};

function clampDrawerWidth(viewportW: number): number {
  return Math.min(
    DRAWER_MAX_PX,
    Math.max(DRAWER_MIN_PX, Math.round(viewportW * DRAWER_WIDTH_RATIO)),
  );
}

/**
 * Pushes App Home tabs chrome (feed / discover column + tab bar) right to reveal the
 * account sidebar underneath — same spatial model as X’s left menu.
 */
export default function AccountMenuShell({ children }: { children: ReactNode }) {
  const { open, closeDrawer } = useAccountMenu();
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [viewportW, setViewportW] = useState(390);
  const [dragDx, setDragDx] = useState<number | null>(null);

  const drawerW = clampDrawerWidth(viewportW);

  useEffect(() => {
    const measure = () => {
      setViewportW(window.innerWidth || 390);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeDrawer]);

  useEffect(() => {
    if (!open) setDragDx(null);
  }, [open]);

  const settleDrag = useCallback(
    (dx: number, velocity: number) => {
      setDragDx(null);
      // dx is negative when dragging the stage left (toward closed).
      if (dx < -drawerW * DISMISS_RATIO || velocity < -DISMISS_VELOCITY) {
        closeDrawer();
      }
    },
    [closeDrawer, drawerW],
  );

  const onDismissPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      lastX: e.clientX,
      startT: e.timeStamp,
      moved: false,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  const onDismissPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      const dx = e.clientX - drag.startX;
      drag.lastX = e.clientX;
      // Only track leftward drag (closing). Rightward is a no-op.
      if (!drag.moved && Math.abs(dx) < 8) return;
      drag.moved = true;
      setDragDx(Math.min(0, Math.max(-drawerW, dx)));
    },
    [drawerW],
  );

  const onDismissPointerEnd = useCallback(
    (e: ReactPointerEvent<HTMLButtonElement>) => {
      const drag = dragRef.current;
      if (!drag || e.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        /* ignore */
      }
      if (!drag.moved) {
        setDragDx(null);
        closeDrawer();
        return;
      }
      const dx = Math.min(0, drag.lastX - drag.startX);
      const dt = Math.max(1, e.timeStamp - drag.startT);
      const velocity = dx / dt; // px/ms
      settleDrag(dx, velocity);
    },
    [closeDrawer, settleDrag],
  );

  const translateX = open ? drawerW + (dragDx ?? 0) : 0;
  const dragging = dragDx != null;

  const stageStyle = {
    transform: `translate3d(${translateX}px, 0, 0)`,
    borderTopLeftRadius: open ? STAGE_OPEN_RADIUS_PX : 0,
    borderBottomLeftRadius: open ? STAGE_OPEN_RADIUS_PX : 0,
    transition: dragging
      ? 'none'
      : 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1), border-radius 320ms cubic-bezier(0.32, 0.72, 0, 1)',
  } as CSSProperties;

  return (
    <div className="absolute inset-0 overflow-hidden" data-account-drawer-shell="">
      <AccountMenuRouteCloser />

      <aside
        className={`absolute inset-y-0 left-0 z-0 ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        style={{ width: drawerW }}
        aria-hidden={!open}
      >
        <AccountMenu />
      </aside>

      <div
        ref={stageRef}
        className={`absolute inset-0 z-[1] overflow-hidden bg-[#f7f5f1] will-change-transform ${
          open ? 'shadow-[-12px_0_32px_rgba(0,0,0,0.22)]' : ''
        }`}
        style={stageStyle}
        data-account-drawer-stage=""
        data-open={open ? 'true' : 'false'}
      >
        {children}

        <button
          type="button"
          aria-label="Close account menu"
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          className={`absolute inset-0 z-[100] touch-none cursor-default bg-black/40 transition-opacity duration-320 ease-[cubic-bezier(0.32,0.72,0,1)] ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onPointerDown={open ? onDismissPointerDown : undefined}
          onPointerMove={open ? onDismissPointerMove : undefined}
          onPointerUp={open ? onDismissPointerEnd : undefined}
          onPointerCancel={open ? onDismissPointerEnd : undefined}
        />
      </div>
    </div>
  );
}
