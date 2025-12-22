/**
 * Shared types for account feature components
 */

import type { Account } from '@/features/auth';
import type { BillingData } from '@/lib/billingServer';

export type AccountTabId = 'analytics' | 'settings' | 'billing';

export interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AccountTabId;
  onAccountUpdate?: () => void | Promise<void>;
}

export interface SettingsClientProps {
  initialAccount: Account;
  userEmail: string;
}

export interface BillingClientProps {
  initialBillingData: BillingData;
  onChangePlanClick?: () => void;
}

export interface OnboardingClientProps {
  initialAccount: Account | null;
  redirectTo?: string;
  onComplete?: () => void | Promise<void>;
}

export interface AccountData {
  account: Account | null;
  userEmail: string;
  billingData: BillingData | null;
  loading: boolean;
  error: string | null;
}

