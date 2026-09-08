import { readAttrsFoundation } from '@/lib/ai/unitProfileFacts';
import { createTerritoryServerClient } from '@/lib/supabase/territoryDb';

export type TerritoryUnitProfile = {
  id: string;
  name: string;
  kind: string;
  subtype: string | null;
  description: string | null;
  website_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  attrs: Record<string, unknown>;
};

export type TerritorySeatHolder = {
  seat_type: string;
  title: string;
  sub_label: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  website_url: string | null;
};

export async function loadTerritoryUnitContext(unitId: string): Promise<{
  unit: TerritoryUnitProfile | null;
  holders: TerritorySeatHolder[];
}> {
  const db = createTerritoryServerClient();
  const { data: unit } = await db
    .from('units')
    .select(
      'id, name, kind, subtype, description, website_url, contact_email, contact_phone, attrs',
    )
    .eq('id', unitId)
    .maybeSingle();

  if (!unit) return { unit: null, holders: [] };

  const { data: seats } = await db
    .from('seats')
    .select('id, seat_type, title, sub_label')
    .eq('unit_id', unitId)
    .eq('is_active', true);

  const seatRows = seats ?? [];
  const seatIds = seatRows.map((s) => s.id as string);
  let holders: TerritorySeatHolder[] = [];

  if (seatIds.length > 0) {
    const { data: officeholders } = await db
      .from('officeholders')
      .select('seat_id, full_name, email, phone, website_url, is_current')
      .in('seat_id', seatIds)
      .eq('is_current', true);

    const bySeat = new Map(
      (officeholders ?? []).map((h) => [h.seat_id as string, h]),
    );
    holders = seatRows.map((s) => {
      const h = bySeat.get(s.id as string);
      return {
        seat_type: s.seat_type as string,
        title: s.title as string,
        sub_label: (s.sub_label as string | null) ?? null,
        full_name: (h?.full_name as string | null) ?? null,
        email: (h?.email as string | null) ?? null,
        phone: (h?.phone as string | null) ?? null,
        website_url: (h?.website_url as string | null) ?? null,
      };
    });
  }

  return {
    unit: {
      id: unit.id as string,
      name: unit.name as string,
      kind: unit.kind as string,
      subtype: (unit.subtype as string | null) ?? null,
      description: (unit.description as string | null) ?? null,
      website_url: (unit.website_url as string | null) ?? null,
      contact_email: (unit.contact_email as string | null) ?? null,
      contact_phone: (unit.contact_phone as string | null) ?? null,
      attrs: (unit.attrs as Record<string, unknown>) ?? {},
    },
    holders,
  };
}

/** Deterministic localhost answer from seats + profile (no model required). */
export function buildTerritoryLocalAnswer(
  unit: TerritoryUnitProfile,
  holders: TerritorySeatHolder[],
  userMessage: string,
): string {
  const q = userMessage.toLowerCase();
  const lines: string[] = [];

  const wantsPeople =
    /who|runs|mayor|commissioner|senator|representative|council|board|office|holder|official/.test(
      q,
    ) || q.trim().length < 4;
  const wantsProfile =
    /about|description|website|email|phone|contact|site|overview|population|feature/.test(
      q,
    );

  if (wantsPeople || !wantsProfile) {
    const named = holders.filter((h) => h.full_name?.trim());
    if (named.length === 0) {
      lines.push(
        `I don’t have current officeholders on file for ${unit.name} yet. You can add them from the Seats section, or propose a person here.`,
      );
    } else {
      lines.push(`Here’s who we have for ${unit.name}:`);
      for (const h of named) {
        const seat = [h.title, h.sub_label].filter(Boolean).join(' · ');
        lines.push(`• ${h.full_name} — ${seat}`);
      }
      const vacant = holders.filter((h) => !h.full_name?.trim());
      if (vacant.length > 0) {
        lines.push(
          `${vacant.length} seat${vacant.length === 1 ? '' : 's'} still vacant in our data.`,
        );
      }
    }
  }

  if (wantsProfile || lines.length === 0) {
    const foundation = readAttrsFoundation(unit.attrs ?? {});
    const bits: string[] = [];
    if (unit.description?.trim()) bits.push(unit.description.trim());
    if (unit.website_url?.trim()) bits.push(`Website: ${unit.website_url.trim()}`);
    if (unit.contact_email?.trim()) bits.push(`Email: ${unit.contact_email.trim()}`);
    if (unit.contact_phone?.trim()) bits.push(`Phone: ${unit.contact_phone.trim()}`);
    if (foundation.population != null) {
      bits.push(`Population: ${foundation.population.toLocaleString()}`);
    }
    if (foundation.features.best?.length) {
      bits.push(`Best: ${foundation.features.best.join('; ')}`);
    }
    if (foundation.features.worst?.length) {
      bits.push(`Challenges: ${foundation.features.worst.join('; ')}`);
    }
    if (bits.length === 0) {
      lines.push(
        `No public profile yet for ${unit.name} (description, website, email). Suggest updates and we can store them on this unit.`,
      );
    } else {
      lines.push(`Profile for ${unit.name}:`, ...bits.map((b) => `• ${b}`));
    }
  }

  return lines.join('\n');
}
