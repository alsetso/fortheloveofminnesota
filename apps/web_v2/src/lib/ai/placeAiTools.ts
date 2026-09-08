/**
 * Place AI focused tools — each turn targets one dataset.
 *
 * fill_about  → units profile / attrs (ftlom-facts → Existing vs New)
 * fill_officials → seats / officeholders (ftlom-seats → Officials carousel)
 * chat → freeform; only attach structured review when a fence is present
 */

export type PlaceAiTool = 'fill_about' | 'fill_officials' | 'chat';

export function isPlaceAiTool(v: unknown): v is PlaceAiTool {
  return v === 'fill_about' || v === 'fill_officials' || v === 'chat';
}

/** Infer tool from a known Fill prompt when the client omits an explicit tool. */
export function detectPlaceAiTool(content: string): PlaceAiTool {
  const t = content.trim();
  if (
    t.includes('For each seat/official, find:') ||
    t.includes('end with exactly one ftlom-seats') ||
    t.includes('Enrich one official for the')
  ) {
    return 'fill_officials';
  }
  if (
    t.includes('Find and report these About fields:') ||
    t.includes('end with an ftlom-facts')
  ) {
    return 'fill_about';
  }
  return 'chat';
}

export function buildFillAboutPrompt(placeName: string, typeLabel: string): string {
  return [
    `Research the official ${typeLabel} government / organization for ${placeName}.`,
    '',
    'Find and report these About fields:',
    '- overview / description',
    '- official website URL',
    '- public contact email',
    '- public contact phone',
    '- population',
    '- best features (strengths of the place)',
    '- challenges / worst features',
    '',
    'Prefer official .gov and primary government sources. Use web search for current facts.',
    'Do not invent emails or phone numbers — omit if not found on a reliable source.',
    'When you have durable facts, end with an ftlom-facts JSON fence so an admin can review Existing vs New and approve before saving.',
    'Do NOT include an ftlom-seats block. This request is About fields only — not officials or seats.',
  ].join('\n');
}

export function buildFillOfficialsPrompt(placeName: string, typeLabel: string): string {
  return [
    `Research the current elected and appointed officials who lead the ${typeLabel} government for ${placeName}.`,
    '',
    'For each seat/official, find:',
    '- seat_type key (e.g. superintendent, board_member, clerk, treasurer, mayor)',
    '- seat title (e.g. Superintendent, School Board Member, Clerk)',
    '- sub_label when needed (e.g. Ward 1, Seat 2)',
    '- current officeholder full_name',
    '- party affiliation (if applicable)',
    '- public contact email',
    '- official website or bio URL',
    '',
    'List every confirmed seat you can find in short Markdown first.',
    'Prefer official .gov / school district sources. Do not invent names.',
    '',
    'Then end with exactly one ftlom-seats JSON fence so an admin can review and save seats:',
    '```ftlom-seats',
    '{"seats":[{"seat_type":"superintendent","title":"Superintendent","full_name":"...","email":"...","website_url":"...","bio":"...","source_urls":["https://..."]},{"seat_type":"board_member","title":"School Board Member","sub_label":"Seat 1","full_name":"...","source_urls":["https://..."]}],"source_urls":["https://..."]}',
    '```',
    'Include one object per confirmed official. Omit uncertain people.',
    'Always include source_urls for pages you used.',
    'Never write placeholder values like "N/A", "none", or "unknown" — omit the key instead.',
    'Do NOT include an ftlom-facts block. Do not propose About fields (website/phone/population) — this request is Officials / seats only.',
  ].join('\n');
}

/**
 * Focused one-shot enrich for a single pending official before save.
 * Asks only for empty detail fields; response is a one-seat ftlom-seats fence.
 */
export function buildEnrichOfficialPrompt(input: {
  placeName: string;
  typeLabel: string;
  draft: {
    seat_type: string;
    title: string;
    sub_label?: string | null;
    full_name: string;
    party?: string | null;
    email?: string | null;
    phone?: string | null;
    website_url?: string | null;
    bio?: string | null;
  };
  emptyFields: string[];
}): string {
  const seatLabel = [input.draft.title, input.draft.sub_label]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(' · ');
  const known = [
    `seat_type: ${input.draft.seat_type}`,
    `title: ${input.draft.title}`,
    input.draft.sub_label?.trim() ? `sub_label: ${input.draft.sub_label.trim()}` : null,
    `full_name: ${input.draft.full_name}`,
    input.draft.party?.trim() ? `party: ${input.draft.party.trim()}` : 'party: (empty)',
    input.draft.email?.trim() ? `email: ${input.draft.email.trim()}` : 'email: (empty)',
    input.draft.phone?.trim() ? `phone: ${input.draft.phone.trim()}` : 'phone: (empty)',
    input.draft.website_url?.trim()
      ? `website_url: ${input.draft.website_url.trim()}`
      : 'website_url: (empty)',
    input.draft.bio?.trim() ? `bio: ${input.draft.bio.trim()}` : 'bio: (empty)',
  ]
    .filter(Boolean)
    .join('\n');

  const need = input.emptyFields.length
    ? input.emptyFields.join(', ')
    : 'party, email, phone, website_url, bio';

  return [
    `Enrich one official for the ${input.typeLabel} "${input.placeName}".`,
    '',
    `Target seat: ${seatLabel || input.draft.seat_type}`,
    `Person: ${input.draft.full_name}`,
    '',
    'Known draft (do not invent a different person):',
    known,
    '',
    `Search official sources for these EMPTY fields only: ${need}.`,
    'Also collect source_urls (every official page you used).',
    'If you write a short biography in prose, also put it in the seat object as bio.',
    'Do not change full_name or invent a different officeholder.',
    'Do not invent emails or phones — omit the key entirely if not found on a reliable source.',
    'Never write placeholder values like "N/A", "none", "unknown", or "-".',
    '',
    'End with exactly one ftlom-seats fence containing a single seat object for this person:',
    '```ftlom-seats',
    `{"seats":[{"seat_type":"${input.draft.seat_type}","title":"${input.draft.title.replace(/"/g, '')}","full_name":"${input.draft.full_name.replace(/"/g, '')}","email":"...","website_url":"...","bio":"...","source_urls":["https://..."]}],"source_urls":["https://..."]}`,
    '```',
    'Only include keys you found. Always include source_urls when you used the web. Do NOT include an ftlom-facts block.',
  ].join('\n');
}

/** Extra system-instruction rules scoped to the active Place AI tool. */
export function placeAiToolInstructionAddendum(tool: PlaceAiTool): string {
  if (tool === 'fill_about') {
    return [
      'Active tool: Fill About.',
      'Primary objective: improve About foundation fields for this place.',
      'Emit at most one ```ftlom-facts``` block with durable About fields.',
      'Do not emit ```ftlom-seats```. Do not focus the reply on listing every official.',
    ].join('\n');
  }
  if (tool === 'fill_officials') {
    return [
      'Active tool: Fill Officials.',
      'Primary objective: improve seats / officeholders for this place.',
      'Emit at most one ```ftlom-seats``` block with confirmed officials.',
      'Do not emit ```ftlom-facts```. Do not propose About website/phone/population fields.',
      'Every person listed in prose should also appear in the ftlom-seats JSON when confirmed.',
    ].join('\n');
  }
  return [
    'Active tool: freeform chat.',
    'If the user asks about About fields, you may emit ```ftlom-facts```.',
    'If the user asks about officials/seats, you may emit ```ftlom-seats```.',
    'Do not emit both unless the user clearly asked for both datasets.',
  ].join('\n');
}
