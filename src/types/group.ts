/**
 * TypeScript types for groups
 */

export type GroupVisibility = 'public' | 'private';

export interface Group {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  image_url: string | null;
  visibility: GroupVisibility;
  is_active: boolean;
  created_by_account_id: string;
  member_count: number;
  post_count: number;
  created_at: string;
  updated_at: string;
  created_by?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
  is_member?: boolean;
  is_admin?: boolean;
}

export interface GroupMember {
  id: string;
  group_id: string;
  account_id: string;
  is_admin: boolean;
  joined_at: string;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
}

export interface CreateGroupData {
  name: string;
  slug: string;
  description?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  visibility?: GroupVisibility;
}

export interface UpdateGroupData {
  name?: string;
  description?: string | null;
  cover_image_url?: string | null;
  image_url?: string | null;
  visibility?: GroupVisibility;
}

export interface GroupFilters {
  visibility?: GroupVisibility;
  is_active?: boolean;
  search?: string;
}

export interface GroupRequest {
  id: string;
  group_id: string;
  account_id: string;
  status: 'pending' | 'approved' | 'denied';
  message: string | null;
  processed_by_account_id: string | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  } | null;
}
