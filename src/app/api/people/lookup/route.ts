import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withSecurity, REQUEST_SIZE_LIMITS } from '@/lib/security/middleware';
import { z } from 'zod';

const lookupBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('name'),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
  }).refine((d) => (d.firstName?.trim()?.length ?? 0) + (d.lastName?.trim()?.length ?? 0) > 0, 'At least one of firstName or lastName required'),
  z.object({
    type: z.literal('email'),
    email: z.string().email().max(320),
  }),
  z.object({
    type: z.literal('phone'),
    phone: z.string().max(30),
  }),
]);

function escapeIlike(s: string): string {
  return s
    .replaceAll('\\', '\\\\')
    .replaceAll('%', '\\%')
    .replaceAll('_', '\\_');
}

function normalizeDigits(s: string | null): string {
  return (s ?? '').replace(/\D/g, '');
}

/** Audit log for people lookups: type only, no PII. Extend to table in production if needed. */
function auditPeopleLookup(searchType: 'name' | 'email' | 'phone', accountId: string | undefined): void {
  if (process.env.NODE_ENV === 'development') {
    console.info('[people/lookup]', { type: 'people_lookup', search_type: searchType, at: new Date().toISOString(), account_id: accountId ?? null });
  }
}

/**
 * POST /api/people/lookup
 * Look up accounts by name (fuzzy first/last), email, or phone.
 * Returns public account fields; phone lookup includes match_type ('full' | 'partial').
 * Never returns email/phone. Requires auth.
 */
function buildSearchQuery(parsed: z.infer<typeof lookupBodySchema>): Record<string, unknown> {
  if (parsed.type === 'name') return { firstName: parsed.firstName ?? '', lastName: parsed.lastName ?? '' };
  if (parsed.type === 'email') return { email: parsed.email };
  return { phone: parsed.phone };
}

async function saveSearch(
  supabase: Awaited<ReturnType<typeof createServerClientWithAuth>>,
  payload: { userId: string; accountId: string; searchType: 'name' | 'email' | 'phone'; query: Record<string, unknown>; accountResults: { accounts: unknown[]; count: number } }
): Promise<string | null> {
  const { data, error } = await supabase.schema('people').from('search').insert({
    user_id: payload.userId,
    account_id: payload.accountId,
    search_type: payload.searchType,
    query: payload.query,
    account_results: payload.accountResults,
  }).select('id').single();
  if (error || !data?.id) return null;
  return data.id as string;
}

export async function POST(request: NextRequest) {
  return withSecurity(
    request,
    async (req, { userId, accountId }) => {
      try {
        const body = await req.json();
        const parsed = lookupBodySchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: 'Invalid request', details: parsed.error.flatten() },
            { status: 400 }
          );
        }

        const supabase = await createServerClientWithAuth(cookies());
        const select = 'id,username,first_name,last_name,image_url';

        if (parsed.data.type === 'name') {
          const firstName = parsed.data.firstName?.trim() ?? '';
          const lastName = parsed.data.lastName?.trim() ?? '';
          const tokens = [...firstName.split(/\s+/).filter(Boolean), ...lastName.split(/\s+/).filter(Boolean)];
          if (tokens.length === 0) {
            return NextResponse.json({ accounts: [], count: 0 });
          }

          // Fuzzy: first token via DB; remaining tokens filtered in JS (ilike %token% on first_name or last_name)
          const firstPattern = `%${escapeIlike(tokens[0])}%`;
          const { data: rows, error } = await supabase
            .from('accounts')
            .select(select)
            .not('username', 'is', null)
            .or(`first_name.ilike.${firstPattern},last_name.ilike.${firstPattern}`)
            .limit(100);

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

          const rest = tokens.slice(1);
          const matches = (rows ?? []).filter((row: { first_name: string | null; last_name: string | null }) => {
            const first = (row.first_name ?? '').toLowerCase();
            const last = (row.last_name ?? '').toLowerCase();
            return rest.every((t) => {
              const lower = t.toLowerCase();
              return first.includes(lower) || last.includes(lower);
            });
          }).slice(0, 20);

          auditPeopleLookup('name', accountId);
          const searchId = userId && accountId ? await saveSearch(supabase, { userId, accountId, searchType: 'name', query: buildSearchQuery(parsed.data), accountResults: { accounts: matches, count: matches.length } }) : null;
          return NextResponse.json({ accounts: matches, count: matches.length, search_id: searchId ?? undefined });
        }

        if (parsed.data.type === 'email') {
          const email = parsed.data.email.trim().toLowerCase();
          const { data, error, count } = await supabase
            .from('accounts')
            .select(select, { count: 'exact' })
            .ilike('email', email)
            .limit(20);

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }
          auditPeopleLookup('email', accountId);
          const emailAccounts = data ?? [];
          const emailCount = count ?? 0;
          const searchId = userId && accountId ? await saveSearch(supabase, { userId, accountId, searchType: 'email', query: buildSearchQuery(parsed.data), accountResults: { accounts: emailAccounts, count: emailCount } }) : null;
          return NextResponse.json({ accounts: emailAccounts, count: emailCount, search_id: searchId ?? undefined });
        }

        // phone: normalize to digits; full match = 10-digit exact, partial = 7-digit suffix
        const searchDigits = normalizeDigits(parsed.data.phone);
        if (searchDigits.length < 4) {
          return NextResponse.json({ accounts: [], count: 0 });
        }
        const suffix10 = searchDigits.slice(-10);
        const suffix7 = searchDigits.slice(-7);
        const { data: rows, error } = await supabase
          .from('accounts')
          .select(`${select},phone`)
          .not('phone', 'is', null)
          .limit(200);

        if (error) {
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        type Row = { phone: string | null } & Record<string, unknown>;
        const withMatch = (rows ?? [] as Row[])
          .map((r) => {
            const n = normalizeDigits(r.phone);
            if (n.length < 4) return null;
            const fullMatch = suffix10.length >= 10 && n.length >= 10 && n.slice(-10) === suffix10;
            const partialMatch = suffix7.length >= 7 && n.length >= 7 && n.slice(-7) === suffix7;
            if (fullMatch) return { ...r, match_type: 'full' as const };
            if (partialMatch) return { ...r, match_type: 'partial' as const };
            return null;
          })
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .sort((a, b) => (a.match_type === 'full' && b.match_type === 'partial' ? -1 : a.match_type === 'partial' && b.match_type === 'full' ? 1 : 0))
          .slice(0, 20)
          .map((r) => {
            const { phone: _p, ...rest } = r;
            return rest;
          });

        auditPeopleLookup('phone', accountId);
        const searchId = userId && accountId ? await saveSearch(supabase, { userId, accountId, searchType: 'phone', query: buildSearchQuery(parsed.data), accountResults: { accounts: withMatch, count: withMatch.length } }) : null;
        return NextResponse.json({ accounts: withMatch, count: withMatch.length, search_id: searchId ?? undefined });
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('POST /api/people/lookup:', e);
        }
        return NextResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      }
    },
    {
      rateLimit: 'public',
      requireAuth: true,
      maxRequestSize: REQUEST_SIZE_LIMITS.json,
    }
  );
}
