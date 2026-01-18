'use client';

import { useState, useEffect } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { ServerAuthUser } from '@/lib/authServer';
import ProfilePhoto from '@/components/shared/ProfilePhoto';
import Link from 'next/link';
import {
  MapPinIcon,
  PencilIcon,
  ChatBubbleLeftRightIcon,
  PhotoIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

interface ContributeClientProps {
  auth: ServerAuthUser | null;
}

interface Account {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

interface ContributionStats {
  edits_count: number;
  reviews_count: number;
  photos_count: number;
}

export default function ContributeClient({ auth }: ContributeClientProps) {
  const supabase = useSupabaseClient();
  const [account, setAccount] = useState<Account | null>(null);
  const [stats, setStats] = useState<ContributionStats>({
    edits_count: 0,
    reviews_count: 0,
    photos_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!auth) {
        setLoading(false);
        return;
      }

      try {
        // Get account info
        const { data: accountData } = await supabase
          .from('accounts')
          .select('id, username, first_name, last_name, image_url')
          .eq('user_id', auth.id)
          .single();

        if (accountData) {
          setAccount(accountData as Account);
        }

        // Get contribution stats
        const accountDataTyped = accountData as { id: string } | null;
        const accountId = accountDataTyped?.id;
        if (accountId) {
          const [editsResult] = await Promise.all([
            (supabase as any)
              .from('civic_events')
              .select('id', { count: 'exact', head: true })
              .eq('account_id', accountId),
          ]);

          setStats({
            edits_count: editsResult.count || 0,
            reviews_count: 0, // TODO: Add reviews table
            photos_count: 0, // TODO: Add photos count
          });
        }
      } catch (error) {
        console.error('Error fetching contribute data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);

  const getDisplayName = () => {
    if (account?.username) return account.username;
    if (account?.first_name || account?.last_name) {
      return [account.first_name, account.last_name].filter(Boolean).join(' ');
    }
    return 'Contributor';
  };

  const getLevel = () => {
    const totalContributions = stats.edits_count + stats.reviews_count + stats.photos_count;
    if (totalContributions >= 50) return 5;
    if (totalContributions >= 25) return 4;
    if (totalContributions >= 10) return 3;
    if (totalContributions >= 5) return 2;
    return 1;
  };

  const getPointsToNextLevel = () => {
    const currentLevel = getLevel();
    const totalContributions = stats.edits_count + stats.reviews_count + stats.photos_count;
    const nextLevelThreshold = currentLevel === 1 ? 5 : currentLevel === 2 ? 10 : currentLevel === 3 ? 25 : currentLevel === 4 ? 50 : 100;
    return Math.max(0, nextLevelThreshold - totalContributions);
  };

  const currentLevel = getLevel();
  const pointsToNext = getPointsToNextLevel();
  const totalContributions = stats.edits_count + stats.reviews_count + stats.photos_count;
  const nextLevelThreshold = currentLevel === 1 ? 5 : currentLevel === 2 ? 10 : currentLevel === 3 ? 25 : currentLevel === 4 ? 50 : 100;
  const progressPercentage = nextLevelThreshold > 0 ? (totalContributions / nextLevelThreshold) * 100 : 100;

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!auth) {
    return (
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <h1 className="text-sm font-semibold text-gray-900">Contribute</h1>
          <p className="text-xs text-gray-600">
            Sign in to start contributing to Minnesota's community knowledge.
          </p>
          <Link
            href="/auth/signin?redirect=/contribute"
            className="inline-block text-xs font-medium text-gray-700 hover:text-gray-900"
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  const contributionActions = [
    {
      icon: MapPinIcon,
      label: 'Add place',
      href: '/gov',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: PencilIcon,
      label: 'Update place',
      href: '/gov',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: ChatBubbleLeftRightIcon,
      label: 'Add review',
      href: '/contribute',
      color: 'bg-teal-100 text-teal-600',
    },
    {
      icon: PhotoIcon,
      label: 'Add photo',
      href: '/contribute',
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: ArrowPathIcon,
      label: 'Update info',
      href: '/gov',
      color: 'bg-blue-100 text-blue-600',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="mb-3 space-y-1.5">
        <h1 className="text-sm font-semibold text-gray-900">Contribute</h1>
      </div>

      {/* User Profile and Progress */}
      {account && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <div className="flex items-center gap-2">
            <ProfilePhoto
              account={{
                id: account.id,
                user_id: null,
                username: account.username,
                first_name: account.first_name,
                last_name: account.last_name,
                email: null,
                phone: null,
                image_url: account.image_url,
                cover_image_url: null,
                bio: null,
                city_id: null,
                view_count: 0,
                role: 'general',
                traits: null,
                stripe_customer_id: null,
                plan: 'hobby',
                billing_mode: 'standard',
                subscription_status: null,
                stripe_subscription_id: null,
                onboarded: false,
                search_visibility: false,
                created_at: '',
                updated_at: '',
                last_visit: null,
              }}
              size="sm"
            />
            <div className="flex-1">
              <div className="text-xs font-medium text-gray-900">{getDisplayName()}</div>
              <div className="text-[10px] text-gray-500">Contributor Level {currentLevel}</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-orange-500 h-full transition-all"
                style={{ width: `${Math.min(progressPercentage, 100)}%` }}
              />
            </div>
            {pointsToNext > 0 ? (
              <div className="text-[10px] text-gray-600">
                {pointsToNext} {pointsToNext === 1 ? 'contribution' : 'contributions'} away from Level {currentLevel + 1}
              </div>
            ) : (
              <div className="text-[10px] text-gray-600">Level {currentLevel} complete!</div>
            )}
          </div>
        </div>
      )}

      {/* Contribution Actions */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <h2 className="text-xs font-semibold text-gray-900">Ways to Contribute</h2>
        <div className="grid grid-cols-5 gap-2">
          {contributionActions.map((action, idx) => {
            const Icon = action.icon;
            return (
              <Link
                key={idx}
                href={action.href}
                className="flex flex-col items-center gap-1.5 p-2 rounded hover:bg-gray-50 transition-colors"
              >
                <div className={`w-10 h-10 rounded-full ${action.color} flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] text-gray-700 text-center">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Badge Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-xs font-semibold text-gray-900">Earn your New Contributor badge</h2>
            <p className="text-[10px] text-gray-600 mt-0.5">
              Get started by making these simple updates
            </p>
          </div>
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-green-600">✓</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between p-1.5 rounded bg-white border border-gray-100">
            <span className="text-[10px] text-gray-700">Make 2 edits</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">
                {Math.min(stats.edits_count, 2)}/2
              </span>
              {stats.edits_count >= 2 ? (
                <span className="text-green-600 text-xs">✓</span>
              ) : (
                <span className="text-gray-400 text-xs">→</span>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-green-50 border border-green-100">
            <span className="text-[10px] text-gray-700">Write 2 reviews</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">0/2</span>
              <span className="text-gray-400 text-xs">→</span>
            </div>
          </div>
          <div className="flex items-center justify-between p-1.5 rounded bg-green-50 border border-green-100">
            <span className="text-[10px] text-gray-700">Add 2 photos</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-500">0/2</span>
              <span className="text-gray-400 text-xs">→</span>
            </div>
          </div>
        </div>
      </div>

      {/* Keep Up the Good Work Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
        <h2 className="text-xs font-semibold text-gray-900">Keep up the good work</h2>
        <p className="text-[10px] text-gray-600">Need ideas for what to contribute next?</p>
        <Link
          href="/gov/community-edits"
          className="inline-block text-[10px] text-blue-600 hover:text-blue-700 font-medium"
        >
          See suggestions →
        </Link>
      </div>

      {/* Progress Card */}
      {pointsToNext > 0 && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-900">
                Add {pointsToNext} {pointsToNext === 1 ? 'contribution' : 'contributions'} to reach Level {currentLevel + 1}
              </div>
            </div>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-orange-500 h-full rounded-full transition-all"
              style={{ width: `${Math.min(progressPercentage, 100)}%` }}
            />
          </div>
          <Link
            href="/gov"
            className="inline-block text-[10px] text-blue-600 hover:text-blue-700 font-medium"
          >
            Start contributing →
          </Link>
        </div>
      )}
    </div>
  );
}

