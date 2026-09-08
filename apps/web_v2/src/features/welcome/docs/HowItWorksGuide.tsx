'use client';

import { useState } from 'react';
import {
  IconAddress,
  IconBoundaries,
  IconCursor,
  IconLayers,
  IconMapStyle,
  IconPeople,
  IconRoute,
  IconSearch,
} from '@/features/map/dockCore/core/icons';

const INK = '#2C2825';
const MUTED = '#7A736C';
const LINE = '#E0D9CE';
const ACCENT = '#2F5D4A';
const LAKE = '#2A6F8F';

type Step = {
  id: string;
  label: string;
  body: string;
  chrome:
    | 'search'
    | 'find-me'
    | 'boundaries'
    | 'people'
    | 'layers'
    | 'map-style'
    | 'address'
    | 'route'
    | 'sign-in';
};

const ESSENTIALS: Step[] = [
  {
    id: 'search',
    label: 'Search Minnesota',
    body: 'City, county, school, person — type it, go there.',
    chrome: 'search',
  },
  {
    id: 'find-me',
    label: 'Find me',
    body: 'Puts you on the map. Shows what’s around your feet.',
    chrome: 'find-me',
  },
  {
    id: 'boundaries',
    label: 'Boundaries',
    body: 'Counties, schools, districts — who covers your block.',
    chrome: 'boundaries',
  },
  {
    id: 'people',
    label: 'People & addresses',
    body: 'Look someone up, or dig into a place, from Tools.',
    chrome: 'people',
  },
];

const MORE: Step[] = [
  {
    id: 'layers',
    label: 'Map layers',
    body: 'Controls — turn overlays on or off.',
    chrome: 'layers',
  },
  {
    id: 'map-style',
    label: 'Map style',
    body: 'Streets, Outdoors, or Satellite.',
    chrome: 'map-style',
  },
  {
    id: 'address',
    label: 'Addresses',
    body: 'Property and owner when you need the place details.',
    chrome: 'address',
  },
  {
    id: 'route',
    label: 'Your route',
    body: 'From a point or Find Me — roads and ETA.',
    chrome: 'route',
  },
  {
    id: 'sign-in',
    label: 'Come on in with email',
    body: 'One-time code. No password. You’re in charge.',
    chrome: 'sign-in',
  },
];

/** Short walkthrough — essentials first, more on request. */
export default function HowItWorksGuide() {
  const [showMore, setShowMore] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
        The buttons you’ll use
      </h3>
      <p className="text-[0.95rem] leading-relaxed" style={{ color: MUTED }}>
        Same names on the map. Start with these four.
      </p>

      <ol className="flex flex-col gap-2.5">
        {ESSENTIALS.map((step, i) => (
          <StepRow key={step.id} step={step} index={i + 1} />
        ))}
      </ol>

      {showMore ? (
        <ol className="flex flex-col gap-2.5" start={ESSENTIALS.length + 1}>
          {MORE.map((step, i) => (
            <StepRow key={step.id} step={step} index={ESSENTIALS.length + i + 1} />
          ))}
        </ol>
      ) : (
        <button
          type="button"
          onClick={() => setShowMore(true)}
          className="despia-touch-target self-start text-[13px] font-semibold transition active:opacity-70"
          style={{ color: ACCENT }}
        >
          More on the workbench
        </button>
      )}

      <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
        Privacy Policy and Terms sit below before you come in.
      </p>
    </div>
  );
}

function StepRow({ step, index }: { step: Step; index: number }) {
  return (
    <li
      className="flex gap-3 rounded-2xl border px-3.5 py-3"
      style={{ borderColor: LINE, backgroundColor: '#FFFdf9' }}
    >
      <span
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold text-white"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        {index}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StepChromeBadge chrome={step.chrome} />
          <h3 className="text-[15px] font-semibold tracking-tight" style={{ color: INK }}>
            {step.label}
          </h3>
        </div>
        <p className="mt-1 text-[0.9rem] leading-relaxed" style={{ color: MUTED }}>
          {step.body}
        </p>
      </div>
    </li>
  );
}

function StepChromeBadge({ chrome }: { chrome: Step['chrome'] }) {
  if (chrome === 'sign-in') {
    return (
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: ACCENT }}
        aria-hidden
      >
        @
      </span>
    );
  }

  return (
    <span
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border bg-white shadow-sm"
      style={{ color: LAKE, borderColor: `${LAKE}40` }}
      aria-hidden
    >
      {chrome === 'search' ? <IconSearch className="h-3.5 w-3.5" /> : null}
      {chrome === 'find-me' ? <IconCursor className="h-3.5 w-3.5" /> : null}
      {chrome === 'boundaries' ? <IconBoundaries className="h-3.5 w-3.5" /> : null}
      {chrome === 'people' ? <IconPeople className="h-3.5 w-3.5" /> : null}
      {chrome === 'layers' ? <IconLayers className="h-3.5 w-3.5" /> : null}
      {chrome === 'map-style' ? <IconMapStyle className="h-3.5 w-3.5" /> : null}
      {chrome === 'address' ? <IconAddress className="h-3.5 w-3.5" /> : null}
      {chrome === 'route' ? <IconRoute className="h-3.5 w-3.5" /> : null}
    </span>
  );
}
