'use client';

import { useState, type ReactNode } from 'react';
import { ComposePlaceChip } from '@/features/community/compose/ComposePlaceChip';
import type { ComposePlaceValue } from '@/features/community/compose/composePlace';
import {
  COMPOSE_PLACEHOLDER,
  type ComposeKindId,
  type ContributionCategory,
} from '@/features/community/contributionTypes';
import {
  MARKETPLACE_INTENT_LABEL,
  MARKETPLACE_INTENTS,
  type MarketplaceIntent,
} from '@/lib/community/composeKindMeta';
import { IconX } from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';

const GROUP = 'overflow-hidden rounded-[10px] bg-white';
const DIVIDER = 'divide-y divide-black/[0.06]';
const ROW = 'flex min-h-[44px] items-center gap-3 px-4 py-2';
const ROW_LABEL = 'w-[5.5rem] shrink-0 text-[17px] text-[#1C1C1E]';
const ROW_INPUT =
  'min-w-0 flex-1 border-0 bg-transparent text-[17px] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:ring-0';
const ROW_INPUT_MUTED = `${ROW_INPUT} text-right text-[#3C3C43]`;
const SECTION_LABEL =
  'px-4 pb-1.5 pt-5 text-[13px] font-normal uppercase tracking-[0.02em] text-[#8E8E93]';

function ComposeSection({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={className}>
      {title ? <p className={SECTION_LABEL}>{title}</p> : null}
      <div className={GROUP}>{children}</div>
    </section>
  );
}

function ComposeSegmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div
      className="flex rounded-[8px] bg-black/[0.06] p-[2px]"
      role="tablist"
      aria-label="Options"
    >
      {options.map((opt) => {
        const on = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => {
              haptic.toggle();
              onChange(opt.id);
            }}
            className={`min-h-[32px] flex-1 rounded-[6px] px-2 text-[13px] font-semibold transition active:opacity-80 ${
              on
                ? 'bg-white text-[#1C1C1E] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                : 'text-[#8E8E93]'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function FormRow({
  label,
  children,
  optional,
}: {
  label: string;
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <div className={ROW}>
      <span className={ROW_LABEL}>
        {label}
        {optional ? (
          <span className="ml-1 text-[13px] font-normal text-[#8E8E93]">Optional</span>
        ) : null}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function ComposeWriteStep({
  category,
  content,
  onContentChange,
  contentMax,
  composePlaceholder,
  place,
  onPlacePress,
  eventTitle,
  onEventTitle,
  eventStartsAt,
  onEventStartsAt,
  eventEndsAt,
  onEventEndsAt,
  marketplaceIntent,
  onMarketplaceIntent,
  marketplacePrice,
  onMarketplacePrice,
  promotionEndsAt,
  onPromotionEndsAt,
  mediaSection,
  error,
}: {
  category: ContributionCategory & { id: ComposeKindId };
  content: string;
  onContentChange: (value: string) => void;
  contentMax: number;
  composePlaceholder?: string | null;
  place: ComposePlaceValue;
  onPlacePress: () => void;
  eventTitle: string;
  onEventTitle: (value: string) => void;
  eventStartsAt: string;
  onEventStartsAt: (value: string) => void;
  eventEndsAt: string;
  onEventEndsAt: (value: string) => void;
  marketplaceIntent: MarketplaceIntent;
  onMarketplaceIntent: (value: MarketplaceIntent) => void;
  marketplacePrice: string;
  onMarketplacePrice: (value: string) => void;
  promotionEndsAt: string;
  onPromotionEndsAt: (value: string) => void;
  mediaSection: ReactNode;
  error: string | null;
}) {
  const kind = category.id;
  const placeholder =
    composePlaceholder?.trim() || COMPOSE_PLACEHOLDER[kind];
  const [kindTipOpen, setKindTipOpen] = useState(true);

  return (
    <div className="bg-[#F7F5F1] pb-6">
      {/* Hero compose — Notes-style, content first */}
      <div className="bg-white px-4 pb-3 pt-2">
        {kindTipOpen ? (
          <div
            role="status"
            className="mb-2.5 flex items-center gap-2 rounded-[8px] bg-lake-blue/[0.08] px-2.5 py-1.5"
          >
            <p className="min-w-0 flex-1 text-[12px] leading-snug text-[#3C3C43]">
              Click “{category.label}” to change post type
            </p>
            <button
              type="button"
              aria-label="Dismiss tip"
              onClick={() => {
                haptic.toggle();
                setKindTipOpen(false);
              }}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[#8E8E93] transition active:bg-black/[0.06] active:opacity-70"
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        <textarea
          value={content}
          onChange={(e) => onContentChange(e.target.value.slice(0, contentMax))}
          maxLength={contentMax}
          rows={6}
          placeholder={placeholder}
          autoFocus
          className="w-full resize-none border-0 bg-transparent p-0 text-[20px] font-normal leading-[1.35] tracking-[-0.01em] text-[#1C1C1E] outline-none placeholder:text-[#C7C7CC] focus:ring-0"
        />
        <p className="mt-1 text-right text-[12px] tabular-nums text-[#8E8E93]">
          {content.trim().length.toLocaleString()} / {contentMax.toLocaleString()}
        </p>
      </div>

      {/* Media */}
      <div className="border-t border-black/[0.04] bg-white px-4 py-3">{mediaSection}</div>

      <div className="space-y-0 px-4">
        {kind === 'event' ? (
          <ComposeSection title="When">
            <div className={DIVIDER}>
              <FormRow label="Title" optional>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => onEventTitle(e.target.value.slice(0, 120))}
                  placeholder="Night market…"
                  className={`${ROW_INPUT} text-right`}
                />
              </FormRow>
              <FormRow label="Starts">
                <input
                  type="datetime-local"
                  value={eventStartsAt}
                  onChange={(e) => onEventStartsAt(e.target.value)}
                  className={ROW_INPUT_MUTED}
                />
              </FormRow>
              <FormRow label="Ends" optional>
                <input
                  type="datetime-local"
                  value={eventEndsAt}
                  onChange={(e) => onEventEndsAt(e.target.value)}
                  className={ROW_INPUT_MUTED}
                />
              </FormRow>
            </div>
          </ComposeSection>
        ) : null}

        {kind === 'marketplace' ? (
          <ComposeSection title="Listing">
            <div className="space-y-0 p-3 pt-2">
              <ComposeSegmented
                options={MARKETPLACE_INTENTS.map((id) => ({
                  id,
                  label: MARKETPLACE_INTENT_LABEL[id],
                }))}
                value={marketplaceIntent}
                onChange={onMarketplaceIntent}
              />
            </div>
            {marketplaceIntent !== 'free' ? (
              <div className={`${DIVIDER} border-t border-black/[0.06]`}>
                <FormRow label="Price" optional>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={marketplacePrice}
                    onChange={(e) => onMarketplacePrice(e.target.value.slice(0, 40))}
                    placeholder="$25"
                    className={`${ROW_INPUT} text-right`}
                  />
                </FormRow>
              </div>
            ) : null}
          </ComposeSection>
        ) : null}

        {kind === 'promotion' ? (
          <ComposeSection title="Offer">
            <div className={DIVIDER}>
              <FormRow label="Ends" optional>
                <input
                  type="datetime-local"
                  value={promotionEndsAt}
                  onChange={(e) => onPromotionEndsAt(e.target.value)}
                  className={ROW_INPUT_MUTED}
                />
              </FormRow>
            </div>
          </ComposeSection>
        ) : null}

        <ComposeSection title="Location">
          <ComposePlaceChip place={place} onPress={onPlacePress} grouped />
        </ComposeSection>

        {error ? (
          <p className="px-2 pt-4 text-center text-[13px] font-medium text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
