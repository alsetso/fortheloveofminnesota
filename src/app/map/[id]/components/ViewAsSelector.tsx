'use client';

import { useState, useMemo, useCallback } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

type ViewAsRole = 'owner' | 'manager' | 'editor' | 'non-member';

interface ViewAsSelectorProps {
  currentRole: ViewAsRole;
  onRoleChange: (role: ViewAsRole) => void;
  viewAsRole?: ViewAsRole;
  mapSettings?: {
    colors?: {
      owner?: string;
      manager?: string;
      editor?: string;
      'non-member'?: string;
    };
  } | null;
}

const OWNER_GRADIENT = 'linear-gradient(to right, #FFB700, #DD4A00, #5C0F2F)';
const BLACK_BACKGROUND = 'rgba(0, 0, 0, 0.8)';
const BLACK_BACKGROUND_HOVER = 'rgba(0, 0, 0, 0.9)';
const GRADIENT_BORDER_COLOR = 'rgba(255, 183, 0, 0.4)'; // Matches gradient start color (#FFB700)
const BLACK_BORDER_COLOR = 'rgba(255, 255, 255, 0.1)';

const ROLES: Array<{ value: ViewAsRole; label: string }> = [
  { value: 'owner', label: 'Owner' },
  { value: 'manager', label: 'Manager' },
  { value: 'editor', label: 'Editor' },
  { value: 'non-member', label: 'Non-Member' },
];

export default function ViewAsSelector({
  currentRole,
  onRoleChange,
  viewAsRole,
  mapSettings,
}: ViewAsSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get background color based on viewAsRole and mapSettings
  const backgroundColor = useMemo(() => {
    if (!viewAsRole) return BLACK_BACKGROUND;
    
    // Get color from mapSettings if available
    const roleColor = mapSettings?.colors?.[viewAsRole];
    if (roleColor && roleColor.trim() !== '') {
      return roleColor;
    }
    
    // Fallback to default: gradient for owner, black for others
    return viewAsRole === 'owner' ? OWNER_GRADIENT : BLACK_BACKGROUND;
  }, [viewAsRole, mapSettings]);

  // Get border color based on background
  const borderColor = useMemo(() => {
    // Use gradient border if the background is actually a gradient
    const isGradient = backgroundColor.includes('gradient');
    return isGradient ? GRADIENT_BORDER_COLOR : BLACK_BORDER_COLOR;
  }, [backgroundColor]);

  const shouldShowGradient = useMemo(() => {
    return backgroundColor.includes('gradient');
  }, [backgroundColor]);
  
  const currentLabel = useMemo(
    () => ROLES.find(r => r.value === currentRole)?.label || 'Owner',
    [currentRole]
  );

  const containerStyle = useMemo(
    () => ({
      background: backgroundColor,
      borderColor: borderColor,
      borderWidth: '1px',
      borderStyle: 'solid',
    }),
    [backgroundColor, borderColor]
  );

  const handleRoleSelect = useCallback((role: ViewAsRole) => {
    onRoleChange(role);
    setIsOpen(false);
  }, [onRoleChange]);

  const handleMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldShowGradient) {
      e.currentTarget.style.background = BLACK_BACKGROUND_HOVER;
    }
  }, [shouldShowGradient]);

  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (!shouldShowGradient) {
      e.currentTarget.style.background = backgroundColor;
    }
  }, [shouldShowGradient, backgroundColor]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-white rounded-md border shadow-lg transition-all"
        style={containerStyle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title="View as different role"
      >
        <span className="text-[10px] text-white/70 uppercase tracking-wide">View As:</span>
        <span>{currentLabel}</span>
        <ChevronDownIcon 
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute top-full right-0 mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg min-w-[140px]">
            {ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => handleRoleSelect(role.value)}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                  currentRole === role.value
                    ? 'bg-indigo-50 text-indigo-900 font-medium'
                    : 'text-gray-900'
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
