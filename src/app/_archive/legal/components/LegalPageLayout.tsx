'use client';

import LegalNav from './LegalNav';
import LegalContent from './LegalContent';
import LegalFooter from './LegalFooter';

interface LegalPageLayoutProps {
  title: string;
  lastUpdated?: string;
  children: React.ReactNode;
}

export default function LegalPageLayout({ title, lastUpdated, children }: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <LegalNav />
      <main className="flex-1">
        <LegalContent title={title} lastUpdated={lastUpdated}>
          {children}
        </LegalContent>
      </main>
      <LegalFooter />
    </div>
  );
}

