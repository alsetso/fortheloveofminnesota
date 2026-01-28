'use client';

import { useState, useEffect, useCallback } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import { useAuthStateSafe } from '@/features/auth';

interface Account {
  id: string;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  image_url: string | null;
}

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (accountId: string, role: 'manager' | 'editor') => Promise<void>;
  existingMemberIds: string[];
}

export default function InviteMemberModal({
  isOpen,
  onClose,
  onInvite,
  existingMemberIds,
}: InviteMemberModalProps) {
  const { account } = useAuthStateSafe();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Account[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'manager' | 'editor'>('editor');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Search for users
  useEffect(() => {
    if (!isOpen || !account) return;

    const searchUsers = async () => {
      const trimmedQuery = searchQuery.trim();
      
      if (trimmedQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      setError(null);

      try {
        const response = await fetch(`/api/people?q=${encodeURIComponent(trimmedQuery)}`);
        if (!response.ok) {
          throw new Error('Failed to search users');
        }
        const data = await response.json();
        
        // Filter out existing members
        const filtered = (data.people || []).filter(
          (person: Account) => !existingMemberIds.includes(person.id)
        );
        
        setSearchResults(filtered.slice(0, 10));
      } catch (err) {
        console.error('Error searching users:', err);
        setError('Failed to search users');
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchUsers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, isOpen, account, existingMemberIds]);

  const handleInvite = async (accountId: string) => {
    setIsInviting(true);
    setError(null);
    
    try {
      await onInvite(accountId, selectedRole);
      setSearchQuery('');
      setSearchResults([]);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to invite member');
    } finally {
      setIsInviting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end lg:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      <div className="relative bg-white rounded-t-2xl lg:rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Invite Member</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-md transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Role Selector */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Role</div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedRole('editor')}
                className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedRole === 'editor'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Editor
              </button>
              <button
                onClick={() => setSelectedRole('manager')}
                className={`flex-1 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  selectedRole === 'manager'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Manager
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-medium text-gray-500">Search Users</div>
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or name..."
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs text-red-600">{error}</p>
            </div>
          )}

          {/* Search Results */}
          {isSearching && (
            <div className="text-center py-4">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-gray-500 mt-2">Searching...</p>
            </div>
          )}

          {!isSearching && searchQuery.trim().length >= 2 && searchResults.length === 0 && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">No users found</p>
            </div>
          )}

          {!isSearching && searchResults.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-medium text-gray-500">Results</div>
              <div className="space-y-1">
                {searchResults.map((person) => {
                  const displayName = person.first_name && person.last_name
                    ? `${person.first_name} ${person.last_name}`
                    : person.username
                    ? `@${person.username}`
                    : 'User';

                  return (
                    <button
                      key={person.id}
                      onClick={() => handleInvite(person.id)}
                      disabled={isInviting}
                      className="w-full flex items-center gap-2 p-2 text-left hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
                    >
                      {person.image_url ? (
                        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-gray-200">
                          <Image
                            src={person.image_url}
                            alt={displayName}
                            width={32}
                            height={32}
                            className="w-full h-full object-cover"
                            unoptimized
                          />
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-gray-500">
                            {(person.first_name?.[0] || person.username?.[0] || 'U').toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">
                          {displayName}
                        </div>
                        {person.username && (
                          <div className="text-[10px] text-gray-500 truncate">
                            @{person.username}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {searchQuery.trim().length < 2 && (
            <div className="text-center py-4">
              <p className="text-xs text-gray-500">Type at least 2 characters to search</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
