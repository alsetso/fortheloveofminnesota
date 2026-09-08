'use client';

import { useCallback, useState } from 'react';
import { absoluteShareUrl, shareOrCopy } from '@/lib/share/shareOrCopy';

/** Top-right header share control — native share or clipboard fallback. */
export function ShareHeaderButton({
  title,
  path,
  disabled = false,
}: {
  title: string;
  path: string;
  disabled?: boolean;
}) {
  const [flash, setFlash] = useState(false);

  const onShare = useCallback(() => {
    if (disabled || !path) return;
    const url = absoluteShareUrl(path);
    void shareOrCopy(title, url).then(() => {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 1600);
    });
  }, [disabled, path, title]);

  return (
    <button
      type="button"
      onClick={onShare}
      disabled={disabled}
      className="relative z-[1] ml-auto shrink-0 px-2 py-1.5 text-[15px] font-semibold text-lake-blue transition active:opacity-60 disabled:opacity-40"
    >
      {flash ? 'Copied' : 'Share'}
    </button>
  );
}
