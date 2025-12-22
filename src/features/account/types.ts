/**
 * Shared types for account feature components
 */

import type { Account } from '@/features/auth';

export type AccountTabId = 'analytics' | 'settings';

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

export interface OnboardingClientProps {
  initialAccount: Account | null;
  redirectTo?: string;
  onComplete?: () => void | Promise<void>;
}

export interface AccountData {
  account: Account | null;
  userEmail: string;
  loading: boolean;
  error: string | null;
}

