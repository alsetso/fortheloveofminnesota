'use client';

import { useState, useEffect, useCallback } from 'react';
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
  HomeIcon,
  MegaphoneIcon,
  Squares2X2Icon,
  BookOpenIcon,
  UsersIcon,
  ChartBarIcon,
  TrophyIcon,
  ClockIcon,
  SparklesIcon,
  StarIcon,
  ListBulletIcon,
  TruckIcon,
  HeartIcon,
  DocumentTextIcon,
  HandRaisedIcon,
  GiftIcon,
  BuildingLibraryIcon,
  ScaleIcon,
  BanknotesIcon,
  MapIcon,
  PencilSquareIcon,
  EnvelopeIcon,
  UserCircleIcon,
  PlusIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  PuzzlePieceIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartSolidIcon } from '@heroicons/react/24/solid';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import MapWidget from '@/components/explore/MapWidget';
import SchoolEditModal from '@/components/school/SchoolEditModal';
import AdminEditModal from '@/components/school/AdminEditModal';
import SchoolLunchMenu from '@/components/school/SchoolLunchMenu';
import SchoolIntegrationsPanel from '@/components/school/SchoolIntegrationsPanel';
import NutrisliceDiscoveryPanel from '@/components/school/NutrisliceDiscoveryPanel';
import { useAuthStateSafe } from '@/features/auth';

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
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  status?: 'listed' | 'setup' | 'published';
  [key: string]: unknown;
}

interface NearbySchool {
  id: string;
  name: string;
  slug: string;
  district_name?: string;
  distance_miles?: number;
}

interface AdminStaff {
  id: string;
  name: string;
  role: string;
  photo_url?: string | null;
  phone?: string | null;
  directory_number?: string | null;
  email?: string | null;
  bio?: string | null;
  sort_order: number;
  claimed_by?: string | null;
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

type SectionStatus = 'live' | 'coming_soon';
type SchoolStatusLevel = 'listed' | 'setup' | 'published';
type SectionVisibility = 'public' | 'member' | 'admin';

interface SectionDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  status: SectionStatus;
  minStatus: SchoolStatusLevel;
  visibility: SectionVisibility;
}

const STATUS_RANK: Record<SchoolStatusLevel, number> = { listed: 0, setup: 1, published: 2 };

