import { Metadata } from 'next';
import { getServerAuth } from '@/lib/authServer';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { hasFeatureAccess } from '@/lib/billing/featureAccess';
import AnalyticsClient from './AnalyticsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'View your profile, mention, and post analytics',
};

type TimeFilter = '24h' | '7d' | '30d' | '90d' | 'all';

interface AnalyticsPageProps {
  searchParams: { time?: string };
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/');
  }

  // Get time filter from URL, default to '24h'
  const timeFilter = (searchParams.time as TimeFilter) || '24h';

  const supabase = await createServerClientWithAuth();
  
  // Get current user's account
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, username, view_count')
    .eq('user_id', auth.id)
    .maybeSingle();

  if (accountError || !account) {
    redirect('/');
  }

  const accountId = account.id;
  const username = account.username;

  // Get mention views (sum of view_count for user's mentions)
  const { data: mentionsData, error: mentionsError } = await supabase
    .from('mentions')
    .select('id, view_count')
    .eq('account_id', accountId);

  const mentionViews = mentionsData?.reduce((sum, mention) => sum + (mention.view_count || 0), 0) || 0;
  const mentionIds = mentionsData?.map(m => m.id) || [];

  // Get post IDs for filtering
  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select('id')
    .eq('account_id', accountId);

  const postIds = postsData?.map(p => p.id) || [];

  // Profile views from account
  const profileViews = account.view_count || 0;

  // Get all URL visits for this user's content
  // Profile views: URLs like /profile/{username}
  // Mention views: URLs with mention IDs in query params or path
  // Post views: URLs like /post/{id}
  
  // Helper function to extract mention ID from URL
  const extractMentionId = (url: string): string | null => {
    // Try /mention/{id}
    const mentionMatch = url.match(/\/mention\/([a-f0-9-]{36})/i);
    if (mentionMatch) return mentionMatch[1];
    
    // Try ?pin={id} or ?pinId={id}
    const pinMatch = url.match(/[?&](?:pin|pinId)=([a-f0-9-]{36})/i);
    if (pinMatch) return pinMatch[1];
    
    return null;
  };

  // Helper function to extract post ID from URL
  const extractPostId = (url: string): string | null => {
    const postMatch = url.match(/\/post\/([a-f0-9-]{36})/i);
    return postMatch ? postMatch[1] : null;
  };

  let allViews: Array<{
    id: string;
    url: string;
    viewed_at: string;
    account_id: string | null;
    viewer_username: string | null;
    viewer_image_url: string | null;
    referrer_url: string | null;
    user_agent: string | null;
    view_type: 'profile' | 'mention' | 'post' | 'other';
    content_title: string | null;
    content_preview: string | null;
  }> = [];

  // Determine fetch limit based on time filter
  const fetchLimit = timeFilter === 'all' ? 10000 : timeFilter === '90d' ? 5000 : timeFilter === '30d' ? 3000 : timeFilter === '7d' ? 2000 : 1000;

  // Get profile views
  if (username) {
    const { data: profileVisits } = await supabase
      .from('url_visits')
      .select(`
        id,
        url,
        viewed_at,
        account_id,
        referrer_url,
        user_agent,
        viewer:accounts!url_visits_account_id_fkey(
          username,
          image_url
        )
      `)
      .like('url', `/profile/${username}%`)
      .order('viewed_at', { ascending: false })
      .limit(fetchLimit);

    if (profileVisits) {
      allViews.push(...profileVisits.map((visit: any) => ({
        id: visit.id,
        url: visit.url,
        viewed_at: visit.viewed_at,
        account_id: visit.account_id,
        viewer_username: visit.viewer?.username || null,
        viewer_image_url: visit.viewer?.image_url || null,
        referrer_url: visit.referrer_url,
        user_agent: visit.user_agent,
        view_type: 'profile' as const,
        content_title: username ? `Profile: ${username}` : 'Your Profile',
        content_preview: null,
      })));
    }
  }

  // Get mention views - check URLs that might contain mention IDs
  if (mentionIds.length > 0) {
    // Fetch all url_visits and filter for those containing mention IDs
    // This includes URLs like /map?pin={id}, /mention/{id}, etc.
    const { data: allMentionVisits } = await supabase
      .from('url_visits')
      .select(`
        id,
        url,
        viewed_at,
        account_id,
        referrer_url,
        user_agent,
        viewer:accounts!url_visits_account_id_fkey(
          username,
          image_url
        )
      `)
      .or(`url.ilike.%/mention/%,url.ilike.%?pin=%,url.ilike.%?pinId=%`)
      .order('viewed_at', { ascending: false })
      .limit(fetchLimit);

    if (allMentionVisits) {
      // Filter to only include visits for user's mentions and extract IDs
      const mentionVisitsWithIds = allMentionVisits
        .map((visit: any) => {
          const mentionId = extractMentionId(visit.url);
          return { ...visit, mentionId };
        })
        .filter((visit: any) => {
          if (!visit.mentionId) return false;
          return mentionIds.includes(visit.mentionId);
        });

      // Fetch mention content for all unique mention IDs
      const uniqueMentionIds = [...new Set(mentionVisitsWithIds.map((v: any) => v.mentionId))];
      const { data: mentionsContent } = await supabase
        .from('mentions')
        .select('id, description')
        .in('id', uniqueMentionIds);

      const mentionsMap = new Map(
        (mentionsContent || []).map((m: any) => [m.id, m.description || ''])
      );

      allViews.push(...mentionVisitsWithIds.map((visit: any) => {
        const description = mentionsMap.get(visit.mentionId) || '';
        return {
          id: visit.id,
          url: visit.url,
          viewed_at: visit.viewed_at,
          account_id: visit.account_id,
          viewer_username: visit.viewer?.username || null,
          viewer_image_url: visit.viewer?.image_url || null,
          referrer_url: visit.referrer_url,
          user_agent: visit.user_agent,
          view_type: 'mention' as const,
          content_title: description ? (description.length > 60 ? description.slice(0, 60) + '...' : description) : 'Mention',
          content_preview: description || null,
        };
      }));
    }
  }

  // Get post views - URLs like /post/{id}
  let postViews = 0;
  if (postIds.length > 0) {
    const { data: allPostVisits } = await supabase
      .from('url_visits')
      .select(`
        id,
        url,
        viewed_at,
        account_id,
        referrer_url,
        user_agent,
        viewer:accounts!url_visits_account_id_fkey(
          username,
          image_url
        )
      `)
      .like('url', '/post/%')
      .order('viewed_at', { ascending: false })
      .limit(fetchLimit);

    if (allPostVisits) {
      // Filter to only include visits for user's posts and extract IDs
      const postVisitsWithIds = allPostVisits
        .map((visit: any) => {
          const postId = extractPostId(visit.url);
          return { ...visit, postId };
        })
        .filter((visit: any) => {
          if (!visit.postId) return false;
          return postIds.includes(visit.postId);
        });

      // Calculate post views count before adding to allViews
      postViews = postVisitsWithIds.length;

      // Fetch post content for all unique post IDs
      const uniquePostIds = [...new Set(postVisitsWithIds.map((v: any) => v.postId))];
      const { data: postsContent } = await supabase
        .from('posts')
        .select('id, title, content')
        .in('id', uniquePostIds);

      const postsMap = new Map(
        (postsContent || []).map((p: any) => [
          p.id,
          {
            title: p.title || null,
            content: p.content || '',
          }
        ])
      );

      allViews.push(...postVisitsWithIds.map((visit: any) => {
        const postData = postsMap.get(visit.postId);
        const title = postData?.title || '';
        const content = postData?.content || '';
        const displayTitle = title || (content.length > 60 ? content.slice(0, 60) + '...' : content) || 'Post';
        
        return {
          id: visit.id,
          url: visit.url,
          viewed_at: visit.viewed_at,
          account_id: visit.account_id,
          viewer_username: visit.viewer?.username || null,
          viewer_image_url: visit.viewer?.image_url || null,
          referrer_url: visit.referrer_url,
          user_agent: visit.user_agent,
          view_type: 'post' as const,
          content_title: displayTitle,
          content_preview: content || null,
        };
      }));
    }
  }

  // Sort all views by viewed_at descending and remove duplicates
  allViews = allViews
    .filter((view, index, self) => 
      index === self.findIndex(v => v.id === view.id)
    )
    .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());

  // Check if user has access to visitor identities feature
  const hasVisitorIdentitiesAccess = await hasFeatureAccess('visitor_identities');

  // Apply time filter
  const now = new Date();
  let cutoffDate: Date | null = null;
  
  switch (timeFilter) {
    case '24h':
      cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      cutoffDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'all':
      cutoffDate = null; // No filter
      break;
  }

  if (cutoffDate) {
    allViews = allViews.filter(view => new Date(view.viewed_at) >= cutoffDate!);
  }

  // Calculate counts from filtered allViews
  const profileViewsFiltered = allViews.filter(v => v.view_type === 'profile').length;
  const mentionViewsFiltered = allViews.filter(v => v.view_type === 'mention').length;
  const postViewsFiltered = allViews.filter(v => v.view_type === 'post').length;

  // Limit to reasonable number for initial load (pagination will handle more)
  // For "all time", show more initially
  const initialLoadLimit = timeFilter === 'all' ? 1000 : 500;
  allViews = allViews.slice(0, initialLoadLimit);

  // If user doesn't have access, remove viewer details for security
  const sanitizedViews = hasVisitorIdentitiesAccess
    ? allViews
    : allViews.map(view => ({
        ...view,
        viewer_username: null,
        viewer_image_url: null,
        account_id: null, // Hide account_id too
      }));

  return (
    <AnalyticsClient
      profileViews={profileViewsFiltered}
      mentionViews={mentionViewsFiltered}
      postViews={postViewsFiltered}
      allViews={sanitizedViews}
      hasVisitorIdentitiesAccess={hasVisitorIdentitiesAccess}
      timeFilter={timeFilter}
    />
  );
}
