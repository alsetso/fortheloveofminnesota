'use client';

import { useState, useEffect } from 'react';

interface ApiRoute {
  path: string;
  method: string;
  isEnabled: boolean;
  requiresAuth: boolean;
  requiresFeature?: string;
  system?: string;
}

export default function ApiControlsClient() {
  const [apiRoutes, setApiRoutes] = useState<ApiRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'enabled' | 'disabled'>('all');

  useEffect(() => {
    fetchApiRoutes();
  }, []);

  const fetchApiRoutes = async () => {
    try {
      const res = await fetch('/api/admin/api-routes');
      if (res.ok) {
        const data = await res.json();
        setApiRoutes(data.routes || []);
      } else {
        // Fallback: scan API directory
        setApiRoutes(getDefaultApiRoutes());
      }
    } catch (error) {
      console.error('Error fetching API routes:', error);
      setApiRoutes(getDefaultApiRoutes());
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (routePath: string, method: string, currentEnabled: boolean) => {
    try {
      const res = await fetch('/api/admin/api-routes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routePath,
          method,
          isEnabled: !currentEnabled,
        }),
      });

      if (res.ok) {
        fetchApiRoutes();
      }
    } catch (error) {
      console.error('Error updating API route:', error);
      // Update local state optimistically
      setApiRoutes(prev => prev.map(route => 
        route.path === routePath && route.method === method
          ? { ...route, isEnabled: !currentEnabled }
          : route
      ));
    }
  };

  const filteredRoutes = apiRoutes.filter(route => {
    const matchesSearch = route.path.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' ||
                         (filter === 'enabled' && route.isEnabled) ||
                         (filter === 'disabled' && !route.isEnabled);
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-gray-600">Loading API routes...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <input
          type="text"
          placeholder="Search API routes..."
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
          <option value="enabled">Enabled Only</option>
          <option value="disabled">Disabled Only</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Total Routes</div>
          <div className="text-sm font-semibold text-gray-900">{apiRoutes.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Enabled</div>
          <div className="text-sm font-semibold text-green-600">
            {apiRoutes.filter(r => r.isEnabled).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Disabled</div>
          <div className="text-sm font-semibold text-red-600">
            {apiRoutes.filter(r => !r.isEnabled).length}
          </div>
        </div>
      </div>

      {/* API Routes List */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto">
          {filteredRoutes.map((route) => (
            <div
              key={`${route.method}-${route.path}`}
              className="border-b border-gray-200 last:border-b-0 p-[10px] hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[9px] font-mono font-semibold">
                      {route.method}
                    </span>
                    <span className="font-mono text-xs text-gray-900">{route.path}</span>
                    {route.system && (
                      <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">
                        {route.system}
                      </span>
                    )}
                    {route.requiresAuth && (
                      <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">auth</span>
                    )}
                    {route.requiresFeature && (
                      <span className="px-1 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[9px]">
                        {route.requiresFeature}
                      </span>
                    )}
                  </div>
                </div>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={route.isEnabled}
                    onChange={() => toggleEnabled(route.path, route.method, route.isEnabled)}
                    className="w-3 h-3"
                  />
                  <span className="text-[10px] text-gray-600">Enabled</span>
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDefaultApiRoutes(): ApiRoute[] {
  return [
    // Core APIs (always enabled)
    { path: '/api/feed/pin-activity', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
    { path: '/api/maps/live/mentions', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
    { path: '/api/maps', method: 'GET', isEnabled: true, requiresAuth: false, system: 'maps' },
    { path: '/api/maps/[id]/pins', method: 'GET', isEnabled: true, requiresAuth: false, system: 'maps' },
    { path: '/api/analytics/homepage-stats', method: 'GET', isEnabled: true, requiresAuth: false, system: 'core' },
    
    // Non-core APIs (can be disabled)
    { path: '/api/feed', method: 'GET', isEnabled: true, requiresAuth: true, system: 'feeds' },
    { path: '/api/stories', method: 'GET', isEnabled: true, requiresAuth: true, system: 'stories' },
    { path: '/api/social', method: 'GET', isEnabled: true, requiresAuth: true, system: 'social_graph' },
    { path: '/api/messaging', method: 'GET', isEnabled: true, requiresAuth: true, system: 'messaging' },
    { path: '/api/pages', method: 'GET', isEnabled: true, requiresAuth: true, system: 'pages' },
    { path: '/api/places', method: 'GET', isEnabled: true, requiresAuth: false, system: 'places' },
    { path: '/api/ad_center', method: 'GET', isEnabled: true, requiresAuth: true, system: 'ads' },
    { path: '/api/analytics', method: 'GET', isEnabled: true, requiresAuth: true, system: 'analytics' },
    { path: '/api/gov', method: 'GET', isEnabled: true, requiresAuth: false, system: 'civic' },
  ];
}
