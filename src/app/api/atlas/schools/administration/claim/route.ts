import { NextRequest, NextResponse } from 'next/server';
import { withSecurity } from '@/lib/security/middleware';
import { z } from 'zod';

const claimSchema = z.object({
  staff_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req) => {
      const body = await req.json();
      const parsed = claimSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
      }

      const { staff_id } = parsed.data;
      const { createSupabaseClient } = await import('@/lib/supabase/unified');
      const supabase = await createSupabaseClient({ service: true });

      const { data: { user } } = await supabase.auth.getUser(
        req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
      );
      if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

      const { data: accountRow } = await supabase
        .from('accounts')
        .select('email')
        .eq('user_id', user.id)
        .single();
      const account = accountRow as { email: string | null } | null;
      if (!account?.email) return NextResponse.json({ error: 'No account email' }, { status: 400 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const atlas = supabase.schema('atlas' as any);

      const { data: staffRow } = await atlas
        .from('school_administration' as any)
        .select('id, email, claimed_by')
        .eq('id', staff_id)
        .single();
      const staff = staffRow as { id: string; email: string | null; claimed_by: string | null } | null;

      if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 404 });
      if (staff.claimed_by) return NextResponse.json({ error: 'Already claimed' }, { status: 409 });
      if (staff.email?.toLowerCase() !== account.email.toLowerCase()) {
        return NextResponse.json({ error: 'Email does not match staff record' }, { status: 403 });
      }

      const { data: updated, error } = await atlas
        .from('school_administration' as any)
        .update({ claimed_by: user.id })
        .eq('id', staff_id)
        .is('claimed_by', null)
        .select('id, name, role, claimed_by')
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(updated);
    },
    { requireAuth: true, rateLimit: 'public' }
  );
}
