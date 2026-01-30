import { supabase } from '@/lib/supabase';
import { withAuthRetry } from '@/lib/authHelpers';

export type AccountRole = 'general' | 'admin';
export type ProfileType = 'homeowner' | 'renter' | 'student' | 'worker' | 'business';

// Legacy alias for backward compatibility during migration
export type AccountType = ProfileType;

export type AccountTrait = 
  // ❤️ Emotional & Meaning
  | 'sentimental'
  | 'nostalgic'
  | 'reflective'
  | 'introspective'
  | 'peace-seeking'
  | 'hopeful'
  | 'healing'
  | 'grateful'
  // 🌲 Care, Stewardship & Responsibility
  | 'steward'
  | 'protector'
  | 'guardian'
  | 'caretaker'
  | 'sustainability-minded'
  | 'prepared'
  | 'duty-driven'
  // 🧭 Exploration & Curiosity
  | 'explorer'
  | 'curious'
  | 'wanderer'
  | 'adventurous'
  | 'experimental'
  | 'traveler'
  // 🏘️ Belonging & Place Identity
  | 'localist'
  | 'rooted'
  | 'neighborhood-focused'
  | 'hometown-proud'
  | 'belonging-driven'
  | 'place-attached'
  // 🧑‍🤝‍🧑 Social & Community Energy
  | 'connector'
  | 'relationship-builder'
  | 'organizer'
  | 'gatherer'
  | 'helper'
  | 'supportive'
  | 'communicative'
  // 🧑‍🎨 Expression & Creativity
  | 'storyteller'
  | 'writer'
  | 'expressive'
  | 'documentarian'
  | 'artistic'
  | 'poetic'
  // 🧠 Observation & Insight
  | 'observer'
  | 'pattern-seeker'
  | 'analytical'
  | 'detail-oriented'
  | 'context-aware'
  | 'systems-thinking'
  // 🧓 Time, Memory & Legacy
  | 'keeper-of-memory'
  | 'historian'
  | 'archivist'
  | 'tradition-oriented'
  | 'legacy-minded'
  | 'remembrance-focused'
  // 🌆🌾 Environment Orientation
  | 'urban-focused'
  | 'city-oriented'
  | 'infrastructure-aware'
  | 'development-curious'
  | 'pedestrian-minded'
  | 'rural-rooted'
  | 'land-connected'
  | 'nature-centered'
  | 'outdoor-oriented'
  | 'solitude-seeking'
  // ⚙️ Practical & Situational Awareness
  | 'problem-solver'
  | 'fixer'
  | 'navigator'
  | 'watchful'
  | 'safety-focused'
  // 🌱 Engagement Style
  | 'quiet-participant'
  | 'conversational'
  | 'selective'
  | 'repeat-visitor'
  | 'saver'
  | 'reactor'
  // 🧘 Energy, Pace & Rhythm
  | 'slow-paced'
  | 'high-energy'
  | 'optimistic'
  | 'contemplative'
  | 'emotionally-fluid'
  | 'seasonally-adaptive'
  // 💼 Economic Participation & Work
  | 'business-owner'
  | 'local-shop-owner'
  | 'hospitality-operator'
  | 'property-owner'
  | 'side-hustler'
  | 'service-provider'
  | 'tradesperson'
  | 'builder'
  | 'technician'
  | 'creative-worker'
  | 'educator'
  | 'care-worker'
  | 'food-worker'
  | 'remote-worker'
  | 'mobile-worker'
  | 'gig-contract-worker'
  | 'student-worker'
  | 'retired-semi-retired'
  // 🔁 Value Creation & Commerce Style
  | 'knowledge-based'
  | 'hands-on'
  | 'creative-driven'
  | 'product-based'
  | 'relationship-based'
  | 'process-driven'
  | 'advisory-focused'
  | 'local-consumer'
  | 'buy-local-advocate'
  | 'circular-economy-minded'
  | 'budget-conscious'
  | 'experience-driven'
  | 'impact-driven'
  | 'formal-business'
  | 'micro-commerce'
  | 'peer-to-peer'
  | 'event-based'
  | 'pop-up-temporary'
  | 'digital-only'
  | 'economy-observant'
  | 'trend-aware'
  | 'place-value-oriented';

export type Plan = 'hobby' | 'contributor' | 'plus' | 'business' | 'gov';
export type BillingMode = 'standard' | 'trial';

export interface Account {
  id: string;
  user_id: string | null; // Null for guest accounts
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  cover_image_url: string | null;
  bio: string | null;
  city_id: string | null;
  view_count: number;
  role: AccountRole;
  traits: AccountTrait[] | null;
  stripe_customer_id: string | null;
  plan: Plan;
  billing_mode: BillingMode;
  subscription_status: string | null;
  stripe_subscription_id: string | null;
  onboarded: boolean;
  search_visibility: boolean;
  account_taggable?: boolean; // Whether this account can be tagged by other users in mentions
  owns_business?: boolean | null;
  created_at: string;
  updated_at: string;
  last_visit: string | null;
  guest_id?: string | null; // For guest accounts
}

