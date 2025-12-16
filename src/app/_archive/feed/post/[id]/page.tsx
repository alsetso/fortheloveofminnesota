import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { Database } from '@/types/supabase';
import FeedPostPageClient from './FeedPostPageClient';
import { cache } from 'react';

type Props = {
  params: Promise<{ id: string }>;
};

function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

function formatArea(area: number): string {
  return `${formatNumber(area)} sq mi`;
}

// Cache cities and counties data - these change infrequently
const getCitiesData = cache(async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  const { data, error } = await supabase
    .from('cities')
    .select('id, name, slug, population, county')
    .order('population', { ascending: false });
  
  if (error) {
    console.error('Error fetching cities:', error);
  }
  
  return data || [];
});

const getCountiesData = cache(async () => {
  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Server components can't set cookies
        },
      },
    }
  );
  const { data, error } = await supabase
    .from('counties')
    .select('id, name, slug, population, area_sq_mi')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('Error fetching counties:', error);
  }
  
  return data || [];
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const url = `${baseUrl}/feed/post/${id}`;

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Server components can't set cookies
          },
        },
      }
    );

    // Fetch post for metadata - try slug first, then ID
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let post: Post | null = null;
    if (isUUID) {
      const result = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();
      post = result.data;
    } else {
      // Simple schema doesn't have slugs, so if not UUID, treat as not found
      post = null;
    }

    if (!post) {
      return {
        title: 'Post Not Found | MNUDA',
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    // Fetch account data (simple schema uses account_id directly)
    let account: AccountInfo | null = null;
    if (post.account_id) {
      const { data: accountData } = await supabase
        .from('accounts')
        .select('first_name, last_name')
        .eq('id', post.account_id)
        .single();
      account = accountData;
    }

    if (post.visibility === 'draft') {
      return {
        title: 'Post Not Found | MNUDA',
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const authorName = account 
      ? `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'MNUDA Member'
      : 'MNUDA Member';

    const description = post.excerpt || 
      (post.content ? post.content.substring(0, 160).replace(/\n/g, ' ') : '') ||
      `Read ${authorName}'s post on MNUDA - Minnesota's real estate network.`;

    // Simple schema doesn't have city/county data
    const locationText = '';

    // Simple schema doesn't have images column - use default
    const firstImage = '/logo.png';

    const postTitle = post.title || post.content?.substring(0, 60).replace(/\n/g, ' ') || 'Post';
    const fullTitle = `${postTitle} | MNUDA - Minnesota Real Estate Network`;
    const fullDescription = `${description}${locationText}. Join Minnesota's premier real estate community for developers, investors, and homeowners.`;

    return {
      title: fullTitle,
      description: fullDescription,
      keywords: `Minnesota real estate, real estate network Minnesota, MNUDA feed, Minnesota property, Minnesota developers, Minnesota investors, Minnesota homeowners, real estate community Minnesota`,
      alternates: {
        canonical: url,
      },
      openGraph: {
        title: fullTitle,
        description: fullDescription,
        url,
        siteName: 'MNUDA - Minnesota Real Estate Network',
        type: 'article',
        publishedTime: post.created_at,
        modifiedTime: post.updated_at || post.created_at,
        authors: [authorName],
        section: 'Real Estate',
        tags: ['Minnesota', 'Real Estate', 'Property', 'Development', 'Investment'],
        images: [
          {
            url: firstImage.startsWith('http') ? firstImage : `${baseUrl}${firstImage}`,
            width: 1200,
            height: 630,
            alt: post.title || 'Post',
          },
        ],
        locale: 'en_US',
      },
      twitter: {
        card: 'summary_large_image',
        title: fullTitle,
        description: fullDescription,
        images: [firstImage.startsWith('http') ? firstImage : `${baseUrl}${firstImage}`],
        creator: '@mnuda',
        site: '@mnuda',
      },
      robots: {
        index: post.visibility === 'public',
        follow: post.visibility === 'public',
        googleBot: {
          index: post.visibility === 'public',
          follow: post.visibility === 'public',
          'max-video-preview': -1,
          'max-image-preview': 'large',
          'max-snippet': -1,
        },
      },
      other: {
        'article:author': authorName,
        'article:published_time': post.created_at,
        'article:modified_time': post.updated_at || post.created_at,
        'article:section': 'Real Estate',
        'article:tag': 'Minnesota, Real Estate, Property',
      },
    };
  } catch (error) {
    console.error('Error generating metadata:', error);
    return {
      title: 'Post | MNUDA',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

function generateStructuredData(post: Post, id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com';
  const account = post.accounts;
  const authorName = account 
    ? `${account.first_name || ''} ${account.last_name || ''}`.trim() || 'MNUDA Member'
    : 'MNUDA Member';
  
  // Simple schema doesn't have city/county data
  const location = '';
  // Simple schema uses UUID only, no slugs
  const postUrl = id;

  // Article structured data
  const articleData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title || post.content?.substring(0, 100) || 'Post',
    description: post.excerpt || post.content.substring(0, 200),
    author: {
      '@type': 'Person',
      name: authorName,
      ...(account?.username && {
        url: `${baseUrl}/profile/${account.username}`,
      }),
    },
    publisher: {
      '@type': 'Organization',
      name: 'MNUDA',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
        width: 1200,
        height: 630,
      },
      sameAs: [
        'https://twitter.com/mnuda',
        'https://facebook.com/mnuda',
        'https://linkedin.com/company/mnuda',
      ],
    },
    datePublished: post.created_at,
    dateModified: post.updated_at || post.created_at,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/feed/post/${postUrl}`,
    },
    ...(location && {
      contentLocation: {
        '@type': 'Place',
        name: location,
        address: {
          '@type': 'PostalAddress',
          addressLocality: cityName || 'Minnesota',
          addressRegion: 'MN',
          addressCountry: 'US',
        },
      },
    }),
    // Simple schema doesn't have images column
    ...(post.view_count && {
      interactionStatistic: {
        '@type': 'InteractionCounter',
        interactionType: 'https://schema.org/ViewAction',
        userInteractionCount: post.view_count,
      },
    }),
  };

  // Breadcrumb structured data
  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: baseUrl,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Feed',
        item: `${baseUrl}/`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${baseUrl}/feed/post/${id}`,
      },
    ],
  };

  // Organization structured data for brand recognition
  const organizationData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'MNUDA',
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: 'Minnesota&apos;s premier real estate network connecting developers, investors, and homeowners',
    address: {
      '@type': 'PostalAddress',
      addressRegion: 'MN',
      addressCountry: 'US',
    },
    sameAs: [
      'https://twitter.com/mnuda',
      'https://facebook.com/mnuda',
      'https://linkedin.com/company/mnuda',
    ],
  };

  return [articleData, breadcrumbData, organizationData];
}

