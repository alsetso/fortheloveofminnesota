import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';

const querySchema = z.object({
  districtId: z.string().uuid(),
});

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

      const { districtId } = validation.data;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schools, error } = await supabase
        .schema('atlas' as any)
        .from('schools' as any)
        .select('id, name, slug')
        .eq('district_id', districtId)
        .order('name');

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      const typedSchools = (schools ?? []) as { id: string; name: string; slug: string }[];
      const schoolIds = typedSchools.map((s) => s.id);

      let integrations: { school_id: string; config: Record<string, unknown>; enabled: boolean }[] = [];
      if (schoolIds.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: integRows } = await supabase
          .schema('atlas' as any)
          .from('school_integrations' as any)
          .select('school_id, config, enabled')
          .eq('provider', 'nutrislice')
          .in('school_id', schoolIds);

        integrations = (integRows ?? []) as typeof integrations;
      }

      const integMap = new Map(integrations.map((i) => [i.school_id, i]));

      const result = typedSchools.map((s) => {
        const integ = integMap.get(s.id);
        return {
          id: s.id,
          name: s.name,
          slug: s.slug,
          nutrislice_connected: integ ? integ.enabled : false,
          nutrislice_config: integ ? integ.config : null,
        };
      });

      return NextResponse.json(result);
    },
    { requireAuth: true, rateLimit: 'public' },
  );
}
