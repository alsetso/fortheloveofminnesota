/**
 * Durable, non-biometric identity hints for the Despia shell.
 *
 * Despia Storage Vault is backed by iCloud Key-Value Store on iOS and Android
 * Key/Value Backup on Android. Values can therefore survive reinstall and may
 * sync to another device using the same cloud account.
 *
 * https://setup.despia.com/native-features/storage-vault
 */
import { despiaCall, isDespia } from '@/lib/despia/despia';

export const DESPIA_IDENTITY_CHANGED_EVENT = 'ftlomn:despia-identity-changed';

const GUEST_ID_KEY = 'guest_id';
const APP_USER_ID_KEY = 'app_user_id';
const MAX_ID_LENGTH = 128;

export type DespiaIdentitySnapshot = {
  /** Stable anonymous identity recovered from (or newly written to) the vault. */
  guestId: string;
  /** True when guest_id already existed before this app boot. */
  hasPriorVaultIdentity: boolean;
  /** Last account that claimed this vault, if one has ever signed in. */
  associatedAccountId: string | null;
};

let guestIdentityPromise:
  | Promise<Pick<DespiaIdentitySnapshot, 'guestId' | 'hasPriorVaultIdentity'>>
  | null = null;

function asVaultString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_ID_LENGTH);
}

async function readVaultValue(key: string): Promise<string | null> {
  try {
    const result = await despiaCall(`readvault://?key=${encodeURIComponent(key)}`, [key]);
    if (!result || typeof result !== 'object') return null;
    return asVaultString((result as Record<string, unknown>)[key]);
  } catch {
    // Despia documents a rejected read as the expected missing-key behavior.
    return null;
  }
}

async function writeVaultValue(key: string, value: string): Promise<void> {
  await despiaCall(
    `setvault://?key=${encodeURIComponent(key)}&value=${encodeURIComponent(value)}&locked=false`,
  );
}

function createGuestId(): string {
  return crypto.randomUUID();
}

async function ensureGuestIdentity(): Promise<
  Pick<DespiaIdentitySnapshot, 'guestId' | 'hasPriorVaultIdentity'>
> {
  const existing = await readVaultValue(GUEST_ID_KEY);
  if (existing) {
    return { guestId: existing, hasPriorVaultIdentity: true };
  }

  const guestId = createGuestId();
  await writeVaultValue(GUEST_ID_KEY, guestId);
  return { guestId, hasPriorVaultIdentity: false };
}

/**
 * Read the durable identity hints and create guest_id on first native launch.
 * Concurrent React mounts share one guest write so Strict Mode cannot race IDs.
 */
export async function initializeDespiaIdentity(): Promise<DespiaIdentitySnapshot | null> {
  if (!isDespia()) return null;

  if (!guestIdentityPromise) {
    guestIdentityPromise = ensureGuestIdentity().catch((error) => {
      guestIdentityPromise = null;
      throw error;
    });
  }

  const [guest, associatedAccountId] = await Promise.all([
    guestIdentityPromise,
    readVaultValue(APP_USER_ID_KEY),
  ]);

  return { ...guest, associatedAccountId };
}

/** Claim this cloud-backed vault for a signed-in account without biometric UI. */
export async function claimDespiaVaultAccount(accountId: string): Promise<void> {
  if (!isDespia() || !accountId) return;
  await writeVaultValue(APP_USER_ID_KEY, accountId);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent(DESPIA_IDENTITY_CHANGED_EVENT, {
        detail: { associatedAccountId: accountId },
      }),
    );
  }
}
