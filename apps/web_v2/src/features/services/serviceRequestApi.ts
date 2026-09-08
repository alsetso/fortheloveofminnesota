import { CATEGORY_UUID } from '@/features/community/contributionTypes';
import { POST_CAPTION_MAX } from '@/features/community/postCaptionLimits';
import {
  buildServiceRequestMeta,
  type ServiceUrgency,
} from '@/lib/community/composeKindMeta';
import {
  getServiceCatalog,
  resolveServiceSelection,
  type ServiceCatalogPayload,
  type ServiceCategoryId,
} from '@/lib/services/catalog';

export type ServiceRequestSite = {
  lat: number;
  lng: number;
  address: string;
};

export type CreateServiceRequestInput = {
  categoryId: ServiceCategoryId;
  tradeIds: string[];
  urgency: ServiceUrgency;
  body: string;
  budget?: string | null;
  site: ServiceRequestSite;
};

export type ServiceRequestRow = {
  id: string;
  body: string | null;
  full_address: string | null;
  created_at: string;
  comment_count: number;
  category_id: string | null;
  category_label: string | null;
  trade: string | null;
  trade_label: string | null;
  trades: Array<{ id: string; label: string }>;
  urgency: ServiceUrgency | null;
  budget: string | null;
};

export async function fetchServiceCatalog(
  signal?: AbortSignal,
): Promise<ServiceCatalogPayload> {
  try {
    const res = await fetch('/api/services/catalog', {
      cache: 'force-cache',
      signal,
    });
    if (res.ok) {
      const json = (await res.json()) as ServiceCatalogPayload;
      if (Array.isArray(json.categories) && Array.isArray(json.trades)) {
        return json;
      }
    }
  } catch {
    /* fall through to bundled catalog */
  }
  return getServiceCatalog();
}

export async function createServiceRequest(
  input: CreateServiceRequestInput,
): Promise<{ id: string }> {
  const body = input.body.trim().slice(0, POST_CAPTION_MAX);
  if (!body) throw new Error('Describe what you need.');
  if (!input.site.address.trim()) throw new Error('Pick a service address.');

  const resolved = resolveServiceSelection(input.categoryId, input.tradeIds);
  if (!resolved) {
    throw new Error('Pick a service category and at least one trade.');
  }

  const kindMeta = buildServiceRequestMeta({
    category: { id: resolved.category.id, label: resolved.category.label },
    trades: resolved.trades,
    urgency: input.urgency,
    budget: input.budget,
  });

  const res = await fetch('/api/community/posts', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: body,
      mention_type_id: CATEGORY_UUID.marketplace,
      category_id: CATEGORY_UUID.marketplace,
      visibility: 'public',
      content_shape: 'standard',
      source: 'services_portal',
      map_data: {
        lat: input.site.lat,
        lng: input.site.lng,
        address: input.site.address.trim(),
      },
      kind_meta: kindMeta,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    id?: string;
    error?: string;
  };
  if (!res.ok || !json.id) {
    throw new Error(json.error ?? 'Could not post your request.');
  }
  return { id: json.id };
}

export async function fetchMyServiceRequests(
  signal?: AbortSignal,
): Promise<ServiceRequestRow[]> {
  const res = await fetch('/api/services/requests', {
    cache: 'no-store',
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(json.error ?? 'Could not load requests.');
  }
  const json = (await res.json()) as { requests?: ServiceRequestRow[] };
  return json.requests ?? [];
}
