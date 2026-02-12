'use client';

import { useState } from 'react';
import SystemsManagementClient from './SystemsManagementClient';
import RouteControlsClient from './RouteControlsClient';
import NavigationControlsClient from './NavigationControlsClient';
import ApiControlsClient from './ApiControlsClient';
import PlatformSettingsClient from './PlatformSettingsClient';
import SystemDetailsPopulator from './SystemDetailsPopulator';

type ControlSection = 'systems' | 'routes' | 'navigation' | 'api' | 'platform' | 'populate';

export default function AdminControlCenter() {
  const [activeSection, setActiveSection] = useState<ControlSection>('systems');

  const sections: Array<{ id: ControlSection; label: string; description: string }> = [
    { id: 'systems', label: 'Systems', description: 'Control database schemas and system visibility' },
    { id: 'populate', label: 'Populate Details', description: 'Manually enter system details (routes, files, APIs)' },
    { id: 'routes', label: 'Routes', description: 'Manage draft/publish status and route access' },
    { id: 'navigation', label: 'Navigation', description: 'Control menu items and navigation links' },
    { id: 'api', label: 'API Endpoints', description: 'Enable/disable API routes' },
    { id: 'platform', label: 'Platform Settings', description: 'Global platform controls and maintenance' },
  ];

  return (
    <div className="space-y-2">
      {/* Section Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {sections.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeSection === section.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {section.label}
            </button>
          ))}
        </div>
      </div>

      {/* Section Description */}
      <div className="bg-gray-50 border border-gray-200 rounded-md p-[10px]">
        <p className="text-[10px] text-gray-600 mb-1">
          {sections.find(s => s.id === activeSection)?.description}
        </p>
        {activeSection === 'systems' && (
          <p className="text-[9px] text-gray-500 font-mono">
            Database: admin.system_visibility (is_visible, is_enabled)
          </p>
        )}
        {activeSection === 'routes' && (
          <p className="text-[9px] text-gray-500 font-mono">
            Database: admin.draft_routes (is_draft) - TODO: Table needed
          </p>
        )}
        {activeSection === 'navigation' && (
          <p className="text-[9px] text-gray-500 font-mono">
            Database: admin.navigation_items (is_visible) - TODO: Table needed
          </p>
        )}
        {activeSection === 'api' && (
          <p className="text-[9px] text-gray-500 font-mono">
            Database: admin.api_routes (is_enabled) - TODO: Table needed
          </p>
        )}
        {activeSection === 'platform' && (
          <p className="text-[9px] text-gray-500 font-mono">
            Database: admin.platform_settings (various columns) - TODO: Table needed
          </p>
        )}
      </div>

      {/* Active Section Content */}
      <div className="mt-2">
        {activeSection === 'systems' && <SystemsManagementClient />}
        {activeSection === 'populate' && <SystemDetailsPopulator />}
        {activeSection === 'routes' && <RouteControlsClient />}
        {activeSection === 'navigation' && <NavigationControlsClient />}
        {activeSection === 'api' && <ApiControlsClient />}
        {activeSection === 'platform' && <PlatformSettingsClient />}
      </div>
    </div>
  );
}
