import {
  type ChatAttachment,
} from '@/lib/ai/chatAttachments';
import type { SubjectResponseMilestone } from '@/lib/ai/subjectResponseMilestones';
import OpenAI from 'openai';
import {
  buildTerritoryLocalAnswer,
  loadTerritoryUnitContext,
  type TerritorySeatHolder,
  type TerritoryUnitProfile,
} from '@/lib/ai/resolveTerritoryAnswer';
import {
  placeAiToolInstructionAddendum,
  type PlaceAiTool,
} from '@/lib/ai/placeAiTools';
import {
  ANSWER_MODE_COPY,
  parseAnswerMode,
  resolveAnswerModeConfig,
  type AnswerMode,
} from '@/lib/ai/answerModes';
import { SUBJECT_TYPE_GENERAL, SUBJECT_TYPE_TERRITORY_UNIT } from '@/lib/ai/subjectTypes';
import { readAttrsFoundation } from '@/lib/ai/unitProfileFacts';


export type UrlCitation = {
  url: string;
  title: string | null;
  start_index?: number;
  end_index?: number;
};

export type SubjectResponsesResult = {
  answer: string;
  resolver: 'responses' | 'local';
  /** Resolved answer mode for this turn. */
  mode: AnswerMode;
  model: string | null;
  openai_response_id: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  reasoning_tokens: number;
  cached_tokens: number;
  cache_write_tokens: number;
  duration_ms: number;
  web_search_used: boolean;
  web_search_call_count: number;
  citations: UrlCitation[];
  /** Concise OpenAI reasoning summary (not raw CoT). */
  reasoning_summary: string | null;
  milestones: SubjectResponseMilestone[];
};

export type SubjectResponsesStreamHandlers = {
  onMilestone?: (milestone: SubjectResponseMilestone) => void;
};

type SubjectTurnInput = {
  subjectType: string;
  subjectId: string;
  userMessage: string;
  attachments?: ChatAttachment[];
  previousResponseId?: string | null;
  /** Focused Place AI tool for this turn (defaults to freeform chat). */
  placeTool?: PlaceAiTool;
  /** User-facing answer mode (server maps to model + reasoning). */
  mode?: AnswerMode;
};

function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  return new OpenAI({ apiKey });
}

type ResponseInputContent =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string; detail: 'auto' | 'low' | 'high' }
  // file_url must not include filename — OpenAI treats those as mutually exclusive.
  | { type: 'input_file'; file_url: string };

function buildMultimodalInput(
  userMessage: string,
  attachments: ChatAttachment[],
): string | Array<{ role: 'user'; content: ResponseInputContent[] }> {
  if (attachments.length === 0) return userMessage;

  const content: ResponseInputContent[] = [];
  const text =
    userMessage.trim() ||
    (attachments.some((a) => a.kind === 'pdf')
      ? 'Please review the attached PDF.'
      : 'Please look at the attached image(s).');
  content.push({ type: 'input_text', text });

  for (const att of attachments) {
    if (att.kind === 'pdf' || att.mime_type === 'application/pdf') {
      content.push({
        type: 'input_file',
        file_url: att.public_url,
      });
    } else {
      content.push({
        type: 'input_image',
        image_url: att.public_url,
        detail: 'auto',
      });
    }
  }

  return [{ role: 'user', content }];
}

