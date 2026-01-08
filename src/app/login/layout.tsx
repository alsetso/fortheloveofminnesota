import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In - For the Love of Minnesota',
  description: 'Sign in to your account to access your maps and communities.',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

