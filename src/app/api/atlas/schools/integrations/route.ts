import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { validateQueryParams } from '@/lib/security/validation';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';

const getSchema = z.object({
  schoolSlug: commonSchemas.slug,
});

const postSchema = z.object({
  schoolSlug: z.string().min(3).max(100),
  provider: z.string().min(1).max(50),
  config: z.record(z.string(), z.unknown()),
});

interface SchoolIntegrationRow {
  id: string;
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface DistrictIntegrationRow {
  provider: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

interface IntegrationsGetResponse {
  school: SchoolIntegrationRow[];
  district: DistrictIntegrationRow[];
}

async function resolveSchool(supabase: Awaited<ReturnType<typeof import('@/lib/supabase/unified').createSupabaseClient>>, slug: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .schema('atlas' as any)
    .from('schools' as any)
    .select('id, district_id')
    .eq('slug', slug)
    .single();
  return data as { id: string; district_id: string } | null;
}

async function canManage(
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/unified').createSupabaseClient>>,
  schoolId: string,
  userId: string | undefined,
  accountId: string | undefined,
): Promise<boolean> {
  if (!userId) return false;

  if (accountId) {
    const { data: account } = await supabase
      .from('accounts')
      .select('role')
      .eq('id', accountId)
      .single();
    if ((account as { role: string } | null)?.role === 'admin') return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await supabase
    .schema('atlas' as any)
    .from('school_administration' as any)
    .select('id')
    .eq('school_id', schoolId)
    .eq('claimed_by', userId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, getSchema);
      if (!validation.success) return validation.error;

      const { schoolSlug } = validation.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      const school = await resolveSchool(supabase, schoolSlug);
      if (!school) {
        return NextResponse.json({ school: [], district: [] });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: schoolRows } = await supabase
        .schema('atlas' as any)
        .from('school_integrations' as any)
        .select('id, provider, config, enabled')
        .eq('school_id', school.id);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: districtRows } = await supabase
        .schema('atlas' as any)
        .from('district_integrations' as any)
        .select('provider, config, enabled')
        .eq('district_id', school.district_id);

      const response: IntegrationsGetResponse = {
        school: (schoolRows ?? []) as SchoolIntegrationRow[],
        district: (districtRows ?? []) as DistrictIntegrationRow[],
      };

      return NextResponse.json(response);
    },
    { rateLimit: 'public', requireAuth: false },
  );
}

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const body = await req.json();
      const parsed = postSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { schoolSlug, provider, config } = parsed.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      const school = await resolveSchool(supabase, schoolSlug);
      if (!school) {
        return NextResponse.json({ error: 'School not found' }, { status: 404 });
      }

      const allowed = await canManage(supabase, school.id, ctx.userId, ctx.accountId);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .schema('atlas' as any)
        .from('school_integrations' as any)
        .upsert(
          { school_id: school.id, provider, config, enabled: true },
          { onConflict: 'school_id,provider' },
        )
        .select('id, provider, config, enabled')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    },
    { requireAuth: true, rateLimit: 'public' },
  );
}
