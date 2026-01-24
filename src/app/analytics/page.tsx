import { Metadata } from 'next';
import { getServerAuth } from '@/lib/authServer';
import { createServerClientWithAuth } from '@/lib/supabaseServer';
import { redirect } from 'next/navigation';
import { hasFeatureAccess } from '@/lib/billing/featureAccess';
import AnalyticsClient from './AnalyticsClient';
import { getAccountIdForUser } from '@/lib/server/getAccountId';

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
  
  // Get active account (respects account dropdown selection)
  const accountId = await getAccountIdForUser(auth, supabase);

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, username, view_count')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError || !account) {
    redirect('/');
  }

  const username = (account as any)?.username || null;

  // Get mention IDs for filtering
  const { data: mentionsData, error: mentionsError } = await supabase
    .from('mentions')
    .select('id')
    .eq('account_id', accountId)
    .returns<Array<{ id: string }>>();

  const mentionIds = mentionsData?.map(m => m.id) || [];

  // Get post IDs for filtering
  const { data: postsData, error: postsError } = await supabase
    .from('posts')
    .select('id')
    .eq('account_id', accountId)
    .returns<Array<{ id: string }>>();

  const postIds = postsData?.map(p => p.id) || [];

  // Get map IDs for filtering (both UUID and custom_slug)
  const { data: mapsData, error: mapsError } = await supabase
    .from('map')
    .select('id, custom_slug')
    .eq('account_id', accountId)
    .returns<Array<{ id: string; custom_slug: string | null }>>();

  const mapIds = mapsData?.map(m => m.id) || [];
  const mapSlugs = mapsData?.filter(m => m.custom_slug).map(m => m.custom_slug!).filter(Boolean) || [];
  const mapIdToSlug = new Map(mapsData?.filter(m => m.custom_slug).map(m => [m.id, m.custom_slug!]) || []);

  // Helper: chunk an array for batched IN queries
  const chunk = <T,>(items: T[], size: number): T[][] => {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += size) {
      batches.push(items.slice(i, i + size));
    }
    return batches;
  };

  // Determine time cutoff (used for accurate SQL counts)
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
      cutoffDate = null;
      break;
  }
  const cutoffIso = cutoffDate ? cutoffDate.toISOString() : null;

  // Helper: exclude self-views (match record_url_visit account view_count semantics)
  const nonSelfOrFilter = `account_id.is.null,account_id.neq.${accountId}`;

  // Accurate counts (authoritative): derived from url_visits counts, not from limited event fetches
  const countVisitsForUrls = async (urls: string[]): Promise<number> => {
    if (urls.length === 0) return 0;
    let total = 0;
    for (const batch of chunk(Array.from(new Set(urls)), 200)) {
      let q = supabase
        .from('url_visits')
        .select('*', { count: 'exact', head: true })
        .in('url', batch)
        .or(nonSelfOrFilter);
      if (cutoffIso) q = q.gte('viewed_at', cutoffIso);
      const { count, error } = await q;
      if (error) throw error;
      total += count || 0;
    }
    return total;
  };

  const [
    profileViewsAccurate,
    mentionViewsAccurate,
    postViewsAccurate,
    mapViewsAccurate,
  ] = await Promise.all([
    (async () => {
      if (!username) return 0;
      let q = supabase
        .from('url_visits')
        .select('*', { count: 'exact', head: true })
        .like('url', `/profile/${username}%`)
        .or(nonSelfOrFilter);
      if (cutoffIso) q = q.gte('viewed_at', cutoffIso);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    })(),
    (async () => {
      if (mentionIds.length === 0) return 0;
      const urls: string[] = [];
      for (const id of mentionIds) {
        urls.push(`/mention/${id}`);
        urls.push(`/map?pin=${id}`);
        urls.push(`/map?pinId=${id}`);
      }
      return countVisitsForUrls(urls);
    })(),
    (async () => {
      if (postIds.length === 0) return 0;
      const urls = postIds.map((id) => `/post/${id}`);
      return countVisitsForUrls(urls);
    })(),
    (async () => {
      if (mapsData && mapsData.length > 0) {
        const urls: string[] = [];
        for (const m of mapsData) {
          urls.push(`/map/${m.id}`);
          if (m.custom_slug) urls.push(`/map/${m.custom_slug}`);
        }
        return countVisitsForUrls(urls);
      }
      return 0;
    })(),
  ]);

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

  // Helper function to extract map ID or slug from URL
  const extractMapId = (url: string): { mapId: string | null; isSlug: boolean } => {
    // Try /map/{uuid} format
    const uuidMatch = url.match(/^\/map\/([a-f0-9-]{36})(?:\?|$)/i);
    if (uuidMatch) {
      return { mapId: uuidMatch[1], isSlug: false };
    }
    
    // Try /map/{slug} format (custom slug)
    const slugMatch = url.match(/^\/map\/([a-z0-9-]+)(?:\?|$)/i);
    if (slugMatch) {
      return { mapId: slugMatch[1], isSlug: true };
    }
    
    return { mapId: null, isSlug: false };
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
    view_type: 'profile' | 'mention' | 'post' | 'map' | 'other';
    content_title: string | null;
    content_preview: string | null;
  }> = [];

  // Determine fetch limit for the event list (not used for totals)
  const fetchLimit = timeFilter === 'all' ? 10000 : timeFilter === '90d' ? 5000 : timeFilter === '30d' ? 3000 : timeFilter === '7d' ? 2000 : 1000;

  // Get profile views
  if (username) {
    let profileVisitsQuery = supabase
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
    if (cutoffIso) profileVisitsQuery = profileVisitsQuery.gte('viewed_at', cutoffIso);
    const { data: profileVisits } = await profileVisitsQuery;

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
    let allMentionVisitsQuery = supabase
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
    if (cutoffIso) allMentionVisitsQuery = allMentionVisitsQuery.gte('viewed_at', cutoffIso);
    const { data: allMentionVisits } = await allMentionVisitsQuery;

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
    let allPostVisitsQuery = supabase
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
    if (cutoffIso) allPostVisitsQuery = allPostVisitsQuery.gte('viewed_at', cutoffIso);
    const { data: allPostVisits } = await allPostVisitsQuery;

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

  // Get map views - URLs like /map/{id} or /map/{custom_slug}
  let mapViews = 0;
  if (mapIds.length > 0 || mapSlugs.length > 0) {
    let allMapVisitsQuery = supabase
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
      .like('url', '/map/%')
      .order('viewed_at', { ascending: false })
      .limit(fetchLimit);
    if (cutoffIso) allMapVisitsQuery = allMapVisitsQuery.gte('viewed_at', cutoffIso);
    const { data: allMapVisits } = await allMapVisitsQuery;

    if (allMapVisits) {
      // Filter to only include visits for user's maps
      const mapVisitsWithIds = allMapVisits
        .map((visit: any) => {
          const { mapId, isSlug } = extractMapId(visit.url);
          return { ...visit, mapId, isSlug };
        })
        .filter((visit: any) => {
          if (!visit.mapId) return false;
          // Check if it's a UUID in our mapIds, or a slug in our mapSlugs
          if (visit.isSlug) {
            return mapSlugs.includes(visit.mapId);
          } else {
            return mapIds.includes(visit.mapId);
          }
        });

      // Calculate map views count
      mapViews = mapVisitsWithIds.length;

      // Fetch map content for all unique map IDs and slugs
      const uniqueMapIds = [...new Set(mapVisitsWithIds.filter((v: any) => !v.isSlug).map((v: any) => v.mapId))];
      const uniqueMapSlugs = [...new Set(mapVisitsWithIds.filter((v: any) => v.isSlug).map((v: any) => v.mapId))];
      
      const mapsContent: Array<{ id: string; title: string | null; description: string | null; custom_slug: string | null }> = [];
      
      if (uniqueMapIds.length > 0) {
        const { data: mapsById } = await supabase
          .from('map')
          .select('id, title, description, custom_slug')
          .in('id', uniqueMapIds);
        if (mapsById) mapsContent.push(...mapsById);
      }
      
      if (uniqueMapSlugs.length > 0) {
        const { data: mapsBySlug } = await supabase
          .from('map')
          .select('id, title, description, custom_slug')
          .in('custom_slug', uniqueMapSlugs);
        if (mapsBySlug) mapsContent.push(...mapsBySlug);
      }

      // Create lookup maps: by ID and by slug
      const mapsByIdMap = new Map(
        mapsContent.map((m: any) => [
          m.id,
          {
            title: m.title || null,
            description: m.description || null,
            custom_slug: m.custom_slug || null,
          }
        ])
      );

      const mapsBySlugMap = new Map(
        mapsContent.filter(m => m.custom_slug).map((m: any) => [
          m.custom_slug,
          {
            title: m.title || null,
            description: m.description || null,
            id: m.id,
            custom_slug: m.custom_slug,
          }
        ])
      );

      allViews.push(...mapVisitsWithIds.map((visit: any) => {
        const mapData = visit.isSlug 
          ? mapsBySlugMap.get(visit.mapId)
          : mapsByIdMap.get(visit.mapId);
        
        const title = mapData?.title || 'Map';
        const mapUrl = mapData?.custom_slug 
          ? `/map/${mapData.custom_slug}`
          : `/map/${visit.mapId}`;
        
        return {
          id: visit.id,
          url: visit.url,
          viewed_at: visit.viewed_at,
          account_id: visit.account_id,
          viewer_username: visit.viewer?.username || null,
          viewer_image_url: visit.viewer?.image_url || null,
          referrer_url: visit.referrer_url,
          user_agent: visit.user_agent,
          view_type: 'map' as const,
          content_title: title,
          content_preview: mapData?.description || null,
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

  // Note: totals are computed from SQL counts (above); allViews is for event detail display only.

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
      profileViews={profileViewsAccurate}
      mentionViews={mentionViewsAccurate}
      postViews={postViewsAccurate}
      mapViews={mapViewsAccurate}
      allViews={sanitizedViews}
      hasVisitorIdentitiesAccess={hasVisitorIdentitiesAccess}
      timeFilter={timeFilter}
    />
  );
}
