'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BuildingOfficeIcon, UserIcon, BriefcaseIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { useAuthStateSafe } from '@/features/auth';
import { useAppModalContextSafe } from '@/contexts/AppModalContext';
import { useToast } from '@/features/ui/hooks/useToast';
import { useGovTab } from './contexts/GovTabContext';
import InlineEditField from '@/features/civic/components/InlineEditField';
import EditableFieldBadge from '@/features/civic/components/EditableFieldBadge';
import CommunityBanner from '@/features/civic/components/CommunityBanner';
import ImageUpload from '@/features/civic/components/ImageUpload';
import { updateCivicFieldWithLogging } from '@/features/civic/utils/civicEditLogger';
import Link from 'next/link';

type Tab = 'orgs' | 'people' | 'roles';

interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  org_type: string;
  parent_id: string | null;
  description: string | null;
  website: string | null;
  created_at: string;
  parent_name?: string | null;
}

interface PersonRecord {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  created_at: string;
  roles?: string[];
}

interface RoleRecord {
  id: string;
  title: string;
  person_id: string;
  org_id: string;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  created_at: string;
  person_name?: string;
  person_photo_url?: string | null;
  person_slug?: string | null;
  org_name?: string;
  org_slug?: string;
}

interface GovTablesClientProps {
  showTabsOnly?: boolean;
  showTablesOnly?: boolean;
}

