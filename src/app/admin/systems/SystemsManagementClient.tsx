'use client';

import { useState, useEffect } from 'react';
import { useAuthStateSafe } from '@/features/auth';
import { useToast } from '@/features/ui/hooks/useToast';
import EditSystemModal from './EditSystemModal';

interface SystemVisibility {
  id: string;
  schema_name: string;
  system_name: string;
  primary_route: string;
  is_visible: boolean;
  is_enabled: boolean;
  requires_feature: string | null;
  description: string | null;
  icon: string | null;
  display_order: number;
  routes?: RouteVisibility[];
  analysis?: SystemAnalysis;
}

interface RouteVisibility {
  id: string;
  route_path: string;
  system_id: string;
  is_visible: boolean;
  requires_feature: string | null;
  description: string | null;
}

interface SystemAnalysis {
  system: {
    id: string;
    schema_name: string;
    system_name: string;
    primary_route: string;
  };
  routes: Array<{
    path: string;
    filePath: string;
    hasMetadata: boolean;
    isDraft: boolean;
    components: string[];
    services: string[];
  }>;
  databaseTables: string[];
  apiRoutes: string[];
  files: {
    components: string[];
    services: string[];
    hooks: string[];
    types: string[];
    utils: string[];
    pages: string[];
  };
  totalFiles: number;
}

