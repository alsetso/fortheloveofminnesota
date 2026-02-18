'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeftIcon,
  AcademicCapIcon,
  MapPinIcon,
  GlobeAltIcon,
  PhoneIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MapWidget from '@/components/explore/MapWidget';
import ExploreBreadcrumb from '@/components/explore/ExploreBreadcrumb';

/* ─── Types ─── */

interface SchoolRecord {
  id: string;
  name: string;
  slug: string;
  address?: string;
  district_id: string;
  district_name?: string;
  building_id?: string;
  lat?: number;
  lng?: number;
  school_type?: string;
  enrollment?: number;
  grade_low?: number;
  grade_high?: number;
  phone?: string;
  website_url?: string;
  principal_name?: string;
  year_established?: number;
  primary_color?: string;
  secondary_color?: string;
  is_verified?: boolean;
  [key: string]: unknown;
}

interface NearbySchool {
  id: string;
  name: string;
  slug: string;
  district_name?: string;
  address?: string;
  distance_miles?: number;
  grade_low?: number;
  grade_high?: number;
  enrollment?: number;
}

function formatGrades(low?: number, high?: number): string | null {
  if (low == null && high == null) return null;
  const lo = low === 0 ? 'K' : String(low ?? '?');
  const hi = high != null ? String(high) : '?';
  return `${lo}–${hi}`;
}

/* ─── Component ─── */

interface SchoolProfilePageProps {
  recordId: string;
}

