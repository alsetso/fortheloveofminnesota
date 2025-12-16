'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  PlusIcon,
  ChartBarIcon,
  EyeIcon,
  CursorArrowRaysIcon,
  CurrencyDollarIcon,
  PencilIcon,
  TrashIcon,
  PlayIcon,
  PauseIcon,
  XMarkIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'draft' | 'ended';
  impressions: number;
  clicks: number;
  spend: number;
  budget: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
}

export default function AdsClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    // TODO: Fetch campaigns from API
    // For now, simulate loading
    const timer = setTimeout(() => {
      setCampaigns([]);
      setLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleCreateCampaign = () => {
    setShowCreateModal(true);
  };

  const handleDeleteCampaign = async (id: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) {
      return;
    }
    // TODO: Implement delete API call
    setCampaigns(campaigns.filter(c => c.id !== id));
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    // TODO: Implement status toggle API call
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    setCampaigns(campaigns.map(c => 
      c.id === id ? { ...c, status: newStatus as Campaign['status'] } : c
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(num);
  };

  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'paused':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'draft':
        return 'bg-gray-100 text-gray-700 border-gray-200';
      case 'ended':
        return 'bg-gray-100 text-gray-600 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-center text-gray-500 text-xs py-6">Loading campaigns...</div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-gray-900">Campaign Manager</h1>
          <p className="text-xs text-gray-600 mt-0.5">Manage your advertising campaigns</p>
        </div>
        <button
          onClick={handleCreateCampaign}
          className="flex items-center gap-1.5 px-[10px] py-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          <span>New Campaign</span>
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs">
          {error}
        </div>
      )}

      {/* Campaigns List */}
      {campaigns.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-md p-6 text-center">
          <ChartBarIcon className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-600 mb-1.5 font-medium">No campaigns yet</p>
          <p className="text-xs text-gray-500 mb-3">Create your first campaign to start advertising on MNUDA</p>
          <button
            onClick={handleCreateCampaign}
            className="inline-flex items-center gap-1.5 px-[10px] py-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map((campaign) => (
            <div
              key={campaign.id}
              className="bg-white border border-gray-200 rounded-md overflow-hidden"
            >
              <div className="p-[10px]">
                {/* Campaign Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-xs font-semibold text-gray-900">{campaign.name}</h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-medium border ${getStatusColor(campaign.status)}`}
                      >
                        {campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">
                      Budget: {formatCurrency(campaign.budget)} • 
                      Spend: {formatCurrency(campaign.spend)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleStatus(campaign.id, campaign.status)}
                      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                      title={campaign.status === 'active' ? 'Pause' : 'Activate'}
                    >
                      {campaign.status === 'active' ? (
                        <PauseIcon className="w-4 h-4" />
                      ) : (
                        <PlayIcon className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                      title="Edit"
                    >
                      <PencilIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteCampaign(campaign.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Campaign Stats */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
                      <EyeIcon className="w-3 h-3" />
                    </div>
                    <div className="text-xs font-semibold text-gray-900">
                      {formatNumber(campaign.impressions)}
                    </div>
                    <div className="text-[10px] text-gray-500">Impressions</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
                      <CursorArrowRaysIcon className="w-3 h-3" />
                    </div>
                    <div className="text-xs font-semibold text-gray-900">
                      {formatNumber(campaign.clicks)}
                    </div>
                    <div className="text-[10px] text-gray-500">Clicks</div>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-gray-500 mb-0.5">
                      <CurrencyDollarIcon className="w-3 h-3" />
                    </div>
                    <div className="text-xs font-semibold text-gray-900">
                      {campaign.clicks > 0
                        ? formatCurrency(campaign.spend / campaign.clicks)
                        : '$0.00'}
                    </div>
                    <div className="text-[10px] text-gray-500">CPC</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreateModal(false)}
        >
          <div 
            className="bg-white rounded-md border border-gray-200 max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MNUDA Branding */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-12 h-12">
                <Image
                  src="/logo.png"
                  alt="MNUDA"
                  fill
                  className="object-contain"
                />
              </div>
            </div>

            {/* Content */}
            <div className="text-center mb-4">
              <div className="flex items-center justify-center mb-2">
                <SparklesIcon className="w-5 h-5 text-gray-400 mr-1.5" />
                <h2 className="text-sm font-semibold text-gray-900">Coming Soon</h2>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">
                We&apos;re building something great! Campaign creation will be available soon. 
                Stay tuned for updates.
              </p>
            </div>

            {/* Close Button */}
            <div className="flex justify-center">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-[10px] py-[10px] bg-gray-900 text-white text-xs font-medium rounded-md hover:bg-gray-800 transition-colors"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


