import { createServerClientWithAuth, createServiceClient } from '@/lib/supabaseServer';
import { withAuthRetry } from '@/lib/authHelpers';

/**
 * Base admin service with common CRUD operations
 * All admin services should extend this class
 * 
 * Uses service role client for write operations (create, update, delete) to bypass RLS
 * since admin status is already verified in API routes.
 * Uses authenticated client for read operations to respect RLS.
 */
export abstract class BaseAdminService<T, CreateT, UpdateT> {
  protected abstract tableName: string;
  
  /**
   * Get service role client for write operations (bypasses RLS)
   * Admin status is verified in API routes, so we can safely use service role
   */
  protected getServiceClient() {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set. Service role key is required for admin operations.');
    }
    return createServiceClient();
  }
  
  /**
   * Get all records (admin only)
   */
  async getAll(): Promise<T[]> {
    return withAuthRetry(async () => {
      const supabase = await createServerClientWithAuth();
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error(`Error fetching all ${this.tableName}:`, error);
        throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
      }
      
      return data || [];
    }, `Get all ${this.tableName}`);
  }
  
  /**
   * Get by ID
   */
  async getById(id: string): Promise<T | null> {
    return withAuthRetry(async () => {
      const supabase = await createServerClientWithAuth();
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('id', id)
        .single();
      
      if (error?.code === 'PGRST116') {
        return null;
      }
      
      if (error) {
        console.error(`Error fetching ${this.tableName} by ID:`, error);
        throw new Error(`Failed to fetch ${this.tableName}: ${error.message}`);
      }
      
      return data;
    }, `Get ${this.tableName} by ID`);
  }
  
  /**
   * Create record
   */
  async create(data: CreateT): Promise<T> {
    return withAuthRetry(async () => {
      const supabase = this.getServiceClient();
      
      const { data: record, error } = await supabase
        .from(this.tableName as any)
        .insert(data as any)
        .select()
        .single();
      
      if (error) {
        console.error(`Error creating ${this.tableName}:`, error);
        throw new Error(`Failed to create ${this.tableName}: ${error.message}`);
      }
      
      if (!record) {
        throw new Error(`Failed to create ${this.tableName}: no data returned`);
      }
      
      return record;
    }, `Create ${this.tableName}`);
  }
  
  /**
   * Update record
   */
  async update(id: string, data: UpdateT): Promise<T> {
    const supabase = this.getServiceClient();
    
    // Only log service role usage in development (never log key details)
    if (process.env.NODE_ENV === 'development') {
      console.log(`[BaseAdminService] Updating ${this.tableName} with service role client`);
    }
    
    const query = supabase.from(this.tableName as any) as any;
    const { data: record, error } = await query
      .update(data as any)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      // Log basic error info (safe for production)
      console.error(`[BaseAdminService] Error updating ${this.tableName}:`, error.message);
      console.error(`[BaseAdminService] Error code:`, error.code);
      
      // Only log detailed error info in development (could expose internal structure)
      if (process.env.NODE_ENV === 'development') {
        console.error(`[BaseAdminService] Error hint:`, error.hint);
        console.error(`[BaseAdminService] Error details:`, JSON.stringify(error, null, 2));
      }
      
      // If it's a permission error, the service role isn't working
      if (error.message?.includes('permission denied') || error.code === '42501') {
        console.error(`[BaseAdminService] PERMISSION DENIED - Service role client is NOT bypassing RLS!`);
        // Only log detailed diagnostic in development
        if (process.env.NODE_ENV === 'development') {
          console.error(`[BaseAdminService] This suggests the service role key may be invalid or not being used correctly.`);
        }
      }
      
      throw new Error(`Failed to update ${this.tableName}: ${error.message}`);
    }
    
    if (!record) {
      throw new Error(`Failed to update ${this.tableName}: no data returned`);
    }
    
    return record;
  }
  
  /**
   * Delete record
   */
  async delete(id: string): Promise<void> {
    return withAuthRetry(async () => {
      const supabase = this.getServiceClient();
      
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);
      
      if (error) {
        console.error(`Error deleting ${this.tableName}:`, error);
        throw new Error(`Failed to delete ${this.tableName}: ${error.message}`);
      }
    }, `Delete ${this.tableName}`);
  }
  
  /**
   * Get basic statistics
   */
  async getStats(): Promise<Record<string, number>> {
    return withAuthRetry(async () => {
      const supabase = await createServerClientWithAuth();
      const { count, error } = await supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.error(`Error getting ${this.tableName} stats:`, error);
        throw new Error(`Failed to get ${this.tableName} stats: ${error.message}`);
      }
      
      return { total: count || 0 };
    }, `Get ${this.tableName} stats`);
  }
}

