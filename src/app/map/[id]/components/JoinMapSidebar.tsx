'use client';

import { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  MapPinIcon, 
  Square3Stack3DIcon, 
  UsersIcon, 
  EyeIcon,
  DocumentTextIcon,
  MapIcon
} from '@heroicons/react/24/outline';
import { useAuthStateSafe } from '@/features/auth';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import SidebarHeader from '@/components/layout/SidebarHeader';

interface JoinMapSidebarProps {
  mapId: string;
  mapName: string;
  autoApproveMembers: boolean;
  membershipQuestions: Array<{ id: number; question: string }>;
  membershipRules: string | null;
  allowPins?: boolean;
  allowAreas?: boolean;
  allowPosts?: boolean;
  // NEW: Plan-based permissions (for visual indicators)
  pinPermissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
  areaPermissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
  postPermissions?: { required_plan: 'hobby' | 'contributor' | 'professional' | 'business' | null } | null;
  mapLayers?: {
    congressional_districts?: boolean;
    ctu_boundaries?: boolean;
    state_boundary?: boolean;
    county_boundaries?: boolean;
  };
  memberCount?: number;
  onJoinSuccess?: () => void;
  onClose?: () => void;
}

export default function JoinMapSidebar({
  mapId,
  mapName,
  autoApproveMembers,
  membershipQuestions,
  membershipRules,
  allowPins = false,
  allowAreas = false,
  allowPosts = false,
  pinPermissions = null,
  areaPermissions = null,
  postPermissions = null,
  mapLayers = {},
  memberCount = 0,
  onJoinSuccess,
  onClose,
}: JoinMapSidebarProps) {
  const { account, activeAccountId } = useAuthStateSafe();
  const { addToast } = useToastContext();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Trigger confetti animation
  const triggerConfetti = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);
      
      // Left side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 }
      });
      
      // Right side confetti
      confetti({
        ...defaults,
        particleCount,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 }
      });
    }, 250);

    return () => clearInterval(interval);
  };

  const handleSubmit = async () => {
    const currentAccountId = activeAccountId || account?.id || null;
    
    if (!currentAccountId) {
      setError('Please sign in to join this map');
      return;
    }

    // Validate required questions
    const requiredQuestions = membershipQuestions.filter(q => true); // All questions required for now
    const missingAnswers = requiredQuestions.filter(q => !answers[q.id]?.trim());
    
    if (missingAnswers.length > 0) {
      setError('Please answer all required questions');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const answersArray = membershipQuestions
        .map(q => ({
          question_id: q.id,
          answer: answers[q.id] || '',
        }))
        .filter(a => a.answer.trim());

      const response = await fetch(`/api/maps/${mapId}/membership-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answersArray }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to join map');
      }

      const data = await response.json();
      
      // If auto-approved, show celebration
      if (data.auto_approved) {
        // Trigger confetti
        triggerConfetti();
        
        // Get username for toast
        const username = account?.username 
          ? `@${account.username}`
          : account?.first_name && account?.last_name
          ? `${account.first_name} ${account.last_name}`
          : 'You';
        
        // Show success toast
        addToast(createToast('success', `${username} just joined ${mapName}`, {
          duration: 4000,
        }));
        
        // Close sidebar and refresh page
        if (onClose) onClose();
        if (onJoinSuccess) onJoinSuccess();
        // Refresh page to show member access
        window.location.reload();
      } else {
        // Request submitted
        addToast(createToast('info', 'Membership request submitted', {
          duration: 3000,
        }));
        if (onClose) onClose();
        if (onJoinSuccess) onJoinSuccess();
      }
    } catch (err: any) {
      console.error('Error joining map:', err);
      setError(err.message || 'Failed to join map');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentAccountId = activeAccountId || account?.id || null;

  return (
    <div className="h-full flex flex-col">
      <SidebarHeader
        title="Join Map"
        onClose={onClose || (() => {})}
        mapId={mapId}
        mapName={mapName}
        showMenu={true}
      />
      
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {/* Header Message */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-600">
            {autoApproveMembers 
              ? 'Join this map to collaborate and contribute.'
              : 'Request to join this map. Your request will be reviewed by the map owner.'}
          </p>
        </div>

      {/* Map Benefits */}
      <div className="space-y-1.5">
        <div className="text-[10px] font-medium text-gray-500">Member Benefits</div>
        <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px] space-y-2">
          {/* Collaboration Features */}
          {(allowPins || allowAreas || allowPosts) && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-600">You can:</div>
              <div className="space-y-1">
                {allowPins && (
                  <div className={`flex items-center gap-1.5 p-1.5 rounded ${
                    pinPermissions?.required_plan 
                      ? 'border-2 border-blue-500' // Plan-based permission (TEMPORARY - remove before production)
                      : 'border-2 border-red-500' // Owner-granted permission (TEMPORARY - remove before production)
                  }`}>
                    <MapPinIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">Add pins to the map</span>
                    {pinPermissions?.required_plan && (
                      <span className="text-[10px] text-blue-600 font-medium ml-auto">
                        ({pinPermissions.required_plan}+)
                      </span>
                    )}
                  </div>
                )}
                {allowAreas && (
                  <div className={`flex items-center gap-1.5 p-1.5 rounded ${
                    areaPermissions?.required_plan
                      ? 'border-2 border-blue-500' // Plan-based permission (TEMPORARY - remove before production)
                      : 'border-2 border-red-500' // Owner-granted permission (TEMPORARY - remove before production)
                  }`}>
                    <Square3Stack3DIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">Draw areas on the map</span>
                    {areaPermissions?.required_plan && (
                      <span className="text-[10px] text-blue-600 font-medium ml-auto">
                        ({areaPermissions.required_plan}+)
                      </span>
                    )}
                  </div>
                )}
                {allowPosts && (
                  <div className={`flex items-center gap-1.5 p-1.5 rounded ${
                    postPermissions?.required_plan
                      ? 'border-2 border-blue-500' // Plan-based permission (TEMPORARY - remove before production)
                      : 'border-2 border-red-500' // Owner-granted permission (TEMPORARY - remove before production)
                  }`}>
                    <DocumentTextIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">Create posts and mentions</span>
                    {postPermissions?.required_plan && (
                      <span className="text-[10px] text-blue-600 font-medium ml-auto">
                        ({postPermissions.required_plan}+)
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Map Layers */}
          {(mapLayers.congressional_districts || mapLayers.ctu_boundaries || mapLayers.state_boundary || mapLayers.county_boundaries) && (
            <div className="space-y-1.5 pt-1.5 border-t border-gray-200">
              <div className="text-[10px] font-medium text-gray-600">Map includes:</div>
              <div className="space-y-1">
                {mapLayers.congressional_districts && (
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">Congressional districts</span>
                  </div>
                )}
                {mapLayers.ctu_boundaries && (
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">CTU boundaries</span>
                  </div>
                )}
                {mapLayers.state_boundary && (
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">State boundary</span>
                  </div>
                )}
                {mapLayers.county_boundaries && (
                  <div className="flex items-center gap-1.5">
                    <MapIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
                    <span className="text-xs text-gray-700">County boundaries</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Member Count */}
          {memberCount > 0 && (
            <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200">
              <UsersIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
              <span className="text-xs text-gray-700">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </span>
            </div>
          )}

          {/* View Access */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-gray-200">
            <EyeIcon className="w-3 h-3 text-gray-500 flex-shrink-0" />
            <span className="text-xs text-gray-700">View all map content and members</span>
          </div>
        </div>
      </div>

      {/* Membership Rules */}
      {membershipRules && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium text-gray-500">Membership Rules</div>
          <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
            <div className="text-xs text-gray-700 whitespace-pre-wrap">
              {membershipRules}
            </div>
          </div>
        </div>
      )}

      {/* Questions */}
      {membershipQuestions.length > 0 ? (
        <div className="space-y-3">
          <div className="text-[10px] font-medium text-gray-500">Questions</div>
          {membershipQuestions.map((question) => (
            <div key={question.id} className="space-y-1.5">
              <label className="text-xs font-medium text-gray-900">
                {question.question}
              </label>
              <textarea
                value={answers[question.id] || ''}
                onChange={(e) =>
                  setAnswers(prev => ({ ...prev, [question.id]: e.target.value }))
                }
                placeholder="Your answer..."
                rows={3}
                className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-xs text-gray-500">No questions required</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-md">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Submit Button */}
      {currentAccountId ? (
        <div className="pt-2">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting 
              ? 'Submitting...' 
              : autoApproveMembers 
                ? 'Join Map' 
                : 'Request to Join'}
          </button>
        </div>
      ) : (
        <div className="pt-2">
          <p className="text-xs text-gray-600 mb-2">Please sign in to join this map</p>
        </div>
      )}
      </div>
    </div>
  );
}
