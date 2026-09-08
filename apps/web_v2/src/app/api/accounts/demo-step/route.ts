import { NextResponse, type NextRequest } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const DEMO_STEPS_TOTAL = 10;

/**
 * POST /api/accounts/demo-step
 * Body: { step: number }
 *   - 1–5: how many steps have been completed (monotonic — never regresses)
 *   - 0:   explicit restart — always writes 0 so the map demo can replay
 *
 * Idempotent for forward steps; safe to call multiple times for the same step.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { step?: unknown } | null;
    const step = typeof body?.step === 'number' ? body.step : null;

    if (
      step === null ||
      !Number.isInteger(step) ||
      step < 0 ||
      step > DEMO_STEPS_TOTAL
    ) {
      return NextResponse.json(
        { error: `step must be an integer between 0 and ${DEMO_STEPS_TOTAL}` },
        { status: 400 },
      );
    }

    const supabase = await createSupabaseServerClient();

    // Explicit restart — always write 0 (bypasses the never-regress rule).
    if (step === 0) {
      const { data, error } = await supabase
        .from('accounts')
        .update({ account_demo_steps: 0 })
        .eq('id', session.accountId)
        .eq('user_id', session.userId)
        .select('id, account_demo_steps')
        .single();

      if (error || !data) {
        console.error('demo-step restart', error?.message);
        return NextResponse.json({ error: 'Failed to restart demo' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        account_demo_steps: data.account_demo_steps ?? 0,
      });
    }

    // Read current value first so we never regress on forward progress.
    const { data: current } = await supabase
      .from('accounts')
      .select('account_demo_steps')
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .single();

    const currentSteps = (current?.account_demo_steps as number | null) ?? 0;
    if (step <= currentSteps) {
      // Already at or past this step — no-op, return current value.
      return NextResponse.json({ success: true, account_demo_steps: currentSteps });
    }

    const { data, error } = await supabase
      .from('accounts')
      .update({ account_demo_steps: step })
      .eq('id', session.accountId)
      .eq('user_id', session.userId)
      .select('id, account_demo_steps')
      .single();

    if (error || !data) {
      console.error('demo-step update', error?.message);
      return NextResponse.json({ error: 'Failed to save demo step' }, { status: 500 });
    }

    return NextResponse.json({ success: true, account_demo_steps: data.account_demo_steps });
  } catch (err) {
    console.error('demo-step', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
