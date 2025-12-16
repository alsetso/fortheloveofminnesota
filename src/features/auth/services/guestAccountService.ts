import { supabase } from '@/lib/supabase';

const GUEST_ID_KEY = 'mnuda_guest_id';
const GUEST_NAME_KEY = 'mnuda_guest_name';

export interface GuestAccount {
  id: string;
  guest_id: string;
  first_name: string;
  username: string | null;
  image_url: string | null;
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
    }

    return guestId;
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
}