function buildTerritoryInstructions(
  unit: TerritoryUnitProfile,
  holders: TerritorySeatHolder[],
  tool: PlaceAiTool,
): string {
  const seatLines =
    holders.length === 0
      ? '(no seats seeded)'
      : holders
          .map((h) => {
            const seat = [h.title, h.sub_label].filter(Boolean).join(' · ');
            return `- ${seat}: ${h.full_name?.trim() || '(vacant)'}${
              h.email ? ` · ${h.email}` : ''
            }`;
          })
          .join('\n');

  const foundation = readAttrsFoundation(unit.attrs ?? {});
  const best = foundation.features.best?.join('; ') || '(empty)';
  const worst = foundation.features.worst?.join('; ') || '(empty)';

  const factsBlock = [
    'About review fence (Fill About / About questions only):',
    '```ftlom-facts',
    '{"website_url":"...","contact_email":"...","contact_phone":"...","description":"...","population":12345,"features":{"best":["..."],"worst":["..."]},"source_urls":["https://..."]}',
    '```',
    'Only include keys you are confident about. Omit unknowns. Do not invent emails or phones.',
  ].join('\n');

  const seatsBlock = [
    'Officials review fence (Fill Officials / seats questions only):',
    '```ftlom-seats',
    '{"seats":[{"seat_type":"mayor","title":"Mayor","full_name":"Jane Smith","party":"DFL","email":"mayor@city.gov","website_url":"https://city.gov/mayor"},{"seat_type":"council_member","title":"Council Member","sub_label":"Ward 1","full_name":"John Doe","email":"jdoe@city.gov"}]}',
    '```',
    'Only include officials you are confident about. Do not invent names.',
    'Never use placeholder values like "N/A", "none", or "unknown" — omit the key instead.',
  ].join('\n');

  const fenceSection =
    tool === 'fill_about'
      ? factsBlock
      : tool === 'fill_officials'
        ? seatsBlock
        : [factsBlock, '', seatsBlock].join('\n');

  return [
    `You are Place AI for For the Love of Minnesota.`,
    `Subject: territory unit "${unit.name}" (kind=${unit.kind}${unit.subtype ? `, subtype=${unit.subtype}` : ''}).`,
    `Canonical unit id: ${unit.id}.`,
    '',
    placeAiToolInstructionAddendum(tool),
    '',
    'Known profile (treat as ground truth unless the user is proposing an update):',
    `- description: ${unit.description?.trim() || '(empty)'}`,
    `- website_url: ${unit.website_url?.trim() || '(empty)'}`,
    `- contact_email: ${unit.contact_email?.trim() || '(empty)'}`,
    `- contact_phone: ${unit.contact_phone?.trim() || '(empty)'}`,
    `- population: ${foundation.population ?? '(empty)'}`,
    `- best features: ${best}`,
    `- worst features: ${worst}`,
    '',
    'Known seats / officeholders:',
    seatLines,
    '',
    'Rules:',
    '- Prefer the known seats/profile above over web results for "who holds office".',
    '- Use web search for current public facts when needed for the active tool.',
    '- Reply in clear Markdown (short headings, bullets). Do not use HTML.',
    '- When citing the web, keep sources attributable; URLs will be shown as citations.',
    '- If data is missing, say so and suggest what the user can add.',
    '- Do not invent officeholders or contact fields.',
    '',
    fenceSection,
  ].join('\n');
}

function buildGeneralInstructions(): string {
  return [
    'You are a helpful assistant in For the Love of Minnesota.',
    'Reply in clear Markdown. Use web search when the question needs current information.',
    'Do not invent Minnesota civic officeholders; suggest opening a territory record for place-specific data.',
  ].join('\n');
}

function extractCitations(response: OpenAI.Responses.Response): UrlCitation[] {
  const out: UrlCitation[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type !== 'output_text') continue;
      for (const ann of part.annotations ?? []) {
        if (ann.type !== 'url_citation') continue;
        out.push({
          url: ann.url,
          title: ann.title ?? null,
          start_index: ann.start_index,
          end_index: ann.end_index,
        });
      }
    }
  }
  return out;
}

/** Prefer SDK helper, then streamed buffer, then walk output message parts. */
function extractOutputText(
  response: OpenAI.Responses.Response,
  streamedText = '',
): string {
  const fromHelper = response.output_text?.trim();
  if (fromHelper) return fromHelper;
  const fromStream = streamedText.trim();
  if (fromStream) return fromStream;
  const parts: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'message') continue;
    for (const part of item.content ?? []) {
      if (part.type === 'output_text' && part.text?.trim()) {
        parts.push(part.text.trim());
      }
    }
  }
  return parts.join('\n\n').trim();
}

function extractReasoningSummary(
  response: OpenAI.Responses.Response,
  streamedSummaries: string[],
): string | null {
  const fromItems: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== 'reasoning') continue;
    for (const part of item.summary ?? []) {
      if (part.type === 'summary_text' && part.text?.trim()) {
        fromItems.push(part.text.trim());
      }
    }
  }
  const joined = (fromItems.length > 0 ? fromItems : streamedSummaries)
    .map((s) => s.trim())
    .filter(Boolean)
    .join('\n\n');
  return joined || null;
}

function countWebSearchCalls(response: OpenAI.Responses.Response): number {
  return (response.output ?? []).filter((o) => o.type === 'web_search_call').length;
}

