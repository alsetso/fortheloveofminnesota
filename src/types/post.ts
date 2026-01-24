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
}

export interface CreatePostData {
  title?: string | null;
  content: string;
  visibility?: PostVisibility;
  group_id?: string | null;
  mention_type_id?: string | null;
  mention_ids?: string[] | null;
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

export interface PostFilters {
  account_id?: string;
  group_id?: string;
  visibility?: PostVisibility;
  limit?: number;
  offset?: number;
}
