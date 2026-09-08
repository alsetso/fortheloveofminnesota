/** Tab bar icons — outline idle, filled when selected (iOS-style). */

type TabIconProps = {
  className?: string;
  selected?: boolean;
};

const STROKE = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.85,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true as const,
};

export function IconTabFeed({ className, selected }: TabIconProps) {
  if (selected) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M12 3.5 3.5 10.75V20a.75.75 0 0 0 .75.75H9.5v-5.5h5v5.5h5.25a.75.75 0 0 0 .75-.75V10.75L12 3.5z" />
      </svg>
    );
  }
  return (
    <svg {...STROKE} className={className}>
      <path d="M3.5 10.75 12 3.5l8.5 7.25" />
      <path d="M6 9.75V20h4.25v-5.25h3.5V20H18V9.75" />
    </svg>
  );
}

export function IconTabMap({ className, selected }: TabIconProps) {
  if (selected) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M8.35 4.15 3.5 6v13.5l4.85-1.85V4.15z" />
        <path d="M9.65 4.15v13.5L14.35 20V6.5l-4.7-2.35z" opacity="0.85" />
        <path d="M15.65 6.5 20.5 4.5V18l-4.85 2V6.5z" />
      </svg>
    );
  }
  return (
    <svg {...STROKE} className={className}>
      <path d="M9 4 3.5 6v13.5L9 17.5l6 2.5 5.5-2V4.5L15 6.5 9 4z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </svg>
  );
}

export function IconTabDiscover({ className, selected }: TabIconProps) {
  if (selected) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M11 3.25a7.75 7.75 0 1 0 4.95 13.7l3.8 3.8a1 1 0 0 0 1.4-1.4l-3.8-3.8A7.75 7.75 0 0 0 11 3.25z" />
      </svg>
    );
  }
  return (
    <svg {...STROKE} className={className}>
      <circle cx="11" cy="11" r="6.75" />
      <path d="m16.25 16.25 4.25 4.25" />
    </svg>
  );
}

export function IconTabProfile({ className, selected }: TabIconProps) {
  if (selected) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <circle cx="12" cy="8" r="3.75" />
        <path d="M5.25 19.25c0-3.35 3.02-5.5 6.75-5.5s6.75 2.15 6.75 5.5" />
      </svg>
    );
  }
  return (
    <svg {...STROKE} className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 19c0-3.15 2.9-5.25 6.5-5.25S18.5 15.85 18.5 19" />
    </svg>
  );
}

/** Wrench — home-service bid requests. */
export function IconTabServices({ className, selected }: TabIconProps) {
  if (selected) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M14.7 4.3a4.6 4.6 0 0 0-6.2 6.2L3.2 15.8a2.1 2.1 0 0 0 0 3l2 2a2.1 2.1 0 0 0 3 0l5.3-5.3a4.6 4.6 0 0 0 6.2-6.2l-2.9 2.9-2.4-.4-.4-2.4 2.9-2.9a4.55 4.55 0 0 0-1.2-.2z" />
      </svg>
    );
  }
  return (
    <svg {...STROKE} className={className}>
      <path d="M14.7 6.3a3.1 3.1 0 0 0-4.1 4.1L5.2 15.8a1.4 1.4 0 0 0 0 2l1 1a1.4 1.4 0 0 0 2 0l5.4-5.4a3.1 3.1 0 0 0 4.1-4.1" />
      <path d="m15.2 8.8 2.2-2.2" />
    </svg>
  );
}
