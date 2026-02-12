'use client';

import { useState } from 'react';

type DocSection = 'overview' | 'systems' | 'routes' | 'navigation' | 'api' | 'platform' | 'how-it-works';

export default function AdminDocsClient() {
  const [activeSection, setActiveSection] = useState<DocSection>('overview');

  const sections: Array<{ id: DocSection; label: string }> = [
    { id: 'overview', label: 'Overview' },
    { id: 'systems', label: 'Systems Control' },
    { id: 'routes', label: 'Routes Control' },
    { id: 'navigation', label: 'Navigation Control' },
    { id: 'api', label: 'API Control' },
    { id: 'platform', label: 'Platform Settings' },
    { id: 'how-it-works', label: 'How It Works' },
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

      {/* Content */}
      <div className="mt-2">
        {activeSection === 'overview' && <OverviewSection />}
        {activeSection === 'systems' && <SystemsSection />}
        {activeSection === 'routes' && <RoutesSection />}
        {activeSection === 'navigation' && <NavigationSection />}
        {activeSection === 'api' && <ApiSection />}
        {activeSection === 'platform' && <PlatformSection />}
        {activeSection === 'how-it-works' && <HowItWorksSection />}
      </div>
    </div>
  );
}

function OverviewSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Is This?</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          The Admin Control Center gives you centralized control over what users can see and access on the platform. 
          Instead of editing code or database tables directly, you can toggle systems, routes, navigation items, and APIs on/off from one interface.
        </p>
        <p className="text-[10px] text-gray-600">
          <strong className="text-gray-900">Key Concept:</strong> Each control affects different parts of the application. 
          Understanding what each toggle does helps you make informed decisions about platform visibility.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">The Flow</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[9px]">1</span>
            <div>
              <strong className="text-gray-900">You toggle a control</strong> in the admin UI
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[9px]">2</span>
            <div>
              <strong className="text-gray-900">API updates database</strong> - Your change is saved to a database table
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[9px]">3</span>
            <div>
              <strong className="text-gray-900">Middleware checks settings</strong> - When a user visits a route, middleware checks if it's allowed
            </div>
          </div>
          <div className="flex items-start gap-2">
            <span className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[9px]">4</span>
            <div>
              <strong className="text-gray-900">User sees result</strong> - Either the page loads, or they're redirected to homepage
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Important Notes</h2>
        <ul className="space-y-1 text-[10px] text-gray-600 list-disc list-inside">
          <li><strong className="text-gray-900">Changes are immediate</strong> - No deployment needed, changes take effect right away</li>
          <li><strong className="text-gray-900">API routes are separate</strong> - Disabling a system blocks pages, but APIs may still work (see API Control section)</li>
          <li><strong className="text-gray-900">Admin always has access</strong> - You can always access admin pages regardless of settings</li>
          <li><strong className="text-gray-900">Database data remains</strong> - Disabling a system doesn't delete data, it just hides it from users</li>
        </ul>
      </div>
    </div>
  );
}

function SystemsSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Are Systems?</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          A "system" is a database schema (like <code className="bg-gray-100 px-1 rounded text-[9px]">maps</code>, <code className="bg-gray-100 px-1 rounded text-[9px]">stories</code>, <code className="bg-gray-100 px-1 rounded text-[9px]">feeds</code>) 
          that corresponds to a feature area of the platform. Each system has a primary route (like <code className="bg-gray-100 px-1 rounded text-[9px]">/maps</code> or <code className="bg-gray-100 px-1 rounded text-[9px]">/stories</code>) 
          and may have multiple sub-routes.
        </p>
        <p className="text-[10px] text-gray-600">
          <strong className="text-gray-900">Example:</strong> The "Maps" system uses the <code className="bg-gray-100 px-1 rounded text-[9px]">maps</code> database schema 
          and controls access to routes like <code className="bg-gray-100 px-1 rounded text-[9px]">/maps</code>, <code className="bg-gray-100 px-1 rounded text-[9px]">/map/[id]</code>, etc.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Visible vs Enabled</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Visible (is_visible):</strong> Controls whether users can see and access routes for this system. 
            When unchecked, users trying to visit routes in this system are redirected to the homepage.
          </div>
          <div>
            <strong className="text-gray-900">Enabled (is_enabled):</strong> Controls whether the system is fully functional. 
            When unchecked, the system is disabled even if visible. Both must be true for a system to work.
          </div>
          <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-2">
            <strong className="text-gray-900">In Code:</strong> Middleware checks both flags: 
            <code className="block bg-white p-1 rounded mt-1 text-[9px] font-mono">
              if (!system.is_visible || !system.is_enabled) redirect('/')
            </code>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Happens When You Toggle</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Turning OFF a system:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>All routes under that system become inaccessible</li>
              <li>Users visiting those routes are redirected to homepage</li>
              <li>Navigation links to those routes may still appear (use Navigation Control to hide them)</li>
              <li>API endpoints may still work (use API Control to disable them)</li>
              <li>Database data is NOT deleted, just hidden</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900">Turning ON a system:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Routes become accessible again</li>
              <li>Users can visit pages in that system</li>
              <li>No code changes needed - it's instant</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">The Database</h2>
        <p className="text-[10px] text-gray-600 mb-2">
          System settings are stored in the <code className="bg-gray-100 px-1 rounded text-[9px]">admin.system_visibility</code> table:
        </p>
        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[9px] font-mono">
          <div>schema_name: 'maps'</div>
          <div>system_name: 'Maps'</div>
          <div>primary_route: '/maps'</div>
          <div>is_visible: true/false</div>
          <div>is_enabled: true/false</div>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          When you toggle a checkbox, the API updates this table, and middleware reads from it on every request.
        </p>
      </div>
    </div>
  );
}

function RoutesSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Are Routes?</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          Routes are individual pages in your application. Each route corresponds to a file like <code className="bg-gray-100 px-1 rounded text-[9px]">src/app/maps/page.tsx</code> 
          or <code className="bg-gray-100 px-1 rounded text-[9px]">src/app/stories/new/page.tsx</code>.
        </p>
        <p className="text-[10px] text-gray-600">
          Routes can be marked as "draft" (unpublished) or "production" (published). Draft routes are hidden from search engines 
          and can be blocked from user access.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Draft vs Production</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Draft Routes:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Marked with <code className="bg-gray-100 px-1 rounded text-[9px]">noindex, nofollow</code> robots meta tags</li>
              <li>Not indexed by search engines</li>
              <li>Can be blocked from access in production (configurable)</li>
              <li>Shown with orange "draft" badge in admin UI</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900">Production Routes:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Fully accessible to users</li>
              <li>Indexed by search engines (if they have metadata)</li>
              <li>Shown with green "production" badge in admin UI</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Happens When You Toggle</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Marking a route as Draft:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Route is added to <code className="bg-gray-100 px-1 rounded text-[9px]">DRAFT_ROUTES</code> config</li>
              <li>Page file gets <code className="bg-gray-100 px-1 rounded text-[9px]">generateDraftMetadata()</code> function</li>
              <li>Search engines are told not to index it</li>
              <li>If <code className="bg-gray-100 px-1 rounded text-[9px]">blockInProduction</code> is enabled, users are redirected</li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900">Marking a route as Production:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Route is removed from draft list</li>
              <li>Normal metadata is used (if available)</li>
              <li>Route becomes fully accessible</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">The Code</h2>
        <p className="text-[10px] text-gray-600 mb-2">
          Draft status is checked in middleware:
        </p>
        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[9px] font-mono">
          <div>if (isDraftRoute(pathname)) {'{'}</div>
          <div className="ml-2">if (blockInProduction) redirect('/')</div>
          <div className="ml-2">// Add noindex meta tags</div>
          <div>{'}'}</div>
        </div>
      </div>
    </div>
  );
}

function NavigationSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Is Navigation Control?</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          Navigation control lets you hide/show menu items in different parts of the UI: left sidebar, right sidebar, header, and footer. 
          This is separate from route access - hiding a nav item doesn't block the route, it just removes the link.
        </p>
        <p className="text-[10px] text-gray-600">
          <strong className="text-gray-900">Key Point:</strong> If you disable a system, you should also hide its navigation items 
          to prevent users from seeing broken links.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Navigation Locations</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Left Sidebar:</strong> Main navigation menu (Home, Friends, Saved, etc.)
          </div>
          <div>
            <strong className="text-gray-900">Right Sidebar:</strong> Secondary content (sponsored, contacts)
          </div>
          <div>
            <strong className="text-gray-900">Header:</strong> Top navigation bar (Home, Maps, Explore, etc.)
          </div>
          <div>
            <strong className="text-gray-900">Footer:</strong> Footer links (Privacy, Terms, etc.)
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Happens When You Toggle</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Hiding a navigation item:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>The link disappears from the menu</li>
              <li>Users can't click it to navigate</li>
              <li>The route itself may still be accessible if typed directly</li>
              <li>Component code checks visibility before rendering: <code className="bg-gray-100 px-1 rounded text-[9px]">if (item.isVisible) {'<Link>'}</code></li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900">Showing a navigation item:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Link appears in the menu</li>
              <li>Users can click to navigate</li>
              <li>Still subject to route-level access control</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Best Practice</h2>
        <p className="text-[10px] text-gray-600">
          When disabling a system, also hide its navigation items. This prevents users from seeing links that lead to blocked pages. 
          The workflow: <strong className="text-gray-900">Disable System → Hide Navigation Items → Disable API Routes</strong>
        </p>
      </div>
    </div>
  );
}

function ApiSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Are API Routes?</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          API routes are backend endpoints that frontend code calls to fetch data. Examples: <code className="bg-gray-100 px-1 rounded text-[9px]">/api/maps</code>, 
          <code className="bg-gray-100 px-1 rounded text-[9px]"> /api/feed/pin-activity</code>, <code className="bg-gray-100 px-1 rounded text-[9px]">/api/stories</code>.
        </p>
        <p className="text-[10px] text-gray-600">
          <strong className="text-gray-900">Important:</strong> Disabling a system blocks page routes, but API routes are checked separately. 
          You need to disable APIs too if you want complete isolation.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Why Control APIs Separately?</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Page routes vs API routes:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>Page routes are checked by middleware (runs before page loads)</li>
              <li>API routes are checked by API route handlers (runs when API is called)</li>
              <li>They're separate systems, so you control them separately</li>
            </ul>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 p-2 rounded mt-2">
            <strong className="text-gray-900">Example:</strong> If you disable the "Stories" system, users can't visit <code className="bg-white px-1 rounded text-[9px]">/stories</code>, 
            but if <code className="bg-white px-1 rounded text-[9px]">/api/stories</code> is still enabled, components might still fetch story data in the background.
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Happens When You Toggle</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Disabling an API route:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>API returns 404 or 403 error</li>
              <li>Frontend components calling that API will fail</li>
              <li>No data is returned, components show error states</li>
              <li>Code checks: <code className="bg-gray-100 px-1 rounded text-[9px]">if (!isApiEnabled(route)) return 404</code></li>
            </ul>
          </div>
          <div>
            <strong className="text-gray-900">Enabling an API route:</strong>
            <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5">
              <li>API works normally</li>
              <li>Frontend can fetch data</li>
              <li>Still subject to auth/feature requirements</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Core APIs</h2>
        <p className="text-[10px] text-gray-600 mb-2">
          Some APIs are marked as "core" and should generally stay enabled:
        </p>
        <ul className="list-disc list-inside ml-2 space-y-0.5 text-[10px] text-gray-600">
          <li><code className="bg-gray-100 px-1 rounded text-[9px]">/api/feed/pin-activity</code> - Homepage feed</li>
          <li><code className="bg-gray-100 px-1 rounded text-[9px]">/api/maps/live/mentions</code> - Live map data</li>
          <li><code className="bg-gray-100 px-1 rounded text-[9px]">/api/analytics/homepage-stats</code> - Homepage stats</li>
        </ul>
        <p className="text-[10px] text-gray-600 mt-2">
          Disabling core APIs will break the homepage and core functionality.
        </p>
      </div>
    </div>
  );
}

function PlatformSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Platform Settings</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          Platform settings are global controls that affect the entire platform, not just specific systems. 
          These are "kill switches" and limits you can use to control platform behavior.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Maintenance Mode</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">What it does:</strong> Shows a maintenance message to all users and blocks access to most features.
          </div>
          <div>
            <strong className="text-gray-900">When to use:</strong> During deployments, major updates, or when you need to temporarily shut down the platform.
          </div>
          <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-2">
            <strong className="text-gray-900">In Code:</strong> Middleware checks maintenance mode:
            <code className="block bg-white p-1 rounded mt-1 text-[9px] font-mono">
              if (maintenanceMode) showMessage(maintenanceMessage)
            </code>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Access Controls</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Allow New Registrations:</strong> Controls whether new users can sign up. 
            Turn off to stop new user growth temporarily.
          </div>
          <div>
            <strong className="text-gray-900">Allow New Maps:</strong> Controls whether users can create new maps. 
            Turn off to prevent new map creation (existing maps still work).
          </div>
          <div>
            <strong className="text-gray-900">Allow New Pins:</strong> Controls whether users can create new pins/mentions. 
            Turn off to prevent new content creation (existing content still visible).
          </div>
          <div>
            <strong className="text-gray-900">Require Email Verification:</strong> Forces users to verify their email before full access. 
            Useful for preventing spam accounts.
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Platform Limits</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Max Pins Per Map:</strong> Sets a hard limit on how many pins can be added to a single map. 
            Leave empty for unlimited. Useful for preventing abuse or managing resource usage.
          </div>
          <div>
            <strong className="text-gray-900">Max Maps Per Account:</strong> Sets a limit on how many maps a single account can create. 
            Leave empty for unlimited. Useful for free tier limits.
          </div>
          <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-2">
            <strong className="text-gray-900">In Code:</strong> Checks happen when creating:
            <code className="block bg-white p-1 rounded mt-1 text-[9px] font-mono">
              if (maxPinsPerMap && currentPins {'>='} maxPinsPerMap) error('Limit reached')
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  return (
    <div className="space-y-3">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">The Complete Flow</h2>
        <div className="space-y-3 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Step 1: You Make a Change</strong>
            <p className="mt-1">You toggle "Visible" off for the "Stories" system in the admin UI.</p>
          </div>
          
          <div>
            <strong className="text-gray-900">Step 2: API Updates Database</strong>
            <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-1 text-[9px] font-mono">
              <div>PATCH /api/admin/systems</div>
              <div>{'{'}</div>
              <div className="ml-2">systemId: 'stories-system-id'</div>
              <div className="ml-2">updates: {'{'} is_visible: false {'}'}</div>
              <div>{'}'}</div>
              <div className="mt-1">→ Updates admin.system_visibility table</div>
            </div>
          </div>

          <div>
            <strong className="text-gray-900">Step 3: User Visits Route</strong>
            <p className="mt-1">A user tries to visit <code className="bg-gray-100 px-1 rounded text-[9px]">/stories</code></p>
          </div>

          <div>
            <strong className="text-gray-900">Step 4: Middleware Checks</strong>
            <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-1 text-[9px] font-mono">
              <div>middleware.ts:</div>
              <div>const routeVisible = await isRouteVisible('/stories')</div>
              <div>→ Calls database function admin.is_route_visible('/stories')</div>
              <div>→ Checks admin.system_visibility for 'stories' schema</div>
              <div>→ Finds is_visible = false</div>
              <div>→ Returns false</div>
            </div>
          </div>

          <div>
            <strong className="text-gray-900">Step 5: User Gets Redirected</strong>
            <div className="bg-gray-50 p-2 rounded border border-gray-200 mt-1 text-[9px] font-mono">
              <div>if (!routeVisible) {'{'}</div>
              <div className="ml-2">return NextResponse.redirect('/')</div>
              <div>{'}'}</div>
              <div className="mt-1">→ User sees homepage instead</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Database Functions</h2>
        <p className="text-[10px] text-gray-600 mb-2">
          The system uses PostgreSQL functions to check visibility efficiently:
        </p>
        <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[9px] font-mono">
          <div>admin.is_route_visible(route_path, user_id)</div>
          <div className="mt-1">→ Checks route_visibility table first</div>
          <div>→ Falls back to system_visibility table</div>
          <div>→ Checks feature requirements if needed</div>
          <div>→ Returns true/false</div>
        </div>
        <p className="text-[10px] text-gray-600 mt-2">
          This function is called on every route request, so changes take effect immediately.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">What Doesn't Get Blocked</h2>
        <div className="space-y-2 text-[10px] text-gray-600">
          <div>
            <strong className="text-gray-900">Admin Routes:</strong> <code className="bg-gray-100 px-1 rounded text-[9px]">/admin/*</code> 
            always accessible to admins, regardless of system visibility.
          </div>
          <div>
            <strong className="text-gray-900">API Routes:</strong> Checked separately. Disabling a system doesn't automatically disable its APIs.
          </div>
          <div>
            <strong className="text-gray-900">Static Assets:</strong> Images, CSS, JS files are not affected.
          </div>
          <div>
            <strong className="text-gray-900">Database Data:</strong> Data remains in database, just hidden from users.
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">Performance</h2>
        <p className="text-[10px] text-gray-600">
          Visibility checks are fast because:
        </p>
        <ul className="list-disc list-inside ml-2 mt-1 space-y-0.5 text-[10px] text-gray-600">
          <li>Database queries are indexed (schema_name, route_path)</li>
          <li>Functions are STABLE (PostgreSQL optimization)</li>
          <li>Results can be cached if needed</li>
          <li>Checks happen in middleware (before page loads)</li>
        </ul>
      </div>
    </div>
  );
}
