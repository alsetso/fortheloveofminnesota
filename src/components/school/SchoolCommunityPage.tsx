'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  AcademicCapIcon,
  MapPinIcon,
  GlobeAltIcon,
  PhoneIcon,
  ChevronRightIcon,
  BuildingOfficeIcon,
  UserGroupIcon,
  CalendarDaysIcon,
  ChatBubbleLeftRightIcon,
  NewspaperIcon,
  CheckBadgeIcon,
} from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MapWidget from '@/components/explore/MapWidget';

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
  [key: string]: unknown;
}

interface NearbySchool {
  id: string;
  name: string;
  slug: string;
  district_name?: string;
  distance_miles?: number;
}

function formatGrades(low?: number, high?: number): string | null {
  if (low == null && high == null) return null;
  const lo = low === 0 ? 'K' : String(low ?? '?');
  const hi = high != null ? String(high) : '?';
  return `${lo}–${hi}`;
}

const MEMBERSHIP_ROLES = [
  { id: 'parent', label: 'Parent / Guardian', icon: UserGroupIcon },
  { id: 'student', label: 'Student', icon: AcademicCapIcon },
  { id: 'teacher', label: 'Teacher', icon: CheckBadgeIcon },
  { id: 'staff', label: 'Staff', icon: BuildingOfficeIcon },
  { id: 'admin', label: 'Administrator', icon: CheckBadgeIcon },
] as const;

/* ─── Component ─── */

interface SchoolCommunityPageProps {
  slug: string;
}

