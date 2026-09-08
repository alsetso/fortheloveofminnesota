/**
 * RevenueCat via Despia — App Store IAP for Contributor + tool-credit packs.
 * https://setup.despia.com/native-features/revenuecat/introduction.md
 *
 * V1 App Store build is earn-only (`REVENUECAT_PURCHASES_ENABLED = false`).
 * Launch helpers no-op until a later binary re-enables IAP.
 */
import { despiaCall, isDespia } from '@/lib/despia/despia';

/** Flip true when shipping IAP again (requires ASC products + Despia RC keys). */
export const REVENUECAT_PURCHASES_ENABLED = false;

/** Current RC offering with the published iOS paywall (weekly + monthly). */
export function getDefaultOffering(): string {
  return process.env.NEXT_PUBLIC_REVENUECAT_DEFAULT_OFFERING?.trim() || 'ios';
}

/** App Store product id for the Contributor subscription (RevenueCat `store_identifier`). */
export const CONTRIBUTOR_PRODUCT_ID = 'contributor_monthly';

/** RevenueCat entitlement identifier granted by the Contributor subscription. */
export const CONTRIBUTOR_ENTITLEMENT_ID = 'contributor';

/** Launch native paywall. Prefer account id as app_user_id. */
export async function launchRevenueCatPaywall(
  externalId: string,
  offering: string = getDefaultOffering(),
): Promise<boolean> {
  if (!REVENUECAT_PURCHASES_ENABLED) return false;
  if (!isDespia() || !externalId) return false;
  const id = encodeURIComponent(externalId);
  const off = encodeURIComponent(offering);
  await despiaCall(`revenuecat://launchPaywall?external_id=${id}&offering=${off}`);
  return true;
}

/**
 * Direct purchase for a single product — skips the paywall UI.
 * Used for one-tap tool-credit packs where we already show our own picker.
 */
export async function purchaseRevenueCatProduct(
  externalId: string,
  productId: string,
): Promise<boolean> {
  if (!REVENUECAT_PURCHASES_ENABLED) return false;
  if (!isDespia() || !externalId || !productId) return false;
  const id = encodeURIComponent(externalId);
  const product = encodeURIComponent(productId);
  await despiaCall(`revenuecat://purchase?external_id=${id}&product=${product}`);
  return true;
}

/** Native Customer Center — restore purchases, manage subscription, refunds (iOS). */
export async function launchRevenueCatCenter(externalId: string): Promise<boolean> {
  if (!REVENUECAT_PURCHASES_ENABLED) return false;
  if (!isDespia() || !externalId) return false;
  const id = encodeURIComponent(externalId);
  await despiaCall(`revenuecat://center?external_id=${id}`);
  return true;
}

type RevenueCatPurchaseData = Record<string, unknown>;
type PurchaseListener = (data: RevenueCatPurchaseData) => void;

declare global {
  interface Window {
    onRevenueCatPurchase?: (data: RevenueCatPurchaseData) => void;
    onRevenueCatCenter?: (data: { event?: string } & Record<string, unknown>) => void;
  }
}

const purchaseListeners = new Set<PurchaseListener>();
let purchaseHookInstalled = false;

function installPurchaseHook() {
  if (purchaseHookInstalled || typeof window === 'undefined') return;
  purchaseHookInstalled = true;
  const existing = window.onRevenueCatPurchase;
  window.onRevenueCatPurchase = (data) => {
    existing?.(data);
    purchaseListeners.forEach((listener) => listener(data ?? {}));
  };
}

/**
 * Subscribe to the Despia `onRevenueCatPurchase` runtime callback.
 * No-op listeners while purchases are disabled (hooks not installed).
 */
export function onRevenueCatPurchase(listener: PurchaseListener): () => void {
  if (!REVENUECAT_PURCHASES_ENABLED) return () => {};
  installPurchaseHook();
  purchaseListeners.add(listener);
  return () => purchaseListeners.delete(listener);
}

type CenterEventData = { event?: string } & Record<string, unknown>;
type CenterListener = (data: CenterEventData) => void;

const centerListeners = new Set<CenterListener>();
let centerHookInstalled = false;

function installCenterHook() {
  if (centerHookInstalled || typeof window === 'undefined') return;
  centerHookInstalled = true;
  const existing = window.onRevenueCatCenter;
  window.onRevenueCatCenter = (data) => {
    existing?.(data);
    centerListeners.forEach((listener) => listener(data ?? {}));
  };
}

/** Subscribe to Customer Center sheet events (`dismissed`, `restoreCompleted`, etc). */
export function onRevenueCatCenter(listener: CenterListener): () => void {
  if (!REVENUECAT_PURCHASES_ENABLED) return () => {};
  installCenterHook();
  centerListeners.add(listener);
  return () => centerListeners.delete(listener);
}
