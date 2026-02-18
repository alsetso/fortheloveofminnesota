import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';
import { commonSchemas, validateQueryParams } from '@/lib/security/validation';

const toggleSchema = z.object({
  school_id: z.string().uuid(),
});

const querySchema = z.object({
  school_id: commonSchemas.uuid.optional(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const body = await req.json();
      const parsed = toggleSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { school_id } = parsed.data;
      const userId = ctx.userId!;

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      const { data: existing } = await atlas
        .from('school_follows' as any)
        .select('user_id')
        .eq('user_id', userId)
        .eq('school_id', school_id)
        .maybeSingle();

      if (existing) {
        await atlas
          .from('school_follows' as any)
          .delete()
          .eq('user_id', userId)
          .eq('school_id', school_id);

        return NextResponse.json({ following: false });
      }

      const { error } = await atlas
        .from('school_follows' as any)
        .insert({ user_id: userId, school_id });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ following: true }, { status: 201 });
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;

      const userId = ctx.userId;
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);
      const schoolId = validation.data.school_id;

      if (schoolId) {
        const { data } = await atlas
          .from('school_follows' as any)
          .select('user_id')
          .eq('user_id', userId)
          .eq('school_id', schoolId)
          .maybeSingle();

        return NextResponse.json({ following: !!data });
      }

      const { data, error } = await atlas
        .from('school_follows' as any)
        .select('school_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}
