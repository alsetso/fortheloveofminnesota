import type { NextConfig } from "next";

// Extract Supabase hostname from environment variable
const getSupabaseHostname = (): string | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    return url.hostname;
  } catch {
    return null;
  }
};

const supabaseHostname = getSupabaseHostname();

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
    tsconfigPath: './tsconfig.json',
  },
  // Exclude _archive folders from build output tracing
  experimental: {
    outputFileTracingExcludes: {
      '*': [
        '**/_archive/**',
        '**/*_archive/**',
        '**/features/_archive/**',
        '**/components/_archive/**',
      ],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'photos.zillowstatic.com',
        port: '',
        pathname: '/fp/**',
      },
      {
        protocol: 'https',
        hostname: 'images.rentals.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images1.apartments.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images1.apartmenthomeliving.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'maps.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.mapbox.com',
        port: '',
        pathname: '/**',
      },
      // Shopify image domains
      {
        protocol: 'https',
        hostname: 'cdn.shopify.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.myshopify.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'shop.mnuda.com',
        port: '',
        pathname: '/**',
      },
      // Add Supabase hostname if available
      ...(supabaseHostname ? [{
        protocol: 'https' as const,
        hostname: supabaseHostname,
        port: '',
        pathname: '/**',
      }] : []),
    ],
  },
};

export default nextConfig;
