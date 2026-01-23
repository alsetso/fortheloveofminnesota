import { supabase } from '@/lib/supabase';
import { AccountService } from '@/features/auth/services/memberService';
import type { Collection, CreateCollectionData, UpdateCollectionData } from '@/types/collection';

/**
 * Service for managing collections
 */
export class CollectionService {
  /**
   * Fetch all collections for an account
   */
  static async getCollections(accountId: string): Promise<Collection[]> {
    const { data, error } = await supabase
      .from('collections')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[CollectionService] Error fetching collections:', error);
      throw new Error(`Failed to fetch collections: ${error.message}`);
    }

    return (data || []) as Collection[];
  }

  /**
   * Create a new collection
   * Requires authenticated user
   * Enforces plan-based limits: hobby = 3, pro = 10
   */
  static async createCollection(data: CreateCollectionData): Promise<Collection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to create collections');
    }

    // Ensure account exists (creates if needed)
    const account = await AccountService.ensureAccountExists();

    // Check current collection count
    const { count, error: countError } = await supabase
      .from('collections')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', account.id);

    if (countError) {
      console.error('[CollectionService] Error counting collections:', countError);
      throw new Error('Failed to check collection limit');
    }

    // Determine limit based on plan
    const plan = (account as { plan: string | null }).plan || 'hobby';
    const isPro = plan === 'contributor' || plan === 'plus';
    const maxCollections = isPro ? null : 3; // null means unlimited for Contributor
    const currentCount = count || 0;

    if (maxCollections !== null && currentCount >= maxCollections) {
      throw new Error(`Hobby plan allows up to ${maxCollections} collections. Upgrade to Contributor for unlimited collections.`);
    }

    const { data: collection, error } = await supabase
      .from('collections')
      .insert({
        account_id: account.id,
        emoji: data.emoji || '📍',
        title: data.title,
        description: data.description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[CollectionService] Error creating collection:', error);
      throw new Error(`Failed to create collection: ${error.message}`);
    }

    return collection as Collection;
  }

  /**
   * Update an existing collection
   * User must own the collection
   */
  static async updateCollection(collectionId: string, data: UpdateCollectionData): Promise<Collection> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update collections');
    }

    const { data: collection, error } = await supabase
      .from('collections')
      .update(data)
      .eq('id', collectionId)
      .select()
      .single();

    if (error) {
      console.error('[CollectionService] Error updating collection:', error);
      throw new Error(`Failed to update collection: ${error.message}`);
    }

    return collection as Collection;
  }

  /**
   * Delete a collection
   * User must own the collection
   */
  static async deleteCollection(collectionId: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to delete collections');
    }

    const { error } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);

    if (error) {
      console.error('[CollectionService] Error deleting collection:', error);
      throw new Error(`Failed to delete collection: ${error.message}`);
    }
  }

  /**
   * Update a mention's collection
   */
  static async updateMentionCollection(mentionId: string, collectionId: string | null): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('You must be signed in to update mentions');
    }

    const { error } = await supabase
      .from('mentions')
      .update({ collection_id: collectionId })
      .eq('id', mentionId);

    if (error) {
      console.error('[CollectionService] Error updating mention collection:', error);
      throw new Error(`Failed to update mention collection: ${error.message}`);
    }
  }
}