export default function SystemsManagementClient() {
  const { account } = useAuthStateSafe();
  const { loading: showLoadingToast, success, error: showError, update, remove } = useToast();
  const [systems, setSystems] = useState<SystemVisibility[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSystems, setExpandedSystems] = useState<Set<string>>(new Set());
  const [detailedSystems, setDetailedSystems] = useState<Map<string, SystemAnalysis>>(new Map());
  const [loadingDetails, setLoadingDetails] = useState<Set<string>>(new Set());
  const [editingSystem, setEditingSystem] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<{
    totalRoutes: number;
    coveredRoutes: number;
    uncoveredCount: number;
    uncoveredRoutes: string[];
  } | null>(null);
  const [loadingCoverage, setLoadingCoverage] = useState(false);

  useEffect(() => {
    fetchSystems();
    fetchCoverage();
  }, []);

  const fetchCoverage = async () => {
    setLoadingCoverage(true);
    try {
      const res = await fetch('/api/admin/systems/coverage');
      if (res.ok) {
        const data = await res.json();
        const routes = data.uncoveredRoutes || [];
        setCoverage({
          totalRoutes: data.totalRoutes,
          coveredRoutes: data.coveredRoutes,
          uncoveredCount: routes.length,
          uncoveredRoutes: routes,
        });
      }
    } catch (error) {
      console.error('Error fetching coverage:', error);
    } finally {
      setLoadingCoverage(false);
    }
  };

  const fetchSystems = async () => {
    try {
      const res = await fetch('/api/admin/systems');
      if (res.ok) {
        const data = await res.json();
        setSystems(data.systems || []);
      }
    } catch (error) {
      console.error('Error fetching systems:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSystemVisibility = async (systemId: string, field: 'is_visible' | 'is_enabled', currentValue: boolean) => {
    const system = systems.find(s => s.id === systemId);
    const systemName = system?.system_name || 'System';
    const fieldLabel = field === 'is_visible' ? 'Visible' : 'Enabled';
    const newValue = !currentValue;
    const action = newValue ? 'enabled' : 'disabled';
    
    // OPTIMISTIC UPDATE: Update UI immediately
    setSystems(prev => prev.map(s => 
      s.id === systemId ? { ...s, [field]: newValue } : s
    ));
    
    // Show loading toast (non-blocking)
    const toastId = showLoadingToast(`Updating ${systemName}...`);
    
    try {
      const res = await fetch('/api/admin/systems', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemId,
          updates: { [field]: newValue },
        }),
      });

      if (res.ok) {
        // Update loading toast to success
        update(toastId, {
          type: 'success',
          title: `${systemName} ${fieldLabel} ${action}`,
          duration: 1500,
        });
        // Refresh in background (don't wait)
        fetchSystems().catch(() => {});
      } else {
        const errorData = await res.json().catch(() => ({}));
        // REVERT optimistic update on error
        setSystems(prev => prev.map(s => 
          s.id === systemId ? { ...s, [field]: currentValue } : s
        ));
        // Update loading toast to error
        update(toastId, {
          type: 'error',
          title: `Failed to update ${systemName}`,
          message: errorData.error || 'Unknown error',
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error updating system:', error);
      // REVERT optimistic update on error
      setSystems(prev => prev.map(s => 
        s.id === systemId ? { ...s, [field]: currentValue } : s
      ));
      // Update loading toast to error
      update(toastId, {
        type: 'error',
        title: `Failed to update ${systemName}`,
        message: error instanceof Error ? error.message : 'Network error',
        duration: 3000,
      });
    }
  };

  const toggleExpanded = async (systemId: string) => {
    const newExpanded = new Set(expandedSystems);
    const isCurrentlyExpanded = newExpanded.has(systemId);
    
    if (isCurrentlyExpanded) {
      newExpanded.delete(systemId);
    } else {
      newExpanded.add(systemId);
      // Fetch detailed analysis if not already loaded
      if (!detailedSystems.has(systemId) && !loadingDetails.has(systemId)) {
        await fetchSystemDetails(systemId);
      }
    }
    setExpandedSystems(newExpanded);
  };

  const fetchSystemDetails = async (systemId: string) => {
    setLoadingDetails(prev => new Set(prev).add(systemId));
    try {
      const res = await fetch(`/api/admin/systems/${systemId}/analyze`);
      if (res.ok) {
        const analysis: SystemAnalysis = await res.json();
        setDetailedSystems(prev => new Map(prev).set(systemId, analysis));
      }
    } catch (error) {
      console.error('Error fetching system details:', error);
    } finally {
      setLoadingDetails(prev => {
        const next = new Set(prev);
        next.delete(systemId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-gray-600">Loading systems...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-[10px] mb-3">
        <div className="text-xs font-semibold text-gray-900 mb-1">Visible vs Enabled</div>
        <div className="text-[10px] text-gray-600 space-y-0.5">
          <div><strong>Visible:</strong> Users can see and access this system's routes</div>
          <div><strong>Enabled:</strong> System is fully functional (both must be true for access)</div>
          <div className="text-[9px] text-gray-500 mt-1">Both unchecked = routes blocked. Both checked = routes accessible.</div>
        </div>
      </div>

      {/* Coverage Alert */}
      {coverage && coverage.uncoveredCount > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-[10px] mb-3">
          <div className="text-xs font-semibold text-orange-900 mb-1">
            ⚠️ {coverage.uncoveredCount} routes not covered by systems
          </div>
          <div className="text-[10px] text-orange-700 mb-2">
            Coverage: {coverage.coveredRoutes}/{coverage.totalRoutes} routes ({Math.round((coverage.coveredRoutes / coverage.totalRoutes) * 100)}%)
          </div>
          <div className="text-[9px] text-orange-600 font-mono max-h-20 overflow-y-auto">
            {coverage.uncoveredRoutes.slice(0, 10).map(route => (
              <div key={route}>{route}</div>
            ))}
            {coverage.uncoveredRoutes.length > 10 && (
              <div>+{coverage.uncoveredRoutes.length - 10} more...</div>
            )}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Total Systems</div>
          <div className="text-sm font-semibold text-gray-900">{systems.length}</div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Visible</div>
          <div className="text-sm font-semibold text-green-600">
            {systems.filter(s => s.is_visible).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Enabled</div>
          <div className="text-sm font-semibold text-blue-600">
            {systems.filter(s => s.is_enabled).length}
          </div>
        </div>
        <div className="bg-white border border-gray-200 p-[10px]">
          <div className="text-xs text-gray-500 mb-0.5">Route Coverage</div>
          <div className="text-sm font-semibold text-gray-900">
            {coverage ? `${coverage.coveredRoutes}/${coverage.totalRoutes}` : '...'}
          </div>
        </div>
      </div>

      {/* Systems List */}
      <div className="border border-gray-200 rounded-md overflow-hidden">
        {systems.map((system) => {
          const isExpanded = expandedSystems.has(system.id);
          const hasRoutes = system.routes && system.routes.length > 0;
          const details = detailedSystems.get(system.id);
          const isLoadingDetails = loadingDetails.has(system.id);

          return (
            <div key={system.id} className="border-b border-gray-200 last:border-b-0">
              {/* System Header */}
              <div className="p-[10px] hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleExpanded(system.id)}
                    className="w-4 h-4 flex items-center justify-center hover:bg-gray-100 rounded"
                  >
                    {isExpanded ? '▼' : '▶'}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-gray-900 text-xs">
                        {system.system_name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {system.schema_name}
                      </span>
                      <span className="text-[10px] text-gray-500 font-mono">
                        {system.primary_route}
                      </span>
                      {(details || system.analysis) && (
                        <span className="text-[9px] text-gray-400">
                          ({(details?.routes || system.analysis?.routes || []).length} routes, {details?.totalFiles || system.analysis?.totalFiles || 0} files)
                        </span>
                      )}
                    </div>
                    {system.description && (
                      <div className="text-[10px] text-gray-600 mb-1">{system.description}</div>
                    )}
                    {/* Show routes in main view - from analysis or details */}
                    {(system.analysis?.routes || details?.routes) && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {(details?.routes || system.analysis?.routes || []).slice(0, 8).map((route: any, idx: number) => (
                          <span
                            key={idx}
                            className="px-1 py-0.5 bg-gray-100 text-gray-700 rounded text-[9px] font-mono"
                          >
                            {route.path || route.route}
                          </span>
                        ))}
                        {(details?.routes || system.analysis?.routes || []).length > 8 && (
                          <span className="px-1 py-0.5 text-gray-500 text-[9px]">
                            +{(details?.routes || system.analysis?.routes || []).length - 8} more
                          </span>
                        )}
                      </div>
                    )}
                    {/* Show route count if no routes loaded yet */}
                    {!details && !system.analysis && (
                      <div className="mt-1.5 text-[9px] text-gray-400">
                        Click to load routes...
                      </div>
                    )}
                  </div>

                  {/* Toggles */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingSystem(system.id)}
                      className="px-2 py-1 text-[10px] border border-gray-200 rounded hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={system.is_visible}
                        onChange={() => toggleSystemVisibility(system.id, 'is_visible', system.is_visible)}
                        className="w-3 h-3 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-600">Visible</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={system.is_enabled}
                        onChange={() => toggleSystemVisibility(system.id, 'is_enabled', system.is_enabled)}
                        className="w-3 h-3 cursor-pointer"
                      />
                      <span className="text-[10px] text-gray-600">Enabled</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Expanded Details Container */}
              {isExpanded && (
                <div className="bg-gray-50 border-t border-gray-200">
                  {isLoadingDetails ? (
                    <div className="p-[10px] text-[10px] text-gray-500">Loading details...</div>
                  ) : details ? (
                    <div className="p-[10px] space-y-3">
                      {/* Routes Section */}
                      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                        <div className="text-xs font-semibold text-gray-900 mb-2">
                          Routes ({details.routes.length})
                        </div>
                        <div className="space-y-1 max-h-48 overflow-y-auto">
                          {details.routes.map((route, idx) => (
                            <div key={idx} className="text-[10px] border-b border-gray-100 last:border-b-0 pb-1 last:pb-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="font-mono text-gray-700">{route.path}</span>
                                {route.hasMetadata && (
                                  <span className="px-1 py-0.5 bg-green-100 text-green-700 rounded text-[9px]">metadata</span>
                                )}
                                {route.isDraft && (
                                  <span className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded text-[9px]">draft</span>
                                )}
                              </div>
                              <div className="text-[9px] text-gray-500 font-mono ml-2">{route.filePath}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Database Tables */}
                      {details.databaseTables.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                          <div className="text-xs font-semibold text-gray-900 mb-2">
                            Database Tables ({details.databaseTables.length})
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {details.databaseTables.map((table) => (
                              <span
                                key={table}
                                className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-mono"
                              >
                                {table}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* API Routes */}
                      {details.apiRoutes.length > 0 && (
                        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                          <div className="text-xs font-semibold text-gray-900 mb-2">
                            API Routes ({details.apiRoutes.length})
                          </div>
                          <div className="space-y-0.5 max-h-32 overflow-y-auto">
                            {details.apiRoutes.map((apiRoute) => (
                              <div key={apiRoute} className="text-[9px] font-mono text-gray-600">
                                {apiRoute}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Files Breakdown */}
                      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                        <div className="text-xs font-semibold text-gray-900 mb-2">
                          Files ({details.totalFiles})
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <div className="text-gray-600 mb-1">Pages ({details.files.pages.length})</div>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {details.files.pages.map((file) => (
                                <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                  {file}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Components ({details.files.components.length})</div>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {details.files.components.slice(0, 10).map((file) => (
                                <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                  {file}
                                </div>
                              ))}
                              {details.files.components.length > 10 && (
                                <div className="text-[9px] text-gray-400">+{details.files.components.length - 10} more</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Services ({details.files.services.length})</div>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {details.files.services.slice(0, 10).map((file) => (
                                <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                  {file}
                                </div>
                              ))}
                              {details.files.services.length > 10 && (
                                <div className="text-[9px] text-gray-400">+{details.files.services.length - 10} more</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-600 mb-1">Hooks ({details.files.hooks.length})</div>
                            <div className="space-y-0.5 max-h-24 overflow-y-auto">
                              {details.files.hooks.slice(0, 10).map((file) => (
                                <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                  {file}
                                </div>
                              ))}
                              {details.files.hooks.length > 10 && (
                                <div className="text-[9px] text-gray-400">+{details.files.hooks.length - 10} more</div>
                              )}
                            </div>
                          </div>
                          {details.files.types.length > 0 && (
                            <div>
                              <div className="text-gray-600 mb-1">Types ({details.files.types.length})</div>
                              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                {details.files.types.slice(0, 10).map((file) => (
                                  <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                    {file}
                                  </div>
                                ))}
                                {details.files.types.length > 10 && (
                                  <div className="text-[9px] text-gray-400">+{details.files.types.length - 10} more</div>
                                )}
                              </div>
                            </div>
                          )}
                          {details.files.utils.length > 0 && (
                            <div>
                              <div className="text-gray-600 mb-1">Utils ({details.files.utils.length})</div>
                              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                                {details.files.utils.slice(0, 10).map((file) => (
                                  <div key={file} className="text-[9px] font-mono text-gray-500 truncate">
                                    {file}
                                  </div>
                                ))}
                                {details.files.utils.length > 10 && (
                                  <div className="text-[9px] text-gray-400">+{details.files.utils.length - 10} more</div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Route Visibility Settings */}
                      {hasRoutes && (
                        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
                          <div className="text-xs font-semibold text-gray-900 mb-2">
                            Route Visibility ({system.routes!.length})
                          </div>
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {system.routes!.map((route) => (
                              <div
                                key={route.id}
                                className="flex items-center gap-2 text-[10px]"
                              >
                                <span className="font-mono text-gray-700 flex-1">{route.route_path}</span>
                                {route.requires_feature && (
                                  <span className="px-1 py-0.5 bg-blue-100 text-blue-700 rounded text-[9px]">
                                    requires: {route.requires_feature}
                                  </span>
                                )}
                                <span
                                  className={`px-1 py-0.5 rounded text-[9px] ${
                                    route.is_visible
                                      ? 'bg-green-100 text-green-700'
                                      : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {route.is_visible ? 'visible' : 'hidden'}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="p-[10px] text-[10px] text-gray-500">Click to load details...</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {editingSystem && (
        <EditSystemModal
          systemId={editingSystem}
          systemName={systems.find(s => s.id === editingSystem)?.system_name || ''}
          isOpen={!!editingSystem}
          onClose={() => setEditingSystem(null)}
          onSave={async (details) => {
            // TODO: Save to database table admin.system_details
            console.log('Saving system details:', details);
            // Refresh details after save
            if (expandedSystems.has(editingSystem)) {
              await fetchSystemDetails(editingSystem);
            }
          }}
        />
      )}
    </div>
  );
}
