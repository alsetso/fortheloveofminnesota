import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  REPORT_REASONS,
  type ReportReason,
} from '@/features/community/reportReasons';

type RouteCtx = { params: Promise<{ id: string }> };

function isReportReason(v: unknown): v is ReportReason {
  return typeof v === 'string' && (REPORT_REASONS as readonly string[]).includes(v);
}

/**
 * POST /api/community/posts/[id]/report
 * Submit a content report. Idempotent — one report per account per post; no withdraw.
 */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { id: postId } = await ctx.params;
    if (!postId) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      reason?: unknown;
      details?: unknown;
    };
    if (!isReportReason(body.reason)) {
      return NextResponse.json({ error: 'Choose a reason' }, { status: 400 });
    }
    const reason = body.reason;
    const detailsRaw =
      typeof body.details === 'string' ? body.details.trim().slice(0, 500) : '';
    const details =
      reason === 'other' && detailsRaw.length > 0 ? detailsRaw : null;

    const supabase = await createSupabaseServerClient();

    const { data: post, error: postErr } = await supabase
      .schema('community')
      .from('posts')
      .select('id, account_id, is_active, visibility, archived')
      .eq('id', postId)
      .eq('is_active', true)
      .maybeSingle();

    if (postErr || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.archived || post.visibility !== 'public') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    if (post.account_id && post.account_id === session.accountId) {
      return NextResponse.json({ error: 'You can’t report your own post' }, { status: 400 });
    }

    // Already reported — treat as success, never allow withdraw/re-submit.
    const { data: existing } = await supabase
      .schema('community')
      .from('content_reports')
      .select('id')
      .eq('reporter_account_id', session.accountId)
      .eq('entity_type', 'community_post')
      .eq('entity_id', postId)
      .maybeSingle();

    if (existing?.id) {
      return NextResponse.json({ reported: true, already_reported: true });
    }

    const { error: insertErr } = await supabase
      .schema('community')
      .from('content_reports')
      .insert({
        reporter_account_id: session.accountId,
        entity_type: 'community_post',
        entity_id: postId,
        reason,
        details,
        status: 'open',
      });

    if (insertErr) {
      // Unique race — another request won; still reported.
      if (insertErr.code === '23505') {
        return NextResponse.json({ reported: true, already_reported: true });
      }
      console.error('[community/posts/id/report POST]', insertErr);
      return NextResponse.json({ error: insertErr.message }, { status: 400 });
    }

    return NextResponse.json({ reported: true, already_reported: false });
  } catch (e) {
    console.error('[community/posts/id/report POST]', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
