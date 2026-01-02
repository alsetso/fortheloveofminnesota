/**
 * Civic Edit Logger
 * 
 * Utility functions for logging edits to civic tables (orgs, people, roles)
 * All edits are tracked in civic.events table for wiki-style edit history
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { formatDistanceToNow } from 'date-fns';

export type CivicTable = 'orgs' | 'people' | 'roles';

export interface CivicEditOptions {
  table: CivicTable;
  recordId: string;
  field: string;
  newValue: string | null;
  accountId: string;
  supabase: SupabaseClient;
  editReason?: string | null;
}

/**
 * Update a civic field and log the edit to civic.events
 * 
 * @param options - Edit options including table, recordId, field, newValue, accountId, and supabase client
 * @returns Promise that resolves when update and logging are complete
 */
export async function updateCivicFieldWithLogging(
  options: CivicEditOptions
): Promise<{ error: Error | null }> {
  const { table, recordId, field, newValue, accountId, supabase, editReason } = options;

  try {
    // Get current value
    const { data: current, error: fetchError } = await supabase
      .from(table)
      .select(field)
      .eq('id', recordId)
      .single();

    if (fetchError) {
      return { error: fetchError };
    }

    const typedCurrent = current as Record<string, any> | null;
    const oldValue = typedCurrent?.[field] ?? null;

    // Skip logging if value hasn't changed
    if (oldValue === newValue) {
      // Still update in case of type coercion (e.g., '' vs null)
      const { error: updateError } = await supabase
        .from(table)
        .update({ [field]: newValue })
        .eq('id', recordId);

      return { error: updateError };
    }

    // Use atomic update function if available (with transaction safety)
    // Fall back to separate update + log if function doesn't exist
    const { error: atomicError } = await supabase.rpc('update_civic_field_with_logging', {
      p_table_name: table,
      p_record_id: recordId,
      p_field_name: field,
      p_new_value: newValue ? String(newValue) : null,
      p_account_id: accountId,
      p_old_value: oldValue ? String(oldValue) : null,
      p_edit_reason: editReason || null,
    });

    // If atomic function doesn't exist or fails, fall back to separate operations
    if (atomicError && atomicError.message?.includes('function') && atomicError.message?.includes('does not exist')) {
      // Fallback: separate update and log
      const { error: updateError } = await supabase
        .from(table)
        .update({ [field]: newValue })
        .eq('id', recordId);

      if (updateError) {
        return { error: updateError };
      }

      // Log the event
      const { error: logError } = await supabase.rpc('log_civic_event', {
        p_table_name: table,
        p_record_id: recordId,
        p_field_name: field,
        p_account_id: accountId,
        p_old_value: oldValue ? String(oldValue) : null,
        p_new_value: newValue ? String(newValue) : null,
        p_edit_reason: editReason || null,
      });

      if (logError) {
        console.error('Failed to log civic edit event:', logError);
        // Note: Update already succeeded, but logging failed
        // In production, consider alerting or retry mechanism
      }

      return { error: null };
    }

    if (atomicError) {
      return { error: atomicError };
    }

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Unknown error') };
  }
}

/**
 * Update multiple civic fields in a single transaction
 * Logs each changed field as a separate event
 */
export async function updateCivicFieldsWithLogging(
  table: CivicTable,
  recordId: string,
  updates: Record<string, string | null>,
  accountId: string,
  supabase: SupabaseClient,
  editReason?: string | null
): Promise<{ error: Error | null }> {
  try {
    // Get current values
    const { data: current, error: fetchError } = await supabase
      .from(table)
      .select('*')
      .eq('id', recordId)
      .single();

    if (fetchError) {
      return { error: fetchError };
    }

    // Filter out unchanged values
    const changedFields: Record<string, string | null> = {};
    for (const [field, newValue] of Object.entries(updates)) {
      const oldValue = current?.[field] ?? null;
      if (oldValue !== newValue) {
        changedFields[field] = newValue;
      }
    }

    if (Object.keys(changedFields).length === 0) {
      return { error: null }; // No changes
    }

    // Update the record
    const { error: updateError } = await supabase
      .from(table)
      .update(changedFields)
      .eq('id', recordId);

    if (updateError) {
      return { error: updateError };
    }

    // Log each changed field as a separate event
    const logPromises = Object.entries(changedFields).map(([field, newValue]) => {
      const oldValue = current?.[field] ?? null;
      return supabase.rpc('log_civic_event', {
        p_table_name: table,
        p_record_id: recordId,
        p_field_name: field,
        p_account_id: accountId,
        p_old_value: oldValue ? String(oldValue) : null,
        p_new_value: newValue ? String(newValue) : null,
        p_edit_reason: editReason || null,
      });
    });

    const logResults = await Promise.allSettled(logPromises);
    const logErrors = logResults
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason);

    if (logErrors.length > 0) {
      console.error('Some edit events failed to log:', logErrors);
      // Don't fail the update if logging fails
    }

    return { error: null };
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Unknown error') };
  }
}

/**
 * Get edit history for a civic record
 */
export async function getCivicEditHistory(
  table: CivicTable,
  recordId: string,
  supabase: SupabaseClient
) {
  const { data, error } = await supabase
    .from('civic_events')
    .select('*')
    .eq('table_name', table)
    .eq('record_id', recordId)
    .order('created_at', { ascending: false });

  return { data, error };
}

/**
 * Get recent edits by a user
 */
export async function getUserCivicEdits(
  accountId: string,
  limit: number = 50,
  supabase: SupabaseClient
) {
  const { data, error } = await supabase
    .from('civic_events')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return { data, error };
}

/**
 * Revert a civic field edit by restoring the old_value from an event
 * Creates a new event log entry indicating this is a revert
 * 
 * @param eventId - The ID of the event to revert
 * @param accountId - The account ID of the user performing the revert
 * @param supabase - Supabase client
 * @param revertReason - Optional reason for the revert
 * @returns Promise that resolves when revert is complete
 */
export async function revertCivicEdit(
  eventId: string,
  accountId: string,
  supabase: SupabaseClient,
  revertReason?: string | null
): Promise<{ error: Error | null }> {
  try {
    // Get the event to revert (use civic_events view which includes account info)
    const { data: event, error: eventError } = await supabase
      .from('civic_events')
      .select('*, account_username, account_first_name, account_last_name')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return { error: eventError || new Error('Event not found') };
    }

    // Get current value to use as old_value in the revert log
    const { data: current, error: fetchError } = await supabase
      .from(event.table_name as CivicTable)
      .select(event.field_name)
      .eq('id', event.record_id)
      .single();

    if (fetchError) {
      return { error: fetchError };
    }

    const currentValue = current?.[event.field_name] ?? null;

    // Revert to the old_value from the event
    const revertValue = event.old_value;

    // Get account info from the event (civic_events view includes account fields)
    const eventWithAccount = event as any;
    const originalEditor = eventWithAccount.account_username || 
      (eventWithAccount.account_first_name || eventWithAccount.account_last_name
        ? [eventWithAccount.account_first_name, eventWithAccount.account_last_name].filter(Boolean).join(' ')
        : 'user');

    // Use the update function to revert and log
    const result = await updateCivicFieldWithLogging({
      table: event.table_name as CivicTable,
      recordId: event.record_id,
      field: event.field_name,
      newValue: revertValue,
      accountId,
      supabase,
      editReason: revertReason || `Reverted edit from ${formatDistanceToNow(new Date(event.created_at), { addSuffix: true })} by ${originalEditor}`,
    });

    return result;
  } catch (error) {
    return { error: error instanceof Error ? error : new Error('Unknown error') };
  }
}

