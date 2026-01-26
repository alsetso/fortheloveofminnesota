'use client';

import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import type { MapMemberRole } from '@/types/map';

interface MemberRoleSelectorProps {
  currentRole: MapMemberRole;
  onRoleChange: (role: 'manager' | 'editor') => Promise<void>;
  canChangeRole: boolean;
  isOwner: boolean;
}

export default function MemberRoleSelector({
  currentRole,
  onRoleChange,
  canChangeRole,
  isOwner,
}: MemberRoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  if (isOwner) {
    return (
      <span className="text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
        Owner
      </span>
    );
  }

  if (!canChangeRole) {
    return (
      <span className="text-xs font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded capitalize">
        {currentRole}
      </span>
    );
  }

  const handleRoleChange = async (newRole: 'manager' | 'editor') => {
    if (newRole === currentRole || isChanging) return;
    
    setIsChanging(true);
    try {
      await onRoleChange(newRole);
      setIsOpen(false);
    } catch (err) {
      console.error('Error changing role:', err);
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isChanging}
        className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded transition-colors disabled:opacity-50"
      >
        <span className="capitalize">{currentRole}</span>
        <ChevronDownIcon className="w-3 h-3" />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-1 z-20 bg-white border border-gray-200 rounded-md shadow-lg min-w-[120px]">
            <button
              onClick={() => handleRoleChange('manager')}
              disabled={isChanging || currentRole === 'manager'}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                currentRole === 'manager'
                  ? 'bg-indigo-50 text-indigo-900 font-medium'
                  : 'text-gray-900'
              } disabled:opacity-50`}
            >
              Manager
            </button>
            <button
              onClick={() => handleRoleChange('editor')}
              disabled={isChanging || currentRole === 'editor'}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
                currentRole === 'editor'
                  ? 'bg-indigo-50 text-indigo-900 font-medium'
                  : 'text-gray-900'
              } disabled:opacity-50`}
            >
              Editor
            </button>
          </div>
        </>
      )}
    </div>
  );
}
