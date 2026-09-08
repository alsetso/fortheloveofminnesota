'use client';

import { useEffect, useState } from 'react';
import type { DmPeerAccount } from '@/features/messages/messagesApi';
import { dmPeerDisplayName } from '@/features/messages/messagesApi';
import { IconUser } from '@/features/map/dockCore/core/icons';

/** Compact circular peer photo for DM rows / thread chrome. */
export function DmPeerAvatar({
  peer,
  size = 44,
}: {
  peer: DmPeerAccount | null | undefined;
  size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const src = peer?.image_url?.trim() || null;

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const name = dmPeerDisplayName(peer);
  const initial = name.replace(/^@/, '').trim().slice(0, 1).toUpperCase() || '?';

  return (
    <span
      className="inline-flex shrink-0 overflow-hidden rounded-full bg-[#ebe7e0] text-foreground-muted"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : peer ? (
        <span className="flex h-full w-full items-center justify-center text-[15px] font-semibold text-lake-blue">
          {initial}
        </span>
      ) : (
        <span className="flex h-full w-full items-center justify-center">
          <IconUser className="h-[45%] w-[45%]" />
        </span>
      )}
    </span>
  );
}
