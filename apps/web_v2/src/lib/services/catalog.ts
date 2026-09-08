/**
 * Server-side home-service catalog for the `/services` bid portal.
 * Categories are the first cut; trades nest under a single category per request.
 */

export const SERVICE_CATEGORY_IDS = [
  'systems',
  'exterior',
  'outdoor',
  'interior',
  'care',
  'logistics',
  'other',
] as const;

export type ServiceCategoryId = (typeof SERVICE_CATEGORY_IDS)[number];

export type ServiceCategory = {
  id: ServiceCategoryId;
  label: string;
  hint: string;
  sort_order: number;
};

export type ServiceTrade = {
  id: string;
  label: string;
  hint: string;
  category_id: ServiceCategoryId;
};

export const SERVICE_CATEGORIES: readonly ServiceCategory[] = [
  {
    id: 'systems',
    label: 'Systems',
    hint: 'Plumbing, electrical, heat & appliances',
    sort_order: 1,
  },
  {
    id: 'exterior',
    label: 'Exterior',
    hint: 'Roof, siding, windows, foundation',
    sort_order: 2,
  },
  {
    id: 'outdoor',
    label: 'Yard & seasonal',
    hint: 'Lawn, snow, trees, decks',
    sort_order: 3,
  },
  {
    id: 'interior',
    label: 'Interior',
    hint: 'Paint, floors, carpentry, remodel',
    sort_order: 4,
  },
  {
    id: 'care',
    label: 'Cleaning & care',
    hint: 'Cleaning, junk, pest control',
    sort_order: 5,
  },
  {
    id: 'logistics',
    label: 'Moving & hauling',
    hint: 'Moves, haul-away, delivery help',
    sort_order: 6,
  },
  {
    id: 'other',
    label: 'Other',
    hint: 'Something else — describe the job',
    sort_order: 7,
  },
] as const;

export const SERVICE_TRADES: readonly ServiceTrade[] = [
  // Systems
  {
    id: 'plumbing',
    label: 'Plumbing',
    hint: 'Leaks, drains, fixtures, water lines',
    category_id: 'systems',
  },
  {
    id: 'electrical',
    label: 'Electrical',
    hint: 'Outlets, panels, lighting, wiring',
    category_id: 'systems',
  },
  {
    id: 'hvac',
    label: 'HVAC',
    hint: 'Furnace, A/C, boilers, ducts',
    category_id: 'systems',
  },
  {
    id: 'water-heater',
    label: 'Water heater',
    hint: 'Repair, flush, or replace',
    category_id: 'systems',
  },
  {
    id: 'appliances',
    label: 'Appliances',
    hint: 'Washer, dryer, fridge, range',
    category_id: 'systems',
  },
  // Exterior
  {
    id: 'roofing',
    label: 'Roofing',
    hint: 'Repairs, replacement, ice dams',
    category_id: 'exterior',
  },
  {
    id: 'gutters',
    label: 'Gutters',
    hint: 'Clean, repair, or install',
    category_id: 'exterior',
  },
  {
    id: 'siding',
    label: 'Siding',
    hint: 'Repair, replace, weather damage',
    category_id: 'exterior',
  },
  {
    id: 'windows-doors',
    label: 'Windows & doors',
    hint: 'Replace, seal, hardware',
    category_id: 'exterior',
  },
  {
    id: 'foundation',
    label: 'Foundation',
    hint: 'Cracks, sealing, waterproofing',
    category_id: 'exterior',
  },
  {
    id: 'garage-door',
    label: 'Garage door',
    hint: 'Openers, springs, panels',
    category_id: 'exterior',
  },
  // Outdoor
  {
    id: 'lawn',
    label: 'Lawn care',
    hint: 'Mow, fertilize, aeration',
    category_id: 'outdoor',
  },
  {
    id: 'landscaping',
    label: 'Landscaping',
    hint: 'Beds, hardscape, planting',
    category_id: 'outdoor',
  },
  {
    id: 'trees',
    label: 'Trees & shrubs',
    hint: 'Trim, remove, stump grind',
    category_id: 'outdoor',
  },
  {
    id: 'snow',
    label: 'Snow removal',
    hint: 'Driveways, walks, roofs',
    category_id: 'outdoor',
  },
  {
    id: 'decks-fences',
    label: 'Decks & fences',
    hint: 'Build, repair, stain',
    category_id: 'outdoor',
  },
  // Interior
  {
    id: 'painting',
    label: 'Painting',
    hint: 'Interior or exterior paint',
    category_id: 'interior',
  },
  {
    id: 'flooring',
    label: 'Flooring',
    hint: 'Carpet, hardwood, LVP, tile',
    category_id: 'interior',
  },
  {
    id: 'carpentry',
    label: 'Carpentry',
    hint: 'Trim, doors, built-ins, repairs',
    category_id: 'interior',
  },
  {
    id: 'drywall',
    label: 'Drywall',
    hint: 'Patch, texture, hang',
    category_id: 'interior',
  },
  {
    id: 'cabinets',
    label: 'Cabinets & countertops',
    hint: 'Install, refinish, replace',
    category_id: 'interior',
  },
  // Care
  {
    id: 'cleaning',
    label: 'Cleaning',
    hint: 'Home, deep, or move-out clean',
    category_id: 'care',
  },
  {
    id: 'junk',
    label: 'Junk removal',
    hint: 'Haul-away, garage clear-outs',
    category_id: 'care',
  },
  {
    id: 'pest',
    label: 'Pest control',
    hint: 'Insects, rodents, prevention',
    category_id: 'care',
  },
  {
    id: 'organizing',
    label: 'Organizing',
    hint: 'Closets, garage, estate prep',
    category_id: 'care',
  },
  // Logistics
  {
    id: 'moving',
    label: 'Moving',
    hint: 'Load, haul, unload',
    category_id: 'logistics',
  },
  {
    id: 'hauling',
    label: 'Hauling',
    hint: 'Trailers, dump runs, bulky items',
    category_id: 'logistics',
  },
  {
    id: 'delivery-help',
    label: 'Delivery help',
    hint: 'Furniture in, assembly assist',
    category_id: 'logistics',
  },
  // Other
  {
    id: 'other',
    label: 'Other',
    hint: 'Describe what you need',
    category_id: 'other',
  },
] as const;

