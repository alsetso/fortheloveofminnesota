'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { UserGroupIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import type { MapMember } from '@/types/map';

interface MapMembersListProps {
  mapId: string;
  currentAccountId: string | null;
}

export default function MapMembersList({ mapId, currentAccountId }: MapMembersListProps) {
  const { account } = useAuthStateSafe();
  const [members, setMembers] = useState<MapMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mapId || !currentAccountId) {
      setLoading(false);
      return;
    }

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/maps/${mapId}/members`);
        
        if (response.ok) {
          const data = await response.json();
          setMembers(data.members || []);
        } else if (response.status === 403) {
          setError('You must be a member to view the member list.');
        } else {
          setError('Failed to load members');
        }
      } catch (err) {
        console.error('Error fetching members:', err);
        setError('Failed to load members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [mapId, currentAccountId]);

  if (loading) {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Members</div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
          <div className="text-xs text-gray-500 text-center py-2">Loading members...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Members</div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
          <div className="text-xs text-gray-500 text-center py-2">{error}</div>
        </div>
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Members</div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
          <div className="text-xs text-gray-500 text-center py-2">No members yet</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-medium text-gray-500">Members</div>
      <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-2">
        {members.map((member) => {
          const displayName = member.account
            ? member.account.first_name && member.account.last_name
              ? `${member.account.first_name} ${member.account.last_name}`
              : member.account.username
              ? `@${member.account.username}`
              : 'User'
            : 'Unknown User';
          
          const isCurrentUser = currentAccountId === member.account_id;
          const isOwner = member.role === 'owner';

          return (
            <div key={member.id} className="flex items-center gap-2">
              {member.account?.image_url ? (
                <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                  <Image
                    src={member.account.image_url}
                    alt={displayName}
                    width={24}
                    height={24}
                    className="w-full h-full object-cover"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-gray-500">
                    {(member.account?.first_name?.[0] || member.account?.username?.[0] || 'U').toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-900 truncate">
                  {displayName}
                  {isCurrentUser && <span className="text-[10px] text-gray-500 ml-1">(You)</span>}
                </div>
                {isOwner && (
                  <div className="text-[10px] text-gray-500">Owner</div>
                )}
              </div>
              {!isOwner && (
                <div className="text-[10px] font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
                  {member.role}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
