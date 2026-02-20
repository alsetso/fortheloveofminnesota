'use client';

import Link from 'next/link';
import PersonAvatar from '@/features/civic/components/PersonAvatar';
import PartyBadge from './PartyBadge';

interface PersonCardOrg {
  name: string;
  slug: string | null;
}

interface PersonCardProps {
  name: string;
  photoUrl?: string | null;
  title?: string | null;
  party?: string | null;
  org?: PersonCardOrg | null;
  /** Link destination for the card. If omitted the card is non-interactive. */
  href?: string | null;
  /** Avatar size — defaults to 'sm' */
  avatarSize?: 'xs' | 'sm' | 'md' | 'lg';
  /** Layout — 'row' (avatar left, text right) or 'col' (stacked, centered) */
  layout?: 'row' | 'col';
  className?: string;
}

function CardInner({
  name,
  photoUrl,
  title,
  party,
  org,
  avatarSize,
  layout,
}: Pick<PersonCardProps, 'name' | 'photoUrl' | 'title' | 'party' | 'org' | 'avatarSize' | 'layout'>) {
  if (layout === 'col') {
    return (
      <div className="flex flex-col items-center text-center gap-1.5">
        <PersonAvatar name={name} photoUrl={photoUrl} size={avatarSize ?? 'md'} />
        <div>
          <div className="text-xs font-medium text-foreground leading-tight">{name}</div>
          {title && (
            <div className="text-[10px] text-foreground-muted leading-tight mt-0.5">{title}</div>
          )}
          {party && <PartyBadge party={party} className="mt-0.5" />}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      <PersonAvatar name={name} photoUrl={photoUrl} size={avatarSize ?? 'sm'} />
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground leading-tight truncate">{name}</div>
        {title && (
          <div className="text-[10px] text-foreground-muted leading-tight">{title}</div>
        )}
        {org && (
          <div className="text-[10px] text-foreground-muted leading-tight truncate">
            {org.slug ? (
              <span className="text-accent hover:underline">{org.name}</span>
            ) : (
              org.name
            )}
          </div>
        )}
        {party && <PartyBadge party={party} className="mt-0.5" />}
      </div>
    </div>
  );
}

export default function PersonCard({
  name,
  photoUrl,
  title,
  party,
  org,
  href,
  avatarSize,
  layout = 'row',
  className = '',
}: PersonCardProps) {
  const baseClass = `border border-border rounded-md p-3 transition-colors ${className}`;
  const inner = (
    <CardInner
      name={name}
      photoUrl={photoUrl}
      title={title}
      party={party}
      org={org}
      avatarSize={avatarSize}
      layout={layout}
    />
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`block ${baseClass} hover:border-border hover:bg-surface-muted`}
      >
        {inner}
      </Link>
    );
  }

  return <div className={baseClass}>{inner}</div>;
}
