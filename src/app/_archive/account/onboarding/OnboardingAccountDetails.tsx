'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { Account } from '@/features/auth';
import { ArrowRightOnRectangleIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';

interface OnboardingAccountDetailsProps {
  account: Account | null;
}

export default function OnboardingAccountDetails({ account }: OnboardingAccountDetailsProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  if (!account) {
    return null;
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    try {
      return formatDistanceToNow(new Date(dateString), { addSuffix: true });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="space-y-3">
      {/* Logo */}
      <Link href="/" className="block hover:opacity-80 transition-opacity">
        <Image
          src="/word_logo.png"
          alt="MNUDA"
          width={100}
          height={20}
          className="w-[100px] h-auto"
          priority
        />
      </Link>

      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors py-1"
      >
        <span>Current Account</span>
        {isOpen ? (
          <ChevronUpIcon className="w-3 h-3 text-gray-500" />
        ) : (
          <ChevronDownIcon className="w-3 h-3 text-gray-500" />
        )}
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="space-y-2 pt-2">
          {/* Created At */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Created</span>
            <span className="text-xs text-gray-900">
              {formatDate(account.created_at)}
            </span>
          </div>

          {/* Last Signed In */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Last Signed In</span>
            <span className="text-xs text-gray-900">
              {formatDate(account.last_visit)}
            </span>
          </div>

          {/* Registry ID */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Registry ID</span>
            <span className="text-xs text-gray-900 font-mono">
              {account.id.slice(0, 8)}...
            </span>
          </div>

          {/* Sign Out Button */}
          <div className="pt-2">
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              className="w-full flex items-center justify-center gap-1.5 px-[10px] py-[10px] border border-gray-200 rounded-md text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowRightOnRectangleIcon className="w-3 h-3" />
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



