'use client';

import { useState, useEffect } from 'react';

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

interface EditSystemModalProps {
  systemId: string;
  systemName: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (details: SystemDetails) => Promise<void>;
}

export default function EditSystemModal({ systemId, systemName, isOpen, onClose, onSave }: EditSystemModalProps) {
  const [details, setDetails] = useState<SystemDetails>({
    routes: [],
    databaseTables: [],
    apiRoutes: [],
    files: { components: [], services: [], hooks: [], types: [], utils: [] },
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    }
  }, [isOpen, systemId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/systems/${systemId}/details`);
      if (res.ok) {
        const data = await res.json();
        setDetails(data);
      }
    } catch (error) {
      console.error('Error loading system details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/systems/${systemId}/details`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(details),
      });
      if (res.ok) {
        await onSave(details);
        onClose();
      }
    } catch (error) {
      console.error('Error saving system details:', error);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-md border border-gray-200 p-[10px]">
          <p className="text-xs text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-md border border-gray-200 p-[10px] max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-gray-900">Edit System: {systemName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        {/* Routes */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-900 mb-2">Routes</div>
          <div className="space-y-1">
            {details.routes.map((route, idx) => (
              <div key={idx} className="flex gap-2 text-[10px]">
                <input
                  type="text"
                  value={route.path}
                  onChange={(e) => {
                    const newRoutes = [...details.routes];
                    newRoutes[idx].path = e.target.value;
                    setDetails({ ...details, routes: newRoutes });
                  }}
                  placeholder="/route/path"
                  className="flex-1 px-2 py-1 border border-gray-200 rounded"
                />
                <input
                  type="text"
                  value={route.filePath}
                  onChange={(e) => {
                    const newRoutes = [...details.routes];
                    newRoutes[idx].filePath = e.target.value;
                    setDetails({ ...details, routes: newRoutes });
                  }}
                  placeholder="src/app/route/page.tsx"
                  className="flex-1 px-2 py-1 border border-gray-200 rounded"
                />
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={route.hasMetadata}
                    onChange={(e) => {
                      const newRoutes = [...details.routes];
                      newRoutes[idx].hasMetadata = e.target.checked;
                      setDetails({ ...details, routes: newRoutes });
                    }}
                  />
                  <span>Metadata</span>
                </label>
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={route.isDraft}
                    onChange={(e) => {
                      const newRoutes = [...details.routes];
                      newRoutes[idx].isDraft = e.target.checked;
                      setDetails({ ...details, routes: newRoutes });
                    }}
                  />
                  <span>Draft</span>
                </label>
                <button
                  onClick={() => {
                    setDetails({ ...details, routes: details.routes.filter((_, i) => i !== idx) });
                  }}
                  className="text-red-600"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                setDetails({
                  ...details,
                  routes: [...details.routes, { path: '', filePath: '', hasMetadata: false, isDraft: false }],
                });
              }}
              className="text-[10px] text-blue-600"
            >
              + Add Route
            </button>
          </div>
        </div>

        {/* Database Tables */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-900 mb-2">Database Tables</div>
          <textarea
            value={details.databaseTables.join('\n')}
            onChange={(e) => {
              setDetails({ ...details, databaseTables: e.target.value.split('\n').filter(Boolean) });
            }}
            placeholder="table1&#10;table2&#10;table3"
            className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-20"
          />
        </div>

        {/* API Routes */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-900 mb-2">API Routes</div>
          <textarea
            value={details.apiRoutes.join('\n')}
            onChange={(e) => {
              setDetails({ ...details, apiRoutes: e.target.value.split('\n').filter(Boolean) });
            }}
            placeholder="/api/route1&#10;/api/route2"
            className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-20"
          />
        </div>

        {/* Files */}
        <div className="mb-3">
          <div className="text-xs font-semibold text-gray-900 mb-2">Files</div>
          {(['components', 'services', 'hooks', 'types', 'utils'] as const).map((type) => (
            <div key={type} className="mb-2">
              <div className="text-[10px] text-gray-600 mb-1 capitalize">{type}</div>
              <textarea
                value={details.files[type].join('\n')}
                onChange={(e) => {
                  setDetails({
                    ...details,
                    files: { ...details.files, [type]: e.target.value.split('\n').filter(Boolean) },
                  });
                }}
                placeholder={`src/components/...&#10;src/services/...`}
                className="w-full px-2 py-1 text-[10px] border border-gray-200 rounded h-16"
              />
            </div>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1 text-xs border border-gray-200 rounded">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1 text-xs bg-gray-900 text-white rounded disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
