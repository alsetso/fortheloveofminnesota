import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';
import { commonSchemas, validateQueryParams } from '@/lib/security/validation';

const joinSchema = z.object({
  school_id: z.string().uuid(),
  role: z.enum(['parent', 'student', 'teacher', 'staff', 'admin']),
});

const querySchema = z.object({
  school_id: commonSchemas.uuid,
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, ctx) => {
      const body = await req.json();
      const parsed = joinSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { school_id, role } = parsed.data;
      const userId = ctx.userId!;

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      const { data: existing } = await atlas
        .from('school_members' as any)
        .select('id, status')
        .eq('school_id', school_id)
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(existing);
      }

      const { data, error } = await atlas
        .from('school_members' as any)
        .insert({ school_id, user_id: userId, role, status: 'pending' })
        .select('id, role, status, created_at')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}

export async function GET(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const url = new URL(req.url);
      const validation = validateQueryParams(url.searchParams, querySchema);
      if (!validation.success) return validation.error;

      const { school_id } = validation.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .schema('atlas' as any)
        .from('school_members' as any)
        .select('id, user_id, role, status, created_at')
        .eq('school_id', school_id)
        .order('created_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
