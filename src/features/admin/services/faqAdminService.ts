import { BaseAdminService } from './baseAdminService';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { withAuthRetry } from '@/lib/authHelpers';
import { FAQ, CreateFAQData, UpdateFAQData } from '@/types/faq';

export class FAQAdminService extends BaseAdminService<FAQ, CreateFAQData, UpdateFAQData> {
  protected tableName = 'faqs';

  /**
   * Get all FAQs (admin sees all, public sees only visible)
   */
  async getAll(includeHidden: boolean = false): Promise<FAQ[]> {
    return withAuthRetry(async () => {
      const supabase = await createServerClientWithAuth();
      
      let query = supabase
        .from(this.tableName)
        .select('*');

      if (!includeHidden) {
        query = query.eq('is_visible', true);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching FAQs:', error);
        throw new Error(`Failed to fetch FAQs: ${error.message}`);
      }

      return data || [];
    }, 'Get all FAQs');
  }

  /**
   * Get visible FAQs for public display
   */
  async getVisible(): Promise<FAQ[]> {
    return withAuthRetry(async () => {
      const supabase = await createServerClientWithAuth();
      
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .eq('is_visible', true)
        .not('answer', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching visible FAQs:', error);
        throw new Error(`Failed to fetch visible FAQs: ${error.message}`);
      }

      return data || [];
    }, 'Get visible FAQs');
  }
}
