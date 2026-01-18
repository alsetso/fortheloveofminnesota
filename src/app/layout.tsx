import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import '@/styles/confetti.css'
import { ToastContainer } from '@/features/ui/components/Toast'
import { Providers } from '@/components/providers/Providers'
import { ErrorBoundary } from '@/components/errors/ErrorBoundary'
import LocalStorageCleanup from '@/components/utils/LocalStorageCleanup'
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
  description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
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
    icon: '/fav.png',
    shortcut: '/fav.png',
    apple: '/fav.png',
  },
  openGraph: {
    title: 'For the Love of Minnesota',
    description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
    url: 'https://fortheloveofminnesota.com',
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/logo.png',
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
    description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
    images: ['/logo.png'],
    creator: '@fortheloveofmn',
  },
  alternates: {
    canonical: 'https://fortheloveofminnesota.com',
  },
  category: 'Community & Social',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
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
        <Providers>
          <ErrorBoundary>
            <LocalStorageCleanup />
            {/* Pages handle their own header/footer via PageLayout component */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
              {children}
            </div>
            <ToastContainer />
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  )
}
