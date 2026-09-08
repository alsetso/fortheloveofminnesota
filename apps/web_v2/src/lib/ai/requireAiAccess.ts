import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { accountCanUsePlaceAi } from '@/lib/ai/accountCanUsePlaceAi';
import { getSessionAccount } from '@/lib/auth/getSessionAccount';
import { isLocalhostHost } from '@/lib/isLocalhostHost';

export type AiAccess =
  | { mode: 'localhost' }
  | { mode: 'staff' }
  | { mode: 'comingSoon'; response: NextResponse };

/** Localhost and staff/admin may write/apply unit foundation facts. */
export function aiAccessCanApply(access: AiAccess): boolean {
  return access.mode === 'localhost' || access.mode === 'staff';
}

function comingSoonResponse(): AiAccess {
  return {
    mode: 'comingSoon',
    response: NextResponse.json(
      {
        comingSoon: true,
        message: 'Place AI is coming soon.',
      },
      { status: 200 },
    ),
  };
}

/**
 * Localhost/dev: full AI write/resolve.
 * Production: staff (admin.staff active) or accounts.role === 'admin'.
 * Everyone else: Coming soon.
 */
export async function resolveAiAccess(): Promise<AiAccess> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (isLocalhostHost(host) || process.env.NODE_ENV === 'development') {
    return { mode: 'localhost' };
  }

  const session = await getSessionAccount();
  if (!session) return comingSoonResponse();

  const allowed = await accountCanUsePlaceAi({
    accountId: session.accountId,
    role: session.role,
  });
  if (allowed) return { mode: 'staff' };

  return comingSoonResponse();
}
