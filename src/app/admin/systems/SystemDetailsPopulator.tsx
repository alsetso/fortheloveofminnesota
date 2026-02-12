'use client';

import { useState } from 'react';
import { useAuthStateSafe } from '@/features/auth';

interface SystemDetails {
  routes: Array<{ path: string; filePath: string; hasMetadata: boolean; isDraft: boolean }>;
  databaseTables: string[];
  apiRoutes: string[];
  files: {
    components: string[];
    services: string[];
    hooks: string[];
    types: string[];
    utils: string[];
  };
}

interface System {
  id: string;
  schema_name: string;
  system_name: string;
  primary_route: string;
}

export default function SystemDetailsPopulator() {
  const { account } = useAuthStateSafe();
  const [systems, setSystems] = useState<System[]>([]);
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [details, setDetails] = useState<SystemDetails>({
    routes: [],
    databaseTables: [],
    apiRoutes: [],
    files: { components: [], services: [], hooks: [], types: [], utils: [] },
  });
  const [saving, setSaving] = useState(false);

  const loadSystems = async () => {
    const res = await fetch('/api/admin/systems');
    if (res.ok) {
      const data = await res.json();
      setSystems(data.systems || []);
    }
  };

  const loadDetails = async (systemId: string) => {
    const res = await fetch(`/api/admin/systems/${systemId}/details`);
    if (res.ok) {
      const data = await res.json();
      setDetails(data);
    }
  };

  const saveDetails = async (systemId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/systems/${systemId}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (res.ok) {
        alert('Saved!');
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h2 className="text-xs font-semibold text-gray-900 mb-2">System Details Populator</h2>
        <p className="text-[10px] text-gray-600 mb-3">
          Select a system and populate its details. We'll go through each one together.
        </p>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={loadSystems}
            className="px-2 py-1 text-[10px] border border-gray-200 rounded hover:bg-gray-50"
          >
            Load Systems
          </button>
        </div>

        {systems.length > 0 && (
          <select
            value={selectedSystem || ''}
            onChange={(e) => {
              const id = e.target.value;
              setSelectedSystem(id);
              if (id) loadDetails(id);
            }}
            className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded"
          >
            <option value="">Select a system...</option>
            {systems.map(s => (
              <option key={s.id} value={s.id}>
                {s.system_name} ({s.schema_name}) - {s.primary_route}
              </option>
            ))}
          </select>
        )}

        {selectedSystem && (
          <div className="mt-3 space-y-2">
            <div className="text-xs font-semibold text-gray-900">
              Editing: {systems.find(s => s.id === selectedSystem)?.system_name}
            </div>
            
            {/* Routes */}
            <div>
              <div className="text-[10px] font-semibold mb-1">Routes (one per line: path|filePath|hasMetadata|isDraft)</div>
              <textarea
                value={details.routes.map(r => `${r.path}|${r.filePath}|${r.hasMetadata}|${r.isDraft}`).join('\n')}
                onChange={(e) => {
                  const routes = e.target.value.split('\n').filter(Boolean).map(line => {
                    const [path, filePath, hasMetadata, isDraft] = line.split('|');
                    return {
                      path: path?.trim() || '',
                      filePath: filePath?.trim() || '',
                      hasMetadata: hasMetadata === 'true',
                      isDraft: isDraft === 'true',
                    };
                  });
                  setDetails({ ...details, routes });
                }}
                className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-32 font-mono"
                placeholder="/maps|src/app/maps/page.tsx|true|false"
              />
            </div>

            {/* Database Tables */}
            <div>
              <div className="text-[10px] font-semibold mb-1">Database Tables (one per line)</div>
              <textarea
                value={details.databaseTables.join('\n')}
                onChange={(e) => {
                  setDetails({ ...details, databaseTables: e.target.value.split('\n').filter(Boolean) });
                }}
                className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-20 font-mono"
                placeholder="maps.maps&#10;maps.pins"
              />
            </div>

            {/* API Routes */}
            <div>
              <div className="text-[10px] font-semibold mb-1">API Routes (one per line)</div>
              <textarea
                value={details.apiRoutes.join('\n')}
                onChange={(e) => {
                  setDetails({ ...details, apiRoutes: e.target.value.split('\n').filter(Boolean) });
                }}
                className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-32 font-mono"
                placeholder="/api/maps&#10;/api/maps/[id]"
              />
            </div>

            {/* Files */}
            {(['components', 'services', 'hooks', 'types', 'utils'] as const).map((type) => (
              <div key={type}>
                <div className="text-[10px] font-semibold mb-1 capitalize">{type} (one per line)</div>
                <textarea
                  value={details.files[type].join('\n')}
                  onChange={(e) => {
                    setDetails({
                      ...details,
                      files: { ...details.files, [type]: e.target.value.split('\n').filter(Boolean) },
                    });
                  }}
                  className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-24 font-mono"
                  placeholder={`src/features/${systems.find(s => s.id === selectedSystem)?.schema_name}/components/...`}
                />
              </div>
            ))}

            <button
              onClick={() => saveDetails(selectedSystem)}
              disabled={saving}
              className="px-3 py-1.5 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Details'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