const SECTIONS: SectionDef[] = [
  // Overview — visible on all statuses to public
  { id: 'overview',          label: 'Overview',          icon: HomeIcon,                 group: 'Overview',              status: 'live',        minStatus: 'listed',    visibility: 'public' },
  { id: 'announcements',     label: 'Announcements',     icon: MegaphoneIcon,            group: 'Overview',              status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'calendar',          label: 'Calendar',          icon: CalendarDaysIcon,         group: 'Overview',              status: 'coming_soon', minStatus: 'published', visibility: 'member' },

  // Academics — staff directory available in setup, rest requires published
  { id: 'departments',       label: 'Departments',       icon: Squares2X2Icon,           group: 'Academics',             status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'programs',          label: 'Programs',          icon: BookOpenIcon,              group: 'Academics',             status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'staff-directory',   label: 'Staff Directory',   icon: UsersIcon,                group: 'Academics',             status: 'live',        minStatus: 'setup',     visibility: 'public' },
  { id: 'academic-data',     label: 'Academic Data',     icon: ChartBarIcon,             group: 'Academics',             status: 'coming_soon', minStatus: 'published', visibility: 'member' },

  // Athletics — all published, member-gated
  { id: 'sports',            label: 'Sports',            icon: TrophyIcon,               group: 'Athletics & Activities', status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'schedules',         label: 'Schedules',         icon: ClockIcon,                group: 'Athletics & Activities', status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'clubs',             label: 'Clubs',             icon: SparklesIcon,             group: 'Athletics & Activities', status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'achievements',      label: 'Achievements',      icon: StarIcon,                 group: 'Athletics & Activities', status: 'coming_soon', minStatus: 'published', visibility: 'public' },

  // Students & Families — all published, member-gated
  { id: 'lunch',             label: 'School Menu',       icon: CalendarDaysIcon,         group: 'Students & Families',   status: 'live',        minStatus: 'listed',    visibility: 'public' },
  { id: 'transportation',    label: 'Transportation',    icon: TruckIcon,                group: 'Students & Families',   status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'counseling',        label: 'Counseling',        icon: HeartIcon,                group: 'Students & Families',   status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'forms',             label: 'Forms',             icon: DocumentTextIcon,         group: 'Students & Families',   status: 'coming_soon', minStatus: 'published', visibility: 'member' },

  // Community — published, mixed visibility
  { id: 'discussion',        label: 'Discussion',        icon: ChatBubbleLeftRightIcon,  group: 'Community',             status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'members',           label: 'Members',           icon: UserGroupIcon,            group: 'Community',             status: 'coming_soon', minStatus: 'published', visibility: 'member' },
  { id: 'volunteer',         label: 'Volunteer',         icon: HandRaisedIcon,           group: 'Community',             status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'sponsors',          label: 'Sponsors',          icon: GiftIcon,                 group: 'Community',             status: 'coming_soon', minStatus: 'published', visibility: 'public' },

  // Governance — published, public
  { id: 'school-board',      label: 'School Board',      icon: BuildingLibraryIcon,      group: 'Governance',            status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'policies',          label: 'Policies',          icon: ScaleIcon,                group: 'Governance',            status: 'coming_soon', minStatus: 'published', visibility: 'public' },
  { id: 'budget',            label: 'Budget',            icon: BanknotesIcon,            group: 'Governance',            status: 'coming_soon', minStatus: 'published', visibility: 'public' },

  // Map — available from listed
  { id: 'attendance-area',   label: 'Attendance Area',   icon: MapIcon,                  group: 'Map',                  status: 'coming_soon', minStatus: 'listed',    visibility: 'public' },
  { id: 'nearby-schools',    label: 'Nearby Schools',    icon: MapPinIcon,               group: 'Map',                  status: 'coming_soon', minStatus: 'listed',    visibility: 'public' },
];

function groupSections(sections: SectionDef[]) {
  const groups: { title: string; items: SectionDef[] }[] = [];
  for (const s of sections) {
    const last = groups[groups.length - 1];
    if (last && last.title === s.group) { last.items.push(s); }
    else { groups.push({ title: s.group, items: [s] }); }
  }
  return groups;
}

function filterVisibleSections(
  sections: SectionDef[],
  schoolStatus: SchoolStatusLevel,
  userTier: 'public' | 'member' | 'admin',
): SectionDef[] {
  const tierRank: Record<string, number> = { public: 0, member: 1, admin: 2 };
  const uRank = tierRank[userTier];
  const sRank = STATUS_RANK[schoolStatus];
  return sections.filter((s) => sRank >= STATUS_RANK[s.minStatus] && uRank >= tierRank[s.visibility]);
}

/* ─── Component ─── */

interface SchoolCommunityPageProps {
  slug: string;
}

