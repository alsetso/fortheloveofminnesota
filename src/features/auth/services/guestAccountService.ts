import { supabase } from '@/lib/supabase';

const GUEST_ID_KEY = 'mnuda_guest_id';
const GUEST_NAME_KEY = 'mnuda_guest_name';
const ALL_GUEST_IDS_KEY = 'mnuda_all_guest_ids';

export interface GuestAccount {
  id: string;
  guest_id: string;
  first_name: string;
  username: string | null;
  image_url: string | null;
  plan?: string;
}

/**
 * Service for managing guest accounts
 * Guest accounts are stored in local storage and linked to accounts with NULL user_id
 */
export class GuestAccountService {
  /**
   * Generate a unique guest ID
   */
  private static generateGuestId(): string {
    // Use crypto.randomUUID() if available (modern browsers)
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return `guest_${crypto.randomUUID()}`;
    }
    
    // Fallback for older browsers
    return `guest_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  /**
   * Get or generate guest ID from local storage
   */
  static getGuestId(): string {
    if (typeof window === 'undefined') {
      throw new Error('Guest ID can only be accessed in browser environment');
    }

    let guestId = localStorage.getItem(GUEST_ID_KEY);
    
    if (!guestId) {
      // Generate a new guest ID
      guestId = this.generateGuestId();
      localStorage.setItem(GUEST_ID_KEY, guestId);
      // Track this ID in all guest IDs list
      this.addToAllGuestIds(guestId);
    }

    return guestId;
  }

  /**
   * Get all guest IDs created on this device
   */
  static getAllGuestIds(): string[] {
    if (typeof window === 'undefined') {
      return [];
    }

    const stored = localStorage.getItem(ALL_GUEST_IDS_KEY);
    if (!stored) {
      return [];
    }

    try {
      const ids = JSON.parse(stored);
      return Array.isArray(ids) ? ids : [];
    } catch {
      return [];
    }
  }

  /**
   * Add a guest ID to the tracked list
   */
  private static addToAllGuestIds(guestId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const ids = this.getAllGuestIds();
    if (!ids.includes(guestId)) {
      ids.push(guestId);
      localStorage.setItem(ALL_GUEST_IDS_KEY, JSON.stringify(ids));
    }
  }

  /**
   * Ensure current guest ID is in the tracked list (for migration)
   */
  static ensureCurrentGuestIdTracked(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const currentId = localStorage.getItem(GUEST_ID_KEY);
    if (currentId) {
      this.addToAllGuestIds(currentId);
    }
  }

  /**
   * Get all guest accounts created on this device
   */
  static async getAllDeviceGuestAccounts(): Promise<GuestAccount[]> {
    // Ensure current ID is tracked (migration for existing users)
    this.ensureCurrentGuestIdTracked();
    
    const guestIds = this.getAllGuestIds();
    if (guestIds.length === 0) {
      return [];
    }

    try {
      const { data: accounts, error } = await supabase
        .from('accounts')
        .select('id, guest_id, first_name, username, image_url, plan')
        .in('guest_id', guestIds)
        .is('user_id', null);

      if (error || !accounts) {
        console.error('[GuestAccountService] Error fetching device guest accounts:', error);
        return [];
      }

      return accounts.map(account => ({
        id: account.id,
        guest_id: account.guest_id || '',
        first_name: account.first_name || 'Guest',
        username: account.username,
        image_url: account.image_url || 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png',
        plan: account.plan || 'hobby',
      }));
    } catch (error) {
      console.error('[GuestAccountService] Error fetching device guest accounts:', error);
      return [];
    }
  }

  /**
   * Create a new guest profile (generates new guest ID)
   */
  static createNewGuestProfile(): string {
    if (typeof window === 'undefined') {
      throw new Error('Can only create guest profile in browser');
    }

    // Generate new guest ID
    const newGuestId = this.generateGuestId();
    
    // Set as current guest ID
    localStorage.setItem(GUEST_ID_KEY, newGuestId);
    
    // Clear the name for new profile
    localStorage.removeItem(GUEST_NAME_KEY);
    
    // Add to tracked list
    this.addToAllGuestIds(newGuestId);

    return newGuestId;
  }

  /**
   * Switch to a different guest account
   */
  static switchToGuestAccount(guestId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    // Verify it's a tracked guest ID
    const ids = this.getAllGuestIds();
    if (!ids.includes(guestId)) {
      console.warn('[GuestAccountService] Attempted to switch to untracked guest ID');
      return;
    }

    localStorage.setItem(GUEST_ID_KEY, guestId);
  }

  /**
   * Get guest name from local storage
   */
  static getGuestName(): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    return localStorage.getItem(GUEST_NAME_KEY);
  }

  /**
   * Set guest name in local storage
   */
  static setGuestName(name: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    if (name && name.trim()) {
      localStorage.setItem(GUEST_NAME_KEY, name.trim());
    } else {
      localStorage.removeItem(GUEST_NAME_KEY);
    }
  }

  /**
   * Get or create guest account
   * Uses the get_or_create_guest_account database function
   */
  static async getOrCreateGuestAccount(): Promise<GuestAccount> {
    const guestId = this.getGuestId();
    const guestName = this.getGuestName() || 'Guest';

    // Call the database function to get or create guest account
    // Function now returns JSON with account details (bypasses RLS)
    const { data, error } = await supabase.rpc('get_or_create_guest_account', {
      p_guest_id: guestId,
      p_first_name: guestName,
    });

    if (error) {
      console.error('[GuestAccountService] Error getting/creating guest account:', error);
      throw new Error(`Failed to get or create guest account: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to get or create guest account: no data returned');
    }

    // Data is now a JSON object with account details
    const account = data as {
      id: string;
      guest_id: string | null;
      first_name: string | null;
      username: string | null;
      image_url: string | null;
    };

    return {
      id: account.id,
      guest_id: account.guest_id || guestId,
      first_name: account.first_name || guestName,
      username: account.username,
      // Ensure guest accounts always have the default guest image
      image_url: account.image_url || 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png',
    };
  }

  /**
   * Check if current session is a guest (not authenticated)
   */
  static async isGuest(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    return !user;
  }

  /**
   * Clear guest data from local storage
   */
  static clearGuestData(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.removeItem(GUEST_ID_KEY);
    localStorage.removeItem(GUEST_NAME_KEY);
  }

  /**
   * Get current guest account if exists
   * Returns null if user is authenticated or no guest account exists
   */
  static async getCurrentGuestAccount(): Promise<GuestAccount | null> {
    const isGuest = await this.isGuest();
    if (!isGuest) {
      return null;
    }

    try {
      return await this.getOrCreateGuestAccount();
    } catch (error) {
      console.error('[GuestAccountService] Error getting guest account:', error);
      return null;
    }
  }

  /**
   * Check if there's a guest account in local storage that could be merged
   * This is useful when a user signs in - we can detect if they have guest data
   */
  static hasGuestData(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    const guestId = localStorage.getItem(GUEST_ID_KEY);
    return !!guestId;
  }

  /**
   * Get guest account by guest_id (for merging purposes)
   * Only works if the account still exists and is a guest account
   */
  static async getGuestAccountByGuestId(guestId: string): Promise<GuestAccount | null> {
    try {
      const { data: account, error } = await supabase
        .from('accounts')
        .select('id, guest_id, first_name, username, image_url')
        .eq('guest_id', guestId)
        .is('user_id', null)
        .single();

      if (error || !account) {
        return null;
      }

      return {
        id: account.id,
        guest_id: account.guest_id || guestId,
        first_name: account.first_name || 'Guest',
        username: account.username,
        // Ensure guest accounts always have the default guest image
        image_url: account.image_url || 'https://hfklpjuiuhbulztsqapv.supabase.co/storage/v1/object/public/logos/Guest%20Image.png',
      };
    } catch (error) {
      console.error('[GuestAccountService] Error fetching guest account:', error);
      return null;
    }
  }

  /**
   * Merge guest account into authenticated user account
   * Transfers all pins from guest account to user account
   * 
   * @param guestAccountId - The guest account ID to merge
   * @param userAccountId - The authenticated user account ID
   * @param deleteGuestAccount - Whether to delete the guest account after merging (default: true)
   */
  static async mergeGuestAccountIntoUser(
    guestAccountId: string,
    userAccountId: string,
    deleteGuestAccount: boolean = true
  ): Promise<{ pins_transferred: number; guest_account_deleted: boolean }> {
    const { data, error } = await supabase.rpc('merge_guest_account_into_user', {
      p_guest_account_id: guestAccountId,
      p_user_account_id: userAccountId,
      p_delete_guest_account: deleteGuestAccount,
    });

    if (error) {
      console.error('[GuestAccountService] Error merging guest account:', error);
      throw new Error(`Failed to merge guest account: ${error.message}`);
    }

    if (!data) {
      throw new Error('Failed to merge guest account: no data returned');
    }

    // Clear guest data from local storage after successful merge
    if (deleteGuestAccount) {
      this.clearGuestData();
    }

    return {
      pins_transferred: data.pins_transferred || 0,
      guest_account_deleted: data.guest_account_deleted || false,
    };
  }

  /**
   * Get guest account stats (number of pins, etc.)
   * Useful for showing user what will be merged
   */
  static async getGuestAccountStats(guestAccountId: string): Promise<{ pin_count: number } | null> {
    try {
      const { count, error } = await supabase
        .from('pins')
        .select('*', { count: 'exact', head: true })
        .eq('account_id', guestAccountId);

      if (error) {
        console.error('[GuestAccountService] Error getting guest account stats:', error);
        return null;
      }

      return {
        pin_count: count || 0,
      };
    } catch (error) {
      console.error('[GuestAccountService] Error getting guest account stats:', error);
      return null;
    }
  }

  /**
   * Delete all pins for the current guest account
   * Keeps the account but removes all pins
   */
  static async deleteAllPins(): Promise<{ success: boolean; pins_deleted: number }> {
    const guestId = this.getGuestId();

    const { data, error } = await supabase.rpc('delete_all_guest_pins', {
      p_guest_id: guestId,
    });

    if (error) {
      console.error('[GuestAccountService] Error deleting all pins:', error);
      throw new Error(`Failed to delete pins: ${error.message}`);
    }

    return {
      success: data?.success || false,
      pins_deleted: data?.pins_deleted || 0,
    };
  }

  /**
   * Delete the current guest account and all associated data
   * This is permanent and clears local storage
   */
  static async deleteAccount(): Promise<{ success: boolean; pins_deleted: number }> {
    const guestId = this.getGuestId();

    const { data, error } = await supabase.rpc('delete_guest_account', {
      p_guest_id: guestId,
    });

    if (error) {
      console.error('[GuestAccountService] Error deleting account:', error);
      throw new Error(`Failed to delete account: ${error.message}`);
    }

    if (data?.success) {
      // Clear local storage after successful deletion
      this.clearGuestData();
      
      // Remove from tracked guest IDs
      this.removeFromAllGuestIds(guestId);
    }

    return {
      success: data?.success || false,
      pins_deleted: data?.pins_deleted || 0,
    };
  }

  /**
   * Reset the current guest account (delete all pins, keep account)
   * Optionally update the display name
   */
  static async resetAccount(newName?: string): Promise<{ success: boolean; pins_deleted: number }> {
    const guestId = this.getGuestId();

    const { data, error } = await supabase.rpc('reset_guest_account', {
      p_guest_id: guestId,
      p_new_name: newName || null,
    });

    if (error) {
      console.error('[GuestAccountService] Error resetting account:', error);
      throw new Error(`Failed to reset account: ${error.message}`);
    }

    // Update local name if provided
    if (newName) {
      this.setGuestName(newName);
    }

    return {
      success: data?.success || false,
      pins_deleted: data?.pins_deleted || 0,
    };
  }

  /**
   * Remove a guest ID from the tracked list
   */
  private static removeFromAllGuestIds(guestId: string): void {
    if (typeof window === 'undefined') {
      return;
    }

    const ids = this.getAllGuestIds();
    const filtered = ids.filter(id => id !== guestId);
    localStorage.setItem(ALL_GUEST_IDS_KEY, JSON.stringify(filtered));
  }

  /**
   * Start fresh with a new guest account
   * Optionally deletes the old account from the database
   * 
   * @param deleteOldAccount - If true, deletes old account from DB (default: false for backwards compat)
   */
  static async startFresh(deleteOldAccount: boolean = false): Promise<string> {
    if (typeof window === 'undefined') {
      throw new Error('Can only start fresh in browser');
    }

    // Optionally delete the old account from the database
    if (deleteOldAccount) {
      try {
        const hasExisting = this.hasGuestData();
        if (hasExisting) {
          await this.deleteAccount();
        }
      } catch (error) {
        console.warn('[GuestAccountService] Error deleting old account during startFresh:', error);
        // Continue anyway - create new profile
      }
    }

    // Create new guest profile (generates new ID, clears name)
    return this.createNewGuestProfile();
  }
}


