/**
 * Type definitions for analytics API responses
 */

export interface PageStats {
  total_loads: number;
  unique_visitors: number;
  accounts_active: number;
}

export interface PageView {
  id: string;
  viewed_at: string;
  account_id: string | null;
  accounts?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
}

export interface Visitor {
  id: string;
  account_id: string | null;
  first_viewed_at: string;
  last_viewed_at: string;
  view_count: number;
  accounts?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
}

export interface SupabaseRPCResponse<T> {
  data: T | null;
  error: {
    code?: string;
    message: string;
    details?: string;
    hint?: string;
  } | null;
}




