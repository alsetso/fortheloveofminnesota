'use client';

import { useState, useEffect, useRef } from 'react';
import { WorldModelPreviewCanvas } from '@/features/map/game/world/WorldModelPreviewCanvas';
import type { AvatarModel } from './useAvatarMe';

type Props = {
  /** null = must pick, string = current selection (opened from Backpack). */
  currentModelId: string | null;
  onSelect: (modelId: string) => Promise<void>;
  /** If false, the modal cannot be dismissed without picking. */
  dismissable?: boolean;
  onDismiss?: () => void;
  /**
   * When provided, only avatars whose slug is in this list are shown.
   * Used by AvatarPickerGate to restrict first-time selection to base figures.
   */
  slugAllowlist?: readonly string[];
};

export function AvatarPickerModal({
  currentModelId,
  onSelect,
  dismissable = false,
  onDismiss,
  slugAllowlist,
}: Props) {
  const [avatars, setAvatars] = useState<AvatarModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(currentModelId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const selectedAvatar = avatars.find(a => a.id === selectedId) ?? null;

  useEffect(() => {
    void (async () => {
      try {
        const res  = await fetch('/api/avatar/catalog');
        const json = (await res.json()) as { avatars?: AvatarModel[] };
        const all  = json.avatars ?? [];
        const list = slugAllowlist
          ? all.filter(a => (slugAllowlist as readonly string[]).includes(a.slug))
          : all;
        setAvatars(list);
        if (!selectedId && list.length) {
          setSelectedId(list[0].id);
        }
      } catch {
        // keep empty, show retry
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm() {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    try {
      await onSelect(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save avatar');
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[300] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.80)' }}
    >
      <div
        className="w-full max-w-md rounded-t-[28px] overflow-hidden shadow-2xl overflow-y-auto"
        style={{ maxHeight: '92vh', background: '#111116' }}
      >
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/[0.07]">
          <div>
            <h2 className="text-[20px] font-bold text-white leading-tight">Choose Your Avatar</h2>
            <p className="text-[12px] text-white/50 mt-0.5">
              Your identity on the map — pick who you are
            </p>
          </div>
          {dismissable && onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-sm"
            >
              ✕
            </button>
          )}
        </div>

        <div className="relative mx-6 mt-5 mb-1 rounded-2xl overflow-hidden" style={{ height: 220, background: '#0D0D10' }}>
          {loading || !selectedAvatar ? (
            <div className="absolute inset-0 bg-white/5 animate-pulse rounded-2xl" />
          ) : (
            <WorldModelPreviewCanvas
              url={selectedAvatar.file_path}
              className="absolute inset-0 w-full h-full"
            />
          )}
        </div>

        <div
          ref={scrollRef}
          className="px-4 pt-4 pb-2 overflow-x-auto scrollbar-none"
          style={{ display: 'flex', gap: 10, scrollSnapType: 'x mandatory' }}
        >
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex-shrink-0 w-[100px] h-[130px] rounded-xl bg-white/10 animate-pulse"
                style={{ scrollSnapAlign: 'center' }}
              />
            ))
          ) : (
            avatars.map(avatar => {
              const active = selectedId === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  onClick={() => setSelectedId(avatar.id)}
                  className="flex-shrink-0 flex flex-col rounded-xl overflow-hidden transition-all"
                  style={{
                    width: 100,
                    height: 130,
                    scrollSnapAlign: 'center',
                    outline: active ? '2px solid #6366F1' : '2px solid transparent',
                    background: '#16161A',
                    transform: active ? 'scale(1.04)' : 'scale(1)',
                  }}
                >
                  <div className="flex-1 relative overflow-hidden">
                    <WorldModelPreviewCanvas
                      url={avatar.file_path}
                      className="absolute inset-0 w-full h-full"
                    />
                  </div>
                  <div
                    className="flex-shrink-0 flex items-center justify-center py-2 px-1"
                    style={{
                      background: active
                        ? 'rgba(99,102,241,0.85)'
                        : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <span
                      className="text-[10px] font-bold leading-tight text-center"
                      style={{ color: active ? 'white' : 'rgba(255,255,255,0.7)' }}
                    >
                      {avatar.name}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {avatars.length > 1 && (
          <div className="flex justify-center gap-1.5 pt-2 pb-1">
            {avatars.map(a => (
              <div
                key={a.id}
                className="rounded-full transition-all"
                style={{
                  width: selectedId === a.id ? 16 : 5,
                  height: 5,
                  background: selectedId === a.id ? '#6366F1' : 'rgba(255,255,255,0.2)',
                }}
              />
            ))}
          </div>
        )}

        {error && (
          <p className="mx-6 mb-2 text-[11px] text-red-400 bg-red-900/30 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="px-6 pb-8 pt-3 border-t border-white/[0.07]">
          <button
            type="button"
            onClick={confirm}
            disabled={!selectedId || saving}
            className="w-full py-4 rounded-2xl text-[15px] font-bold text-white transition-all disabled:opacity-40"
            style={{
              background: selectedId
                ? 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)'
                : 'rgba(255,255,255,0.12)',
              boxShadow: selectedId ? '0 4px 20px rgba(99,102,241,0.5)' : 'none',
            }}
          >
            {saving ? 'Saving…' : 'Play as This Avatar'}
          </button>
          <p className="text-center text-[10px] text-white/30 mt-3">
            You can change this anytime from the Backpack
          </p>
        </div>
      </div>
    </div>
  );
}
