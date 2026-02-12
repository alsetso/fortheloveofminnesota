/**
 * Server-side Supabase clients for SSR, SSG, ISR, and Route Handlers
 * 
 * @deprecated Use createSupabaseClient() from '@/lib/supabase/unified' instead
 * This file maintains backward compatibility while migrating to unified factory
 */

export { 
  createSupabaseClient,
  createServerClient,
  createServerClientWithAuth,
  createServiceClient
} from './supabase/unified';

