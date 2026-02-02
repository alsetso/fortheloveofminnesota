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
  searchParams: Promise<{ time?: string }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  try {
    const auth = await getServerAuth();
    
    if (!auth) {
      redirect('/');
    }

    // Get time filter from URL, default to '24h'
    const resolvedSearchParams = await searchParams;
    const timeFilter = (resolvedSearchParams.time as TimeFilter) || '24h';

    const supabase = await createServerClientWithAuth();
    
    // Get active account (respects account dropdown selection)
    const accountId = await getAccountIdForUser(auth, supabase);

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('id, username, view_count, role')
    .eq('id', accountId)
    .maybeSingle();

  if (accountError || !account) {
    redirect('/');
  }

  const username = (account as any)?.username || null;

  // Get mention IDs for filtering
  // Get live map ID first
  const { data: liveMap, error: liveMapError } = await supabase
    .from('map')
    .select('id')
    .eq('slug', 'live')
    .eq('is_active', true)
    .maybeSingle();

  const liveMapId = liveMap && typeof liveMap === 'object' && 'id' in liveMap ? (liveMap as { id: string }).id : null;
  
  // Get live mentions (pins on live map) - only if live map exists
  let liveMentionsData: Array<{ id: string }> | null = null;
  let liveMentionsError = null;
  if (liveMapId) {
    const result = await supabase
      .from('map_pins')
      .select('id', { count: 'exact', head: false })
      .eq('map_id', liveMapId)
      .eq('account_id', accountId)
      .eq('is_active', true)
      .eq('archived', false);
    liveMentionsData = result.data;
    liveMentionsError = result.error;
  }

  const liveMentionsCount = liveMentionsData?.length || 0;
  const liveMentionIds = ((liveMentionsData || []) as Array<{ id: string }>).map(m => m.id);

  // Get total pins (all pins across all maps)
  const { data: allPinsData, error: allPinsError } = await supabase
    .from('map_pins')
    .select('id', { count: 'exact', head: false })
    .eq('account_id', accountId)
    .eq('is_active', true)
    .eq('archived', false);

  const totalPinsCount = allPinsData?.length || 0;
  const mentionIds = ((allPinsData || []) as Array<{ id: string }>).map(m => m.id);

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
    pinViewsAccurate,
    mentionPageViewsAccurate,
    postViewsAccurate,
    mapViewsAccurate,
  ] = await Promise.all([
    (async () => {
      if (!username) return 0;
      let q = supabase
        .from('url_visits')
        .select('*', { count: 'exact', head: true })
        .like('url', `/${username}%`)
        .or(nonSelfOrFilter);
      if (cutoffIso) q = q.gte('viewed_at', cutoffIso);
      const { count, error } = await q;
      if (error) throw error;
      return count || 0;
    })(),
    (async () => {
      // Total Pin Views: views from map clicks (/map?pin={id} and /map?pinId={id})
      if (mentionIds.length === 0) return 0;
      const urls: string[] = [];
      for (const id of mentionIds) {
        urls.push(`/map?pin=${id}`);
        urls.push(`/map?pinId=${id}`);
      }
      return countVisitsForUrls(urls);
    })(),
    (async () => {
      // Total Mention Views: views from mention detail pages (/mention/{id})
      if (mentionIds.length === 0) return 0;
      const urls = mentionIds.map((id) => `/mention/${id}`);
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
  // Profile views: URLs like /{username}
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

  // URL Visit History: Where the CURRENT USER visited (their browsing history)
  // This shows which pages they visited so they know whose analytics they'll appear in
  let userVisitHistory: Array<{
    id: string;
    url: string;
    viewed_at: string;
    account_id: string | null;
    viewer_username: string | null;
    viewer_image_url: string | null;
    viewer_plan: string | null;
    referrer_url: string | null;
    user_agent: string | null;
    view_type: 'profile' | 'mention' | 'post' | 'map' | 'other';
    content_title: string | null;
    content_preview: string | null;
    content_owner_username: string | null;
    content_owner_image_url: string | null;
  }> = [];

  // Determine fetch limit for the event list
  const fetchLimit = timeFilter === 'all' ? 10000 : timeFilter === '90d' ? 5000 : timeFilter === '30d' ? 3000 : timeFilter === '7d' ? 2000 : 1000;

  // Get URL Visit History: Where the current user visited (account_id = current user)
  let userVisitsQuery = supabase
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
        image_url,
        plan
      )
    `)
    .eq('account_id', accountId) // Current user's visits
    .order('viewed_at', { ascending: false })
    .limit(fetchLimit);
  if (cutoffIso) userVisitsQuery = userVisitsQuery.gte('viewed_at', cutoffIso);
  const { data: userVisits } = await userVisitsQuery;

  type UrlVisit = {
    id: string;
    url: string;
    viewed_at: string;
    account_id: string;
    referrer_url: string | null;
    user_agent: string | null;
    viewer: {
      username: string | null;
      image_url: string | null;
      plan: string | null;
    } | null;
  };

  if (userVisits) {
    // Collect unique content IDs to batch fetch
    const mentionIdsToFetch: string[] = [];
    const postIdsToFetch: string[] = [];
    const mapIdsToFetch: string[] = [];
    const mapSlugsToFetch: string[] = [];

    for (const visit of userVisits as UrlVisit[]) {
      const url = visit.url;
      if (url.includes('/mention/') || url.includes('?pin=') || url.includes('?pinId=')) {
        const mentionId = extractMentionId(url);
        if (mentionId) mentionIdsToFetch.push(mentionId);
      } else if (url.includes('/post/')) {
        const postId = extractPostId(url);
        if (postId) postIdsToFetch.push(postId);
      } else if (url.includes('/map/')) {
        const { mapId, isSlug } = extractMapId(url);
        if (mapId) {
          if (isSlug) {
            mapSlugsToFetch.push(mapId);
          } else {
            mapIdsToFetch.push(mapId);
          }
        }
      }
    }

    // Batch fetch content data with account_id to check ownership and get owner info
    const [mentionsData, postsData, mapsByIdData, mapsBySlugData] = await Promise.all([
      mentionIdsToFetch.length > 0
        ? supabase.from('map_pins').select('id, description, account_id, account:accounts!map_pins_account_id_fkey(username, image_url)').in('id', [...new Set(mentionIdsToFetch)])
        : Promise.resolve({ data: [] }),
      postIdsToFetch.length > 0
        ? supabase.from('posts').select('id, title, content, account_id, account:accounts!posts_account_id_fkey(username, image_url)').in('id', [...new Set(postIdsToFetch)])
        : Promise.resolve({ data: [] }),
      mapIdsToFetch.length > 0
        ? supabase.from('map').select('id, title, description').in('id', [...new Set(mapIdsToFetch)])
        : Promise.resolve({ data: [] }),
      mapSlugsToFetch.length > 0
        ? supabase.from('map').select('id, title, description, custom_slug').in('custom_slug', [...new Set(mapSlugsToFetch)])
        : Promise.resolve({ data: [] }),
    ]);

    // Fetch account info for profile visits
    const profileUsernames = (userVisits as UrlVisit[])
      .map(v => {
        const url = v.url;
        if (url.match(/^\/[^/?#]+$/)) {
          return url.slice(1).split('?')[0];
        }
        return null;
      })
      .filter((u): u is string => u !== null && u.toLowerCase() !== username?.toLowerCase());
    
    const uniqueProfileUsernames = [...new Set(profileUsernames)];
    let profileAccountsMap = new Map<string, { username: string | null; image_url: string | null }>();
    if (uniqueProfileUsernames.length > 0) {
      const { data: profileAccounts } = await supabase
        .from('accounts')
        .select('username, image_url')
        .in('username', uniqueProfileUsernames);
      if (profileAccounts) {
        profileAccountsMap = new Map(
          profileAccounts.map((a: any) => [a.username?.toLowerCase() || '', { username: a.username, image_url: a.image_url }])
        );
      }
    }

    const mentionsMap = new Map((mentionsData.data || []).map((m: any) => [
      m.id,
      {
        description: m.description || '',
        account_id: m.account_id,
        owner_username: m.account?.username || null,
        owner_image_url: m.account?.image_url || null,
      }
    ]));
    const postsMap = new Map((postsData.data || []).map((p: any) => [
      p.id,
      {
        title: p.title || null,
        content: p.content || '',
        account_id: p.account_id,
        owner_username: p.account?.username || null,
        owner_image_url: p.account?.image_url || null,
      }
    ]));
    const mapsByIdMap = new Map((mapsByIdData.data || []).map((m: any) => [m.id, { title: m.title || null, description: m.description || null }]));
    const mapsBySlugMap = new Map((mapsBySlugData.data || []).map((m: any) => [m.custom_slug, { title: m.title || null, description: m.description || null, id: m.id }]));

    // Build user visit history, filtering out visits to own content
    for (const visit of userVisits as UrlVisit[]) {
      const url = visit.url;
      let viewType: 'profile' | 'mention' | 'post' | 'map' | 'other' = 'other';
      let contentTitle: string | null = null;
      let contentPreview: string | null = null;
      let isOwnContent = false;

      let contentOwnerUsername: string | null = null;
      let contentOwnerImageUrl: string | null = null;

      if (url.includes('/mention/') || url.includes('?pin=') || url.includes('?pinId=')) {
        viewType = 'mention';
        const mentionId = extractMentionId(url);
        if (mentionId) {
          const mentionData = mentionsMap.get(mentionId);
          if (mentionData) {
            // Check if this mention belongs to the current user
            if (mentionData.account_id === accountId) {
              isOwnContent = true;
            } else {
              contentTitle = mentionData.description.length > 60 ? mentionData.description.slice(0, 60) + '...' : mentionData.description;
              contentPreview = mentionData.description;
              contentOwnerUsername = mentionData.owner_username;
              contentOwnerImageUrl = mentionData.owner_image_url;
            }
          } else {
            contentTitle = 'Mention';
          }
        } else {
          contentTitle = 'Mention';
        }
      } else if (url.includes('/post/')) {
        viewType = 'post';
        const postId = extractPostId(url);
        if (postId) {
          const postData = postsMap.get(postId);
          if (postData) {
            // Check if this post belongs to the current user
            if (postData.account_id === accountId) {
              isOwnContent = true;
            } else {
              contentTitle = postData.title || (postData.content.length > 60 ? postData.content.slice(0, 60) + '...' : postData.content) || 'Post';
              contentPreview = postData.content || null;
              contentOwnerUsername = postData.owner_username;
              contentOwnerImageUrl = postData.owner_image_url;
            }
          } else {
            contentTitle = 'Post';
          }
        } else {
          contentTitle = 'Post';
        }
      } else if (url.match(/^\/[^/?#]+$/)) {
        viewType = 'profile';
        const profileUsername = url.slice(1).split('?')[0];
        // Check if this is the user's own profile
        if (profileUsername.toLowerCase() === username?.toLowerCase()) {
          isOwnContent = true;
        } else {
          contentTitle = `Profile: ${profileUsername}`;
          const profileAccount = profileAccountsMap.get(profileUsername.toLowerCase());
          if (profileAccount) {
            contentOwnerUsername = profileAccount.username;
            contentOwnerImageUrl = profileAccount.image_url;
          }
        }
      } else if (url.includes('/map/')) {
        viewType = 'map';
        const { mapId, isSlug } = extractMapId(url);
        if (mapId) {
          // Check if this map belongs to the current user
          if (isSlug) {
            if (mapSlugs.includes(mapId)) {
              isOwnContent = true;
            } else {
              const mapData = mapsBySlugMap.get(mapId);
              if (mapData) {
                contentTitle = mapData.title || 'Map';
                contentPreview = mapData.description || null;
              } else {
                contentTitle = 'Map';
              }
            }
          } else {
            if (mapIds.includes(mapId)) {
              isOwnContent = true;
            } else {
              const mapData = mapsByIdMap.get(mapId);
              if (mapData) {
                contentTitle = mapData.title || 'Map';
                contentPreview = mapData.description || null;
              } else {
                contentTitle = 'Map';
              }
            }
          }
        }
      }

      // Only add to history if it's not the user's own content
      if (!isOwnContent) {
        userVisitHistory.push({
          id: visit.id,
          url: visit.url,
          viewed_at: visit.viewed_at,
          account_id: visit.account_id,
          viewer_username: visit.viewer?.username || null,
          viewer_image_url: visit.viewer?.image_url || null,
          viewer_plan: visit.viewer?.plan || null,
          referrer_url: visit.referrer_url,
          user_agent: visit.user_agent,
          view_type: viewType,
          content_title: contentTitle,
          content_preview: contentPreview,
          content_owner_username: contentOwnerUsername,
          content_owner_image_url: contentOwnerImageUrl,
        });
      }
    }
  }

  // Map Views: Views OF the current user's maps (where others viewed their maps)
  let mapViewsList: Array<{
    id: string;
    url: string;
    viewed_at: string;
    account_id: string | null;
    viewer_username: string | null;
    viewer_image_url: string | null;
    viewer_plan: string | null;
    referrer_url: string | null;
    user_agent: string | null;
    view_type: 'map';
    content_title: string | null;
    content_preview: string | null;
  }> = [];

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
          image_url,
          plan
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

      mapViewsList = mapVisitsWithIds.map((visit: any) => {
        const mapData = visit.isSlug 
          ? mapsBySlugMap.get(visit.mapId)
          : mapsByIdMap.get(visit.mapId);
        
        const title = mapData?.title || 'Map';
        
        return {
          id: visit.id,
          url: visit.url,
          viewed_at: visit.viewed_at,
          account_id: visit.account_id,
          viewer_username: visit.viewer?.username || null,
          viewer_image_url: visit.viewer?.image_url || null,
          viewer_plan: visit.viewer?.plan || null,
          referrer_url: visit.referrer_url,
          user_agent: visit.user_agent,
          view_type: 'map' as const,
          content_title: title,
          content_preview: mapData?.description || null,
        };
      });
    }
  }

  // Sort user visit history by viewed_at descending and remove duplicates
  userVisitHistory = userVisitHistory
    .filter((view, index, self) => 
      index === self.findIndex(v => v.id === view.id)
    )
    .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());

  // Sort map views by viewed_at descending and remove duplicates
  mapViewsList = mapViewsList
    .filter((view, index, self) => 
      index === self.findIndex(v => v.id === view.id)
    )
    .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime());

  // Check if user has access to visitor identities feature
  const hasVisitorIdentitiesAccess = await hasFeatureAccess('visitor_identities');
  const isAdmin = account && (account as any).role === 'admin';
  
  // Admins and paid users can see viewer identities
  const canSeeViewerIdentities = hasVisitorIdentitiesAccess || isAdmin;

  // Limit to reasonable number for initial load (pagination will handle more)
  const initialLoadLimit = timeFilter === 'all' ? 1000 : 500;
  userVisitHistory = userVisitHistory.slice(0, initialLoadLimit);
  mapViewsList = mapViewsList.slice(0, initialLoadLimit);

  // For user visit history, viewer info is the current user (they're viewing their own history)
  // For map views, sanitize viewer details if user doesn't have access
  const sanitizedMapViews = canSeeViewerIdentities
    ? mapViewsList
    : mapViewsList.map(view => ({
        ...view,
        viewer_username: null,
        viewer_image_url: null,
        viewer_plan: null,
        account_id: null,
      }));

    return (
      <AnalyticsClient
        profileViews={profileViewsAccurate}
        pinViews={pinViewsAccurate}
        mentionPageViews={mentionPageViewsAccurate}
        postViews={postViewsAccurate}
        mapViews={mapViewsAccurate}
        liveMentions={liveMentionsCount}
        totalPins={totalPinsCount}
        userVisitHistory={userVisitHistory}
        mapViewsList={sanitizedMapViews}
        hasVisitorIdentitiesAccess={canSeeViewerIdentities}
        timeFilter={timeFilter}
        isAdmin={isAdmin || false}
      />
    );
  } catch (error) {
    console.error('[AnalyticsPage] Error loading analytics:', error);
    // Log the error and rethrow so error boundary can handle it
    // This will show the error page instead of silently redirecting
    throw error;
  }
}
