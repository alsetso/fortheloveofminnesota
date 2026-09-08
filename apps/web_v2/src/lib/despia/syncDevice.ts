/**
 * Bind Despia install identity to public.accounts after auth.
 * - device_id  = despia.uuid
 * - app_user_id = accounts.id (Storage Vault + user_devices)
 *
 * https://setup.despia.com/native-features/device-indexing
 * https://setup.despia.com/best-practices/backend/user-session
 */
import { despiaCall, getDespia, isDespia } from '@/lib/despia/despia';
import { claimDespiaVaultAccount } from '@/lib/despia/identityVault';

export type SyncDespiaDeviceInput = {
  /** public.accounts.id — canonical app_user_id */
  accountId: string;
  /** auth.users.id */
  userId: string;
};

type DespiaModule = ((command: string, keys?: string[]) => Promise<unknown>) & {
  uuid?: string;
};

function asTrimmedString(value: unknown, max = 64): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function detectPlatform(): string | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('despia-android') || (ua.includes('despia') && ua.includes('android'))) {
    return 'android';
  }
  if (ua.includes('despia-ipad') || (ua.includes('despia') && ua.includes('ipad'))) {
    return 'ios-ipad';
  }
  if (ua.includes('despia-iphone') || (ua.includes('despia') && ua.includes('iphone'))) {
    return 'ios-iphone';
  }
  if (ua.includes('despia')) return 'ios';
  return null;
}

async function readInstallId(): Promise<string | null> {
  const despia = (await getDespia()) as DespiaModule | null;
  if (!despia) return null;

  const syncUuid = typeof despia.uuid === 'string' ? despia.uuid.trim() : '';
  if (syncUuid) return syncUuid;

  const raw = await despiaCall('get-uuid://', ['uuid']);
  if (raw && typeof raw === 'object' && 'uuid' in raw) {
    return asTrimmedString((raw as { uuid?: unknown }).uuid, 128);
  }
  return null;
}

async function readAppVersion(): Promise<{
  versionNumber: string | null;
  bundleNumber: string | null;
}> {
  try {
    const raw = await despiaCall('getappversion://', ['versionNumber', 'bundleNumber']);
    if (!raw || typeof raw !== 'object') {
      return { versionNumber: null, bundleNumber: null };
    }
    const info = raw as { versionNumber?: unknown; bundleNumber?: unknown };
    return {
      versionNumber: asTrimmedString(info.versionNumber, 32),
      bundleNumber: asTrimmedString(info.bundleNumber, 32),
    };
  } catch {
    return { versionNumber: null, bundleNumber: null };
  }
}

async function readStoreLocation(): Promise<string | null> {
  try {
    const raw = await despiaCall('getstorelocation://', ['storeLocation']);
    if (!raw || typeof raw !== 'object') return null;
    return asTrimmedString((raw as { storeLocation?: unknown }).storeLocation, 64);
  } catch {
    return null;
  }
}

/**
 * After OTP/session + account load: write vault + upsert user_devices.
 * No-op outside Despia (browser). Safe to call repeatedly.
 */
export async function syncDespiaDevice(input: SyncDespiaDeviceInput): Promise<boolean> {
  if (!isDespia()) return false;
  if (!input.accountId || !input.userId) return false;

  const deviceId = await readInstallId();
  if (!deviceId) {
    console.warn('despia sync: missing uuid');
    return false;
  }

  try {
    await claimDespiaVaultAccount(input.accountId);
  } catch (err) {
    console.warn('despia sync: vault write failed', err);
  }

  const [{ versionNumber, bundleNumber }, storeLocation] = await Promise.all([
    readAppVersion(),
    readStoreLocation(),
  ]);

  try {
    const res = await fetch('/api/sync-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        platform: detectPlatform(),
        versionNumber,
        bundleNumber,
        storeLocation,
      }),
    });
    if (!res.ok) {
      console.warn('despia sync: api failed', res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('despia sync: network failed', err);
    return false;
  }
}
