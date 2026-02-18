import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const querySchema = z.object({
  subdomain: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/i),
});

interface NutrisliceMenuType {
  name: string;
  slug: string;
}

interface NutrisliceSchool {
  name: string;
  slug: string;
  active_menu_types: NutrisliceMenuType[];
  address?: string;
  geolocation?: { latitude: number; longitude: number } | null;
  logo?: string;
  operating_status?: string;
}

interface DiscoveredSchool {
  nutrislice_name: string;
  nutrislice_slug: string;
  menu_types: { lunch: string | null; breakfast: string | null };
  address: string | null;
  logo: string | null;
}

function classifyMenuTypes(types: NutrisliceMenuType[]): { lunch: string | null; breakfast: string | null } {
  let lunch: string | null = null;
  let breakfast: string | null = null;

  for (const t of types) {
    const lower = t.slug.toLowerCase();
    if (!lunch && lower.includes('lunch')) lunch = t.slug;
    if (!breakfast && lower.includes('breakfast')) breakfast = t.slug;
  }

  return { lunch, breakfast };
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      if (!ctx.accountId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });
      const { data: account } = await supabase
        .from('accounts')
        .select('role')
        .eq('id', ctx.accountId)
        .single();

      if ((account as { role: string } | null)?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;

      const { subdomain } = validation.data;
      const nutrisliceUrl = `https://${subdomain}.api.nutrislice.com/menu/api/schools/?format=json`;

      try {
        const upstream = await fetch(nutrisliceUrl, {
          headers: { Accept: 'application/json' },
          next: { revalidate: 300 },
        });

        if (!upstream.ok) {
          return NextResponse.json(
            { error: `Nutrislice returned ${upstream.status}` },
            { status: 502 },
          );
        }

        const raw: NutrisliceSchool[] = await upstream.json();

        const schools: DiscoveredSchool[] = raw.map((s) => ({
          nutrislice_name: s.name,
          nutrislice_slug: s.slug,
          menu_types: classifyMenuTypes(s.active_menu_types ?? []),
          address: s.address ?? null,
          logo: s.logo ?? null,
        }));

        return NextResponse.json(schools);
      } catch {
        return NextResponse.json(
          { error: 'Failed to reach Nutrislice API' },
          { status: 502 },
        );
      }
    },
    { requireAuth: true, rateLimit: 'public' },
  );
}
