'use client';

import Image from 'next/image';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { MapMembershipRequest } from '@/types/map';

interface MembershipRequestItemProps {
  request: MapMembershipRequest;
  onApprove: () => Promise<void>;
  onReject: () => Promise<void>;
  membershipQuestions: Array<{ id: number; question: string }>;
  isProcessing: boolean;
}

export default function MembershipRequestItem({
  request,
  onApprove,
  onReject,
  membershipQuestions,
  isProcessing,
}: MembershipRequestItemProps) {
  const displayName = request.account
    ? request.account.first_name && request.account.last_name
      ? `${request.account.first_name} ${request.account.last_name}`
      : request.account.username
      ? `@${request.account.username}`
      : 'User'
    : 'Unknown User';

  return (
    <div className="p-[10px] bg-gray-50 border border-gray-200 rounded-md space-y-2">
      {/* User Info */}
      <div className="flex items-center gap-2">
        {request.account?.image_url ? (
          <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
            <Image
              src={request.account.image_url}
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
              {(request.account?.first_name?.[0] || request.account?.username?.[0] || 'U').toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">
            {displayName}
          </div>
          <div className="text-[10px] text-gray-500">
            {new Date(request.created_at).toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* Answers to Questions */}
      {membershipQuestions.length > 0 && request.answers && request.answers.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-gray-200">
          {request.answers.map((answer, idx) => {
            const question = membershipQuestions.find(q => q.id === answer.question_id);
            if (!question) return null;
            
            return (
              <div key={idx} className="space-y-0.5">
                <div className="text-[10px] font-medium text-gray-500">
                  {question.question}
                </div>
                <div className="text-xs text-gray-700 bg-white border border-gray-200 rounded-md p-1.5">
                  {answer.answer || '(No answer)'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
        <button
          onClick={onApprove}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors disabled:opacity-50"
        >
          <CheckIcon className="w-3.5 h-3.5" />
          Approve
        </button>
        <button
          onClick={onReject}
          disabled={isProcessing}
          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50"
        >
          <XMarkIcon className="w-3.5 h-3.5" />
          Reject
        </button>
      </div>
    </div>
  );
}