function emptyResult(
  partial: Partial<SubjectResponsesResult> &
    Pick<SubjectResponsesResult, 'answer' | 'resolver'> & { mode?: AnswerMode },
  startMs: number,
): SubjectResponsesResult {
  return {
    model: null,
    openai_response_id: null,
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
    reasoning_tokens: 0,
    cached_tokens: 0,
    cache_write_tokens: 0,
    duration_ms: Date.now() - startMs,
    web_search_used: false,
    web_search_call_count: 0,
    citations: [],
    reasoning_summary: null,
    milestones: [],
    ...partial,
    mode: parseAnswerMode(partial.mode),
  };
}

function apiFailureAnswer(err: unknown, attachments: ChatAttachment[]): string {
  const apiMessage =
    err &&
    typeof err === 'object' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
      ? (err as { message: string }).message
      : null;
  const attachmentHint =
    attachments.length > 0
      ? ' The attachment could not be processed — try again, or send without the file.'
      : '';
  return apiMessage && /mutually exclusive|invalid_request|unsupported/i.test(apiMessage)
    ? `I couldn’t read that attachment.${attachmentHint}`
    : `The AI request failed. Please try again in a moment.${attachmentHint}`;
}

async function prepareTurn(input: SubjectTurnInput): Promise<{
  instructions: string;
  localFallback: string | null;
  missingUnit: boolean;
}> {
  const placeTool: PlaceAiTool = input.placeTool ?? 'chat';
  let instructions = buildGeneralInstructions();
  let localFallback: string | null = null;

  if (input.subjectType === SUBJECT_TYPE_TERRITORY_UNIT) {
    const { unit, holders } = await loadTerritoryUnitContext(input.subjectId);
    if (!unit) {
      return {
        instructions,
        localFallback: 'I could not find that territory unit.',
        missingUnit: true,
      };
    }
    instructions = buildTerritoryInstructions(unit, holders, placeTool);
    localFallback = buildTerritoryLocalAnswer(unit, holders, input.userMessage);
    return { instructions, localFallback, missingUnit: false };
  }

  if (input.subjectType === SUBJECT_TYPE_GENERAL) {
    localFallback =
      'General chat needs OPENAI_API_KEY configured on the server. Territory place questions work best from a unit record.';
  } else {
    localFallback =
      'This subject type does not have a dedicated resolver yet. Configure OPENAI_API_KEY for model answers.';
  }
  return { instructions, localFallback, missingUnit: false };
}

function createMilestoneEmitter(onMilestone?: (m: SubjectResponseMilestone) => void) {
  const milestones: SubjectResponseMilestone[] = [];
  const seenLabels = new Set<string>();

  const emit = (label: string, detail?: string, dedupeKey?: string) => {
    const key = dedupeKey ?? label;
    if (seenLabels.has(key) && !detail) return;
    if (!detail) seenLabels.add(key);
    const milestone: SubjectResponseMilestone = {
      id: `m_${crypto.randomUUID()}`,
      label,
      ...(detail ? { detail } : {}),
      at: Date.now(),
    };
    milestones.push(milestone);
    onMilestone?.(milestone);
  };

  return { milestones, emit };
}

/**
 * Run Responses API with web_search for a subject turn.
 * Falls back to local territory resolver when OPENAI_API_KEY is unset.
 */
export async function runSubjectResponses(
  input: SubjectTurnInput,
): Promise<SubjectResponsesResult> {
  return runSubjectResponsesStream(input);
}

/**
 * Same as {@link runSubjectResponses}, with optional live milestone callbacks
 * (used by chat SSE). Territory routes can ignore milestones.
 */
