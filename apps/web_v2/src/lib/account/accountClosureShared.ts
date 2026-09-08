import { normalizeUsernameConfirm } from '@/lib/account/accountDeletePreview';

export type AccountClosureRow = {
  id: string;
  username: string | null;
  status: string;
  user_id: string | null;
};

export function assertUsernameMatches(
  accountUsername: string | null,
  inputUsername: string,
): { ok: true } | { ok: false; error: string } {
  if (!accountUsername) {
    return { ok: false, error: 'Set a username on your profile before continuing' };
  }
  const expected = normalizeUsernameConfirm(accountUsername);
  const provided = normalizeUsernameConfirm(inputUsername);
  if (expected !== provided) {
    return { ok: false, error: 'Username does not match' };
  }
  return { ok: true };
}
