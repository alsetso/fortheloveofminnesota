'use client';

import { useEffect, useMemo } from 'react';
import Image from 'next/image';
import { XMarkIcon, ChartBarIcon, UserIcon, UserGroupIcon, IdentificationIcon } from '@heroicons/react/24/outline';
import AnalyticsClient from './AnalyticsClient';
import SettingsClient from './SettingsClient';
import ProfileClient from './ProfileClient';
import ProfilesClient from './ProfilesClient';
import { useAccountData } from '../hooks/useAccountData';
import { useAccountTabs } from '../hooks/useAccountTabs';
import type { AccountModalProps, AccountTabId } from '../types';

interface Tab {
  id: AccountTabId;
  label: string;
  icon: typeof ChartBarIcon;
}

export default function AccountModal({ isOpen, onClose, initialTab, onAccountUpdate }: AccountModalProps) {
  const { activeTab, setActiveTab } = useAccountTabs(initialTab, isOpen);
  const { account, userEmail, loading } = useAccountData(isOpen, activeTab);

  // Build tabs array - profile is available to everyone, profiles is only available to admins
  const tabs: Tab[] = useMemo(() => {
    const baseTabs: Tab[] = [
      { id: 'analytics', label: 'Analytics', icon: ChartBarIcon },
      { id: 'profile', label: 'Profile', icon: IdentificationIcon },
      { id: 'settings', label: 'Settings', icon: UserIcon },
    ];
    
    // Only include profiles tab if user is admin
    if (account?.role === 'admin') {
      baseTabs.push({ id: 'profiles', label: 'Profiles', icon: UserGroupIcon });
    }
    
    return baseTabs;
  }, [account?.role]);

  // Redirect away from profiles tab if user is not admin
  useEffect(() => {
    if (activeTab === 'profiles' && account?.role !== 'admin') {
      setActiveTab('settings');
    }
  }, [activeTab, account?.role, setActiveTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-[10px]">
      {/* Backdrop - No click to close, user must explicitly close */}
      <div 
        className="absolute inset-0 bg-black/40"
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-md border border-gray-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-[10px] py-[10px] border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative w-6 h-6 flex-shrink-0">
              <Image
                src="/logo.png"
                alt="For the Love of Minnesota"
                width={24}
                height={24}
                className="object-contain"
                priority
              />
            </div>
            <div className="flex flex-col">
              <h2 className="text-sm font-semibold text-gray-900">Account</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-1.5 px-[10px] py-2 text-xs font-medium transition-colors whitespace-nowrap border-b-2
                  ${activeTab === tab.id
                    ? 'text-gray-900 border-gray-900'
                    : 'text-gray-500 hover:text-gray-700 border-transparent'
                  }
                `}
              >
                <Icon className="w-3 h-3" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-[10px]">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {activeTab === 'analytics' && <AnalyticsClient />}
              {activeTab === 'profile' && <ProfileClient />}
              {activeTab === 'settings' && account && <SettingsClient initialAccount={account} userEmail={userEmail} />}
              {activeTab === 'profiles' && <ProfilesClient />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}




