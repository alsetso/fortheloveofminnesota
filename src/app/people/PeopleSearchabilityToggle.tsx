'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStateSafe } from '@/features/auth';
import { AccountService } from '@/features/auth/services/memberService';
import toast from 'react-hot-toast';

export default function PeopleSearchabilityToggle() {
  const router = useRouter();
  const { account, isLoading, isAccountLoading, refreshAccount } = useAuthStateSafe();

  const initialValue = useMemo(() => {
    if (!account) return null;
    return !!account.search_visibility;
  }, [account]);

  const [enabled, setEnabled] = useState<boolean | null>(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnabled(initialValue);
  }, [initialValue]);

  if (isLoading || isAccountLoading) return null;
  if (!account) return null;
  if (!account.username) return null;

  const disabled = isSaving || enabled === null;

  const toggle = async () => {
    if (disabled) return;
    const nextValue = !enabled;

    setError(null);
    setEnabled(nextValue);
    setIsSaving(true);
    try {
      await AccountService.updateCurrentAccount({ search_visibility: nextValue }, account.id);
      await refreshAccount();
      router.refresh();
      const username = account.username ? `@${account.username}` : 'Profile';
      toast.success(nextValue ? `${username} is searchable` : `${username} is not searchable`);
    } catch (e) {
      setEnabled(enabled);
      const message = e instanceof Error ? e.message : 'Failed to update searchability';
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-0.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-medium text-gray-500">
          Searchable
        </span>
        <button
          onClick={toggle}
          disabled={disabled}
          className={`relative inline-flex h-5 w-9 cursor-pointer rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-60 disabled:cursor-not-allowed ${
            enabled ? 'bg-gray-900' : 'bg-gray-200'
          }`}
          role="switch"
          aria-checked={enabled}
          aria-label="Toggle profile searchability"
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 transform rounded bg-white shadow ring-0 transition ${
              enabled ? 'translate-x-4' : 'translate-x-0.5'
            }`}
            style={{ marginTop: '2px' }}
          />
        </button>
      </div>
      {error && (
        <p className="text-[10px] text-red-600">{error}</p>
      )}
    </div>
  );
}