export interface UpdateAccountData {
  username?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  image_url?: string | null;
  cover_image_url?: string | null;
  bio?: string | null;
  city_id?: string | null;
  role?: AccountRole;
  traits?: AccountTrait[] | null;
  search_visibility?: boolean;
  account_taggable?: boolean; // Whether this account can be tagged by other users in mentions
  owns_business?: boolean | null;
}

export class AccountService {
  /**
   * Get the current user's account record
   */
  static async getCurrentAccount(): Promise<Account | null> {
    return withAuthRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return null;
      }

      return this.getAccountById(user.id);
    }, 'Get current account');
  }

  /**
   * Get an account by user ID (returns first account for the user)
   */
  static async getAccountById(userId: string): Promise<Account | null> {
    return withAuthRetry(async () => {
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) {
        console.error('Auth error in getAccountById:', authError);
        throw new Error('User not authenticated');
      }

      if (authUser.id !== userId) {
        throw new Error('Unauthorized: Cannot access other user\'s account record');
      }

      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching account:', error);
        throw new Error(`Failed to fetch account: ${error.message}`);
      }

      return data;
    }, 'Get account by ID');
  }

  /**
   * Ensure an account record exists for the current user
   */
  static async ensureAccountExists(): Promise<Account> {
    return withAuthRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let account = await this.getAccountById(user.id);
      
      if (!account) {
        // Create account record if it doesn't exist
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            role: 'general' // Every user automatically gets 'general' role
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating account:', error);
          throw new Error('Failed to create account');
        }

        if (!newAccount) {
          throw new Error('Failed to create account: no data returned');
        }

        account = newAccount;
      }

      if (!account) {
        throw new Error('Account not found and could not be created');
      }

      return account;
    }, 'Ensure account exists');
  }

  /**
   * Validate email format
   */
  private static validateEmail(email: string | null | undefined): boolean {
    if (!email || !email.trim()) return true; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  }

  /**
   * Validate phone format
   */
  private static validatePhone(phone: string | null | undefined): boolean {
    if (!phone || !phone.trim()) return true; // Optional field
    // E.164 format or US format: +1XXXXXXXXXX, (XXX) XXX-XXXX, XXX-XXX-XXXX, etc.
    const phoneRegex = /^\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}$/;
    return phoneRegex.test(phone.trim());
  }

  /**
   * Update the current user's account record
   * @param data - Account data to update
   * @param accountId - Optional account ID to update. If not provided, uses first account (for backward compatibility)
   */
  static async updateCurrentAccount(data: UpdateAccountData, accountId?: string): Promise<Account> {
    return withAuthRetry(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Validate email format if provided
      if (data.email !== undefined && !this.validateEmail(data.email)) {
        throw new Error('Invalid email format');
      }

      // Validate phone format if provided
      if (data.phone !== undefined && !this.validatePhone(data.phone)) {
        throw new Error('Invalid phone format');
      }

      // Remove undefined values
      const cleanedData: UpdateAccountData = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value !== undefined) {
          cleanedData[key as keyof UpdateAccountData] = value;
        }
      });

      let targetAccountId: string;

      if (accountId) {
        // Verify user owns this account
        const { data: account, error: accountError } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', accountId)
          .eq('user_id', user.id)
          .single();

        if (accountError || !account) {
          throw new Error('Account not found or you do not have access to it');
        }
        targetAccountId = account.id;
      } else {
        // Fallback to first account (backward compatibility)
        await this.ensureAccountExists();
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
          .single();

        if (!existingAccount) {
          throw new Error('Account not found');
        }
        targetAccountId = existingAccount.id;
      }

      const { data: account, error } = await supabase
        .from('accounts')
        .update(cleanedData)
        .eq('id', targetAccountId)
        .select()
        .single();

      if (error) {
        console.error('Error updating account:', error);
        throw new Error(`Failed to update account: ${error.message}`);
      }

      return account;
    }, 'Update current account');
  }

  /**
   * Get display name from account record
   */
  static getDisplayName(account: Account | null): string {
    if (!account) return 'Account';
    
    // For guest accounts, prefer first_name
    if (account.user_id === null && account.guest_id) {
      return account.first_name || 'Guest';
    }
    
    // For authenticated users
    if (account.first_name || account.last_name) {
      return `${account.first_name || ''} ${account.last_name || ''}`.trim();
    }
    
    return account.username || 'User';
  }
}

// Legacy aliases for backward compatibility during migration
export type MemberRole = AccountRole;
export type MemberType = AccountType;
export type Member = Account;
export type UpdateMemberData = UpdateAccountData;
export const MemberService = AccountService;
