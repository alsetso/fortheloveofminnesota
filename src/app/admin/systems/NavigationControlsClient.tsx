'use client';

import { useState, useEffect } from 'react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  location: 'left' | 'right' | 'header' | 'footer';
  isVisible: boolean;
  requiresAuth: boolean;
  requiresFeature?: string;
}

export default function NavigationControlsClient() {
  const [navItems, setNavItems] = useState<NavItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'left' | 'right' | 'header' | 'footer'>('all');

  useEffect(() => {
    fetchNavItems();
  }, []);

  const fetchNavItems = async () => {
    try {
      const res = await fetch('/api/admin/navigation');
      if (res.ok) {
        const data = await res.json();
        setNavItems(data.items || []);
      } else {
        // Fallback: hardcoded nav items from codebase
        setNavItems(getDefaultNavItems());
      }
    } catch (error) {
      console.error('Error fetching navigation items:', error);
      setNavItems(getDefaultNavItems());
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = async (itemId: string, currentVisible: boolean) => {
    try {
      const res = await fetch('/api/admin/navigation', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId,
          isVisible: !currentVisible,
        }),
      });

      if (res.ok) {
        fetchNavItems();
      }
    } catch (error) {
      console.error('Error updating navigation item:', error);
      // Update local state optimistically
      setNavItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, isVisible: !currentVisible } : item
      ));
    }
  };

  const filteredItems = navItems.filter(item => 
    filter === 'all' || item.location === filter
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-gray-600">Loading navigation items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
        >
          <option value="all">All Locations</option>
          <option value="left">Left Sidebar</option>
          <option value="right">Right Sidebar</option>
          <option value="header">Header</option>
          <option value="footer">Footer</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Total Items</div>
          <div className="text-sm font-semibold text-gray-900">{navItems.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Visible</div>
          <div className="text-sm font-semibold text-green-600">
            {navItems.filter(i => i.isVisible).length}
          </div>
        </div>
      </div>

      {/* Navigation Items by Location */}
      {(['left', 'right', 'header', 'footer'] as const).map((location) => {
        const locationItems = filteredItems.filter(item => item.location === location);
        if (filter !== 'all' && filter !== location) return null;
        
        return (
          <div key={location} className="border border-gray-200 rounded-md overflow-hidden mb-2">
            <div className="bg-gray-50 p-[10px] border-b border-gray-200">
              <div className="text-xs font-semibold text-gray-900 capitalize">
                {location} Sidebar
              </div>
            </div>
            <div className="divide-y divide-gray-200">
              {locationItems.length === 0 ? (
                <div className="p-[10px] text-[10px] text-gray-500">No items</div>
              ) : (
                locationItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-[10px] hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs text-gray-900">{item.label}</span>
                          <span className="text-[10px] text-gray-500 font-mono">{item.href}</span>
                          {item.requiresAuth && (
                            <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">auth</span>
                          )}
                          {item.requiresFeature && (
                            <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px]">
                              {item.requiresFeature}
                            </span>
                          )}
                        </div>
                      </div>
                      <label className="flex items-center gap-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.isVisible}
                          onChange={() => toggleVisibility(item.id, item.isVisible)}
                          className="w-3 h-3"
                        />
                        <span className="text-[10px] text-gray-600">Visible</span>
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getDefaultNavItems(): NavItem[] {
  return [
    // Left Sidebar
    { id: 'nav-left-home', label: 'Love of Minnesota', href: '/', location: 'left', isVisible: true, requiresAuth: false },
    { id: 'nav-left-friends', label: 'Friends', href: '/friends', location: 'left', isVisible: true, requiresAuth: true },
    { id: 'nav-left-saved', label: 'Saved', href: '/saved', location: 'left', isVisible: true, requiresAuth: true },
    { id: 'nav-left-memories', label: 'Memories', href: '/memories', location: 'left', isVisible: true, requiresAuth: true },
    { id: 'nav-left-pages', label: 'Pages', href: '/pages', location: 'left', isVisible: true, requiresAuth: true },
    { id: 'nav-left-stories', label: 'Stories', href: '/stories', location: 'left', isVisible: true, requiresAuth: true },
    { id: 'nav-left-docs', label: 'Documentation', href: '/docs', location: 'left', isVisible: true, requiresAuth: false },
    
    // Header
    { id: 'nav-header-home', label: 'Home', href: '/', location: 'header', isVisible: true, requiresAuth: false },
    { id: 'nav-header-maps', label: 'Maps', href: '/maps', location: 'header', isVisible: true, requiresAuth: false },
    { id: 'nav-header-explore', label: 'Explore', href: '/explore', location: 'header', isVisible: true, requiresAuth: false },
    { id: 'nav-header-people', label: 'People', href: '/people', location: 'header', isVisible: true, requiresAuth: false },
    { id: 'nav-header-gov', label: 'Government', href: '/gov', location: 'header', isVisible: true, requiresAuth: false },
  ];
}
