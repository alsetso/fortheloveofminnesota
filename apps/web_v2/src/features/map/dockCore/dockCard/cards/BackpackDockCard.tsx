'use client';

import { useState, useEffect, useCallback } from 'react';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { AvatarPickerModal } from '@/features/avatar/AvatarPickerModal';
import { useAvatarMe } from '@/features/avatar/useAvatarMe';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';

type AvatarAsset = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  file_path: string;
  attach_point: string;
  real_world_meters: number | null;
  default_unlock: boolean;
  sort_order: number;
  owned: boolean;
};

const ATTACH_LABEL: Record<string, string> = {
  right_hand: 'Right Hand',
  left_hand: 'Left Hand',
  back: 'Back',
};

type Tab = 'avatar' | 'items';

export default function BackpackDockCard() {
  const { closeDockCard } = useMapDock();
  const [tab, setTab] = useState<Tab>('avatar');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [assets, setAssets] = useState<AvatarAsset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);

  const { data: avatarData, loading: avatarLoading, refresh: refreshAvatar } = useAvatarMe();

  useEffect(() => {
    if (tab !== 'items') return;
    setAssetsLoading(true);
    void fetch('/api/avatar/assets')
      .then(r => r.json())
      .then((json: { assets?: AvatarAsset[] }) => setAssets(json.assets ?? []))
      .catch(() => {})
      .finally(() => setAssetsLoading(false));
  }, [tab]);

  const handleAvatarSelect = useCallback(async (modelId: string) => {
    const res = await fetch('/api/avatar/select', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatar_model_id: modelId }),
    });
    if (!res.ok) {
      const json = (await res.json()) as { error?: string };
      throw new Error(json.error ?? 'Failed to save avatar');
    }
    await refreshAvatar();
    setPickerOpen(false);
  }, [refreshAvatar]);

  const TAB_BTN = (id: Tab, label: string) => (
    <button
      type="button"
      key={id}
      onClick={() => setTab(id)}
      className="flex-1 py-2 text-[13px] font-semibold transition-colors rounded-xl"
      style={{
        background: tab === id ? '#1C1C1E' : 'transparent',
        color: tab === id ? 'white' : '#8E8E93',
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      {pickerOpen && (
        <AvatarPickerModal
          currentModelId={avatarData?.avatar_model_id ?? null}
          onSelect={handleAvatarSelect}
          dismissable
          onDismiss={() => setPickerOpen(false)}
        />
      )}

      <DockCardShell
        variant="stack"
        titleMode="center"
        eyebrow="Game"
        title="Avatar"
        onBack={closeDockCard}
      >
        {/* Tab bar */}
        <div className="mx-4 mb-4 flex bg-[#F2F2F7] rounded-xl p-1 gap-1">
          {TAB_BTN('avatar', 'Avatar')}
          {TAB_BTN('items', 'Items')}
        </div>

        {/* ── Avatar tab ── */}
        {tab === 'avatar' && (
          <div className="px-4 pb-6 space-y-4">
            {avatarLoading ? (
              <div className="h-24 rounded-2xl bg-[#F2F2F7] animate-pulse" />
            ) : avatarData?.avatar_model_id ? (
              <div className="bg-[#111116] rounded-2xl overflow-hidden shadow-lg flex flex-col">
                {/* 3D model preview strip */}
                <div className="relative w-full" style={{ height: 140 }}>
                  {avatarData.avatar_url && (
                    <WorldModelPreviewCanvas
                      url={avatarData.avatar_url}
                      className="absolute inset-0 w-full h-full"
                    />
                  )}
                </div>
                {/* Info + change row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-bold text-white">{avatarData.avatar_name}</p>
                    <span className="inline-block mt-0.5 px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-bold rounded-full">
                      Equipped
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-[11px] font-semibold rounded-xl hover:bg-indigo-500 transition-colors flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-[#F2F2F7] rounded-2xl p-5 text-center">
                <p className="text-[13px] font-medium text-[#8E8E93]">No avatar equipped yet</p>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="mt-3 px-5 py-2.5 bg-[#1C1C1E] text-white text-[12px] font-bold rounded-xl hover:bg-indigo-600 transition-colors"
                >
                  Pick an Avatar
                </button>
              </div>
            )}

            <div className="bg-blue-50 rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-blue-700">About Avatars</p>
              <p className="text-[11px] text-blue-600 mt-1">
                Your avatar appears as your Find Me dot on the map. More avatars are coming — earn and unlock them as you explore Minnesota.
              </p>
            </div>
          </div>
        )}

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <div className="px-4 pb-6 space-y-3">
            {assetsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-2xl bg-[#F2F2F7] animate-pulse" />
              ))
            ) : assets.length === 0 ? (
              <p className="text-center text-[13px] text-[#8E8E93] py-8">No items available</p>
            ) : (
              assets.map(asset => (
                <div
                  key={asset.id}
                  className={`flex items-center gap-3 p-4 rounded-2xl ${
                    asset.owned ? 'bg-white shadow-sm' : 'bg-[#F2F2F7] opacity-60'
                  }`}
                >
                  {/* 3D asset preview thumbnail */}
                  <div
                    className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative"
                    style={{ background: '#16161A' }}
                  >
                    <WorldModelPreviewCanvas
                      url={asset.file_path}
                      className="absolute inset-0 w-full h-full"
                      transparent
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-semibold text-[#1C1C1E] truncate">{asset.name}</p>
                    <p className="text-[11px] text-[#8E8E93]">
                      {ATTACH_LABEL[asset.attach_point] ?? asset.attach_point}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    {asset.owned ? (
                      <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">
                        Owned
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-[#E5E5EA] text-[#8E8E93] text-[10px] font-bold rounded-full">
                        Locked
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}

            <div className="bg-amber-50 rounded-2xl p-4">
              <p className="text-[11px] font-semibold text-amber-700">Avatar Items</p>
              <p className="text-[11px] text-amber-600 mt-1">
                Items your avatar can hold. These are account-local — only you see them. More items coming as you play.
              </p>
            </div>
          </div>
        )}
      </DockCardShell>
    </>
  );
}
