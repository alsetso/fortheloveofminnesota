import type { ExperienceZoneListResult } from '@/lib/experienceZones/experienceZoneTypes';

export type FetchExperienceZonesListOptions = {
  signal?: AbortSignal;
  /** Play hub: only featured primary zones. Object Map omits this. */
  featuredOnly?: boolean;
};

/** Client fetch for GET /api/experience-zones — active primary zones + geometry. */
export async function fetchExperienceZonesList(
  signalOrOptions?: AbortSignal | FetchExperienceZonesListOptions,
): Promise<ExperienceZoneListResult | null> {
  const options: FetchExperienceZonesListOptions =
    signalOrOptions instanceof AbortSignal || signalOrOptions == null
      ? { signal: signalOrOptions ?? undefined }
      : signalOrOptions;

  // 'no-store' — always fetch fresh. The API sets Cache-Control: max-age=60
  // on the server (CDN/edge caches it), so this is still fast. Using
  // 'force-cache' was causing deleted zones to persist indefinitely in the
  // browser cache across sessions.
  const qs = options.featuredOnly ? '?featured=1' : '';
  const res = await fetch(`/api/experience-zones${qs}`, {
    signal: options.signal,
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return (await res.json()) as ExperienceZoneListResult;
}
