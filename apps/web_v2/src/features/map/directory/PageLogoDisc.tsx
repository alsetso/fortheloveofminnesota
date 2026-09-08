'use client';

import { isPageLogoHttpUrl } from '@/lib/directory/pageTypes';

export function PageLogoDisc({
  title,
  logoUrl,
  icon,
  size = 'md',
  verified = false,
  executive = false,
}: {
  title: string;
  logoUrl?: string | null;
  icon?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  verified?: boolean;
  executive?: boolean;
}) {
  const px =
    size === 'xl'
      ? 'h-24 w-24 rounded-[1.65rem]'
      : size === 'lg'
        ? 'h-14 w-14 rounded-[1.05rem]'
        : size === 'sm'
          ? 'h-10 w-10 rounded-xl'
          : 'h-12 w-12 rounded-[0.95rem]';
  const type =
    size === 'xl' ? 'text-4xl' : size === 'lg' ? 'text-xl' : size === 'sm' ? 'text-sm' : 'text-lg';
  const emoji = icon && !isPageLogoHttpUrl(icon) ? icon : null;
  const ring = executive
    ? 'ring-2 ring-yellow-400/80'
    : verified
      ? 'ring-2 ring-lake-blue/70'
      : '';

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden bg-emerald-950/30 text-foreground ${px} ${ring}`}
    >
      {logoUrl && isPageLogoHttpUrl(logoUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt="" className="h-full w-full object-cover" />
      ) : emoji ? (
        <span className={type} aria-hidden>
          {emoji}
        </span>
      ) : (
        <span className={`${type} font-semibold`}>{title.slice(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}
