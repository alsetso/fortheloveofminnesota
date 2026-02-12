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
    ignoreBuildErrors: true, // Database type is incomplete; regenerate with npm run types:generate
    tsconfigPath: './tsconfig.json',
  },
  // Exclude _archive folders and heavy deps from build output tracing
  outputFileTracingExcludes: {
    '*': [
      '**/_archive/**',
      '**/*_archive/**',
      '**/features/_archive/**',
      '**/components/_archive/**',
    ],
    // Admin API routes: exclude heavy packages not needed for admin endpoints
    '/api/admin/**': [
      'node_modules/exceljs/**',
      'node_modules/xlsx/**',
      'node_modules/mapbox-gl/**',
      'node_modules/@mapbox/**',
      'node_modules/jspdf/**',
      'node_modules/html2canvas/**',
      'node_modules/canvas/**',
      'node_modules/reactflow/**',
      'node_modules/@tiptap/**',
      'node_modules/prosemirror-*/**',
      'node_modules/dompurify/**',
      'node_modules/jsdom/**',
    ],
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
        hostname: 'shop.fortheloveofminnesota.com',
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
