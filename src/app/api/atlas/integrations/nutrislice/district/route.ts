import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const getSchema = z.object({
  provider: z.string().default('nutrislice'),
  all: z.enum(['true', 'false']).default('false'),
});

const postSchema = z.object({
  districtId: z.string().uuid(),
  subdomain: z
    .string()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/i),
});

async function requirePlatformAdmin(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/unified').createSupabaseClient>>,
  accountId: string | undefined,
): Promise<boolean> {
  if (!accountId) return false;
  const { data: account } = await supabase
    .from('accounts')
    .select('role')
    .eq('id', accountId)
    .single();
  return (account as { role: string } | null)?.role === 'admin';
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      if (!(await requirePlatformAdmin(supabase, ctx.accountId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, getSchema);
      if (!validation.success) return validation.error;

      if (validation.data.all === 'true') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: allDistricts, error: dErr } = await supabase
          .schema('atlas' as any)
          .from('districts' as any)
          .select('id, name')
          .order('name');
        if (dErr) {
          return NextResponse.json({ error: dErr.message }, { status: 500 });
        }
        return NextResponse.json(allDistricts ?? []);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: rows, error } = await supabase
        .schema('atlas' as any)
        .from('district_integrations' as any)
        .select('id, district_id, provider, config, enabled')
        .eq('provider', validation.data.provider)
        .eq('enabled', true);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const districtIds = (rows ?? []).map((r: { district_id: string }) => r.district_id);

      let districts: { id: string; name: string }[] = [];
      if (districtIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: districtRows } = await supabase
          .schema('atlas' as any)
          .from('districts' as any)
          .select('id, name')
          .in('id', districtIds)
          .order('name');
        districts = (districtRows ?? []) as typeof districts;
      }

      const districtMap = new Map(districts.map((d) => [d.id, d]));

      const result = (rows ?? []).map((r: { id: string; district_id: string; config: Record<string, unknown>; enabled: boolean }) => ({
        id: r.id,
        district_id: r.district_id,
        district_name: districtMap.get(r.district_id)?.name ?? 'Unknown',
        config: r.config,
        enabled: r.enabled,
      }));

      return NextResponse.json(result);
    },
    { requireAuth: true, rateLimit: 'public' },
  );
}

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      if (!(await requirePlatformAdmin(supabase, ctx.accountId))) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      const body = await req.json();
      const parsed = postSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { districtId, subdomain } = parsed.data;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: district } = await supabase
        .schema('atlas' as any)
        .from('districts' as any)
        .select('id')
        .eq('id', districtId)
        .single();

      if (!district) {
        return NextResponse.json({ error: 'District not found' }, { status: 404 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .schema('atlas' as any)
        .from('district_integrations' as any)
        .upsert(
          { district_id: districtId, provider: 'nutrislice', config: { subdomain }, enabled: true },
          { onConflict: 'district_id,provider' },
        )
        .select('id, district_id, config, enabled')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    },
    { requireAuth: true, rateLimit: 'public' },
  );
}
