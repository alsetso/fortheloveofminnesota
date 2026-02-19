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
      cities: {
        Row: {
          id: string
          name: string
          slug: string | null
          favorite: boolean | null
          updated_at: string | null
          [key: string]: any
        }
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      counties: {
        Row: {
          id: string
          name: string
          slug: string | null
          favorite: boolean | null
          updated_at: string | null
          [key: string]: any
        }
        Insert: Record<string, any>
        Update: Record<string, any>
      }
      accounts: {
        Row: {
          id: string
          user_id: string | null
          username: string | null
          first_name: string | null
          last_name: string | null
          email: string | null
          phone: string | null
          image_url: string | null
          cover_image_url: string | null
          bio: string | null
          city_id: string | null
          role: 'general' | 'admin'
          traits: string[]
          view_count: number
          onboarded: boolean
          stripe_customer_id: string | null
          plan: 'hobby' | 'contributor' | 'plus' | 'gov' | null
          billing_mode: 'standard' | 'trial' | null
          subscription_status: string | null
          guest_id: string | null
          created_at: string
          updated_at: string
          last_visit: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          image_url?: string | null
          cover_image_url?: string | null
          bio?: string | null
          city_id?: string | null
          role?: 'general' | 'admin'
          traits?: string[]
          view_count?: number
          onboarded?: boolean
          stripe_customer_id?: string | null
          plan?: 'hobby' | 'contributor' | 'plus' | null
          billing_mode?: 'standard' | 'trial' | null
          subscription_status?: string | null
          stripe_subscription_id?: string | null
          guest_id?: string | null
          created_at?: string
          updated_at?: string
          last_visit?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          username?: string | null
          first_name?: string | null
          last_name?: string | null
          email?: string | null
          phone?: string | null
          image_url?: string | null
          cover_image_url?: string | null
          bio?: string | null
          city_id?: string | null
          role?: 'general' | 'admin'
          traits?: string[]
          view_count?: number
          onboarded?: boolean
          stripe_customer_id?: string | null
          plan?: 'hobby' | 'contributor' | 'plus' | null
          billing_mode?: 'standard' | 'trial' | null
          subscription_status?: string | null
          stripe_subscription_id?: string | null
          guest_id?: string | null
          created_at?: string
          updated_at?: string
          last_visit?: string | null
        }
      }
      [key: string]: {
        Row: Record<string, any>
        Insert: Record<string, any>
        Update: Record<string, any>
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
  people: {
    Tables: {
      search: {
        Row: {
          id: string
          account_id: string
          user_id: string | null
          search_type: string
          query: Record<string, unknown>
          account_results: unknown
          public_record_results: unknown
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
      pull_requests: {
        Row: {
          id: string
          search_id: string
          user_id: string
          account_id: string
          person_id: string | null
          pulled_data: unknown
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, string>
  }
}
