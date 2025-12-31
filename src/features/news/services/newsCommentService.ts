/**
 * News comment service utilities
 */

import { createServiceClient } from '@/lib/supabaseServer';

/**
 * Get generated_id (UUID) from article_id (TEXT)
 * Returns null if article not found
 */
export async function getGeneratedIdFromArticleId(articleId: string): Promise<string | null> {
  const supabase = createServiceClient();

  // Validate articleId format (basic check)
  if (!articleId || typeof articleId !== 'string' || articleId.trim().length === 0) {
    return null;
  }

  const { data: generatedArticle, error } = await supabase
    .schema('news')
    .from('generated')
    .select('id')
    .eq('article_id', articleId.trim())
    .single();

  if (error || !generatedArticle) {
    return null;
  }

  return generatedArticle.id;
}

