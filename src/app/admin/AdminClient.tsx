'use client';

import { useState, useEffect } from 'react';
import { usePageView } from '@/hooks/usePageView';

interface PageView {
  id: string;
  page_url: string;
  account_id: string | null;
  viewed_at: string;
  user_agent: string | null;
  referrer_url: string | null;
  session_id: string | null;
  account?: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

interface PinView {
  id: string;
  pin_id: string;
  account_id: string | null;
  viewed_at: string;
  user_agent: string | null;
  referrer_url: string | null;
  session_id: string | null;
  pin?: {
    name: string;
  };
  account?: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
}

export default function AdminClient() {
  // Track page view
  usePageView();
  
  const [activeTab, setActiveTab] = useState<'page_views' | 'pin_views'>('page_views');
  const [pageViews, setPageViews] = useState<PageView[]>([]);
  const [pinViews, setPinViews] = useState<PinView[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLimit, setPageLimit] = useState(100);
  const [pinLimit, setPinLimit] = useState(100);

  useEffect(() => {
    loadData();
  }, [activeTab, pageLimit, pinLimit]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'page_views') {
        const response = await fetch(`/api/admin/views/page-views?limit=${pageLimit}`);
        if (!response.ok) {
          throw new Error('Failed to fetch page views');
        }
        const { data } = await response.json();
        setPageViews(data || []);
      } else {
        const response = await fetch(`/api/admin/views/pin-views?limit=${pinLimit}`);
        if (!response.ok) {
          throw new Error('Failed to fetch pin views');
        }
        const { data } = await response.json();
        setPinViews(data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getAccountName = (account: any) => {
    if (!account) return 'Guest';
    if (account.username) return account.username;
    if (account.first_name || account.last_name) {
      return `${account.first_name || ''} ${account.last_name || ''}`.trim();
    }
    return 'Unknown';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard - Views Analytics</h1>

        {/* Tabs */}
        <div className="mb-4 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('page_views')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'page_views'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Page Views ({pageViews.length})
            </button>
            <button
              onClick={() => setActiveTab('pin_views')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'pin_views'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Pin Views ({pinViews.length})
            </button>
          </nav>
        </div>

        {/* Limit Controls */}
        <div className="mb-4 flex items-center gap-4">
          <label className="text-sm text-gray-700">
            Limit:
            <select
              value={activeTab === 'page_views' ? pageLimit : pinLimit}
              onChange={(e) => {
                const limit = parseInt(e.target.value);
                if (activeTab === 'page_views') {
                  setPageLimit(limit);
                } else {
                  setPinLimit(limit);
                }
              }}
              className="ml-2 border border-gray-300 rounded px-2 py-1"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </label>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Refresh
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : activeTab === 'page_views' ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Page URL
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Viewer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Viewed At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referrer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pageViews.map((view) => (
                    <tr key={view.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {view.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{view.page_url}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getAccountName(view.account)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(view.viewed_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {view.referrer_url || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {view.user_agent || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pin
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Viewer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Viewed At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referrer
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      User Agent
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pinViews.map((view) => (
                    <tr key={view.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
                        {view.id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {view.pin?.name || view.pin_id.substring(0, 8)}...
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">
                        {getAccountName(view.account)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {formatDate(view.viewed_at)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {view.referrer_url || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                        {view.user_agent || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

