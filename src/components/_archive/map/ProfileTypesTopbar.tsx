'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { ProfileType } from '@/features/auth';
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';

// Profile-specific actions with emojis
type ProfileAction = {
  emoji: string;
  label: string;
  category: string;
};

const PROFILE_ACTIONS: Record<ProfileType, ProfileAction[]> = {
  homeowner: [
    { emoji: '🏠', label: 'For Sale', category: 'Property' },
    { emoji: '🏡', label: 'FSBO', category: 'Property' },
    { emoji: '🔧', label: 'Work Request', category: 'Work' },
    { emoji: '⚠️', label: 'Concern', category: 'Concern' },
  ],
  renter: [
    { emoji: '🔧', label: 'Work Request', category: 'Work' },
    { emoji: '⚠️', label: 'Concern', category: 'Concern' },
  ],
  student: [
    { emoji: '🏘️', label: 'For Rent', category: 'Property' },
    { emoji: '🔧', label: 'Work Request', category: 'Work' },
    { emoji: '⚠️', label: 'Concern', category: 'Concern' },
  ],
  worker: [
    { emoji: '🔧', label: 'Service', category: 'Work' },
    { emoji: '👷', label: 'Contractor', category: 'Work' },
    { emoji: '🏗️', label: 'Project', category: 'Project' },
    { emoji: '🏢', label: 'Business', category: 'Business' },
  ],
  business: [
    { emoji: '🏠', label: 'For Sale', category: 'Property' },
    { emoji: '🏘️', label: 'For Rent', category: 'Property' },
    { emoji: '📍', label: 'Land', category: 'Property' },
    { emoji: '📋', label: 'Pocket Listing', category: 'Property' },
    { emoji: '🔜', label: 'Coming Soon', category: 'Property' },
    { emoji: '🎯', label: 'Lead', category: 'Property' },
    { emoji: '💔', label: 'Distressed', category: 'Property' },
    { emoji: '🏚️', label: 'Vacant', category: 'Property' },
    { emoji: '🚫', label: 'Abandoned', category: 'Property' },
    { emoji: '🔨', label: 'Auction', category: 'Property' },
    { emoji: '🔧', label: 'Work Request', category: 'Work' },
    { emoji: '🏗️', label: 'Project', category: 'Project' },
    { emoji: '⚠️', label: 'Concern', category: 'Concern' },
    { emoji: '🏢', label: 'Business', category: 'Business' },
    { emoji: '📋', label: 'Opportunity', category: 'Opportunity' },
  ],
};

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  homeowner: 'Homeowner',
  renter: 'Renter',
  student: 'Student',
  worker: 'Worker',
  business: 'Business',
};

const ALL_PROFILE_TYPES: ProfileType[] = [
  'homeowner',
  'renter',
  'student',
  'worker',
  'business',
];

// Mock onboarding checklist items per profile type
type OnboardingItem = {
  id: string;
  label: string;
  completed: boolean;
};

const ONBOARDING_CHECKLISTS: Record<ProfileType, OnboardingItem[]> = {
  homeowner: [
    { id: '1', label: 'Complete your profile', completed: false },
    { id: '2', label: 'Add your property location', completed: false },
    { id: '3', label: 'Set up property alerts', completed: false },
    { id: '4', label: 'Explore nearby services', completed: false },
  ],
  renter: [
    { id: '1', label: 'Complete your profile', completed: false },
    { id: '2', label: 'Set your search area', completed: false },
    { id: '3', label: 'Enable rental notifications', completed: false },
    { id: '4', label: 'Save favorite properties', completed: false },
  ],
  student: [
    { id: '1', label: 'Complete your profile', completed: false },
    { id: '2', label: 'Set your search area', completed: false },
    { id: '3', label: 'Enable rental notifications', completed: false },
    { id: '4', label: 'Save favorite properties', completed: false },
  ],
  worker: [
    { id: '1', label: 'Complete your profile', completed: false },
    { id: '2', label: 'Add your service areas', completed: false },
    { id: '3', label: 'Set up job notifications', completed: false },
    { id: '4', label: 'Upload portfolio photos', completed: false },
  ],
  business: [
    { id: '1', label: 'Complete your profile', completed: false },
    { id: '2', label: 'Add business details', completed: false },
    { id: '3', label: 'Set up team members', completed: false },
    { id: '4', label: 'Enable collaboration tools', completed: false },
  ],
};

interface ProfileTypesTopbarProps {
  className?: string;
}