export default function SchoolCommunityPage({ slug }: SchoolCommunityPageProps) {
  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingGeometry, setBuildingGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [nearby, setNearby] = useState<NearbySchool[]>([]);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [joinSubmitted, setJoinSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/atlas/schools?slug=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const rec = Array.isArray(data) ? data[0] ?? null : data;
        setSchool(rec);
      })
      .catch(() => setSchool(null))
      .finally(() => setLoading(false));
  }, [slug]);

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
    fetch(`/api/atlas/schools/nearby?school_id=${school.id}&limit=5`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setNearby(Array.isArray(data) ? data : []))
      .catch(() => setNearby([]));
  }, [school?.id]);

  const phone = school?.phone;
  const website = school?.website_url;

  /* ─── Left Sidebar ─── */
  const leftSidebar = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border">
        <Link
          href={school ? `/explore/schools/${school.slug}` : '/explore/schools'}
          className="flex items-center gap-2 px-2 py-1.5 text-xs text-foreground-muted hover:bg-surface-accent hover:text-foreground rounded-md transition-colors"
        >
          <AcademicCapIcon className="w-3.5 h-3.5" />
          View Public Profile
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-4">
        {/* Community Nav */}
        <div>
          <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-2">
            Community
          </h3>
          <div className="space-y-0.5">
            <NavItem icon={ChatBubbleLeftRightIcon} label="Discussion" count={0} active />
            <NavItem icon={CalendarDaysIcon} label="Events" count={0} />
            <NavItem icon={NewspaperIcon} label="Announcements" count={0} />
            <NavItem icon={UserGroupIcon} label="Members" count={0} />
          </div>
        </div>

        {/* Nearby Schools */}
        {nearby.length > 0 && (
          <div>
            <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-2">
              Nearby Schools
            </h3>
            <div className="space-y-0.5">
              {nearby.map((s) => (
                <Link
                  key={s.id}
                  href={`/school/${s.slug}`}
                  className="flex items-center justify-between px-2 py-1.5 rounded text-xs hover:bg-surface-accent transition-colors group"
                >
                  <span className="truncate text-foreground-muted group-hover:text-foreground transition-colors">
                    {s.name}
                  </span>
                  {s.distance_miles != null && (
                    <span className="text-[10px] text-foreground-subtle flex-shrink-0 ml-2">
                      {s.distance_miles}mi
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  /* ─── Right Sidebar ─── */
  const rightSidebar = school ? (
    <div className="h-full flex flex-col overflow-y-auto scrollbar-hide">
      <div className="p-[10px] border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <AcademicCapIcon className="w-4 h-4 text-lake-blue flex-shrink-0" />
          <h2 className="text-sm font-semibold text-foreground truncate">{school.name}</h2>
        </div>
      </div>

      <div className="p-[10px] border-b border-border space-y-1.5">
        <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">About</h3>
        {school.address && <SidebarRow label="Address" value={school.address} />}
        {school.district_name && <SidebarRow label="District" value={school.district_name} />}
        {formatGrades(school.grade_low, school.grade_high) && (
          <SidebarRow label="Grades" value={formatGrades(school.grade_low, school.grade_high)!} />
        )}
        {school.enrollment != null && <SidebarRow label="Enrollment" value={school.enrollment.toLocaleString()} />}
        {school.principal_name && <SidebarRow label="Principal" value={school.principal_name} />}
      </div>

      {(phone || website) && (
        <div className="p-[10px] border-b border-border space-y-1.5">
          <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Contact</h3>
          {phone && (
            <div className="flex items-center gap-1.5">
              <PhoneIcon className="w-3 h-3 text-foreground-muted" />
              <a href={`tel:${phone}`} className="text-xs text-foreground-muted hover:text-foreground transition-colors">{phone}</a>
            </div>
          )}
          {website && (
            <div className="flex items-center gap-1.5">
              <GlobeAltIcon className="w-3 h-3 text-foreground-muted" />
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

      {/* District link */}
      {school.district_id && (
        <div className="p-[10px]">
          <Link
            href={`/explore/school-districts/${school.district_id}`}
            className="flex items-center justify-between p-2 rounded-md border border-border hover:bg-surface-accent transition-colors group"
          >
            <div className="flex items-center gap-2 min-w-0">
              <BuildingOfficeIcon className="w-3.5 h-3.5 text-foreground-muted flex-shrink-0" />
              <span className="text-xs text-foreground group-hover:text-lake-blue transition-colors truncate">
                {school.district_name || 'School District'}
              </span>
            </div>
            <ChevronRightIcon className="w-3 h-3 text-foreground-subtle flex-shrink-0" />
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
        ← Browse Schools
      </Link>
    </div>
  ) : (
    <div className="max-w-[960px] mx-auto w-full px-4 py-4 space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-lake-blue/10 flex items-center justify-center flex-shrink-0">
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
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      {(buildingGeometry || (school.lat != null && school.lng != null)) && (
        <section>
          <MapWidget
            geometry={buildingGeometry}
            lat={!buildingGeometry && school.lat != null ? Number(school.lat) : undefined}
            lng={!buildingGeometry && school.lng != null ? Number(school.lng) : undefined}
            height={220}
          />
        </section>
      )}

      {/* Join / Membership */}
      {!joinSubmitted ? (
        <section className="rounded-md border border-border bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Join {school.name}</h2>
            <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
              Select your role to request membership. You&apos;ll get access to discussions, events, and announcements for this school community.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {MEMBERSHIP_ROLES.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.id;
              return (
                <button
                  key={role.id}
                  onClick={() => setSelectedRole(role.id)}
                  className={`flex items-center gap-2 p-3 rounded-md border text-xs font-medium transition-colors ${
                    isSelected
                      ? 'border-lake-blue bg-lake-blue/5 text-lake-blue'
                      : 'border-border text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {role.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <p className="text-[10px] text-foreground-subtle leading-relaxed">
              Membership is limited to verified parents, students, teachers, staff, and administrators. Requests are subject to review.
            </p>
            <button
              disabled={!selectedRole}
              onClick={() => setJoinSubmitted(true)}
              className={`flex-shrink-0 px-5 py-2 text-xs font-medium rounded-md transition-colors ${
                selectedRole
                  ? 'bg-lake-blue text-white hover:bg-lake-blue/90'
                  : 'bg-surface-accent text-foreground-subtle cursor-not-allowed'
              }`}
            >
              Request to Join
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-md border border-lake-blue/20 bg-lake-blue/5 p-4">
          <div className="flex items-start gap-3">
            <CheckBadgeIcon className="w-5 h-5 text-lake-blue flex-shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">Request Submitted</h2>
              <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                Your request to join {school.name} as a {MEMBERSHIP_ROLES.find((r) => r.id === selectedRole)?.label.toLowerCase()} has been submitted. You&apos;ll be notified when it&apos;s reviewed.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Discussion placeholder */}
      <section>
        <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Discussion</h2>
        <div className="rounded-md border border-border bg-surface p-6 text-center">
          <ChatBubbleLeftRightIcon className="w-8 h-8 text-foreground-subtle mx-auto" />
          <p className="text-xs text-foreground-muted mt-2">No discussions yet</p>
          <p className="text-[10px] text-foreground-subtle mt-1">Join this school to start a conversation</p>
        </div>
      </section>

      {/* Events placeholder */}
      <section>
        <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Upcoming Events</h2>
        <div className="rounded-md border border-border bg-surface p-6 text-center">
          <CalendarDaysIcon className="w-8 h-8 text-foreground-subtle mx-auto" />
          <p className="text-xs text-foreground-muted mt-2">No upcoming events</p>
          <p className="text-[10px] text-foreground-subtle mt-1">Events will appear here when posted by school members</p>
        </div>
      </section>

      {/* Announcements placeholder */}
      <section>
        <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Announcements</h2>
        <div className="rounded-md border border-border bg-surface p-6 text-center">
          <NewspaperIcon className="w-8 h-8 text-foreground-subtle mx-auto" />
          <p className="text-xs text-foreground-muted mt-2">No announcements</p>
          <p className="text-[10px] text-foreground-subtle mt-1">School announcements from staff and administrators</p>
        </div>
      </section>
    </div>
  );

  return (
    <NewPageWrapper leftSidebar={leftSidebar} rightSidebar={rightSidebar}>
      {mainContent}
    </NewPageWrapper>
  );
}

/* ─── Sub-components ─── */

function NavItem({
  icon: Icon,
  label,
  count,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  active?: boolean;
}) {
  return (
    <button
      className={`flex items-center justify-between w-full px-2 py-1.5 rounded text-xs transition-colors ${
        active
          ? 'bg-surface-accent text-foreground font-medium'
          : 'text-foreground-muted hover:bg-surface-accent hover:text-foreground'
      }`}
    >
      <div className="flex items-center gap-2">
        <Icon className="w-3.5 h-3.5" />
        {label}
      </div>
      {count != null && count > 0 && (
        <span className="text-[10px] text-foreground-subtle tabular-nums">{count}</span>
      )}
    </button>
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
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-surface-accent animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-64 rounded bg-surface-accent animate-pulse" />
          <div className="h-3 w-48 rounded bg-surface-accent animate-pulse" />
        </div>
      </div>
      <div className="h-[220px] rounded-md bg-surface-accent animate-pulse" />
      <div className="h-40 rounded-md bg-surface-accent animate-pulse" />
      <div className="h-32 rounded-md bg-surface-accent animate-pulse" />
      <div className="h-32 rounded-md bg-surface-accent animate-pulse" />
    </div>
  );
}
