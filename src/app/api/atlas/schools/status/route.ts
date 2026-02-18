import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const updateSchema = z.object({
  school_id: z.string().uuid(),
  status: z.enum(['listed', 'setup', 'published']),
});

export async function PATCH(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const body = await req.json();
      const parsed = updateSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { school_id, status } = parsed.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await supabase
        .schema('atlas' as any)
        .from('schools' as any)
        .update({ status })
        .eq('id', school_id)
        .select('id, status')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    },
    { requireAdmin: true, rateLimit: 'public' }
  );
}
