import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import '@/styles/confetti.css'
import { ToastContainer } from '@/features/ui/components/Toast'
import { Providers } from '@/components/providers/Providers'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import LocalStorageCleanup from '@/components/utils/LocalStorageCleanup'
import { getAuthAndBilling } from '@/lib/server/getAuthAndBilling'
import { InitialBillingDataProvider } from '@/contexts/BillingEntitlementsContext'
// Removed usage/billing context and modals after simplifying app
// Footer moved to PageLayout component for consistent page structure

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'),
  title: 'For the Love of Minnesota',
  description: 'A living map built on love for Minnesota.',
  keywords: 'Minnesota, Minnesota residents, Minnesota neighbors, Minnesota community, Minnesota locations, Minnesota cities, Minnesota counties, archive Minnesota, Minnesota memories, Minnesota stories',
  authors: [{ name: 'For the Love of Minnesota' }],
  creator: 'For the Love of Minnesota',
  publisher: 'For the Love of Minnesota',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: [
      { url: '/fav.png', type: 'image/png', sizes: 'any' },
    ],
    shortcut: [
      { url: '/fav.png', type: 'image/png' },
    ],
    apple: [
      { url: '/fav.png', type: 'image/png', sizes: '180x180' },
    ],
  },
  openGraph: {
    title: 'For the Love of Minnesota',
    description: 'A living map and social network built on love for Minnesota — its people, places, and stories.',
    url: 'https://fortheloveofminnesota.com',
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/og/lomn-share.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'For the Love of Minnesota',
    description: 'A living map built on love for Minnesota.',
    images: ['/og/lomn-share.png'],
    creator: '@fortheloveofmn',
  },
  alternates: {
    canonical: 'https://fortheloveofminnesota.com',
  },
  category: 'Community & Social',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch auth + billing once per request (cached via React cache())
  // This ensures only one auth check across all pages
  const { auth, billing } = await getAuthAndBilling();

  return (
    <html lang="en" className="h-full w-full">
      <body className="min-h-screen w-full" style={{ display: 'flex', flexDirection: 'column' }}>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-SWNED81F4V"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-SWNED81F4V');
          `}
        </Script>
        {/* Meta Pixel Code */}
        <Script id="facebook-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '342825829636878');
            console.log('[Facebook Pixel] Initialized - ID: 342825829636878');
            fbq('track', 'PageView');
            console.log('[Facebook Pixel] Tracked: PageView');
          `}
        </Script>
        <noscript>
          <img
            height="1"
            width="1"
            style={{ display: 'none' }}
            src="https://www.facebook.com/tr?id=342825829636878&ev=PageView&noscript=1"
            alt=""
          />
        </noscript>
        {/* End Meta Pixel Code */}
        <InitialBillingDataProvider initialData={billing}>
          <Providers initialAuth={auth}>
            <ErrorBoundary>
              <LocalStorageCleanup />
              {/* Pages handle their own header/footer via PageLayout component */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                {children}
              </div>
              <ToastContainer />
            </ErrorBoundary>
          </Providers>
        </InitialBillingDataProvider>
      </body>
    </html>
  )
}
