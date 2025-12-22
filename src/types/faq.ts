/**
 * FAQ Types
 * 
 * Type definitions for the FAQs table and related operations.
 */

export interface FAQ {
  id: string;
  question: string;
  answer: string | null;
  is_visible: boolean;
  account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateFAQData {
  question: string;
  account_id?: string | null;
}

export interface UpdateFAQData {
  question?: string;
  answer?: string | null;
  is_visible?: boolean;
}
