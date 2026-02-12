/**
 * Schema-Aware Query Utilities
 * 
 * Ensures all database queries respect system visibility and use correct schemas.
 * Enforces schema-to-system mapping globally.
 */

import { createSupabaseClient } from './unified';
import { isSchemaAccessible } from '../admin/schemaMapping';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/supabase';

/**
 * Get Supabase client for a specific schema
 * Checks system visibility before returning client
 * 
 * @throws Error if schema is not accessible
 */
export async function getSchemaClient(
  schemaName: string,
  userId?: string,
  options: { auth?: boolean; service?: boolean } = {}
): Promise<SupabaseClient<Database>> {
  // Check if schema is accessible
  const accessible = await isSchemaAccessible(schemaName, userId);
  
  if (!accessible) {
    throw new Error(`Schema "${schemaName}" is not accessible. System may be disabled or requires feature access.`);
  }
  
  // Return client with schema context
  const client = await createSupabaseClient(options);
  
  // Note: Schema selection happens at query time via .schema() method
  // This function ensures the schema is accessible before returning client
  return client;
}

/**
 * Execute a query on a specific schema with visibility check
 * 
 * @example
 * const maps = await querySchema('maps', 'maps', (client) => 
 *   client.from('maps').select('*')
 * );
 */
export async function querySchema<T>(
  schemaName: string,
  tableName: string,
  queryFn: (client: SupabaseClient<Database>) => Promise<T>,
  userId?: string
): Promise<T> {
  const client = await getSchemaClient(schemaName, userId, { auth: true });
  const schemaClient = (client as any).schema(schemaName);
  return queryFn(schemaClient);
}
