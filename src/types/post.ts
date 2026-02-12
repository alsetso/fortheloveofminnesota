/**
 * TypeScript types for posts
 */

export type PostVisibility = 'public' | 'draft';

export interface Post {
  id: string;
  account_id: string;
  title: string | null;
  content: string;
  visibility: PostVisibility;
  group_id: string | null;
  mention_type_id: string | null;
  mention_ids: string[] | null;
  tagged_account_ids: string[] | null;
  map_id: string | null;
  images: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> | null;
  map_data: {
    lat: number;
    lng: number;
    address?: string;
    place_name?: string;
  } | null;
  background_color: 'black' | 'red' | 'blue' | null;
  created_at: string;
  updated_at: string;
  account?: {
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
    plan: string | null;
  } | null;
  tagged_accounts?: Array<{
    id: string;
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  }> | null;
  map?: {
    id: string;
    name: string;
    slug: string;
    visibility: string;
  } | null;
  mention_type?: {
    id: string;
    emoji: string;
    name: string;
  } | null;
  mentions?: Array<{
    id: string;
    lat: number;
    lng: number;
    description: string | null;
    image_url: string | null;
    account_id: string | null;
    mention_type?: {
      emoji: string;
      name: string;
    } | null;
  }> | null;
  shared_post_id?: string | null;
  shared_post?: Post | null;
}

export interface CreatePostData {
  title?: string | null;
  content: string;
  visibility?: PostVisibility;
  group_id?: string | null;
  mention_type_id?: string | null;
  mention_ids?: string[] | null;
  tagged_account_ids?: string[] | null;
  map_id?: string | null;
  images?: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> | null;
  map_data?: {
    lat: number;
    lng: number;
    address?: string;
    place_name?: string;
  } | null;
}

export interface UpdatePostData {
  title?: string | null;
  content?: string;
  visibility?: PostVisibility;
  group_id?: string | null;
  mention_type_id?: string | null;
  mention_ids?: string[] | null;
  tagged_account_ids?: string[] | null;
  map_id?: string | null;
  images?: Array<{
    url: string;
    alt?: string;
    width?: number;
    height?: number;
  }> | null;
  map_data?: {
    lat: number;
    lng: number;
    address?: string;
    place_name?: string;
  } | null;
  background_color?: 'black' | 'red' | 'blue' | null;
}

export interface PostFilters {
  account_id?: string;
  map_id?: string;
  visibility?: PostVisibility;
  limit?: number;
  offset?: number;
}
