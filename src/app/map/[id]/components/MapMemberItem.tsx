'use client';

import Image from 'next/image';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import MemberRoleSelector from './MemberRoleSelector';
import type { MapMember } from '@/types/map';

interface MapMemberItemProps {
  member: MapMember;
  onRoleChange: (role: 'manager' | 'editor') => Promise<void>;
  onRemove: () => Promise<void>;
  canManage: boolean;
  isMapOwner: boolean;
}

export default function MapMemberItem({
  member,
  onRoleChange,
  onRemove,
  canManage,
  isMapOwner,
}: MapMemberItemProps) {
  const { account: currentAccount } = useAuthStateSafe();
  const isCurrentUser = currentAccount?.id === member.account_id;
  const isOwner = member.role === 'owner';
  const canChangeRole = canManage && !isOwner && !isCurrentUser;
  const canRemoveMember = canManage && !isOwner && !isCurrentUser;

  const displayName = member.account
    ? member.account.first_name && member.account.last_name
      ? `${member.account.first_name} ${member.account.last_name}`
      : member.account.username
      ? `@${member.account.username}`
      : 'User'
    : 'Unknown User';

  return (
    <div className="flex items-center justify-between gap-2 p-[10px] bg-gray-50 border border-gray-200 rounded-md">
      <div className="flex items-center gap-2 flex-1 min-w-0">
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
          </div>
          {isCurrentUser && (
            <div className="text-[10px] text-gray-500">You</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <MemberRoleSelector
          currentRole={member.role}
          onRoleChange={onRoleChange}
          canChangeRole={canChangeRole}
          isOwner={isOwner}
        />
        {canRemoveMember && (
          <button
            onClick={onRemove}
            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
            title="Remove member"
            aria-label="Remove member"
          >
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