export function isServiceCategoryId(value: unknown): value is ServiceCategoryId {
  return (
    typeof value === 'string' &&
    (SERVICE_CATEGORY_IDS as readonly string[]).includes(value)
  );
}

export function serviceCategoryById(
  id: string | null | undefined,
): ServiceCategory | null {
  if (!id) return null;
  return SERVICE_CATEGORIES.find((row) => row.id === id) ?? null;
}

export function serviceTradeById(id: string | null | undefined): ServiceTrade | null {
  if (!id) return null;
  return SERVICE_TRADES.find((row) => row.id === id) ?? null;
}

export function tradesForCategory(
  categoryId: ServiceCategoryId,
): ServiceTrade[] {
  return SERVICE_TRADES.filter((row) => row.category_id === categoryId);
}

/** Compact summary — "Plumbing", "Plumbing, Electrical", "Plumbing +2". */
export function formatServiceTradeSummary(ids: readonly string[]): string | null {
  const labels = ids
    .map((id) => serviceTradeById(id)?.label)
    .filter((label): label is string => Boolean(label));
  if (labels.length === 0) return null;
  if (labels.length === 1) return labels[0]!;
  if (labels.length === 2) return `${labels[0]}, ${labels[1]}`;
  return `${labels[0]} +${labels.length - 1}`;
}

/** Nav row: "Systems · Plumbing +1" when category + trades known. */
export function formatServiceSelectionSummary(
  categoryId: string | null | undefined,
  tradeIds: readonly string[],
): string | null {
  const category = serviceCategoryById(categoryId);
  const trades = formatServiceTradeSummary(tradeIds);
  if (category && trades) return `${category.label} · ${trades}`;
  if (trades) return trades;
  if (category) return category.label;
  return null;
}

export type ServiceCatalogPayload = {
  categories: readonly ServiceCategory[];
  trades: readonly ServiceTrade[];
};

export function getServiceCatalog(): ServiceCatalogPayload {
  return {
    categories: SERVICE_CATEGORIES,
    trades: SERVICE_TRADES,
  };
}

/**
 * Validate category + trades against the catalog.
 * Trades must all belong to the category (except empty → invalid).
 */
export function resolveServiceSelection(
  categoryIdRaw: string | null | undefined,
  tradeIds: readonly string[],
): {
  category: ServiceCategory;
  trades: Array<{ id: string; label: string }>;
} | null {
  if (!isServiceCategoryId(categoryIdRaw)) return null;
  const category = serviceCategoryById(categoryIdRaw);
  if (!category) return null;
  const allowed = new Set(tradesForCategory(category.id).map((row) => row.id));
  const trades: Array<{ id: string; label: string }> = [];
  for (const id of tradeIds) {
    if (!allowed.has(id)) continue;
    const trade = serviceTradeById(id);
    if (!trade) continue;
    trades.push({ id: trade.id, label: trade.label });
  }
  if (trades.length === 0) return null;
  return { category, trades };
}
