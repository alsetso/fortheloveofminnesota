'use client';

import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { MapPinIcon, HeartIcon, UserPlusIcon } from '@heroicons/react/24/outline';

interface SignInGateProps {
  /** Title shown in the gate */
  title?: string;
  /** Description shown in the gate */
  description?: string;
  /** Features list to show benefits of signing in */
  features?: Array<{ icon: React.ReactNode; text: string }>;
  /** Custom children to render instead of default content */
  children?: React.ReactNode;
  /** Whether to show a subtle version (for inline prompts) */
  subtle?: boolean;
}

export default function SignInGate({
  title = 'Sign in to view this content',
  description = 'Create a free account to see mentions, like posts, and connect with the Minnesota community.',
  features = [
    { icon: <MapPinIcon className="w-5 h-5" />, text: 'View and explore mentions' },
    { icon: <HeartIcon className="w-5 h-5" />, text: 'Like and interact with posts' },
    { icon: <UserPlusIcon className="w-5 h-5" />, text: 'Connect with the community' },
  ],
  children,
  subtle = false,
}: SignInGateProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const { openWelcome } = useAppModalContextSafe();
  const isAuthenticated = Boolean(account || activeAccountId);

  if (isAuthenticated) {
    return null;
  }

  if (children) {
    return <>{children}</>;
  }

  if (subtle) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">
          <button
            onClick={openWelcome}
            className="text-gray-900 font-medium hover:underline"
          >
            Sign in
          </button>
          {' '}to view this content and join the Minnesota community.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center bg-white">
      <div className="max-w-md w-full mx-auto px-4">
        <div className="bg-white rounded-md border border-gray-200 p-6 text-center space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            <p className="text-sm text-gray-600">{description}</p>
          </div>

          <div className="pt-4 space-y-2">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-3 text-sm text-gray-700">
                <div className="text-gray-500 flex-shrink-0">{feature.icon}</div>
                <span>{feature.text}</span>
              </div>
            ))}
          </div>

          <div className="pt-4">
            <button
              onClick={openWelcome}
              className="w-full px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
            >
              Sign In or Create Account
            </button>
          </div>

          <p className="text-xs text-gray-500 pt-2">
            Free to join • No credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
