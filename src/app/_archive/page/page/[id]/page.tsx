import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabaseServer';
import { getServerAuth } from '@/lib/authServer';
import { getServerAccount } from '@/lib/accountServer';
import SimplePageLayout from '@/components/SimplePageLayout';
import BusinessDetailClient, { BusinessWithCities } from '@/app/_archive/business/[id]/BusinessDetailClient';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://mnuda.com';
  const url = `${baseUrl}/page/${id}`;

  try {
    const supabase = createServerClient();
    const { data: page } = await supabase
      .from('pages')
      .select('name, industry, address')
      .eq('id', id)
      .single();

    if (!page) {
      return {
        title: 'Page Not Found | Minnesota Pages Directory | MNUDA',
        robots: {
          index: false,
          follow: false,
        },
      };
    }

    const title = `${page.name} | Minnesota Pages Directory | MNUDA`;
    // Note: category will be fetched separately, so we use a generic description here
    const description = `${page.name}${page.address ? ` located in ${page.address}` : ''}. View page details in the Minnesota Pages Directory.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        siteName: 'MNUDA',
        type: 'website',
      },
      twitter: {
        card: 'summary',
        title,
        description,
      },
      alternates: {
        canonical: url,
      },
      robots: {
        index: true,
        follow: true,
      },
    };
  } catch (error) {
    return {
      title: 'Page Not Found | Minnesota Business Directory | MNUDA',
      robots: {
        index: false,
        follow: false,
      },
    };
  }
}

export default async function PageDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { view } = await searchParams;
  const supabase = createServerClient();
  const auth = await getServerAuth();
  const account = await getServerAccount();

  // Fetch page with category and cities
  const { data: page, error } = await supabase
    .from('pages')
    .select(`
      *,
      category:categories(id, name)
    `)
    .eq('id', id)
    .single();

  if (error || !page) {
    notFound();
  }

  // Check if current user owns this page
  const isOwner = account && page.account_id === account.id;

  // Validate and normalize view mode
  // Only owners can use admin view, non-owners always see visitor view
  let viewMode: 'admin' | 'visitor' = 'visitor';
  if (isOwner) {
    // Owner can toggle between admin and visitor
    if (view === 'visitor') {
      viewMode = 'visitor';
    } else {
      // Default to admin view for owners
      viewMode = 'admin';
    }
  } else {
    // Non-owners always see visitor view (ignore any view param)
    viewMode = 'visitor';
  }

  // Get city IDs from service_areas
  const cityIds = page.service_areas && Array.isArray(page.service_areas) 
    ? page.service_areas 
    : [];

  // Fetch cities
  let cities: Array<{ id: string; name: string }> = [];
  if (cityIds.length > 0) {
    const { data: citiesData } = await supabase
      .from('cities')
      .select('id, name')
      .in('id', cityIds);
    
    if (citiesData) {
      cities = citiesData;
    }
  }

  // Extract category from join (Supabase returns it as an array)
  const category = page.category && Array.isArray(page.category) && page.category.length > 0
    ? page.category[0]
    : null;

  const businessWithCities: BusinessWithCities = {
    ...page,
    category: category ? { id: category.id, name: category.name } : null,
    cities: cities.length > 0 ? cities : null,
  };

  return (
    <SimplePageLayout backgroundColor="bg-[#f4f2ef]" contentPadding="px-0" footerVariant="light" hideFooter>
      <BusinessDetailClient 
        business={businessWithCities} 
        isOwner={isOwner || false}
        viewMode={viewMode}
      />
    </SimplePageLayout>
  );
}
