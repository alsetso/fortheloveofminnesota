'use client';

import Link from 'next/link';

/**
 * Right Sidebar for Pages list
 * Recent activity, suggestions
 */
export default function PagesRightSidebar() {
  const recentActivity = [
    { id: '1', title: 'Best Hiking Trails in Minnesota', author: 'Sarah Johnson', time: '2h ago' },
    { id: '2', title: 'Local Food Guide', author: 'Mike Chen', time: '5h ago' },
    { id: '3', title: 'Winter Activities', author: 'Emma Davis', time: '1d ago' },
  ];

  return (
    <div className="h-full flex flex-col p-3 overflow-y-auto">
      <div className="space-y-4">
        {/* Recent Activity */}
        <div>
          <h3 className="text-sm font-semibold text-white mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {recentActivity.map((item) => (
              <Link
                key={item.id}
                href={`/page/${item.id}`}
                className="block p-2 bg-surface-accent rounded-md hover:bg-surface-accent/80 transition-colors"
              >
                <div className="text-xs font-medium text-white mb-1 line-clamp-2">
                  {item.title}
                </div>
                <div className="text-xs text-white/60">
                  {item.author} · {item.time}
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Suggestions */}
        <div className="pt-3 border-t border-white/10">
          <h3 className="text-sm font-semibold text-white mb-3">Suggestions</h3>
          <p className="text-xs text-white/60">
            Discover pages from the Love of Minnesota community
          </p>
        </div>
      </div>
    </div>
  );
}
