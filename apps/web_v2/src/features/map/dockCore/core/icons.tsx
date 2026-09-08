/** Tiny inline icons — avoids pulling @heroicons into the ios-2 foundation. */

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

export function IconUser({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19c1.5-3.5 4-5 7-5s5.5 1.5 7 5" strokeLinecap="round" />
    </svg>
  );
}

export function IconX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} className={className} aria-hidden>
      <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Padlock — passport-locked territory. */
export function IconLock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrowLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Down-pointing chevron — rotate ±90° for left/right calendar steppers. */
export function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconLayers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 3l9 5-9 5-9-5 9-5z" strokeLinejoin="round" />
      <path d="M3 12l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 16l9 5 9-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Boundaries in Controls — pencil (draw / edit territories). */
export function IconBoundaries({ className }: { className?: string }) {
  return <IconPencil className={className} />;
}

export function IconLocate({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21" strokeLinecap="round" />
    </svg>
  );
}

/** Mouse pointer / cursor — Find Me. */
export function IconCursor({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M5.5 3.2l13.2 8.1c.7.43.38 1.5-.43 1.5H12.6l-2.7 7.3c-.28.76-1.35.7-1.53-.09L5.5 3.2z" />
    </svg>
  );
}

export function IconSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 3a9 9 0 109 9" strokeLinecap="round" />
    </svg>
  );
}

/** Switch / swap accounts — opposing horizontal arrows. */
export function IconSwitch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M4 7h12M16 7l-3-3M16 7l-3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 17H8M8 17l3-3M8 17l3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconMapPin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 21s6-5.2 6-10a6 6 0 10-12 0c0 4.8 6 10 6 10z" strokeLinejoin="round" />
      <circle cx="12" cy="11" r="2.25" />
    </svg>
  );
}

export function IconPencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 00-3-3L5 17v3z" strokeLinejoin="round" />
      <path d="M13.5 6.5l3 3" strokeLinecap="round" />
    </svg>
  );
}

/** Compose / create post — square note with plus. */
export function IconPost({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2.5" />
      <path d="M8 9h8M8 13h5" strokeLinecap="round" />
    </svg>
  );
}

/** View details — list rows. */
export function IconDetails({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M8 7h11M8 12h11M8 17h11" strokeLinecap="round" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="5" cy="17" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

export function IconPhoto({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <circle cx="9" cy="10.5" r="1.5" />
      <path d="M7.5 16.5l3.2-3.2a1.2 1.2 0 011.6 0L20 17" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCamera({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path
        d="M4.5 8.5h2.2l1.1-2h8.4l1.1 2H19.5A1.5 1.5 0 0121 10v7.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5V10a1.5 1.5 0 011.5-1.5z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13.25" r="3.25" />
    </svg>
  );
}

export function IconSignOut({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M10 5H6a2 2 0 00-2 2v10a2 2 0 002 2h4" strokeLinecap="round" />
      <path d="M14 16l4-4-4-4M18 12H9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconEnvelope({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPhone({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path
        d="M8 3.5h2.2l1.1 3.2-1.4 1.4a12 12 0 005.2 5.2l1.4-1.4 3.2 1.1V17a2 2 0 01-2.2 2A14.5 14.5 0 016 5.7 2 2 0 018 3.5z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconHome({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 01-1.5 1.5H5.5A1.5 1.5 0 014 19v-8.5z" strokeLinejoin="round" />
      <path d="M10 20.5V14h4v6.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Person with plus — save person to contact book. */
export function IconUserPlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="10" cy="8" r="3.25" />
      <path d="M3.5 19c1.3-3.2 3.5-4.6 6.5-4.6 1.2 0 2.3.2 3.2.7" strokeLinecap="round" />
      <path d="M17 11v6M14 14h6" strokeLinecap="round" />
    </svg>
  );
}

/** House with plus — save address to contact book. */
export function IconHomePlus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M3.5 11L11 5l7.5 6V18a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 18v-7z" strokeLinejoin="round" />
      <path d="M9 19.5V14h4v5.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18.5 8.5v4M16.5 10.5h4" strokeLinecap="round" />
    </svg>
  );
}

/** Contact book / address book. */
export function IconContactBook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M6.5 4.5h11a1.5 1.5 0 011.5 1.5v12a1.5 1.5 0 01-1.5 1.5h-11a1.5 1.5 0 01-1.5-1.5v-12a1.5 1.5 0 011.5-1.5z" strokeLinejoin="round" />
      <path d="M5 8h1.5M5 12h1.5M5 16h1.5" strokeLinecap="round" />
      <circle cx="13" cy="10" r="2" />
      <path d="M9.5 16c.8-1.6 2-2.4 3.5-2.4S15.7 14.4 16.5 16" strokeLinecap="round" />
    </svg>
  );
}

