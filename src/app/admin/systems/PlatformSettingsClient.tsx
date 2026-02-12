'use client';

import { useState, useEffect } from 'react';

interface PlatformSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowNewRegistrations: boolean;
  allowNewMaps: boolean;
  allowNewPins: boolean;
  requireEmailVerification: boolean;
  maxPinsPerMap: number | null;
  maxMapsPerAccount: number | null;
}

export default function PlatformSettingsClient() {
  const [settings, setSettings] = useState<PlatformSettings>({
    maintenanceMode: false,
    maintenanceMessage: 'We are currently performing maintenance. Please check back soon.',
    allowNewRegistrations: true,
    allowNewMaps: true,
    allowNewPins: true,
    requireEmailVerification: false,
    maxPinsPerMap: null,
    maxMapsPerAccount: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/platform-settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings || settings);
      }
    } catch (error) {
      console.error('Error fetching platform settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PlatformSettings, value: any) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [key]: value,
        }),
      });

      if (res.ok) {
        setSettings(prev => ({ ...prev, [key]: value }));
      }
    } catch (error) {
      console.error('Error updating platform setting:', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xs text-gray-600">Loading platform settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Maintenance Mode */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="text-xs font-semibold text-gray-900 mb-2">Maintenance Mode</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.maintenanceMode}
              onChange={(e) => updateSetting('maintenanceMode', e.target.checked)}
              className="w-3 h-3"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-600">Enable maintenance mode</span>
          </label>
          {settings.maintenanceMode && (
            <textarea
              value={settings.maintenanceMessage}
              onChange={(e) => updateSetting('maintenanceMessage', e.target.value)}
              placeholder="Maintenance message..."
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              rows={2}
              disabled={saving}
            />
          )}
        </div>
      </div>

      {/* Access Controls */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="text-xs font-semibold text-gray-900 mb-2">Access Controls</div>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowNewRegistrations}
              onChange={(e) => updateSetting('allowNewRegistrations', e.target.checked)}
              className="w-3 h-3"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-600">Allow new user registrations</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowNewMaps}
              onChange={(e) => updateSetting('allowNewMaps', e.target.checked)}
              className="w-3 h-3"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-600">Allow creating new maps</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.allowNewPins}
              onChange={(e) => updateSetting('allowNewPins', e.target.checked)}
              className="w-3 h-3"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-600">Allow creating new pins/mentions</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.requireEmailVerification}
              onChange={(e) => updateSetting('requireEmailVerification', e.target.checked)}
              className="w-3 h-3"
              disabled={saving}
            />
            <span className="text-[10px] text-gray-600">Require email verification</span>
          </label>
        </div>
      </div>

      {/* Limits */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="text-xs font-semibold text-gray-900 mb-2">Platform Limits</div>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">
              Max pins per map (leave empty for unlimited)
            </label>
            <input
              type="number"
              value={settings.maxPinsPerMap || ''}
              onChange={(e) => updateSetting('maxPinsPerMap', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Unlimited"
              disabled={saving}
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">
              Max maps per account (leave empty for unlimited)
            </label>
            <input
              type="number"
              value={settings.maxMapsPerAccount || ''}
              onChange={(e) => updateSetting('maxMapsPerAccount', e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
              placeholder="Unlimited"
              disabled={saving}
            />
          </div>
        </div>
      </div>

      {saving && (
        <div className="text-center py-2">
          <p className="text-xs text-gray-500">Saving...</p>
        </div>
      )}
    </div>
  );
}