export default async function FeedPostPage({ params }: Props) {
  const { id } = await params;

  // Fetch cities and counties in parallel
  const [citiesData, countiesData] = await Promise.all([
    getCitiesData(),
    getCountiesData(),
  ]);

  type CityData = {
    id: number;
    name: string;
    slug: string | null;
    population: number;
    county: string | null;
  };

  type CountyData = {
    id: number;
    name: string;
    slug: string | null;
    population: number;
    area_sq_mi: number | null;
  };

  const cities = (citiesData as CityData[])
    .filter((city): city is CityData & { slug: string } => !!city.slug)
    .map(city => ({
      id: String(city.id),
      name: city.name,
      slug: city.slug,
      population: formatNumber(city.population),
      county: city.county ?? '',
    }));

  const counties = (countiesData as CountyData[])
    .filter((county): county is CountyData & { slug: string } => !!county.slug)
    .map(county => ({
      id: String(county.id),
      name: county.name,
      slug: county.slug,
      population: formatNumber(county.population),
      area: formatArea(county.area_sq_mi ?? 0),
    }));

  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Server components can't set cookies
          },
        },
      }
    );

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    const isAuthenticated = !authError && !!user;

    // Try to fetch by slug first, then by ID (backward compatible)
    // Check if id is a UUID format (8-4-4-4-12 hex pattern)
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    
    let feedPost: Post | null = null;
    let feedPostError: { message: string; code?: string } | null = null;

    if (isUUID) {
      // Fetch by ID (simple schema uses UUID only, no slugs)
      const result = await supabase
        .from('posts')
        .select('*')
        .eq('id', id)
        .single();
      feedPost = result.data;
      feedPostError = result.error;
    } else {
      // Simple schema doesn't have slugs - treat as not found
      feedPost = null;
      feedPostError = { message: 'Post not found - invalid ID format' };
    }

    if (feedPostError || !feedPost) {
      console.error('Post fetch error:', {
        id,
        isUUID,
        error: feedPostError,
        hasPost: !!feedPost
      });
      notFound();
    }

    // Fetch account data (simple schema uses account_id directly)
    let accountInfo: AccountInfo | null = null;
    if (feedPost.account_id) {
      const { data: account } = await supabase
        .from('accounts')
        .select('id, first_name, last_name, image_url, username')
        .eq('id', feedPost.account_id)
        .single();
      accountInfo = account;
    }

    // Check if draft - only allow if user owns the post
    if (feedPost.visibility === 'draft') {
      if (!isAuthenticated || !user) {
        notFound();
      }
      
      // Check if user owns the account
      if (feedPost.account_id && accountInfo) {
        const { data: account } = await supabase
          .from('accounts')
          .select('id, user_id')
          .eq('id', feedPost.account_id)
          .eq('user_id', user.id)
          .single();
        
        if (!account || account.user_id !== user.id) {
          notFound();
        }
      } else {
        notFound();
      }
    }

    // Combine post with account data
    const enrichedPost: Post = {
      ...feedPost,
      accounts: accountInfo,
    };

    return <FeedPostPageClient postId={id} initialPost={enrichedPost} cities={cities} counties={counties} />;
  } catch (error) {
    console.error('Error loading feed post:', error);
    notFound();
  }
}


