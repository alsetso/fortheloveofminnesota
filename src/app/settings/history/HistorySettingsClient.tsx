'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ClockIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';

interface HistoryItem {
  id: string;
  type: string;
  description: string;
  url: string;
  created_at: string;
  referrer_url?: string | null;
}

export default function HistorySettingsClient() {
  const { account } = useSettings();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  useEffect(() => {
    if (account?.id) {
      fetchHistory();
    }
  }, [account?.id, page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const offset = (page - 1) * limit;
      const response = await fetch(`/api/settings/history?limit=${limit}&offset=${offset}`);
      if (!response.ok) {
        throw new Error('Failed to fetch history');
      }
      const data = await response.json();
      setHistory(data.history || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Error fetching history:', err);
      setHistory([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-3">
      {/* History List */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        <h3 className="text-sm font-semibold text-gray-900 px-[10px] py-3 border-b border-gray-200">
          Account History
        </h3>
        {loading ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">Loading...</div>
        ) : history.length === 0 ? (
          <div className="px-[10px] py-4 text-xs text-gray-500">
            <div className="flex flex-col items-center justify-center py-8">
              <ClockIcon className="w-8 h-8 text-gray-300 mb-2" />
              <p>No history available yet.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Type</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">URL Visit</th>
                  <th className="text-left px-[10px] py-2 font-semibold text-gray-900">Date</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 last:border-b-0 hover:bg-gray-50">
                    <td className="px-[10px] py-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700 capitalize">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-[10px] py-2">
                      <Link
                        href={item.url}
                        className="flex items-center gap-1 text-gray-900 hover:text-gray-700 hover:underline"
                      >
                        <span>{item.description}</span>
                        <ArrowTopRightOnSquareIcon className="w-3 h-3 text-gray-400" />
                      </Link>
                    </td>
                    <td className="px-[10px] py-2 text-gray-600">
                      {formatDate(item.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > limit && (
          <div className="flex items-center justify-between px-[10px] py-3 border-t border-gray-200">
            <div className="text-xs text-gray-500">
              Page {page} of {Math.ceil(total / limit)}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(Math.ceil(total / limit), p + 1))}
                disabled={page >= Math.ceil(total / limit)}
                className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">About History</h3>
        <div className="space-y-2 text-xs text-gray-600">
          <p>
            Your account history shows a record of important account activities and changes.
          </p>
          <p>
            This includes account updates, plan changes, and other significant events.
          </p>
        </div>
      </div>
    </div>
  );
}
