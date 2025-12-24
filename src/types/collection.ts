/**
 * TypeScript types for collections
 */

export interface Collection {
  id: string;
  account_id: string;
  emoji: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionData {
  emoji?: string;
  title: string;
  description?: string | null;
}

export interface UpdateCollectionData {
  emoji?: string;
  title?: string;
  description?: string | null;
}


