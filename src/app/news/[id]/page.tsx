import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import ArticlePageClient from '@/features/news/components/ArticlePageClient';
import { createServiceClient } from '@/lib/supabaseServer';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const supabase = createServiceClient();
  
  // Get article by article_id
  const { data } = await (supabase.rpc as any)('get_news_by_date_range', {
    p_start_date: '2000-01-01',
    p_end_date: '2100-01-01',
  });
  
  const article = (data || []).find((a: any) => a.article_id === params.id);
  
  if (!article) {
    return {
      title: 'Article Not Found | For the Love of Minnesota',
    };
  }

  return {
    title: `${article.title} | For the Love of Minnesota`,
    description: article.snippet || `Read the full article from ${article.source_name}`,
  };
}

export default async function NewsArticlePage({ params }: { params: { id: string } }) {
  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <div className="max-w-7xl mx-auto">
        <ArticlePageClient articleId={params.id} />
      </div>
    </SimplePageLayout>
  );
}