export async function runSubjectResponsesStream(
  input: SubjectTurnInput,
  handlers: SubjectResponsesStreamHandlers = {},
): Promise<SubjectResponsesResult> {
  const startMs = Date.now();
  const client = getOpenAiClient();
  const attachments = input.attachments ?? [];
  const modeConfig = resolveAnswerModeConfig(input.mode);
  const { milestones, emit } = createMilestoneEmitter(handlers.onMilestone);

  const prepared = await prepareTurn(input);
  if (prepared.missingUnit) {
    return emptyResult(
      {
        answer: prepared.localFallback ?? 'I could not find that territory unit.',
        resolver: 'local',
        mode: modeConfig.mode,
        milestones,
      },
      startMs,
    );
  }

  if (!client) {
    return emptyResult(
      {
        answer: prepared.localFallback ?? 'OpenAI is not configured.',
        resolver: 'local',
        mode: modeConfig.mode,
        milestones,
      },
      startMs,
    );
  }

  emit(`${ANSWER_MODE_COPY[modeConfig.mode].label} · Planning…`);

  try {
    const stream = await client.responses.create({
      model: modeConfig.model,
      instructions: prepared.instructions,
      input: buildMultimodalInput(input.userMessage, attachments),
      tools: [{ type: 'web_search' }],
      reasoning: modeConfig.reasoning,
      store: true,
      stream: true,
      ...(input.previousResponseId
        ? { previous_response_id: input.previousResponseId }
        : {}),
    });

    let finalResponse: OpenAI.Responses.Response | null = null;
    let wroteText = false;
    let streamedText = '';
    let reasoningSummary = '';
    const reasoningSummaries: string[] = [];
    let webSearchCount = 0;

    for await (const event of stream) {
      switch (event.type) {
        case 'response.output_item.added': {
          const item = event.item;
          if (item.type === 'reasoning') {
            emit('Reasoning…');
          } else if (item.type === 'web_search_call') {
            webSearchCount += 1;
            emit('Searching the web…', undefined, 'web_search');
          } else if (item.type === 'message') {
            emit('Writing reply…', undefined, 'writing');
          }
          break;
        }
        case 'response.reasoning_summary_text.delta': {
          emit('Reasoning…');
          reasoningSummary += event.delta;
          break;
        }
        case 'response.reasoning_summary_text.done': {
          const text = (event.text || reasoningSummary).trim();
          if (text) {
            reasoningSummaries.push(text);
            emit('Reasoning…', text.slice(0, 280), `reasoning_detail_${milestones.length}`);
          }
          reasoningSummary = '';
          break;
        }
        case 'response.web_search_call.in_progress':
        case 'response.web_search_call.searching': {
          emit('Searching the web…', undefined, 'web_search');
          break;
        }
        case 'response.web_search_call.completed': {
          emit('Search complete', undefined, 'web_search_done');
          break;
        }
        case 'response.output_text.delta': {
          if (!wroteText) {
            wroteText = true;
            emit('Writing reply…', undefined, 'writing');
          }
          streamedText += event.delta ?? '';
          break;
        }
        case 'response.output_text.done': {
          if (event.text?.trim()) streamedText = event.text;
          break;
        }
        case 'response.completed': {
          finalResponse = event.response;
          break;
        }
        case 'response.failed': {
          throw new Error(event.response.error?.message || 'Response failed');
        }
        case 'error': {
          throw new Error(event.message || 'Stream error');
        }
        default:
          break;
      }
    }

    if (!finalResponse) {
      throw new Error('Stream ended without a completed response');
    }

    const usage = finalResponse.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const reasoningTokens = usage?.output_tokens_details?.reasoning_tokens ?? 0;
    const cachedTokens = usage?.input_tokens_details?.cached_tokens ?? 0;
    const cacheWriteTokens = usage?.input_tokens_details?.cache_write_tokens ?? 0;
    const webSearchCallCount = Math.max(
      webSearchCount,
      countWebSearchCalls(finalResponse),
    );
    // Never use the "OPENAI_API_KEY unset" copy here — the model call succeeded.
    // Territory local answers are still fine as a soft fallback for empty output.
    const extracted = extractOutputText(finalResponse, streamedText);
    const answer =
      extracted ||
      (input.subjectType === SUBJECT_TYPE_TERRITORY_UNIT
        ? prepared.localFallback
        : null) ||
      'I could not generate a reply.';
    const reasoningSummaryText = extractReasoningSummary(
      finalResponse,
      reasoningSummaries,
    );

    emit('Done');

    return {
      answer,
      resolver: 'responses',
      mode: modeConfig.mode,
      model: finalResponse.model ?? modeConfig.model,
      openai_response_id: finalResponse.id ?? null,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: usage?.total_tokens ?? inputTokens + outputTokens,
      reasoning_tokens: reasoningTokens,
      cached_tokens: cachedTokens,
      cache_write_tokens: cacheWriteTokens,
      duration_ms: Date.now() - startMs,
      web_search_used: webSearchCallCount > 0,
      web_search_call_count: webSearchCallCount,
      citations: extractCitations(finalResponse),
      reasoning_summary: reasoningSummaryText,
      milestones,
    };
  } catch (err) {
    console.error('[runSubjectResponses]', err);
    return emptyResult(
      {
        answer: apiFailureAnswer(err, attachments),
        resolver: 'local',
        mode: modeConfig.mode,
        milestones,
      },
      startMs,
    );
  }
}
