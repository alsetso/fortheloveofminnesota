'use client';

import { IconMapPin } from '@/features/map/dockCore/core/icons';
import {
  composePlaceLabel,
  type ComposePlaceValue,
} from '@/features/community/compose/composePlace';

/** Place row on the write step — grouped list or standalone card. */
export function ComposePlaceChip({
  place,
  onPress,
  grouped = false,
}: {
  place: ComposePlaceValue;
  onPress: () => void;
  grouped?: boolean;
}) {
  const label = composePlaceLabel(place);
  const hint =
    place.precision === 'city' ? 'Appears in this city' : 'Pin on the map';

  if (grouped) {
    return (
      <button
        type="button"
        onClick={onPress}
        className="flex w-full min-h-[44px] items-center gap-3 px-4 py-2.5 text-left transition active:bg-black/[0.03]"
      >
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-lake-blue/10 text-lake-blue">
          <IconMapPin className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] text-[#1C1C1E]">{label}</span>
          <span className="block truncate text-[13px] text-[#8E8E93]">{hint}</span>
        </span>
        <span className="shrink-0 text-[17px] text-lake-blue">Change</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onPress}
      className="flex w-full items-start gap-2.5 rounded-2xl border border-black/[0.08] bg-[#F7F5F1] px-3.5 py-3 text-left transition active:scale-[0.99]"
    >
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
        <IconMapPin className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold tracking-tight text-[#1C1C1E]">
          {label}
        </span>
        <span className="mt-0.5 block text-[12px] text-foreground-muted">{hint}</span>
      </span>
      <span className="shrink-0 self-center text-[13px] font-semibold text-lake-blue">
        Edit
      </span>
    </button>
  );
}