/** Community events calendar. */
export function IconCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="4" y="5" width="16" height="15" rx="2" strokeLinejoin="round" />
      <path d="M8 3v4M16 3v4M4 10h16" strokeLinecap="round" />
    </svg>
  );
}

/** Map time filter — community pins window. */
export function IconClock({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 7.75V12l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBookmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M7 4.5h10a1 1 0 011 1V20l-6-3.5L6 20V5.5a1 1 0 011-1z" strokeLinejoin="round" />
    </svg>
  );
}

export function IconBookmarkFilled({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" stroke="none" className={className} aria-hidden>
      <path d="M7 4.5h10a1 1 0 011 1V20l-6-3.5L6 20V5.5a1 1 0 011-1z" />
    </svg>
  );
}

export function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="3.5" y="6" width="17" height="12.5" rx="2" />
      <path d="M3.5 10H20" strokeLinecap="round" />
      <circle cx="16.5" cy="14.25" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconBus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="5" y="3.5" width="14" height="14" rx="2.5" />
      <path d="M5 11h14M8 17.5v2M16 17.5v2M8 7.5h3M13 7.5h3" strokeLinecap="round" />
    </svg>
  );
}

/** People tool — contact / person lookup. */
export function IconPeople({ className }: { className?: string }) {
  return <IconUser className={className} />;
}

/** Two-person silhouette — All Contacts list row (iOS Lists style). */
export function IconPeopleGroup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <circle cx="9" cy="7.5" r="3.1" />
      <path d="M2.8 18.5c.9-3.2 3.1-4.8 6.2-4.8s5.3 1.6 6.2 4.8" />
      <circle cx="16.6" cy="8.2" r="2.55" opacity={0.92} />
      <path d="M13.4 18.5c.55-1.85 1.7-3.05 3.35-3.55 1.85.55 3.15 2.05 3.7 3.55" opacity={0.92} />
    </svg>
  );
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Addresses tool — property / place lookup. */
export function IconAddress({ className }: { className?: string }) {
  return <IconHome className={className} />;
}

/** Your route — path from here to a point. */
export function IconRoute({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <circle cx="6.5" cy="6.5" r="2.25" />
      <circle cx="17.5" cy="17.5" r="2.25" />
      <path
        d="M8.5 7.5c2.2 0 3.2 1.2 4.5 3.2S15.5 14 17 14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** AI / sparkles. */
export function IconSparkles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M12 3l1.2 4.2L17.5 8.5l-4.3 1.3L12 14l-1.2-4.2L6.5 8.5l4.3-1.3L12 3z" strokeLinejoin="round" />
      <path d="M18.5 13l.7 2.3 2.3.7-2.3.7-.7 2.3-.7-2.3-2.3-.7 2.3-.7.7-2.3z" strokeLinejoin="round" />
      <path d="M5.5 15l.55 1.7L7.8 17.2l-1.75.5L5.5 19.4l-.55-1.7-1.75-.5 1.75-.5L5.5 15z" strokeLinejoin="round" />
    </svg>
  );
}

/** Basemap / map style — stacked tiles. */
export function IconMapStyle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <rect x="4" y="5" width="13" height="10" rx="1.5" />
      <path d="M7 15v3.5a1.5 1.5 0 001.5 1.5H19a1.5 1.5 0 001.5-1.5V9.5A1.5 1.5 0 0019 8h-2" strokeLinecap="round" />
    </svg>
  );
}

export function IconHeart({ className, solid }: { className?: string; solid?: boolean }) {
  if (solid) {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconChat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path
        d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v7a2.5 2.5 0 01-2.5 2.5H10l-4 3v-3H7.5A2.5 2.5 0 015 13.5v-7z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconEllipsis({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <circle cx="5.5" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18.5" cy="12" r="1.6" />
    </svg>
  );
}

/** Three-line “more” / menu control (Instagram-style profile header). */
export function IconMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <rect x="4" y="6.25" width="16" height="1.75" rx="0.875" fill="currentColor" />
      <rect x="4" y="11.125" width="16" height="1.75" rx="0.875" fill="currentColor" />
      <rect x="4" y="16" width="16" height="1.75" rx="0.875" fill="currentColor" />
    </svg>
  );
}

/** ChatGPT-style sidebar / thread list control. */
export function IconSidebar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2.5" strokeLinejoin="round" />
      <path d="M9.5 4.5v15" strokeLinecap="round" />
    </svg>
  );
}

export function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path
        d="M5 7h14M10 7V5h4v2m-6 3v7m4-7v7M7 7l1 12a2 2 0 002 2h4a2 2 0 002-2l1-12"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Account settings / preferences. */
