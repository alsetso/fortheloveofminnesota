'use client';

import { useState, useEffect } from 'react';

interface RouteInfo {
  path: string;
  filePath: string;
  hasMetadata: boolean;
  isDraft: boolean;
  isDynamic: boolean;
}

export default function RouteControlsClient() {
  const [routes, setRoutes] = useState<RouteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'draft' | 'production'>('all');

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const res = await fetch('/api/admin/dashboard/routes');
      if (res.ok) {
        const data = await res.json();
        setRoutes(data.routes || []);
      }
    } catch (error) {
      console.error('Error fetching routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleDraftStatus = async (routePath: string, currentIsDraft: boolean) => {
    try {
      const res = await fetch('/api/admin/routes/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routePath,
          isDraft: !currentIsDraft,
        }),
      });

      if (res.ok) {
        fetchRoutes();
      }
    } catch (error) {
      console.error('Error updating route draft status:', error);
    }
  };

  const filteredRoutes = routes.filter(route => {
    const matchesSearch = route.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         route.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || 
                         (filter === 'draft' && route.isDraft) ||
                         (filter === 'production' && !route.isDraft);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-gray-600">Loading routes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search routes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="all">All Routes</option>
          <option value="draft">Draft Only</option>
          <option value="production">Production Only</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Total Routes</div>
          <div className="text-sm font-semibold text-gray-900">{routes.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Draft</div>
          <div className="text-sm font-semibold text-orange-600">
            {routes.filter(r => r.isDraft).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Production</div>
          <div className="text-sm font-semibold text-green-600">
            {routes.filter(r => !r.isDraft).length}
          </div>
        </div>
      </div>

      {/* Routes List */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {filteredRoutes.map((route) => (
            <div
              key={route.path}
              className="border-b border-gray-200 last:border-b-0 p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs text-gray-900">{route.path}</span>
                    {route.isDynamic && (
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">dynamic</span>
                    )}
                    {route.hasMetadata && (
                      <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">metadata</span>
                    )}
                    <span
                      className={`px-1 py-0.5 rounded text-[9px] ${
                        route.isDraft
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {route.isDraft ? 'draft' : 'production'}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-500 font-mono truncate">{route.filePath}</div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!route.isDraft}
                    onChange={() => toggleDraftStatus(route.path, route.isDraft)}
                    className="w-3 h-3"
                  />
                  <span className="text-[10px] text-gray-600">Published</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
