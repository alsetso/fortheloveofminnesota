import type { Metadata, Viewport } from 'next';
import Providers from '@/components/providers/Providers';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5F0E8',
};

export const metadata: Metadata = {
  title: 'For the Love of Minnesota',
  description: 'A living map built on love for Minnesota.',
  icons: {
    icon: [{ url: '/fav.png', type: 'image/png' }],
    apple: [{ url: '/fav.png', type: 'image/png' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
