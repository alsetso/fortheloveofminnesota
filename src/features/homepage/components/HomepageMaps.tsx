'use client';

import Link from 'next/link';
import { ArrowRightIcon, MapIcon, UserGroupIcon, BuildingOfficeIcon, GlobeAltIcon } from '@heroicons/react/24/outline';

export default function HomepageMaps() {
  const mapCategories = [
    {
      href: '/maps?tab=community',
      title: 'Community Maps',
      description: 'Explore maps created by the community, including mentions and shared locations.',
      icon: UserGroupIcon,
      color: 'text-blue-600',
    },
    {
      href: '/maps?tab=professional',
      title: 'Professional Maps',
      description: 'Business and organization maps with advanced features and customization.',
      icon: BuildingOfficeIcon,
      color: 'text-indigo-600',
    },
    {
      href: '/maps?tab=atlas',
      title: 'Atlas Maps',
      description: 'Comprehensive geographic data layers including cities, counties, schools, parks, and more.',
      icon: GlobeAltIcon,
      color: 'text-green-600',
    },
    {
      href: '/maps?tab=my-maps',
      title: 'My Maps',
      description: 'Your personal maps and collections. Create and manage your own custom maps.',
      icon: MapIcon,
      color: 'text-gray-600',
    },
  ];

  return (
    <section className="space-y-3 pt-6 border-t border-gray-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapIcon className="w-4 h-4 text-gray-700" />
          <h2 className="text-sm font-semibold text-gray-900">MAPS</h2>
        </div>
        <Link
          href="/maps"
          className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1"
        >
          <span>View All</span>
          <ArrowRightIcon className="w-3 h-3" />
        </Link>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {mapCategories.map((category) => {
          const Icon = category.icon;
          return (
            <Link
              key={category.href}
              href={category.href}
              className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 hover:border-gray-300 transition-all group"
            >
              <div className="flex items-start gap-2">
                <div className={`flex-shrink-0 mt-0.5 ${category.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 space-y-0.5 min-w-0">
                  <h3 className="text-xs font-semibold text-gray-900 group-hover:text-gray-700 transition-colors">
                    {category.title}
                  </h3>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    {category.description}
                  </p>
                </div>
                <ArrowRightIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-600 transition-colors flex-shrink-0 mt-0.5" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