export default function SchoolProfilePage({ recordId }: SchoolProfilePageProps) {
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingGeometry, setBuildingGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [nearby, setNearby] = useState<NearbySchool[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);

  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId);

  useEffect(() => {
    setLoading(true);
    setSchool(null);
    setBuildingGeometry(null);
    setNearby([]);

    const param = isUUID ? `id=${recordId}` : `slug=${encodeURIComponent(recordId)}`;

    fetch(`/api/atlas/schools?${param}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rec = Array.isArray(data) ? data[0] ?? null : data;
        setSchool(rec);
      })
      .catch(() => setSchool(null))
      .finally(() => setLoading(false));
  }, [recordId, isUUID]);

  useEffect(() => {
    if (!school?.building_id) return;
    fetch(`/api/civic/school-buildings?id=${school.building_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.geometry) setBuildingGeometry(data.geometry as GeoJSON.Geometry);
      })
      .catch(() => {});
  }, [school?.building_id]);

  useEffect(() => {
    if (!school?.id) return;
    setNearbyLoading(true);
    fetch(`/api/atlas/schools/nearby?school_id=${school.id}&limit=8`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setNearby(Array.isArray(data) ? data : []))
      .catch(() => setNearby([]))
      .finally(() => setNearbyLoading(false));
  }, [school?.id]);

  const phone = school?.phone;
  const website = school?.website_url;

  /* ─── Left Sidebar ─── */
  const leftSidebar = (
    <div className="h-full flex flex-col">
      {/* Navigation breadcrumb */}
      <div className="p-3 border-b border-border">
        <ExploreBreadcrumb entitySlug="schools" recordName={school?.name} variant="stacked" />
      </div>

      {/* Nearby Schools */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="p-3">
          <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            Nearby Schools
          </h3>
          {nearbyLoading ? (
            <div className="space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-10 rounded bg-surface-accent animate-pulse" />
              ))}
            </div>
          ) : nearby.length === 0 ? (
            <p className="text-[10px] text-foreground-subtle py-2">Loading…</p>
          ) : (
            <div className="space-y-0.5">
              {nearby.map((s) => (
                <Link
                  key={s.id}
                  href={`/explore/schools/${s.slug}`}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-surface-accent transition-colors group"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-foreground truncate group-hover:text-lake-blue transition-colors">
                      {s.name}
                    </div>
                    {s.distance_miles != null && (
                      <div className="text-[10px] text-foreground-subtle">
                        {s.distance_miles} mi away
                      </div>
                    )}
                  </div>
                  <ChevronRightIcon className="w-3 h-3 text-foreground-subtle flex-shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  /* ─── Right Sidebar ─── */
  const rightSidebar = school ? (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      {/* Header */}
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <AcademicCapIcon className="w-4 h-4 text-lake-blue flex-shrink-0" />
          <h2 className="text-sm font-semibold text-foreground truncate">{school.name}</h2>
        </div>
        <p className="text-[10px] text-foreground-muted mt-0.5">School</p>
      </div>

      {/* Quick Stats */}
      <div className="p-[10px] border-b border-border space-y-1.5">
        <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
          Information
        </h3>
        {school.address && <SidebarRow label="Address" value={school.address} />}
        {school.district_name && <SidebarRow label="District" value={school.district_name} />}
        {formatGrades(school.grade_low, school.grade_high) && (
          <SidebarRow label="Grades" value={formatGrades(school.grade_low, school.grade_high)!} />
        )}
        {school.school_type && <SidebarRow label="Type" value={String(school.school_type)} />}
        {school.enrollment != null && <SidebarRow label="Enrollment" value={school.enrollment.toLocaleString()} />}
        {school.principal_name && <SidebarRow label="Principal" value={school.principal_name} />}
        {school.year_established != null && <SidebarRow label="Established" value={String(school.year_established)} />}
      </div>

      {/* Contact */}
      {(phone || website) && (
        <div className="p-[10px] border-b border-border space-y-1.5">
          <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
            Contact
          </h3>
          {phone && (
            <div className="flex items-center gap-1.5">
              <PhoneIcon className="w-3 h-3 text-foreground-muted flex-shrink-0" />
              <a href={`tel:${phone}`} className="text-xs text-foreground-muted hover:text-foreground transition-colors">
                {phone}
              </a>
            </div>
          )}
          {website && (
            <div className="flex items-center gap-1.5">
              <GlobeAltIcon className="w-3 h-3 text-foreground-muted flex-shrink-0" />
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-lake-blue hover:underline truncate"
              >
                {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            </div>
          )}
        </div>
      )}

      {/* Location */}
      {school.lat != null && school.lng != null && (
        <div className="p-[10px] border-b border-border space-y-1.5">
          <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">
            Location
          </h3>
          <SidebarRow label="Coordinates" value={`${Number(school.lat).toFixed(4)}, ${Number(school.lng).toFixed(4)}`} />
        </div>
      )}

      {/* District link */}
      {school.district_id && (
        <div className="p-[10px]">
          <Link
            href={`/explore/school-districts/${school.district_id}`}
            className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-surface-accent transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BuildingOfficeIcon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
              <div className="text-xs text-foreground group-hover:text-lake-blue transition-colors truncate">
                {school.district_name || 'School District'}
              </div>
            </div>
            <ChevronRightIcon className="w-3 h-3 text-foreground-subtle flex-shrink-0" />
          </Link>
          <Link
            href={`/explore/school-districts/${school.district_id}?view=map`}
            className="flex items-center gap-1.5 mt-1.5 px-2 py-1.5 text-[10px] text-foreground-muted hover:text-foreground transition-colors"
          >
            <MapIcon className="w-3 h-3" />
            View on map
          </Link>
        </div>
      )}
    </div>
  ) : null;

  /* ─── Main Content ─── */
  const mainContent = loading ? (
    <LoadingSkeleton />
  ) : !school ? (
    <div className="max-w-[960px] mx-auto px-4 py-6 text-center">
      <p className="text-sm text-foreground-muted">School not found</p>
      <Link href="/explore/schools" className="text-xs text-lake-blue hover:underline mt-2 inline-block">
        ← Back to Schools
      </Link>
    </div>
  ) : (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-5">
      <ExploreBreadcrumb entitySlug="schools" recordName={school.name} />

      {/* Header */}
      <div>
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-lake-blue/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <AcademicCapIcon className="w-5 h-5 text-lake-blue" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground leading-tight">{school.name}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {school.address && (
                <span className="flex items-center gap-1 text-xs text-foreground-muted">
                  <MapPinIcon className="w-3 h-3" />
                  {school.address}
                </span>
              )}
              {formatGrades(school.grade_low, school.grade_high) && (
                <span className="text-[10px] text-foreground-subtle bg-surface-accent px-1.5 py-0.5 rounded">
                  {formatGrades(school.grade_low, school.grade_high)}
                </span>
              )}
              {school.school_type && (
                <span className="text-[10px] text-foreground-subtle bg-surface-accent px-1.5 py-0.5 rounded capitalize">
                  {String(school.school_type)}
                </span>
              )}
            </div>
          </div>
        </div>

        {(phone || website) && (
          <div className="flex flex-wrap items-center gap-3 mt-3 pl-12">
            {phone && (
              <a href={`tel:${phone}`} className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground transition-colors">
                <PhoneIcon className="w-3 h-3" />
                {phone}
              </a>
            )}
            {website && (
              <a
                href={website.startsWith('http') ? website : `https://${website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-lake-blue hover:underline"
              >
                <GlobeAltIcon className="w-3 h-3" />
                {website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
              </a>
            )}
          </div>
        )}
      </div>

      {/* At a Glance */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {school.enrollment != null && <StatCard label="Enrollment" value={school.enrollment.toLocaleString()} />}
        {formatGrades(school.grade_low, school.grade_high) && (
          <StatCard label="Grades" value={formatGrades(school.grade_low, school.grade_high)!} />
        )}
        {school.year_established != null && <StatCard label="Established" value={String(school.year_established)} />}
        {school.district_name && (
          <LinkStatCard
            label="District"
            value={school.district_name}
            href={`/explore/school-districts/${school.district_id}`}
          />
        )}
        {school.address && (
          <LinkStatCard
            label="Location"
            value={school.address.split(',')[1]?.trim() || school.address}
            href={`/explore/school-districts/${school.district_id}?view=map`}
          />
        )}
      </div>

      {/* Map */}
      {(buildingGeometry || (school.lat != null && school.lng != null)) && (
        <section>
          <MapWidget
            geometry={buildingGeometry}
            lat={!buildingGeometry && school.lat != null ? Number(school.lat) : undefined}
            lng={!buildingGeometry && school.lng != null ? Number(school.lng) : undefined}
            height={260}
          />
        </section>
      )}

      {/* Join This School */}
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Join This School</h2>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
              Connect with {school.name}&apos;s community. Share updates, events, and resources with other members.
            </p>
          </div>
          <Link
            href={`/school/${school.slug}`}
            className="flex-shrink-0 px-4 py-2 text-xs font-medium rounded-md bg-lake-blue text-white hover:bg-lake-blue/90 transition-colors"
          >
            Join School
          </Link>
        </div>
        <p className="text-[10px] text-foreground-subtle mt-3 leading-relaxed border-t border-border pt-2.5">
          Membership is limited to verified parents, students, teachers, staff, and administrators of this school. Requests are subject to review.
        </p>
      </section>

      {/* Principal */}
      {school.principal_name && (
        <ContentSection title="Staff">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <StatCard label="Principal" value={school.principal_name} />
          </div>
        </ContentSection>
      )}

      {/* District */}
      {school.district_name && (
        <ContentSection title="District">
          <Link
            href={`/explore/school-districts/${school.district_id}`}
            className="flex items-center justify-between p-3 rounded-md border border-border hover:bg-surface-accent transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BuildingOfficeIcon className="w-4 h-4 text-foreground-muted flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-xs font-semibold text-foreground group-hover:text-lake-blue transition-colors truncate">
                  {school.district_name}
                </div>
                <div className="text-[10px] text-foreground-muted">View district boundary & schools</div>
              </div>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-foreground-subtle flex-shrink-0" />
          </Link>
        </ContentSection>
      )}

      {/* Nearby Schools (main content, shown on mobile when sidebars hidden) */}
      <ContentSection title="Nearby Schools">
        {nearbyLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-md bg-surface-accent animate-pulse" />
            ))}
          </div>
        ) : nearby.length === 0 ? (
          <p className="text-xs text-foreground-muted py-3">No nearby schools found</p>
        ) : (
          <div className="border border-border rounded-md divide-y divide-border">
            {nearby.map((s) => (
              <Link
                key={s.id}
                href={`/explore/schools/${s.slug}`}
                className="flex items-center justify-between px-3 py-2.5 hover:bg-surface-accent transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground group-hover:text-lake-blue transition-colors truncate">
                    {s.name}
                  </div>
                  <div className="text-[10px] text-foreground-muted truncate">
                    {[s.district_name, formatGrades(s.grade_low, s.grade_high)].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {s.distance_miles != null && (
                    <span className="text-[10px] text-foreground-subtle tabular-nums">
                      {s.distance_miles} mi
                    </span>
                  )}
                  <ChevronRightIcon className="w-3 h-3 text-foreground-subtle" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </ContentSection>

      {/* Back */}
      <div className="pt-2 border-t border-border">
        <Link
          href="/explore/schools"
          className="inline-flex items-center gap-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          <ArrowLeftIcon className="w-3 h-3" />
          All Schools
        </Link>
      </div>
    </div>
  );

  return (
    <NewPageWrapper
      leftSidebar={leftSidebar}
      rightSidebar={rightSidebar}
    >
      {mainContent}
    </NewPageWrapper>
  );
}

/* ─── Sub-components ─── */

function ContentSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">
        {title}
      </h2>
      {children}
    </section>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-md bg-surface border border-border">
      <div className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5 truncate">{value}</div>
    </div>
  );
}

function LinkStatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="p-3 rounded-md bg-surface border border-border hover:bg-surface-accent hover:border-lake-blue/30 transition-colors group block"
    >
      <div className="text-[10px] text-foreground-muted uppercase tracking-wider">{label}</div>
      <div className="text-sm font-semibold text-foreground mt-0.5 truncate group-hover:text-lake-blue transition-colors">{value}</div>
    </Link>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="text-[10px] text-foreground-muted flex-shrink-0">{label}</span>
      <span className="text-xs text-foreground text-right truncate">{value}</span>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-4">
      <div className="h-3 w-40 rounded bg-surface-accent animate-pulse" />
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-surface-accent animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-64 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-48 rounded bg-surface-accent animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md bg-surface-accent animate-pulse" />
        ))}
      </div>
      <div className="h-[260px] rounded-md bg-surface-accent animate-pulse" />
      <div className="space-y-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-surface-accent animate-pulse" />
        ))}
      </div>
    </div>
  );
}
