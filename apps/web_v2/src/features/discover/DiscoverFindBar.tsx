'use client';

import Link from 'next/link';
import {
  IconAddress,
  IconBillboard,
  IconPeopleGroup,
} from '@/features/map/dockCore/core/icons';
import {
  CONTACTS_PATH,
  GAME_PATH,
} from '@/lib/routes/routePolicy';

const ACTIONS = [
  {
    id: 'people',
    label: 'People',
    href: `${CONTACTS_PATH}/new?kind=people`,
    Icon: IconPeopleGroup,
  },
  {
    id: 'address',
    label: 'Address',
    href: `${CONTACTS_PATH}/new?kind=addresses`,
    Icon: IconAddress,
  },
  {
    id: 'business',
    label: 'Business',
    href: GAME_PATH,
    Icon: IconBillboard,
  },
] as const;

/**
 * Discover Find strip — People / Address / Business shortcuts into lookup.
 * Dock mode uses callbacks so contacts open in-sheet without leaving the map.
 */
export function DiscoverFindBar({
  compact = false,
  onPeople,
  onAddress,
  onBusiness,
}: {
  compact?: boolean;
  onPeople?: () => void;
  onAddress?: () => void;
  onBusiness?: () => void;
}) {
  const handlers = {
    people: onPeople,
    address: onAddress,
    business: onBusiness,
  } as const;

  return (
    <div className={compact ? 'px-0' : 'px-5'}>
      <p className="mb-2.5 text-[20px] font-bold tracking-tight text-foreground">
        Find
      </p>
      <div
        role="group"
        aria-label="Find people, address, or business"
        className="grid grid-cols-3 gap-2"
      >
        {ACTIONS.map(({ id, label, href, Icon }) => {
          const onClick = handlers[id];
          const className =
            'flex flex-col items-center gap-1.5 rounded-2xl border border-black/[0.08] bg-white px-2 py-2.5 shadow-[0_1px_0_rgba(0,0,0,0.04)] transition active:scale-[0.97] active:bg-black/[0.02]';
          const body = (
            <>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-lake-blue/10 text-lake-blue">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[12px] font-semibold leading-none text-foreground">
                {label}
              </span>
            </>
          );

          if (onClick) {
            return (
              <button key={id} type="button" onClick={onClick} className={className}>
                {body}
              </button>
            );
          }

          return (
            <Link key={id} href={href} className={className}>
              {body}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