export function IconGear({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="12" r="3.25" />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1.08-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1.08 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.58.9.98 1.55.98H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Security — shield. */
export function IconShield({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 3.5l7 2.6v5.2c0 4.8-3 8-7 9.2-4-1.2-7-4.4-7-9.2V6.1l7-2.6z" strokeLinejoin="round" />
      <path d="M9 12l2 2 4-4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Report / flag content. */
export function IconFlag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M5 21V4" strokeLinecap="round" />
      <path d="M5 4h11l-1.5 3.5L16 11H5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** TEMP experiment — wooden signpost for 3D prop drop. */
export function IconWoodenSign({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 21V9" strokeLinecap="round" />
      <path
        d="M7 5.5h9.5l1.5 2.5-1.5 2.5H7V5.5z"
        strokeLinejoin="round"
      />
      <path d="M9 8h5.5" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — billboard for 3D prop drop. */
export function IconBillboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <rect x="3.5" y="4" width="17" height="10" rx="1.5" />
      <path d="M8 14v5M16 14v5M6.5 19h11" strokeLinecap="round" />
      <path d="M7 8h4M7 10.5h6" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — tree for 3D prop drop. */
export function IconTree({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 21v-6" strokeLinecap="round" />
      <path
        d="M12 4l5.5 7H14l4 5.5H6L10 11H6.5L12 4z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** TEMP experiment — cow. */
export function IconCow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <ellipse cx="12" cy="13" rx="6.5" ry="4.5" />
      <path d="M7 10.5V8.5l-2-1M17 10.5V8.5l2-1" strokeLinecap="round" />
      <circle cx="10" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
      <path d="M9.5 17.5v2.5M14.5 17.5v2.5" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — chicken. */
export function IconChicken({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="11" r="4.5" />
      <path d="M14.5 8.5l2-2.5M9.5 14.5l-1.5 4M14.5 14.5l1.5 4" strokeLinecap="round" />
      <path d="M16.5 12.5h2.5" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — chicken coop. */
export function IconCoop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M4 11l8-6 8 6v8H4v-8z" strokeLinejoin="round" />
      <path d="M10 19v-5h4v5" strokeLinejoin="round" />
    </svg>
  );
}

/** TEMP experiment — cat. */
export function IconCat({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="13" r="5" />
      <path d="M8 9l-1.5-3.5L10 8M16 9l1.5-3.5L14 8" strokeLinejoin="round" />
      <circle cx="10.2" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="12.5" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** TEMP experiment — dog / beagle. */
export function IconDog({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="12.5" r="4.5" />
      <path d="M7.5 11.5c-1.5.2-2.5 1.2-2.5 2.5M16.5 11.5c1.5.2 2.5 1.2 2.5 2.5" strokeLinecap="round" />
      <circle cx="10.5" cy="12" r="0.65" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="12" r="0.65" fill="currentColor" stroke="none" />
      <path d="M11 14.5h2" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — fox. */
export function IconFox({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 18c-3.5 0-6-2.4-6-5.5S9.5 6 12 6s6 2.4 6 6.5S15.5 18 12 18z" strokeLinejoin="round" />
      <path d="M8 8.5L6 5.5 10 8M16 8.5l2-3L14 8" strokeLinejoin="round" />
      <circle cx="10.2" cy="12" r="0.65" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="12" r="0.65" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** TEMP experiment — coin. */
export function IconCoin({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="12" r="7.5" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 9.5v5M10.5 11h3M10.5 13.5h3" strokeLinecap="round" />
    </svg>
  );
}

/** TEMP experiment — treasure chest. */
export function IconChest({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M4 10.5h16v8.5H4v-8.5z" strokeLinejoin="round" />
      <path d="M4 10.5l2-4h12l2 4" strokeLinejoin="round" />
      <path d="M12 10.5v4.5M10 15h4" strokeLinecap="round" />
    </svg>
  );
}

/** World prop — fish. */
export function IconFish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path
        d="M4 12c3.5-4.5 8-6 12-4.5 1.5.5 2.8 1.4 4 2.5-1.2 1.1-2.5 2-4 2.5C12 14 7.5 12.5 4 12z"
        strokeLinejoin="round"
      />
      <path d="M4 12l3.5-2.5M4 12l3.5 2.5" strokeLinecap="round" />
      <circle cx="15.5" cy="11.2" r="0.7" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** World prop — graduation / mortarboard. */
export function IconGraduationCap({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M3 10.5 12 6l9 4.5-9 4.5L3 10.5z" strokeLinejoin="round" />
      <path d="M7 12.5v4.2c0 .8 2.2 2.3 5 2.3s5-1.5 5-2.3v-4.2" strokeLinejoin="round" />
      <path d="M21 10.5v5.5" strokeLinecap="round" />
    </svg>
  );
}

/** Notifications — bell. */
export function IconBell({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M6 10.5a6 6 0 1112 0c0 3.2 1 4.7 2 5.8H4c1-1.1 2-2.6 2-5.8z" strokeLinejoin="round" />
      <path d="M9.5 19.5a2.5 2.5 0 005 0" strokeLinecap="round" />
    </svg>
  );
}

/** Analytics — simple bar chart. */
export function IconChartBar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M5 20V11M12 20V4M19 20v-7" strokeLinecap="round" />
      <path d="M3.5 20.5h17" strokeLinecap="round" />
    </svg>
  );
}

export function IconRefresh({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path
        d="M4.5 12a7.5 7.5 0 0113.2-4.8M19.5 12a7.5 7.5 0 01-13.2 4.8"
        strokeLinecap="round"
      />
      <path d="M17 3.5v4.2h-4.2M7 20.5v-4.2h4.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Share / send — three nodes connected by lines. */
export function IconShare({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="18" cy="5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="19" r="2.25" />
      <path d="M8.2 10.9l7.6-4.4M8.2 13.1l7.6 4.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Insights Today — upward trending line with a small spark dot.
 * Used for the in-game Insights Today dock card button.
 */
export function IconInsights({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M4 17l4.5-5 3.5 3 4-5 4 3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="7" r="2" fill="currentColor" stroke="none" />
      <path d="M19 5v2M17 7h2" strokeLinecap="round" strokeWidth={1.5} />
    </svg>
  );
}

/** Leave / exit door — Explore Zone two-step leave control. */
export function IconLeave({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden>
      <path d="M10 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19H10" strokeLinecap="round" />
      <path d="M14 12H21M18 8.5L21.5 12 18 15.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Insights Explore — compass rose.
 * Used for the in-game Insights Explore dock card button.
 */
export function IconCompass({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.25" />
      <path d="M12 3.75v2M12 18.25v2M3.75 12h2M18.25 12h2" strokeLinecap="round" strokeWidth={1.5} />
      <path d="M14.5 9.5l-3 2.5 3 2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 14.5l3-2.5-3-2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Drop — arrow pointing down toward a ground plane.
 * Used for the "Drop" action in the selected-point toolbar (place a world prop).
 */
export function IconDrop({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      {/* Arrow shaft */}
      <path d="M12 3v13" strokeLinecap="round" />
      {/* Arrowhead */}
      <path d="M7.5 12l4.5 5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Ground plane */}
      <path d="M4.5 20.5h15" strokeLinecap="round" strokeWidth={2} />
    </svg>
  );
}

/** 3-D cube — block builder. */
export function IconCube({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 3L21 8.5v7L12 21l-9-5.5v-7L12 3z" strokeLinejoin="round" />
      <path d="M12 3v18M3 8.5l9 5.5 9-5.5" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" strokeLinejoin="round" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCheckSmall({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className} aria-hidden>
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Terrain / physical surface — waves for water bodies and waterways. */
export function IconWaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M2 10c1.4-1.8 2.8-1.8 4.2 0 1.4 1.8 2.8 1.8 4.2 0 1.4-1.8 2.8-1.8 4.2 0 1.4 1.8 2.8 1.8 4.2 0 1.4-1.8 2.8-1.8 4.2 0" strokeLinecap="round" />
      <path d="M2 15c1.4-1.8 2.8-1.8 4.2 0 1.4 1.8 2.8 1.8 4.2 0 1.4-1.8 2.8-1.8 4.2 0 1.4 1.8 2.8 1.8 4.2 0 1.4-1.8 2.8-1.8 4.2 0" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Zoom state indicator — concentric rings that visually scale with state.
 * `rings` controls how many circles are shown (1–3); outer rings represent
 * a wider / more zoomed-out frame.
 */
export function IconZoomState({
  className,
  rings = 2,
}: {
  className?: string;
  rings?: 1 | 2 | 3;
}) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      {rings >= 3 && <circle cx="12" cy="12" r="9" strokeWidth={1.5} strokeOpacity={0.45} />}
      {rings >= 2 && <circle cx="12" cy="12" r="5.5" strokeWidth={1.75} strokeOpacity={0.7} />}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Road / street — dashed path with forward tick. */
export function IconRoad({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className={className} aria-hidden>
      <path d="M12 3v18" strokeLinecap="round" strokeDasharray="3 2.5" />
      <path d="M5 3l7 0 7 0" strokeLinecap="round" />
      <path d="M4 21h16" strokeLinecap="round" />
    </svg>
  );
}
