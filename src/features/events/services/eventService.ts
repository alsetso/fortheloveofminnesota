import { supabase } from '@/lib/supabase';
import type { Event, CreateEventData, UpdateEventData, EventFilters } from '@/types/event';

/**
 * Service for managing events
 */
export class EventService {
  /**
   * Fetch all public events
   * Optionally filter by account_id, date range, or visibility
   * Includes account information (username, image_url) when available
   */
  static async getEvents(filters?: EventFilters): Promise<Event[]> {
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;
    
    // Build query - for anonymous users, skip accounts join to avoid RLS issues
    let query = supabase
      .from('events')
      .select(isAuthenticated 
        ? `*,
          accounts(
            id,
            username,
            first_name,
            image_url
          )`
        : `*`
      )
      .eq('archived', false); // Exclude archived events
    
    // For anonymous users, explicitly filter to public events only
    if (!isAuthenticated) {
      query = query.eq('visibility', 'public');
    }
    
    // Apply filters
    if (filters?.account_id) {
      query = query.eq('account_id', filters.account_id);
    }

    if (filters?.visibility) {
      query = query.eq('visibility', filters.visibility);
    }

    if (filters?.archived !== undefined) {
      query = query.eq('archived', filters.archived);
    }

    // Date range filters
    if (filters?.start_date) {
      query = query.gte('start_date', filters.start_date);
    }

    if (filters?.end_date) {
      query = query.lte('end_date', filters.end_date);
    }

    // Order by start_date ascending (upcoming events first)
    query = query.order('start_date', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[EventService] Error fetching events:', error);
      throw new Error(`Failed to fetch events: ${error.message}`);
    }

    return (data || []) as unknown as Event[];
  }

  /**
   * Get a single event by ID
   */
  static async getEventById(eventId: string): Promise<Event | null> {
    const { data: { user } } = await supabase.auth.getUser();
    const isAuthenticated = !!user;

    const { data, error } = await supabase
      .from('events')
      .select(isAuthenticated 
        ? `*,
          accounts(
            id,
            username,
            first_name,
            image_url
          )`
        : `*`
      )
      .eq('id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      console.error('[EventService] Error fetching event:', error);
      throw new Error(`Failed to fetch event: ${error.message}`);
    }

    return data as unknown as Event;
  }

  /**
   * Create a new event
   * Requires authenticated user
   */
  static async createEvent(data: CreateEventData, accountId?: string): Promise<Event> {
    // Require authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create events');
    }

    // Use provided accountId or get from authenticated user
    let account_id: string;
    if (accountId) {
      // Verify user owns this account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('id', accountId)
        .eq('user_id', user.id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found or you do not have access to it.');
      }
      account_id = account.id;
    } else {
      // Get user's account
      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (accountError || !account) {
        throw new Error('Account not found. Please complete your profile setup.');
      }
      account_id = account.id;
    }

    // Validate dates
    const startDate = new Date(data.start_date);
    if (isNaN(startDate.getTime())) {
      throw new Error('Invalid start date');
    }

    let endDate: string | null = null;
    if (data.end_date) {
      const end = new Date(data.end_date);
      if (isNaN(end.getTime())) {
        throw new Error('Invalid end date');
      }
      if (end < startDate) {
        throw new Error('End date must be after start date');
      }
      endDate = end.toISOString();
    }

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        title: data.title,
        description: data.description || null,
        start_date: startDate.toISOString(),
        end_date: endDate,
        location_name: data.location_name || null,
        location_address: data.location_address || null,
        lat: data.lat || null,
        lng: data.lng || null,
        account_id: account_id,
        visibility: data.visibility || 'public',
        tags: data.tags && data.tags.length > 0 ? data.tags : null,
        archived: false,
      })
      .select(`
        *,
        accounts(
          id,
          username,
          first_name,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('[EventService] Error creating event:', error);
      throw new Error(`Failed to create event: ${error.message}`);
    }

    return event as Event;
  }

  /**
   * Update an existing event
   * User must own the event
   */
  static async updateEvent(eventId: string, data: UpdateEventData): Promise<Event> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update events');
    }

    // Validate dates if provided
    const updateData: any = { ...data };
    
    if (data.start_date) {
      const startDate = new Date(data.start_date);
      if (isNaN(startDate.getTime())) {
        throw new Error('Invalid start date');
      }
      updateData.start_date = startDate.toISOString();
    }

    if (data.end_date !== undefined) {
      if (data.end_date === null) {
        updateData.end_date = null;
      } else {
        const endDate = new Date(data.end_date);
        if (isNaN(endDate.getTime())) {
          throw new Error('Invalid end date');
        }
        updateData.end_date = endDate.toISOString();
      }
    }

    // If both dates are being updated, validate end >= start
    if (updateData.start_date && updateData.end_date) {
      const start = new Date(updateData.start_date);
      const end = new Date(updateData.end_date);
      if (end < start) {
        throw new Error('End date must be after start date');
      }
    }

    // Handle tags in update
    if (data.tags !== undefined) {
      updateData.tags = data.tags && data.tags.length > 0 ? data.tags : null;
    }

    const { data: event, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', eventId)
      .select(`
        *,
        accounts(
          id,
          username,
          first_name,
          image_url
        )
      `)
      .single();

    if (error) {
      console.error('[EventService] Error updating event:', error);
      throw new Error(`Failed to update event: ${error.message}`);
    }

    return event as Event;
  }

  /**
   * Delete an event (soft delete by archiving)
   * User must own the event
   */
  static async deleteEvent(eventId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to delete events');
    }

    const { error } = await supabase
      .from('events')
      .update({ archived: true })
      .eq('id', eventId);

    if (error) {
      console.error('[EventService] Error deleting event:', error);
      throw new Error(`Failed to delete event: ${error.message}`);
    }
  }
}

