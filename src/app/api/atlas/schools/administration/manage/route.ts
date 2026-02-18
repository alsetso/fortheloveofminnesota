import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  school_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  photo_url: z.string().url().nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  directory_number: z.string().max(20).nullable().optional(),
  email: z.string().email().nullable().optional(),
  bio: z.string().max(5000).nullable().optional(),
  sort_order: z.number().int().min(0).max(999).optional(),
});

const deleteSchema = z.object({
  id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const body = await req.json();
      const parsed = upsertSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { id, school_id, ...fields } = parsed.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      if (id) {
        const { data, error } = await atlas
          .from('school_administration' as any)
          .update(fields)
          .eq('id', id)
          .eq('school_id', school_id)
          .select()
          .single();
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json(data);
      }

      const { data, error } = await atlas
        .from('school_administration' as any)
        .insert({ school_id, ...fields })
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data);
    },
    { requireAdmin: true, rateLimit: 'public' }
  );
}

export async function DELETE(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const body = await req.json();
      const parsed = deleteSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await supabase
        .schema('atlas' as any)
        .from('school_administration' as any)
        .delete()
        .eq('id', parsed.data.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    },
    { requireAdmin: true, rateLimit: 'public' }
  );
}