export function ProfileTypesTopbar({ className = '' }: ProfileTypesTopbarProps) {
  const { selectedProfile, isLoading } = useProfile();
  const [hoveredProfileType, setHoveredProfileType] = useState<ProfileType | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [checklistItems, setChecklistItems] = useState<OnboardingItem[]>([]);

  const currentProfileType = selectedProfile?.profile_type || null;

  // Load checklist items when profile type changes - MUST be before early return
  useEffect(() => {
    if (currentProfileType) {
      setChecklistItems(ONBOARDING_CHECKLISTS[currentProfileType] || []);
    } else {
      setChecklistItems([]);
    }
  }, [currentProfileType]);

  // Don't render if still loading or no profile - AFTER all hooks
  if (isLoading || !selectedProfile) {
    return null;
  }

  const isAvailable = (profileType: ProfileType) => profileType === currentProfileType;
  const getAvailableActions = (profileType: ProfileType) => {
    return PROFILE_ACTIONS[profileType] || [];
  };

  const toggleChecklistItem = (itemId: string) => {
    setChecklistItems(prev => 
      prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const completedCount = checklistItems.filter(item => item.completed).length;
  const totalCount = checklistItems.length;

  // Condensed view when profile type is selected
  if (currentProfileType) {
    return (
      <div 
        className={`absolute left-4 z-[100] pointer-events-auto ${className}`}
        style={{ top: '1rem', overflow: 'visible' }}
      >
        <div 
          className="rounded-2xl border shadow-xl max-w-[95vw] transition-all duration-300"
          style={{
            backdropFilter: 'blur(40px) saturate(180%)',
            WebkitBackdropFilter: 'blur(40px) saturate(180%)',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            borderColor: 'rgba(255, 255, 255, 0.4)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
            overflow: 'visible',
          }}
        >
          {/* Condensed Header */}
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="px-2.5 py-1 rounded-lg font-medium text-xs bg-white/40 text-gray-900 shadow-sm">
              {PROFILE_TYPE_LABELS[currentProfileType]}
            </div>
            
            {/* Checklist Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs bg-white/20 text-gray-700 hover:bg-white/30 transition-colors"
            >
              <span className="text-[10px]">
                {completedCount}/{totalCount}
              </span>
              {isExpanded ? (
                <ChevronUpIcon className="w-3 h-3" />
              ) : (
                <ChevronDownIcon className="w-3 h-3" />
              )}
            </button>
          </div>

          {/* Expanded Checklist - iOS Style */}
          {isExpanded && (
            <div 
              className="px-3 pb-3 border-t border-white/20"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
              }}
            >
              <div className="pt-2.5 space-y-1">
                {checklistItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => toggleChecklistItem(item.id)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all active:scale-[0.98]"
                    style={{
                      backgroundColor: item.completed 
                        ? 'rgba(34, 197, 94, 0.15)' 
                        : 'rgba(255, 255, 255, 0.1)',
                    }}
                  >
                    {/* iOS-style Checkbox */}
                    <div 
                      className="flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
                      style={{
                        borderColor: item.completed ? '#22c55e' : 'rgba(0, 0, 0, 0.3)',
                        backgroundColor: item.completed ? '#22c55e' : 'transparent',
                      }}
                    >
                      {item.completed && (
                        <CheckIcon className="w-3 h-3 text-white" />
                      )}
                    </div>
                    
                    {/* Label */}
                    <span 
                      className="flex-1 text-left text-xs font-medium"
                      style={{
                        color: item.completed ? 'rgba(34, 197, 94, 0.9)' : 'rgba(0, 0, 0, 0.8)',
                        textDecoration: item.completed ? 'line-through' : 'none',
                        opacity: item.completed ? 0.7 : 1,
                      }}
                    >
                      {item.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Full view when no profile type is selected
  return (
    <div 
      className={`absolute left-4 z-[100] pointer-events-auto ${className}`}
      style={{ top: '1rem', overflow: 'visible' }}
    >
      <div 
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-2xl border shadow-xl max-w-[95vw]"
        style={{
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          borderColor: 'rgba(255, 255, 255, 0.4)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1)',
          overflowX: 'auto',
          overflowY: 'visible',
        }}
      >
        {ALL_PROFILE_TYPES.map((profileType) => {
          const available = isAvailable(profileType);
          const actions = getAvailableActions(profileType);
          const isHovered = hoveredProfileType === profileType;

          return (
            <div
              key={profileType}
              className="relative"
              style={{ overflow: 'visible' }}
              onMouseEnter={() => setHoveredProfileType(profileType)}
              onMouseLeave={() => setHoveredProfileType(null)}
            >
              <button
                className={`
                  px-2.5 py-1 rounded-lg font-medium text-xs transition-all duration-200 whitespace-nowrap
                  ${available
                    ? 'bg-white/40 text-gray-900 shadow-sm cursor-pointer hover:bg-white/50 active:scale-95'
                    : 'bg-white/10 text-gray-500 cursor-not-allowed opacity-40'
                  }
                `}
                disabled={!available}
                title={available ? `${PROFILE_TYPE_LABELS[profileType]} - Click to switch` : 'Not available for your account'}
              >
                {PROFILE_TYPE_LABELS[profileType]}
              </button>

              {/* Hover tooltip showing available actions */}
              {isHovered && actions.length > 0 && (
                <div
                  className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-2.5 rounded-xl border shadow-xl whitespace-nowrap z-[200]"
                  style={{
                    position: 'absolute',
                    backdropFilter: 'blur(40px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    borderColor: 'rgba(255, 255, 255, 0.4)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.15)',
                    pointerEvents: 'auto',
                  }}
                >
                  <div className="text-xs font-semibold text-gray-800 mb-2">
                    Available Actions:
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {actions.map((action, idx) => (
                      <div
                        key={idx}
                        className="text-xs text-gray-700 px-2.5 py-1.5 rounded-lg flex items-center gap-2"
                        style={{
                          backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        }}
                      >
                        <span className="text-base">{action.emoji}</span>
                        <span>{action.label}</span>
                        <span className="text-[10px] text-gray-500 ml-auto">{action.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
