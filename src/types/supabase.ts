// Supabase Database Types
// This file should be regenerated using: npm run types:generate
// For now, this is a minimal type definition to allow compilation

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      jurisdictions: {
        Row: {
          id: string
          slug: string | null
          name: string | null
          type: string | null
          parent_id: string | null
        }
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      pages: {
        Row: {
          id: string
          name: string
          [key: string]: any
        }
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string | null
          is_visible: boolean
          account_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question: string
          answer?: string | null
          is_visible?: boolean
          account_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question?: string
          answer?: string | null
          is_visible?: boolean
          account_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [key: string]: {
        Row: Record<string, any>
      }
    }
    Functions: {
      [key: string]: {
        Args: {
          [key: string]: unknown
        }
        Returns: unknown
      }
      get_page_stats: {
        Args: {
          p_page_url: string
          p_hours: number | null
        }
        Returns: Array<{
          total_views: number
          unique_viewers: number
          accounts_viewed: number
        }>
      }
      get_pin_stats: {
        Args: {
          p_pin_id: string
          p_hours: number | null
        }
        Returns: Array<{
          total_views: number
          unique_viewers: number
          accounts_viewed: number
        }>
      }
      get_pin_viewers: {
        Args: {
          p_pin_id: string
          p_limit: number
          p_offset: number
        }
        Returns: Array<{
          id: string
          viewed_at: string
          account_id: string | null
        }>
      }
      get_page_viewers: {
        Args: {
          p_page_url: string
          p_limit: number
          p_offset: number
        }
        Returns: Array<{
          id: string
          viewed_at: string
          account_id: string | null
        }>
      }
      get_trending_pins: {
        Args: {
          p_hours: number
          p_limit: number
        }
        Returns: Array<{
          pin_id: string
          view_count: number
        }>
      }
      record_page_view: {
        Args: {
          p_page_url: string
          p_account_id: string | null
          p_user_agent: string | null
          p_referrer_url: string | null
          p_session_id: string | null
        }
        Returns: string
      }
      record_pin_view: {
        Args: {
          p_pin_id: string
          p_account_id: string | null
          p_user_agent: string | null
          p_referrer_url: string | null
          p_session_id: string | null
        }
        Returns: string
      }
    }
    Enums: {
      [key: string]: string
    }
  }
}