export default function GovTablesClient({ showTabsOnly = false, showTablesOnly = false }: GovTablesClientProps = {}) {
  const { account } = useAuthStateSafe();
  const appModal = useAppModalContextSafe();
  const { success, error: showError } = useToast();
  const { activeTab, setActiveTab } = useGovTab();
  const isAuthenticated = !!account;
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());
  const [refreshKey, setRefreshKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = useSupabaseClient();

  const handleRefresh = useCallback(() => {
    setLoadedTabs(new Set());
    setRefreshKey(prev => prev + 1);
  }, []);

  const loadData = useCallback(async () => {
    // Skip if already loaded (unless refresh was triggered)
    if (loadedTabs.has(activeTab) && refreshKey === 0) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'orgs') {
        const { data: orgsData, error } = await supabase
          .from('orgs')
          .select('*')
          .order('name');
        if (error) throw error;

        // Create a map to look up parent names
        const orgsMap = new Map<string, string>();
        (orgsData || []).forEach((org: OrgRecord) => {
          orgsMap.set(org.id, org.name);
        });

        // Add parent names to orgs
        const orgsWithParents = (orgsData || []).map((org: OrgRecord) => ({
          ...org,
          parent_name: org.parent_id ? orgsMap.get(org.parent_id) || null : null,
        }));

        setOrgs(orgsWithParents);
      } else if (activeTab === 'people') {
        const { data: peopleData, error: peopleError } = await supabase
          .from('people')
          .select('id, name, slug, party, photo_url, district, email, phone, address, created_at')
          .order('name');
        if (peopleError) throw peopleError;

        // Fetch all roles
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('person_id, title')
          .order('title');
        
        if (rolesError) {
          console.error('Error fetching roles:', rolesError);
        }

        // Group roles by person_id
        const rolesByPerson = new Map<string, string[]>();
        (rolesData || []).forEach((role: { person_id: string; title: string }) => {
          if (role.person_id) {
            if (!rolesByPerson.has(role.person_id)) {
              rolesByPerson.set(role.person_id, []);
            }
            rolesByPerson.get(role.person_id)!.push(role.title);
          }
        });

        // Add roles to people
        const peopleWithRoles = (peopleData || []).map((person: PersonRecord) => ({
          ...person,
          roles: rolesByPerson.get(person.id) || [],
        }));

        setPeople(peopleWithRoles);
      } else if (activeTab === 'roles') {
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('*')
          .order('created_at', { ascending: false });
        if (rolesError) throw rolesError;

        // Fetch all people and orgs to join with roles
        const [peopleResult, orgsResult] = await Promise.all([
          supabase.from('people').select('id, name, photo_url, slug'),
          supabase.from('orgs').select('id, name, slug'),
        ]);
        
        if (peopleResult.error) {
          console.error('Error fetching people:', peopleResult.error);
        }
        if (orgsResult.error) {
          console.error('Error fetching orgs:', orgsResult.error);
        }

        // Create maps for lookups
        const peopleMap = new Map<string, { name: string; photo_url: string | null; slug: string | null }>();
        (peopleResult.data || []).forEach((person: { id: string; name: string; photo_url: string | null; slug: string | null }) => {
          peopleMap.set(person.id, {
            name: person.name,
            photo_url: person.photo_url,
            slug: person.slug,
          });
        });

        const orgsMap = new Map<string, { name: string; slug: string }>();
        (orgsResult.data || []).forEach((org: { id: string; name: string; slug: string }) => {
          orgsMap.set(org.id, {
            name: org.name,
            slug: org.slug,
          });
        });

        // Join roles with people and orgs data
        const rolesWithPeople = (rolesData || []).map((role: RoleRecord) => {
          const person = peopleMap.get(role.person_id);
          const org = orgsMap.get(role.org_id);
          return {
            ...role,
            person_name: person?.name,
            person_photo_url: person?.photo_url,
            person_slug: person?.slug,
            org_name: org?.name,
            org_slug: org?.slug,
          };
        });

        setRoles(rolesWithPeople);
      }
      setLoadedTabs(prev => new Set(prev).add(activeTab));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadedTabs, supabase, refreshKey]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, refreshKey]);

  // Reset search when switching tabs
  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  // Filter data based on search query
  const filteredOrgs = useMemo(() => {
    if (!searchQuery.trim()) return orgs;
    const query = searchQuery.toLowerCase();
    return orgs.filter(org => 
      org.name.toLowerCase().includes(query) ||
      org.org_type.toLowerCase().includes(query) ||
      org.slug.toLowerCase().includes(query) ||
      (org.parent_name?.toLowerCase().includes(query)) ||
      (org.description?.toLowerCase().includes(query))
    );
  }, [orgs, searchQuery]);

  const filteredPeople = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const query = searchQuery.toLowerCase();
    return people.filter(person => 
      person.name.toLowerCase().includes(query) ||
      (person.party?.toLowerCase().includes(query)) ||
      (person.district?.toLowerCase().includes(query)) ||
      (person.email?.toLowerCase().includes(query)) ||
      (person.slug?.toLowerCase().includes(query)) ||
      (person.roles?.some(role => role.toLowerCase().includes(query)))
    );
  }, [people, searchQuery]);

  const filteredRoles = useMemo(() => {
    if (!searchQuery.trim()) return roles;
    const query = searchQuery.toLowerCase();
    return roles.filter(role => 
      role.title.toLowerCase().includes(query) ||
      (role.person_name?.toLowerCase().includes(query)) ||
      (role.org_name?.toLowerCase().includes(query))
    );
  }, [roles, searchQuery]);

  // Get current filtered data based on active tab
  const getFilteredData = () => {
    switch (activeTab) {
      case 'orgs': return filteredOrgs;
      case 'people': return filteredPeople;
      case 'roles': return filteredRoles;
    }
  };

  const getTotalCount = () => {
    switch (activeTab) {
      case 'orgs': return orgs.length;
      case 'people': return people.length;
      case 'roles': return roles.length;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  // Render tabs only
  if (showTabsOnly) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setActiveTab('orgs')}
            className={`px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-colors text-left ${
              activeTab === 'orgs'
                ? 'border-gray-900 bg-gray-50 text-gray-900'
                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BuildingOfficeIcon className="w-3 h-3 inline mr-1" />
            Orgs ({searchQuery.trim() && activeTab === 'orgs' ? `${filteredOrgs.length}/${orgs.length}` : orgs.length})
          </button>
          <button
            onClick={() => setActiveTab('people')}
            className={`px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-colors text-left ${
              activeTab === 'people'
                ? 'border-gray-900 bg-gray-50 text-gray-900'
                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <UserIcon className="w-3 h-3 inline mr-1" />
            People ({searchQuery.trim() && activeTab === 'people' ? `${filteredPeople.length}/${people.length}` : people.length})
          </button>
          <button
            onClick={() => setActiveTab('roles')}
            className={`px-3 py-1.5 text-xs font-medium border-2 rounded-md transition-colors text-left ${
              activeTab === 'roles'
                ? 'border-gray-900 bg-gray-50 text-gray-900'
                : 'border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <BriefcaseIcon className="w-3 h-3 inline mr-1" />
            Roles ({searchQuery.trim() && activeTab === 'roles' ? `${filteredRoles.length}/${roles.length}` : roles.length})
          </button>
        </div>
      </div>
    );
  }

  // Render tables only (no tabs, no banner)
  if (showTablesOnly) {
    return (
      <div className="space-y-4">
        {/* Search Input */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            />
          </div>
          {searchQuery.trim() && (
            <p className="text-xs text-gray-500 mt-1.5">
              Showing {getFilteredData().length} of {getTotalCount()} {activeTab}
            </p>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {activeTab === 'orgs' && (
          <div className="overflow-x-auto">
            {filteredOrgs.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No organizations found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No organizations found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Description
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Type</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Parent</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">
                    <div className="flex items-center gap-1">
                      Website
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      <Link
                        href={`/gov/org/${org.slug}`}
                        className="text-gray-900 hover:text-gray-700 hover:underline font-medium"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="orgs"
                          recordId={org.id}
                          field="description"
                          value={org.description}
                          accountId={account.id}
                          type="textarea"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {org.description || <span className="text-gray-400 italic">(empty)</span>}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      <Link
                        href={`/gov/org/${org.slug}`}
                        className="text-gray-600 hover:text-gray-900 hover:underline"
                      >
                        {org.slug}
                      </Link>
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">{org.org_type}</td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">
                      {org.parent_name || '-'}
                    </td>
                    <td className="p-1.5">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="orgs"
                          recordId={org.id}
                          field="website"
                          value={org.website}
                          accountId={account.id}
                          type="url"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {org.website ? (
                            <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {org.website}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {activeTab === 'people' && (
          <div className="overflow-x-auto">
            {filteredPeople.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No people found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No people found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Photo
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Party
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      District
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Roles</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Email
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Phone
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Address
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <ImageUpload
                          currentUrl={person.photo_url}
                          pathPrefix={person.id}
                          onUpload={async (url) => {
                            const { error } = await updateCivicFieldWithLogging({
                              table: 'people',
                              recordId: person.id,
                              field: 'photo_url',
                              newValue: url,
                              accountId: account.id,
                              supabase,
                            });
                            if (!error) {
                              success('Updated', 'Photo uploaded successfully');
                              handleRefresh();
                            } else {
                              showError('Upload failed', 'Failed to update photo');
                            }
                          }}
                          onError={(err) => {
                            console.error('Image upload error:', err);
                            showError('Upload failed', err instanceof Error ? err.message : 'Failed to upload image');
                          }}
                          size="sm"
                        />
                      ) : (
                        person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">
                            No photo
                          </div>
                        )
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {person.slug ? (
                        <Link
                          href={`/gov/person/${person.slug}`}
                          className="text-gray-900 hover:text-gray-700 hover:underline font-medium"
                        >
                          {person.name}
                        </Link>
                      ) : (
                        <span className="text-gray-900 font-medium">{person.name}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">{person.slug || '-'}</td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="party"
                          value={person.party}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.party || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="district"
                          value={person.district}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.district || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">
                      {person.roles && person.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.roles.map((role, index) => (
                            <span
                              key={index}
                              className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="email"
                          value={person.email}
                          accountId={account.id}
                          type="email"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {person.email ? (
                            <a href={`mailto:${person.email}`} className="text-blue-600 hover:underline">
                              {person.email}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="phone"
                          value={person.phone}
                          accountId={account.id}
                          type="tel"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {person.phone ? (
                            <a href={`tel:${person.phone}`} className="text-blue-600 hover:underline">
                              {person.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="address"
                          value={person.address}
                          accountId={account.id}
                          type="textarea"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.address || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-500 font-mono text-[10px]">
                      {person.id.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="overflow-x-auto">
            {filteredRoles.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No roles found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No roles found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Title
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Person</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Organization</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Start Date
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      End Date
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">
                    <div className="flex items-center gap-1">
                      Current
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="title"
                          value={role.title}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-900 font-medium">{role.title}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {role.person_name ? (
                        <div className="flex items-center gap-2">
                          {role.person_photo_url ? (
                            <img
                              src={role.person_photo_url}
                              alt={role.person_name}
                              className="w-6 h-6 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-500 flex-shrink-0">
                              No photo
                            </div>
                          )}
                          {role.person_slug ? (
                            <Link
                              href={`/gov/person/${role.person_slug}`}
                              className="text-gray-900 hover:text-gray-700 hover:underline"
                            >
                              {role.person_name}
                            </Link>
                          ) : (
                            <span className="text-gray-900">{role.person_name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">
                          {role.person_id ? `${role.person_id.slice(0, 8)}...` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {role.org_name ? (
                        role.org_slug ? (
                          <Link
                            href={`/gov/org/${role.org_slug}`}
                            className="text-gray-900 hover:text-gray-700 hover:underline"
                          >
                            {role.org_name}
                          </Link>
                        ) : (
                          <span className="text-gray-900">{role.org_name}</span>
                        )
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">
                          {role.org_id ? `${role.org_id.slice(0, 8)}...` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="start_date"
                          value={role.start_date}
                          accountId={account.id}
                          type="date"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{role.start_date || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="end_date"
                          value={role.end_date}
                          accountId={account.id}
                          type="date"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{role.end_date || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5">
                      {isAuthenticated && account?.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={role.is_current}
                            onChange={async (e) => {
                              const { error } = await updateCivicFieldWithLogging({
                                table: 'roles',
                                recordId: role.id,
                                field: 'is_current',
                                newValue: e.target.checked ? 'true' : 'false',
                                accountId: account.id,
                                supabase,
                              });
                              if (!error) {
                                success('Updated', `Role marked as ${e.target.checked ? 'current' : 'past'}`);
                                handleRefresh();
                              } else {
                                showError('Update failed', 'Failed to update role status');
                              }
                            }}
                            className="w-3 h-3 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-600">
                            {role.is_current ? 'Current' : 'Past'}
                          </span>
                        </div>
                      ) : (
                        role.is_current ? (
                          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            Yes
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                            No
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}
        </div>
      </div>
    );
  }

  // Default: render everything (for backwards compatibility)
  return (
    <div className="space-y-3">
      <CommunityBanner />
      
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('orgs')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'orgs'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BuildingOfficeIcon className="w-3 h-3 inline mr-1" />
          Orgs ({searchQuery.trim() && activeTab === 'orgs' ? `${filteredOrgs.length}/${orgs.length}` : orgs.length})
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'people'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserIcon className="w-3 h-3 inline mr-1" />
          People ({searchQuery.trim() && activeTab === 'people' ? `${filteredPeople.length}/${people.length}` : people.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BriefcaseIcon className="w-3 h-3 inline mr-1" />
          Roles ({searchQuery.trim() && activeTab === 'roles' ? `${filteredRoles.length}/${roles.length}` : roles.length})
        </button>
      </div>

      {/* Search Input */}
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="w-3 h-3 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          />
        </div>
        {searchQuery.trim() && (
          <p className="text-xs text-gray-500 mt-1.5">
            Showing {getFilteredData().length} of {getTotalCount()} {activeTab}
          </p>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        {activeTab === 'orgs' && (
          <div className="overflow-x-auto">
            {filteredOrgs.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No organizations found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No organizations found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Description
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Type</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Parent</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">
                    <div className="flex items-center gap-1">
                      Website
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map((org) => (
                  <tr key={org.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      <Link
                        href={`/gov/org/${org.slug}`}
                        className="text-gray-900 hover:text-gray-700 hover:underline font-medium"
                      >
                        {org.name}
                      </Link>
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="orgs"
                          recordId={org.id}
                          field="description"
                          value={org.description}
                          accountId={account.id}
                          type="textarea"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {org.description || <span className="text-gray-400 italic">(empty)</span>}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      <Link
                        href={`/gov/org/${org.slug}`}
                        className="text-gray-600 hover:text-gray-900 hover:underline"
                      >
                        {org.slug}
                      </Link>
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">{org.org_type}</td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">
                      {org.parent_name || '-'}
                    </td>
                    <td className="p-1.5">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="orgs"
                          recordId={org.id}
                          field="website"
                          value={org.website}
                          accountId={account.id}
                          type="url"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {org.website ? (
                            <a href={org.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                              {org.website}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {activeTab === 'people' && (
          <div className="overflow-x-auto">
            {filteredPeople.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No people found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No people found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Photo
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Name</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Slug</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Party
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      District
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Roles</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Email
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Phone
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Address
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">ID</th>
                </tr>
              </thead>
              <tbody>
                {filteredPeople.map((person) => (
                  <tr key={person.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <ImageUpload
                          currentUrl={person.photo_url}
                          pathPrefix={person.id}
                          onUpload={async (url) => {
                            const { error } = await updateCivicFieldWithLogging({
                              table: 'people',
                              recordId: person.id,
                              field: 'photo_url',
                              newValue: url,
                              accountId: account.id,
                              supabase,
                            });
                            if (!error) {
                              success('Updated', 'Photo uploaded successfully');
                              handleRefresh();
                            } else {
                              showError('Upload failed', 'Failed to update photo');
                            }
                          }}
                          onError={(err) => {
                            console.error('Image upload error:', err);
                            showError('Upload failed', err instanceof Error ? err.message : 'Failed to upload image');
                          }}
                          size="sm"
                        />
                      ) : (
                        person.photo_url ? (
                          <img src={person.photo_url} alt={person.name} className="w-8 h-8 rounded object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-500">
                            No photo
                          </div>
                        )
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {person.slug ? (
                        <Link
                          href={`/gov/person/${person.slug}`}
                          className="text-gray-900 hover:text-gray-700 hover:underline font-medium"
                        >
                          {person.name}
                        </Link>
                      ) : (
                        <span className="text-gray-900 font-medium">{person.name}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">{person.slug || '-'}</td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="party"
                          value={person.party}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.party || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="district"
                          value={person.district}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.district || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-600 border-r border-gray-100">
                      {person.roles && person.roles.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {person.roles.map((role, index) => (
                            <span
                              key={index}
                              className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded"
                            >
                              {role}
                            </span>
                          ))}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="email"
                          value={person.email}
                          accountId={account.id}
                          type="email"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {person.email ? (
                            <a href={`mailto:${person.email}`} className="text-blue-600 hover:underline">
                              {person.email}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="phone"
                          value={person.phone}
                          accountId={account.id}
                          type="tel"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">
                          {person.phone ? (
                            <a href={`tel:${person.phone}`} className="text-blue-600 hover:underline">
                              {person.phone}
                            </a>
                          ) : (
                            <span className="text-gray-400 italic">(empty)</span>
                          )}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="people"
                          recordId={person.id}
                          field="address"
                          value={person.address}
                          accountId={account.id}
                          type="textarea"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{person.address || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 text-gray-500 font-mono text-[10px]">
                      {person.id.slice(0, 8)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}

        {activeTab === 'roles' && (
          <div className="overflow-x-auto">
            {filteredRoles.length === 0 ? (
              <div className="p-[10px] text-center">
                {searchQuery.trim() ? (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600">No roles found matching "{searchQuery}"</p>
                    <button
                      onClick={() => setSearchQuery('')}
                      className="text-xs text-gray-900 font-medium hover:underline"
                    >
                      Clear search
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-gray-600">No roles found</p>
                )}
              </div>
            ) : (
            <table className="w-full text-xs border-collapse">
              <thead className="bg-gray-50 border-b-2 border-gray-300 sticky top-0">
                <tr>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Title
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Person</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">Organization</th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      Start Date
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700 border-r border-gray-200">
                    <div className="flex items-center gap-1">
                      End Date
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                  <th className="p-1.5 text-left font-semibold text-gray-700">
                    <div className="flex items-center gap-1">
                      Current
                      {isAuthenticated && <EditableFieldBadge />}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((role) => (
                  <tr key={role.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="title"
                          value={role.title}
                          accountId={account.id}
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-900 font-medium">{role.title}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {role.person_name ? (
                        <div className="flex items-center gap-2">
                          {role.person_photo_url ? (
                            <img
                              src={role.person_photo_url}
                              alt={role.person_name}
                              className="w-6 h-6 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-500 flex-shrink-0">
                              No photo
                            </div>
                          )}
                          {role.person_slug ? (
                            <Link
                              href={`/gov/person/${role.person_slug}`}
                              className="text-gray-900 hover:text-gray-700 hover:underline"
                            >
                              {role.person_name}
                            </Link>
                          ) : (
                            <span className="text-gray-900">{role.person_name}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">
                          {role.person_id ? `${role.person_id.slice(0, 8)}...` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {role.org_name ? (
                        role.org_slug ? (
                          <Link
                            href={`/gov/org/${role.org_slug}`}
                            className="text-gray-900 hover:text-gray-700 hover:underline"
                          >
                            {role.org_name}
                          </Link>
                        ) : (
                          <span className="text-gray-900">{role.org_name}</span>
                        )
                      ) : (
                        <span className="text-gray-500 font-mono text-[10px]">
                          {role.org_id ? `${role.org_id.slice(0, 8)}...` : '-'}
                        </span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="start_date"
                          value={role.start_date}
                          accountId={account.id}
                          type="date"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{role.start_date || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-gray-100">
                      {isAuthenticated && account?.id ? (
                        <InlineEditField
                          table="roles"
                          recordId={role.id}
                          field="end_date"
                          value={role.end_date}
                          accountId={account.id}
                          type="date"
                          onUpdate={handleRefresh}
                        />
                      ) : (
                        <span className="text-xs text-gray-600">{role.end_date || <span className="text-gray-400 italic">(empty)</span>}</span>
                      )}
                    </td>
                    <td className="p-1.5">
                      {isAuthenticated && account?.id ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="checkbox"
                            checked={role.is_current}
                            onChange={async (e) => {
                              const { error } = await updateCivicFieldWithLogging({
                                table: 'roles',
                                recordId: role.id,
                                field: 'is_current',
                                newValue: e.target.checked ? 'true' : 'false',
                                accountId: account.id,
                                supabase,
                              });
                              if (!error) {
                                success('Updated', `Role marked as ${e.target.checked ? 'current' : 'past'}`);
                                handleRefresh();
                              } else {
                                showError('Update failed', 'Failed to update role status');
                              }
                            }}
                            className="w-3 h-3 cursor-pointer"
                          />
                          <span className="text-[10px] text-gray-600">
                            {role.is_current ? 'Current' : 'Past'}
                          </span>
                        </div>
                      ) : (
                        role.is_current ? (
                          <span className="text-[10px] font-medium text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            Yes
                          </span>
                        ) : (
                          <span className="text-[10px] font-medium text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded">
                            No
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>

      {/* Community Info */}
      <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md p-[10px]">
        <p className="text-[10px] text-gray-600 leading-relaxed">
          <span className="font-medium text-gray-900">Community-Built Directory:</span> This data is maintained by community contributors. 
          Click on any organization or person to view detailed edit history and see who contributed to each record.
        </p>
      </div>

      {/* Sign In Prompt */}
      {!isAuthenticated && (
        <div className="mt-3 bg-gray-50 border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">
            <button
              onClick={() => appModal?.openAccount?.()}
              className="text-gray-900 font-medium hover:underline"
            >
              Sign in
            </button>
            {' '}to edit civic data
          </p>
        </div>
      )}
    </div>
  );
}

