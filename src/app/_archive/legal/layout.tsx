import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Legal - MNUDA',
  description: 'MNUDA Legal Documents - Terms of Service, Privacy Policy, User Agreement, and Community Guidelines.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}


