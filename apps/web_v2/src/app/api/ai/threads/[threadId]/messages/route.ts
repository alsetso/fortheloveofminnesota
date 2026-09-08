import { NextResponse } from 'next/server';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { resolveAiAccess } from '@/lib/ai/requireAiAccess';
import {
  CHAT_ATTACHMENT_MAX_COUNT,
  chatAttachmentKind,
  type ChatAttachment,
} from '@/lib/ai/chatAttachments';
import { loadTerritoryUnitContext } from '@/lib/ai/resolveTerritoryAnswer';
import { parseAnswerMode, type AnswerMode } from '@/lib/ai/answerModes';
import {
  runSubjectResponsesStream,
  type SubjectResponsesResult,
} from '@/lib/ai/runSubjectResponses';
import type { ChatMessageStreamEvent } from '@/lib/ai/subjectResponseMilestones';
import { isUuid, SUBJECT_TYPE_TERRITORY_UNIT } from '@/lib/ai/subjectTypes';
import {
  detectPlaceAiTool,
  isPlaceAiTool,
  type PlaceAiTool,
} from '@/lib/ai/placeAiTools';
import {
  buildFoundationCompareRows,
  extractUnitFoundationFromAnswer,
} from '@/lib/ai/unitProfileFacts';
import {
  buildSeatsCompareCards,
  extractSeatsFromAnswer,
} from '@/lib/ai/unitSeatsFacts';
import { createAiServerClient } from '@/lib/supabase/aiDb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/ai/threads/[threadId]/messages
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { threadId } = await params;
    if (!isUuid(threadId)) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const ai = createAiServerClient();
    const { data: thread, error: threadErr } = await ai
      .from('subject_threads')
      .select('id, account_id, subject_type, subject_id, title')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: messages, error } = await ai
      .from('subject_messages')
      .select('id, role, content, meta, created_at')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      thread: {
        id: thread.id,
        title: thread.title,
        subject_type: thread.subject_type,
        subject_id: thread.subject_id,
      },
      messages: messages ?? [],
    });
  } catch (err) {
    console.error('[ai/threads messages GET]', err);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

type PostBody = {
  content?: string;
  /** Focused Place AI tool for this turn. */
  tool?: PlaceAiTool;
  /** Answer mode — server maps to model + reasoning. */
  mode?: AnswerMode;
  /** `ai.ai_media` ids already uploaded for this account. */
  attachment_ids?: string[];
};

type ThreadRow = {
  id: string;
  account_id: string;
  subject_type: string;
  subject_id: string;
  title: string | null;
  meta: unknown;
};

function sseEncode(event: ChatMessageStreamEvent): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * POST — SSE stream: user → milestones → done | error.
 * Early validation still returns JSON.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  try {
    const access = await resolveAiAccess();
    if (access.mode === 'comingSoon') return access.response;

    const session = await getSessionAccount();
    if (!session) {
      return NextResponse.json({ error: 'Sign in required' }, { status: 401 });
    }

    const { threadId } = await params;
    if (!isUuid(threadId)) {
      return NextResponse.json({ error: 'Invalid thread id' }, { status: 400 });
    }

    const body = (await request.json().catch(() => ({}))) as PostBody;
    const content = body.content?.trim() ?? '';
    const attachmentIds = Array.isArray(body.attachment_ids)
      ? body.attachment_ids.filter((id): id is string => typeof id === 'string' && isUuid(id))
      : [];

    if (attachmentIds.length > CHAT_ATTACHMENT_MAX_COUNT) {
      return NextResponse.json(
        { error: `At most ${CHAT_ATTACHMENT_MAX_COUNT} attachments` },
        { status: 400 },
      );
    }
    if (!content && attachmentIds.length === 0) {
      return NextResponse.json({ error: 'content or attachments required' }, { status: 400 });
    }

    const placeTool: PlaceAiTool = isPlaceAiTool(body.tool)
      ? body.tool
      : detectPlaceAiTool(content || 'chat');
    const answerMode = parseAnswerMode(body.mode);

    const ai = createAiServerClient();
    const { data: thread, error: threadErr } = await ai
      .from('subject_threads')
      .select('id, account_id, subject_type, subject_id, title, meta')
      .eq('id', threadId)
      .maybeSingle();

    if (threadErr || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    if (thread.account_id !== session.accountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let attachments: ChatAttachment[] = [];
    if (attachmentIds.length > 0) {
      const { data: mediaRows, error: mediaErr } = await ai
        .from('ai_media')
        .select('id, public_url, mime_type, original_name, file_size, account_id, message_id')
        .in('id', attachmentIds)
        .eq('account_id', session.accountId);

      if (mediaErr) {
        return NextResponse.json({ error: mediaErr.message }, { status: 500 });
      }
      if (!mediaRows || mediaRows.length !== attachmentIds.length) {
        return NextResponse.json({ error: 'Attachment not found' }, { status: 400 });
      }
      if (mediaRows.some((m) => m.message_id)) {
        return NextResponse.json({ error: 'Attachment already used' }, { status: 400 });
      }

      const mapped = mediaRows.map((m) => ({
        id: m.id as string,
        public_url: m.public_url as string,
        mime_type: String(m.mime_type ?? ''),
        original_name: (m.original_name as string | null) ?? null,
        file_size: (m.file_size as number | null) ?? null,
        kind: chatAttachmentKind(String(m.mime_type ?? '')),
      }));
      const byId = new Map(mapped.map((a) => [a.id, a]));
      attachments = attachmentIds
        .map((id) => byId.get(id))
        .filter((a): a is ChatAttachment => Boolean(a));
    }

    const messageContent =
      content ||
      (attachments.length > 0
        ? attachments.map((a) => a.original_name || a.kind).join(', ')
        : '');

    const { data: userMsg, error: userErr } = await ai
      .from('subject_messages')
      .insert({
        thread_id: threadId,
        role: 'user',
        content: messageContent,
        meta: {
          source: 'subject-responses',
          place_tool: placeTool,
          answer_mode: answerMode,
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((a) => ({
                  id: a.id,
                  public_url: a.public_url,
                  mime_type: a.mime_type,
                  original_name: a.original_name,
                  file_size: a.file_size,
                  kind: a.kind,
                })),
              }
            : {}),
        },
      })
      .select('id, role, content, meta, created_at')
      .single();

    if (userErr || !userMsg) {
      return NextResponse.json(
        { error: userErr?.message ?? 'Failed to save message' },
        { status: 500 },
      );
    }

    if (attachments.length > 0) {
      const { error: linkErr } = await ai
        .from('ai_media')
        .update({ message_id: userMsg.id, thread_id: threadId })
        .in(
          'id',
          attachments.map((a) => a.id),
        )
        .eq('account_id', session.accountId);
      if (linkErr) console.error('[ai/threads link media]', linkErr);
    }

    const threadMeta = (thread.meta ?? {}) as Record<string, unknown>;
    const previousResponseId =
      typeof threadMeta.last_response_id === 'string' ? threadMeta.last_response_id : null;

    const accountId = session.accountId;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ChatMessageStreamEvent) => {
          controller.enqueue(sseEncode(event));
        };

        try {
          send({
            type: 'user',
            userMessage: {
              id: userMsg.id as string,
              role: userMsg.role as string,
              content: userMsg.content as string,
              created_at: userMsg.created_at as string,
              meta: (userMsg.meta ?? null) as Record<string, unknown> | null,
            },
          });

          const result = await runSubjectResponsesStream(
            {
              subjectType: thread.subject_type as string,
              subjectId: thread.subject_id as string,
              userMessage: content,
              attachments,
              previousResponseId,
              placeTool,
              mode: answerMode,
            },
            {
              onMilestone: (m) =>
                send({
                  type: 'milestone',
                  id: m.id,
                  label: m.label,
                  detail: m.detail,
                  at: m.at,
                }),
            },
          );

          const saved = await persistAssistantTurn({
            ai,
            thread: thread as ThreadRow,
            threadId,
            threadMeta,
            placeTool,
            answerMode,
            content,
            attachments,
            userMsgId: userMsg.id as string,
            accountId,
            result,
          });

          if (!saved.ok) {
            send({ type: 'error', error: saved.error });
            return;
          }

          send({
            type: 'done',
            assistantMessage: saved.assistantMessage,
            usage: {
              input_tokens: result.input_tokens,
              output_tokens: result.output_tokens,
              total_tokens: result.total_tokens,
              reasoning_tokens: result.reasoning_tokens,
              cached_tokens: result.cached_tokens,
              cache_write_tokens: result.cache_write_tokens,
              web_search_used: result.web_search_used,
              resolver: result.resolver,
            },
          });
        } catch (err) {
          console.error('[ai/threads messages POST stream]', err);
          send({ type: 'error', error: 'Failed to send message' });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    console.error('[ai/threads messages POST]', err);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

async function persistAssistantTurn(opts: {
  ai: ReturnType<typeof createAiServerClient>;
  thread: ThreadRow;
  threadId: string;
  threadMeta: Record<string, unknown>;
  placeTool: PlaceAiTool;
  answerMode: AnswerMode;
  content: string;
  attachments: ChatAttachment[];
  userMsgId: string;
  accountId: string;
  result: SubjectResponsesResult;
}): Promise<
  | {
      ok: true;
      assistantMessage: {
        id: string;
        role: string;
        content: string;
        created_at: string;
        meta?: Record<string, unknown> | null;
      };
    }
  | { ok: false; error: string }
> {
  const {
    ai,
    thread,
    threadId,
    threadMeta,
    placeTool,
    answerMode,
    content,
    attachments,
    userMsgId,
    accountId,
    result,
  } = opts;

  const citationUrls = result.citations.map((c) => c.url);
  let displayAnswer = result.answer;
  let foundationMeta: Record<string, unknown> | null = null;
  let seatsMeta: Record<string, unknown> | null = null;

  if (thread.subject_type === SUBJECT_TYPE_TERRITORY_UNIT) {
    const { cleanAnswer: seatsStripped, proposals, fromBlock: seatsFromBlock } =
      extractSeatsFromAnswer(result.answer);

    const wantAbout = placeTool === 'fill_about' || placeTool === 'chat';
    const wantSeats = placeTool === 'fill_officials' || placeTool === 'chat';
    const allowAboutHeuristics = placeTool === 'fill_about';

    const { cleanAnswer, facts, fromBlock } = extractUnitFoundationFromAnswer(
      seatsStripped,
      citationUrls,
      { allowHeuristics: allowAboutHeuristics },
    );
    displayAnswer = cleanAnswer || seatsStripped || result.answer;

    const { unit, holders } = await loadTerritoryUnitContext(thread.subject_id);
    if (unit) {
      if (wantAbout && (placeTool === 'fill_about' || fromBlock)) {
        const rows = buildFoundationCompareRows(unit, facts);
        if (rows.length > 0) {
          foundationMeta = {
            from_block: fromBlock,
            applied: false,
            status: 'pending',
            labels: rows.map((r) => r.label),
            proposal_ids: [],
            rows,
            source_urls: facts.source_urls.slice(0, 8),
            place_tool: placeTool,
          };
        }
      }

      if (wantSeats && (placeTool === 'fill_officials' || seatsFromBlock) && proposals.length > 0) {
        const cards = buildSeatsCompareCards(holders, proposals);
        if (cards.length > 0) {
          seatsMeta = {
            from_block: seatsFromBlock,
            applied: false,
            status: 'pending',
            cards,
            place_tool: placeTool,
          };
        }
      }
    }
  }

  const resolvedMode = result.mode ?? answerMode;
  const assistantMeta: Record<string, unknown> = {
    source: 'subject-responses',
    place_tool: placeTool,
    answer_mode: resolvedMode,
    resolver: result.resolver,
    model: result.model,
    openai_response_id: result.openai_response_id,
    input_tokens: result.input_tokens,
    output_tokens: result.output_tokens,
    total_tokens: result.total_tokens,
    reasoning_tokens: result.reasoning_tokens,
    cached_tokens: result.cached_tokens,
    cache_write_tokens: result.cache_write_tokens,
    duration_ms: result.duration_ms,
    web_search_used: result.web_search_used,
    web_search_call_count: result.web_search_call_count,
    citations: result.citations,
    reasoning_summary: result.reasoning_summary,
    milestones: result.milestones,
    ...(foundationMeta ? { foundation: foundationMeta } : {}),
    ...(seatsMeta ? { seats: seatsMeta } : {}),
  };

  const { data: assistantMsg, error: asstErr } = await ai
    .from('subject_messages')
    .insert({
      thread_id: threadId,
      role: 'assistant',
      content: displayAnswer,
      meta: assistantMeta,
    })
    .select('id, role, content, meta, created_at')
    .single();

  if (asstErr || !assistantMsg) {
    return { ok: false, error: asstErr?.message ?? 'Failed to save reply' };
  }

  if (result.citations.length > 0) {
    const rows = result.citations.map((c) => ({
      subject_type: thread.subject_type,
      subject_id: thread.subject_id,
      url: c.url,
      title: c.title,
      kind: 'web',
      message_id: assistantMsg.id,
      account_id: accountId,
    }));
    const { error: citeErr } = await ai.from('subject_citations').insert(rows);
    if (citeErr) console.error('[ai/threads citations]', citeErr);
  }

  const threadPatch: Record<string, unknown> = {
    meta: {
      ...threadMeta,
      last_answer_mode: resolvedMode,
      ...(result.openai_response_id
        ? { last_response_id: result.openai_response_id }
        : {}),
    },
  };
  if (
    !thread.title ||
    thread.title === 'New conversation' ||
    thread.title === 'New chat'
  ) {
    const titleSource =
      content ||
      attachments[0]?.original_name ||
      (attachments.length > 0 ? 'Attachment' : 'New conversation');
    threadPatch.title =
      titleSource.length > 48 ? `${titleSource.slice(0, 45)}…` : titleSource;
  }
  await ai.from('subject_threads').update(threadPatch).eq('id', threadId);

  if (result.resolver === 'responses') {
    const { error: usageErr } = await ai.from('ai_usage_events').insert({
      account_id: accountId,
      subject_thread_id: threadId,
      openai_response_id: result.openai_response_id,
      model: result.model ?? 'unknown',
      mode: resolvedMode,
      source: 'subject-responses',
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      total_tokens: result.total_tokens,
      reasoning_tokens: result.reasoning_tokens,
      cached_tokens: result.cached_tokens,
      cache_write_tokens: result.cache_write_tokens,
      duration_ms: result.duration_ms,
      web_search_used: result.web_search_used,
      web_search_call_count: result.web_search_call_count,
      input_length: content.length,
      output_length: displayAnswer.length,
      meta: {
        subject_type: thread.subject_type,
        subject_id: thread.subject_id,
        user_message_id: userMsgId,
        assistant_message_id: assistantMsg.id,
        answer_mode: resolvedMode,
        reasoning_tokens: result.reasoning_tokens,
        cached_tokens: result.cached_tokens,
        cache_write_tokens: result.cache_write_tokens,
      },
    });
    if (usageErr) console.error('[ai/threads usage]', usageErr);
  }

  return {
    ok: true,
    assistantMessage: {
      id: assistantMsg.id as string,
      role: assistantMsg.role as string,
      content: assistantMsg.content as string,
      created_at: assistantMsg.created_at as string,
      meta: (assistantMsg.meta ?? null) as Record<string, unknown> | null,
    },
  };
}
