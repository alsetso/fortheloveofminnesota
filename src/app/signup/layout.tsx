import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign Up - For the Love of Minnesota',
  description: 'Create an account to start exploring Minnesota maps and communities.',
};

export default function SignUpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

