export const PLATFORM_PLACEMENT_SLOTS = [
  {
    slot: 'ads_feed',
    title: 'Sponsored feed',
    description: 'Dedicated /ads stream — ads in the same card format as community posts.',
    defaultSelected: true,
  },
  {
    slot: 'homepage',
    title: 'Homepage sidebar',
    description: 'Right sidebar on the main feed and other tri-column site pages.',
    defaultSelected: false,
  },
  {
    slot: 'main_feed',
    title: 'Community feed',
    description: 'Injected into /feed every 2–3 organic posts.',
    defaultSelected: false,
  },
] as const;

export type PlatformPlacementSlot = (typeof PLATFORM_PLACEMENT_SLOTS)[number]['slot'];

const SLOT_SET = new Set<string>(PLATFORM_PLACEMENT_SLOTS.map((s) => s.slot));

export function isPlatformPlacementSlot(value: string): value is PlatformPlacementSlot {
  return SLOT_SET.has(value);
}
