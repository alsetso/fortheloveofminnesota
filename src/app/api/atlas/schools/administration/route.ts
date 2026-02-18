import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';
import { commonSchemas } from '@/lib/security/validation';
import { validateQueryParams } from '@/lib/security/validation';

const querySchema = z.object({
  school_id: commonSchemas.uuid,
});

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
        .from('school_administration' as any)
        .select('id, name, role, photo_url, phone, directory_number, email, bio, sort_order, claimed_by')
        .eq('school_id', school_id)
        .order('sort_order', { ascending: true });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    },
    { rateLimit: 'public', requireAuth: false }
  );
}