export default function SchoolCommunityPage({ slug }: SchoolCommunityPageProps) {
  const { account } = useAuthStateSafe();
  const isPlatformAdmin = account?.role === 'admin';

  const [school, setSchool] = useState<SchoolRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [buildingGeometry, setBuildingGeometry] = useState<GeoJSON.Geometry | null>(null);
  const [nearby, setNearby] = useState<NearbySchool[]>([]);
  const [adminStaff, setAdminStaff] = useState<AdminStaff[]>([]);
  const [activeSection, setActiveSection] = useState('overview');

  const isSchoolAdmin = Boolean(
    account?.user_id &&
    adminStaff.some((s) => s.claimed_by === account.user_id)
  );
  const canManageSchool = isPlatformAdmin || isSchoolAdmin;

  const userTier: 'public' | 'member' | 'admin' = canManageSchool ? 'admin' : account ? 'member' : 'public';
  const schoolStatus: SchoolStatusLevel = (school?.status as SchoolStatusLevel) ?? 'listed';
  const visibleSections = filterVisibleSections(SECTIONS, schoolStatus, userTier);
  const sectionGroups = groupSections(visibleSections);

  const [following, setFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [joinSubmitted, setJoinSubmitted] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);

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

  useEffect(() => {
    if (!school?.id) return;
    fetch(`/api/atlas/schools/administration?school_id=${school.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAdminStaff(Array.isArray(data) ? data : []))
      .catch(() => setAdminStaff([]));
  }, [school?.id]);

  useEffect(() => {
    if (!school?.id || !account?.user_id) return;
    fetch(`/api/atlas/schools/follow?school_id=${school.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setFollowing(data.following); })
      .catch(() => {});
  }, [school?.id, account?.user_id]);

  const handleFollowToggle = useCallback(async () => {
    if (!school || !account?.user_id) return;
    setFollowLoading(true);
    try {
      const res = await fetch('/api/atlas/schools/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: school.id }),
      });
      if (res.ok) {
        const data = await res.json();
        setFollowing(data.following);
      }
    } finally {
      setFollowLoading(false);
    }
  }, [school, account?.user_id]);

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
        {canManageSchool && (
          <NavSection title="Admin">
            <NavItem
              icon={Cog6ToothIcon}
              label="Dashboard"
              active={activeSection === 'admin-dashboard'}
              onClick={() => setActiveSection('admin-dashboard')}
            />
            <NavItem
              icon={PuzzlePieceIcon}
              label="Integrations"
              active={activeSection === 'integrations'}
              onClick={() => setActiveSection('integrations')}
            />
            {isPlatformAdmin && (
              <NavItem
                icon={MagnifyingGlassIcon}
                label="Nutrislice Discovery"
                active={activeSection === 'nutrislice-discovery'}
                onClick={() => setActiveSection('nutrislice-discovery')}
              />
            )}
          </NavSection>
        )}
        {sectionGroups.map((g) => (
          <NavSection key={g.title} title={g.title}>
            {g.items.map((s) => (
              <NavItem
                key={s.id}
                icon={s.icon}
                label={s.label}
                active={activeSection === s.id}
                comingSoon={s.status === 'coming_soon'}
                onClick={() => setActiveSection(s.id)}
              />
            ))}
          </NavSection>
        ))}
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
        {(school.primary_color || school.secondary_color) && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-[10px] text-foreground-muted flex-shrink-0">Colors</span>
            <div className="flex items-center gap-1 ml-auto">
              {school.primary_color && (
                <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: school.primary_color }} title={school.primary_color} />
              )}
              {school.secondary_color && (
                <div className="w-4 h-4 rounded border border-border" style={{ backgroundColor: school.secondary_color }} title={school.secondary_color} />
              )}
            </div>
          </div>
        )}
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

      {/* Map */}
      {(buildingGeometry || (school.lat != null && school.lng != null)) && (
        <div className="p-[10px] border-b border-border">
          <MapWidget
            geometry={buildingGeometry}
            lat={!buildingGeometry && school.lat != null ? Number(school.lat) : undefined}
            lng={!buildingGeometry && school.lng != null ? Number(school.lng) : undefined}
            height={160}
            maxZoom={17}
          />
        </div>
      )}

      {/* District link */}
      {school.district_id && (
        <div className="p-[10px] border-b border-border">
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

      {/* Status toggle — platform admin only */}
      {isPlatformAdmin && (
        <div className="p-[10px]">
          <SchoolStatusToggle
            schoolId={school.id}
            currentStatus={school.status ?? 'listed'}
            onStatusChange={(status) => setSchool((prev) => prev ? { ...prev, status } : prev)}
          />
        </div>
      )}
    </div>
  ) : null;

  const handleJoinRequest = useCallback(async () => {
    if (!school || !selectedRole || !account?.user_id) return;
    setJoinLoading(true);
    try {
      const res = await fetch('/api/atlas/schools/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: school.id, role: selectedRole }),
      });
      if (res.ok) setJoinSubmitted(true);
    } finally {
      setJoinLoading(false);
    }
  }, [school, selectedRole, account?.user_id]);

  /* ─── Section content resolver ─── */
  const activeDef = visibleSections.find((s) => s.id === activeSection) ?? SECTIONS[0];

  const renderSectionContent = () => {
    if (!school) return null;

    if (activeSection === 'admin-dashboard' && canManageSchool) {
      return (
        <AdminDashboard
          school={school}
          isPlatformAdmin={isPlatformAdmin}
          onNavigate={setActiveSection}
          onOpenIdentityEditor={() => setEditModalOpen(true)}
        />
      );
    }

    if (activeSection === 'integrations' && canManageSchool) {
      return <SchoolIntegrationsPanel school={school} canManageSchool={canManageSchool} />;
    }

    if (activeSection === 'nutrislice-discovery' && isPlatformAdmin) {
      return <NutrisliceDiscoveryPanel />;
    }

    if (activeDef.status === 'coming_soon') {
      const Icon = activeDef.icon;
      return (
        <ComingSoonCard
          icon={Icon}
          title={activeDef.label}
          description={`${activeDef.label} for ${school.name} is under development. Check back soon.`}
        />
      );
    }

    const currentStatus = school.status ?? 'listed';

    switch (activeDef.id) {
      case 'overview': {
        const tagline = (school as Record<string, unknown>).tagline as string | null;
        const about = (school as Record<string, unknown>).description as string | null;
        const yearEst = (school as Record<string, unknown>).year_established as number | null;

        const stats: { label: string; value: string }[] = [];
        if (school.enrollment != null) stats.push({ label: 'Students', value: school.enrollment.toLocaleString() });
        if (formatGrades(school.grade_low, school.grade_high)) stats.push({ label: 'Grades', value: formatGrades(school.grade_low, school.grade_high)! });
        if (yearEst) stats.push({ label: 'Est.', value: String(yearEst) });
        if (school.school_type) stats.push({ label: 'Type', value: school.school_type });

        return (
          <>
            {/* Stats strip */}
            {stats.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {stats.map((s) => (
                  <div key={s.label} className="rounded-md border border-border bg-surface px-3 py-2 min-w-[80px]">
                    <div className="text-sm font-semibold text-foreground leading-tight">{s.value}</div>
                    <div className="text-[10px] text-foreground-muted uppercase tracking-wider mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tagline + About */}
            {(tagline || about) && (
              <section className="rounded-md border border-border bg-surface p-4 space-y-2">
                {tagline && <p className="text-xs font-medium text-foreground-muted italic">{tagline}</p>}
                {about && <p className="text-xs text-foreground-muted leading-relaxed">{about}</p>}
              </section>
            )}

            {/* Status-dependent community section */}
            {currentStatus === 'listed' ? (
              <section className="rounded-md border border-border bg-surface p-4 space-y-2">
                <h2 className="text-sm font-semibold text-foreground">{school.name}</h2>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  This school community is not yet active. If you are a parent, student, teacher, or staff member interested in bringing digital civic tools to your school, reach out to{' '}
                  <a href="mailto:loveofminnesota@gmail.com" className="text-lake-blue hover:underline">loveofminnesota@gmail.com</a>{' '}
                  to get started.
                </p>
              </section>
            ) : currentStatus === 'setup' ? (
              <section className="rounded-md border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                <h2 className="text-sm font-semibold text-foreground">Community Setup in Progress</h2>
                <p className="text-xs text-foreground-muted leading-relaxed">
                  {school.name}&apos;s community page is being configured by school administration. Membership will open once setup is complete.
                </p>
              </section>
            ) : !joinSubmitted ? (
              <section className="rounded-md border border-border bg-surface p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Join {school.name}</h2>
                  <p className="text-xs text-foreground-muted mt-1 leading-relaxed">
                    Select your role to request membership. You&apos;ll get access to discussions, events, and announcements for this school community.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {MEMBERSHIP_ROLES.map((role) => {
                    const RoleIcon = role.icon;
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
                        <RoleIcon className="w-4 h-4 flex-shrink-0" />
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
                    disabled={!selectedRole || !account?.user_id || joinLoading}
                    onClick={handleJoinRequest}
                    className={`flex-shrink-0 px-5 py-2 text-xs font-medium rounded-md transition-colors ${
                      selectedRole && account?.user_id
                        ? 'bg-lake-blue text-white hover:bg-lake-blue/90'
                        : 'bg-surface-accent text-foreground-subtle cursor-not-allowed'
                    }`}
                  >
                    {joinLoading ? 'Submitting…' : !account?.user_id ? 'Sign in to Join' : 'Request to Join'}
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

            {/* Administration — hidden when listed unless admin */}
            {(currentStatus !== 'listed' || canManageSchool) && (
              <section>
                <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Administration</h2>
                {adminStaff.length > 0 || canManageSchool ? (
                  <AdminStaffStrip
                    staff={adminStaff}
                    canManage={canManageSchool}
                    schoolId={school.id}
                    currentUserId={account?.user_id ?? null}
                    currentUserEmail={account?.email ?? null}
                    onStaffChange={setAdminStaff}
                  />
                ) : (
                  <div className="rounded-md border border-border bg-surface p-6 text-center">
                    <UserCircleIcon className="w-8 h-8 text-foreground-subtle mx-auto" />
                    <p className="text-xs text-foreground-muted mt-2">No administration staff listed</p>
                  </div>
                )}
              </section>
            )}
          </>
        );
      }

      case 'staff-directory':
        return (
          <section>
            <h2 className="text-xs font-semibold text-foreground-muted uppercase tracking-wider mb-2">Administration & Staff</h2>
            {adminStaff.length > 0 || canManageSchool ? (
              <AdminStaffStrip
                staff={adminStaff}
                canManage={canManageSchool}
                schoolId={school.id}
                currentUserId={account?.user_id ?? null}
                currentUserEmail={account?.email ?? null}
                onStaffChange={setAdminStaff}
              />
            ) : (
              <div className="rounded-md border border-border bg-surface p-6 text-center">
                <UserCircleIcon className="w-8 h-8 text-foreground-subtle mx-auto" />
                <p className="text-xs text-foreground-muted mt-2">No staff listed yet</p>
              </div>
            )}
          </section>
        );

      case 'lunch':
        return <SchoolLunchMenu slug={school.slug} primaryColor={school.primary_color ?? undefined} />;

      default:
        return null;
    }
  };

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
      {/* Cover */}
      {school.cover_url && (
        <div className="rounded-md overflow-hidden border border-border h-[180px]">
          <img src={school.cover_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{ backgroundColor: school.primary_color ? `${school.primary_color}1a` : undefined }}
          >
            {school.logo_url ? (
              <img src={school.logo_url} alt="" className="w-full h-full object-contain" />
            ) : (
              <AcademicCapIcon className="w-5 h-5 text-lake-blue" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-foreground leading-tight">{school.name}</h1>
              {canManageSchool && (
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="p-1 rounded hover:bg-surface-accent transition-colors flex-shrink-0"
                  title="Edit school identity"
                >
                  <PencilSquareIcon className="w-3.5 h-3.5 text-foreground-muted" />
                </button>
              )}
              {account?.user_id && (
                <button
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium transition-colors flex-shrink-0 ${
                    following
                      ? 'border-red-300/40 bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-500/20'
                      : 'border-border text-foreground-muted hover:bg-surface-accent hover:text-foreground'
                  } ${followLoading ? 'opacity-50' : ''}`}
                  title={following ? 'Unfollow' : 'Follow'}
                >
                  {following ? (
                    <HeartSolidIcon className="w-3 h-3" />
                  ) : (
                    <HeartIcon className="w-3 h-3" />
                  )}
                  {following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
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

      {/* Active section content */}
      {renderSectionContent()}
    </div>
  );

  return (
    <>
      <NewPageWrapper leftSidebar={leftSidebar} rightSidebar={rightSidebar}>
        {mainContent}
      </NewPageWrapper>

      {editModalOpen && school && (
        <SchoolEditModal
          schoolId={school.id}
          schoolName={school.name}
          initialData={{
            name: school.name,
            address: school.address ?? null,
            phone: school.phone ?? null,
            website_url: school.website_url ?? null,
            principal_name: school.principal_name ?? null,
            enrollment: school.enrollment ?? null,
            year_established: (school as Record<string, unknown>).year_established as number | null ?? null,
            grade_low: school.grade_low ?? null,
            grade_high: school.grade_high ?? null,
            tagline: (school as Record<string, unknown>).tagline as string | null ?? null,
            description: (school as Record<string, unknown>).description as string | null ?? null,
            conference: (school as Record<string, unknown>).conference as string | null ?? null,
            mascot_name: (school as Record<string, unknown>).mascot_name as string | null ?? null,
            primary_color: school.primary_color ?? null,
            secondary_color: school.secondary_color ?? null,
            logo_url: school.logo_url ?? null,
            cover_url: school.cover_url ?? null,
            mascot_url: (school as Record<string, unknown>).mascot_url as string | null ?? null,
          }}
          onClose={() => setEditModalOpen(false)}
          onSaved={(data) => {
            setSchool((prev) => {
              if (!prev) return prev;
              const patch: Record<string, unknown> = {};
              for (const [k, v] of Object.entries(data)) {
                if (v !== undefined) patch[k] = v;
              }
              return { ...prev, ...patch };
            });
          }}
        />
      )}
    </>
  );
}

/* ─── Sub-components ─── */

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  comingSoon,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active?: boolean;
  comingSoon?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
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
      {comingSoon && (
        <span className="text-[8px] text-foreground-subtle bg-surface-accent px-1 py-0.5 rounded leading-none">Soon</span>
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

function AdminStaffStrip({
  staff,
  canManage,
  schoolId,
  currentUserId,
  currentUserEmail,
  onStaffChange,
}: {
  staff: AdminStaff[];
  canManage: boolean;
  schoolId: string;
  currentUserId: string | null;
  currentUserEmail: string | null;
  onStaffChange: (s: AdminStaff[]) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<AdminStaff | null | 'new'>(null);
  const [claiming, setClaiming] = useState(false);
  const selected = staff.find((s) => s.id === selectedId) ?? null;

  const canClaimSelected = Boolean(
    selected &&
    !selected.claimed_by &&
    currentUserEmail &&
    selected.email?.toLowerCase() === currentUserEmail.toLowerCase()
  );

  const handleClaim = async () => {
    if (!selected || claiming) return;
    setClaiming(true);
    try {
      const res = await fetch('/api/atlas/schools/administration/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: selected.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || 'Claim failed');
      }
      const updated = await res.json();
      onStaffChange(staff.map((s) => (s.id === updated.id ? { ...s, claimed_by: updated.claimed_by } : s)));
    } catch {
      // silent fail — claim button remains
    } finally {
      setClaiming(false);
    }
  };

  return (
    <>
      <div className="rounded-md border border-border bg-surface">
        <div className="flex overflow-x-auto scrollbar-hide gap-2 p-[10px]">
          {staff.map((s) => {
            const isActive = selectedId === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setSelectedId(isActive ? null : s.id)}
                className={`flex-shrink-0 w-[88px] flex flex-col items-center gap-1.5 p-2 rounded-md border transition-colors ${
                  isActive
                    ? 'border-lake-blue bg-lake-blue/5'
                    : 'border-border hover:bg-surface-accent'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-surface-accent flex items-center justify-center overflow-hidden">
                    {s.photo_url ? (
                      <img src={s.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <UserCircleIcon className="w-6 h-6 text-foreground-subtle" />
                    )}
                  </div>
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-surface ${
                      s.claimed_by ? 'bg-emerald-500 dark:bg-emerald-400' : 'bg-foreground-subtle/40'
                    }`}
                    title={s.claimed_by ? 'Active' : 'Unclaimed'}
                  />
                </div>
                <div className="w-full text-center">
                  <div className="text-[10px] font-medium text-foreground truncate">{s.name.split(' ')[0]}</div>
                  <div className="text-[9px] text-foreground-muted truncate">{s.role}</div>
                </div>
              </button>
            );
          })}
          {canManage && (
            <button
              onClick={() => setEditTarget('new')}
              className="flex-shrink-0 w-[88px] flex flex-col items-center justify-center gap-1.5 p-2 rounded-md border border-dashed border-border hover:border-foreground-subtle hover:bg-surface-accent transition-colors"
            >
              <PlusIcon className="w-5 h-5 text-foreground-subtle" />
              <span className="text-[9px] text-foreground-muted">Add</span>
            </button>
          )}
        </div>

        {selected && (
          <div className="border-t border-border p-[10px] space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center overflow-hidden flex-shrink-0">
                {selected.photo_url ? (
                  <img src={selected.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserCircleIcon className="w-5 h-5 text-foreground-subtle" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground">{selected.name}</span>
                  <span className={`text-[8px] font-medium px-1 py-0.5 rounded leading-none ${
                    selected.claimed_by
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                      : 'bg-surface-accent text-foreground-subtle'
                  }`}>
                    {selected.claimed_by ? 'Active' : 'Unclaimed'}
                  </span>
                </div>
                <div className="text-[10px] text-foreground-muted">{selected.role}</div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {canManage && (
                  <button
                    onClick={() => setEditTarget(selected)}
                    className="p-1 rounded hover:bg-surface-accent transition-colors"
                    title="Edit"
                  >
                    <PencilSquareIcon className="w-3 h-3 text-foreground-muted" />
                  </button>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="p-1 rounded hover:bg-surface-accent transition-colors" title={selected.email}>
                    <EnvelopeIcon className="w-3 h-3 text-foreground-muted" />
                  </a>
                )}
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="p-1 rounded hover:bg-surface-accent transition-colors" title={`${selected.phone}${selected.directory_number ? ` ${selected.directory_number}` : ''}`}>
                    <PhoneIcon className="w-3 h-3 text-foreground-muted" />
                  </a>
                )}
              </div>
            </div>
            {(selected.phone || selected.email) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                {selected.phone && (
                  <span className="text-[10px] text-foreground-muted">
                    {selected.phone}{selected.directory_number ? ` ${selected.directory_number}` : ''}
                  </span>
                )}
                {selected.email && (
                  <a href={`mailto:${selected.email}`} className="text-[10px] text-lake-blue hover:underline">{selected.email}</a>
                )}
              </div>
            )}
            {selected.bio && (
              <p className="text-[11px] text-foreground-muted leading-relaxed">{selected.bio}</p>
            )}

            {/* Claim button — only visible to matching email, only when unclaimed */}
            {canClaimSelected && (
              <button
                onClick={handleClaim}
                disabled={claiming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-50 mt-1"
              >
                <ShieldCheckIcon className="w-3 h-3" />
                {claiming ? 'Claiming…' : 'Claim This Profile'}
              </button>
            )}
          </div>
        )}
      </div>

      {editTarget && (
        <AdminEditModal
          schoolId={schoolId}
          staff={editTarget === 'new' ? null : editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(record) => {
            const updated: AdminStaff = {
              ...record,
              sort_order: record.sort_order ?? 0,
              claimed_by: (editTarget !== 'new' ? editTarget.claimed_by : null) ?? null,
            };
            const exists = staff.some((s) => s.id === updated.id);
            if (exists) {
              onStaffChange(staff.map((s) => (s.id === updated.id ? updated : s)));
            } else {
              onStaffChange([...staff, updated]);
            }
          }}
          onDeleted={(id) => {
            onStaffChange(staff.filter((s) => s.id !== id));
            if (selectedId === id) setSelectedId(null);
          }}
        />
      )}
    </>
  );
}

function SchoolStatusToggle({
  schoolId,
  currentStatus,
  onStatusChange,
}: {
  schoolId: string;
  currentStatus: 'listed' | 'setup' | 'published';
  onStatusChange: (s: 'listed' | 'setup' | 'published') => void;
}) {
  const [saving, setSaving] = useState(false);

  const handleChange = async (status: 'listed' | 'setup' | 'published') => {
    if (status === currentStatus || saving) return;
    setSaving(true);
    try {
      const res = await fetch('/api/atlas/schools/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school_id: schoolId, status }),
      });
      if (res.ok) onStatusChange(status);
    } finally {
      setSaving(false);
    }
  };

  const options: { value: 'listed' | 'setup' | 'published'; label: string; activeClass: string }[] = [
    { value: 'listed', label: 'Listed', activeClass: 'bg-surface-accent text-foreground-muted' },
    { value: 'setup', label: 'Setup', activeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { value: 'published', label: 'Published', activeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <ShieldCheckIcon className="w-3 h-3 text-foreground-muted" />
        <span className="text-[10px] font-semibold text-foreground-muted uppercase tracking-wider">Status</span>
      </div>
      <div className="flex rounded-md border border-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            disabled={saving}
            className={`flex-1 px-2 py-1.5 text-[10px] font-medium transition-colors ${
              currentStatus === opt.value
                ? opt.activeClass
                : 'bg-surface text-foreground-subtle hover:text-foreground-muted hover:bg-surface-accent'
            } ${saving ? 'opacity-50' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AdminDashboard({
  school,
  isPlatformAdmin,
  onNavigate,
  onOpenIdentityEditor,
}: {
  school: SchoolRecord;
  isPlatformAdmin: boolean;
  onNavigate: (sectionId: string) => void;
  onOpenIdentityEditor: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cog6ToothIcon className="w-4 h-4 text-foreground-muted" />
        <h2 className="text-sm font-semibold text-foreground">School Admin</h2>
        {isPlatformAdmin && (
          <span className="text-[8px] font-medium px-1 py-0.5 rounded leading-none bg-amber-500/10 text-amber-600 dark:text-amber-400">Platform Admin</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <DashboardCard
          icon={PencilSquareIcon}
          title="School Identity"
          description="Logo, cover image, colors"
          status="live"
          onClick={onOpenIdentityEditor}
        />
        <DashboardCard
          icon={UsersIcon}
          title="Staff Directory"
          description="Manage administration profiles"
          status="live"
          onClick={() => onNavigate('staff-directory')}
        />
        <DashboardCard
          icon={PuzzlePieceIcon}
          title="Integrations"
          description="Connect external services"
          status="live"
          onClick={() => onNavigate('integrations')}
        />
        {isPlatformAdmin && (
          <DashboardCard
            icon={MagnifyingGlassIcon}
            title="Nutrislice Discovery"
            description="Onboard entire districts at once"
            status="live"
            onClick={() => onNavigate('nutrislice-discovery')}
          />
        )}
        <DashboardCard
          icon={UserGroupIcon}
          title="Member Requests"
          description="Review pending join requests"
          status="coming_soon"
        />
        <DashboardCard
          icon={MegaphoneIcon}
          title="Announcements"
          description="Post school announcements"
          status="coming_soon"
        />
        <DashboardCard
          icon={CalendarDaysIcon}
          title="Events"
          description="Manage school calendar"
          status="coming_soon"
        />
        <DashboardCard
          icon={ChartBarIcon}
          title="Analytics"
          description="Page views, member activity"
          status="coming_soon"
        />
      </div>
    </div>
  );
}

function DashboardCard({
  icon: Icon,
  title,
  description,
  status,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: 'live' | 'coming_soon';
  onClick?: () => void;
}) {
  const Wrapper = onClick && status === 'live' ? 'button' : 'div';
  return (
    <Wrapper
      onClick={onClick && status === 'live' ? onClick : undefined}
      className={`rounded-md border p-3 space-y-1.5 text-left ${
        status === 'live'
          ? 'border-border bg-surface hover:bg-surface-accent transition-colors cursor-pointer'
          : 'border-dashed border-border bg-surface-muted'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`w-3.5 h-3.5 ${status === 'live' ? 'text-foreground-muted' : 'text-foreground-subtle/50'}`} />
          <span className={`text-xs font-medium ${status === 'live' ? 'text-foreground' : 'text-foreground-subtle'}`}>{title}</span>
        </div>
        {status === 'coming_soon' && (
          <span className="text-[8px] text-foreground-subtle bg-surface-accent px-1 py-0.5 rounded leading-none">Soon</span>
        )}
      </div>
      <p className={`text-[10px] ${status === 'live' ? 'text-foreground-muted' : 'text-foreground-subtle/50'}`}>{description}</p>
    </Wrapper>
  );
}

function ComingSoonCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-8 text-center space-y-3">
      <div className="w-12 h-12 rounded-full bg-surface-accent flex items-center justify-center mx-auto">
        <Icon className="w-6 h-6 text-foreground-subtle" />
      </div>
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-foreground-muted mt-1.5 leading-relaxed max-w-sm mx-auto">{description}</p>
      </div>
      <span className="inline-block text-[10px] font-medium text-foreground-subtle bg-surface-accent px-2 py-1 rounded">Coming Soon</span>
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
