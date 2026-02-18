import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const patchSchema = z.object({
  enabled: z.boolean().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

interface IntegrationLookupRow {
  id: string;
  school_id: string;
}

interface AccountRow {
  role: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const { id } = await params;
      if (!z.string().uuid().safeParse(id).success) {
        return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
      }

      const body = await req.json();
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const updates = parsed.data;
      if (updates.enabled === undefined && updates.config === undefined) {
        return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: row } = await supabase
        .schema('atlas' as any)
        .from('school_integrations' as any)
        .select('id, school_id')
        .eq('id', id)
        .single();

      if (!row) {
        return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
      }

      const { school_id } = row as IntegrationLookupRow;

      if (!ctx.userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      let isPlatformAdmin = false;
      if (ctx.accountId) {
        const { data: account } = await supabase
          .from('accounts')
          .select('role')
          .eq('id', ctx.accountId)
          .single();
        if ((account as AccountRow | null)?.role === 'admin') isPlatformAdmin = true;
      }

      if (!isPlatformAdmin) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: staffRows } = await supabase
          .schema('atlas' as any)
          .from('school_administration' as any)
          .select('id')
          .eq('school_id', school_id)
          .eq('claimed_by', ctx.userId)
          .limit(1);
        if (!Array.isArray(staffRows) || staffRows.length === 0) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
      }

      const patch: Record<string, unknown> = {};
      if (updates.enabled !== undefined) patch.enabled = updates.enabled;
      if (updates.config !== undefined) patch.config = updates.config;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .schema('atlas' as any)
        .from('school_integrations' as any)
        .update(patch)
        .eq('id', id)
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
