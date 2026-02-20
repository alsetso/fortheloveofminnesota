'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import Link from 'next/link';

interface PersonRecord {
  id: string;
  name: string;
  slug: string | null;
  party: string | null;
  photo_url: string | null;
  district: string | null;
  roles?: string[];
}

// Extract numeric district number for sorting (moved outside component for performance)
const extractDistrictNumber = (district: string | null): number => {
  if (!district) return 999999;
  const match = district.match(/\d+/);
  if (match) {
    return parseInt(match[0], 10);
  }
  return 999999;
};

// Extract suffix for secondary sorting (moved outside component for performance)
const extractDistrictSuffix = (district: string | null): string => {
  if (!district) return '';
  const match = district.match(/\d+([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
};

// Sort by district number (ascending), then by suffix, then by name
const sortByDistrict = (a: PersonRecord, b: PersonRecord) => {
  const numA = extractDistrictNumber(a.district);
  const numB = extractDistrictNumber(b.district);
  
  if (numA !== numB) {
    return numA - numB;
  }
  
  const suffixA = extractDistrictSuffix(a.district);
  const suffixB = extractDistrictSuffix(b.district);
  if (suffixA !== suffixB) {
    return suffixA.localeCompare(suffixB);
  }
  
  return a.name.localeCompare(b.name);
};

export default function PeoplePageClient() {
  const supabase = useSupabaseClient();
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const CACHE_KEY = 'gov_people_cache';
    const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

    const loadData = async () => {
      // Check cache first
      try {
        const cached = sessionStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_DURATION) {
            setPeople(data);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Cache read failed, continue with fetch
      }

      setLoading(true);
      try {
        const { data: peopleData, error: peopleError } = await supabase
          .from('people')
          .select('id, name, slug, party, photo_url, district, created_at');
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

        // Cache the result
        try {
          sessionStorage.setItem(CACHE_KEY, JSON.stringify({
            data: peopleWithRoles,
            timestamp: Date.now(),
          }));
        } catch (err) {
          // Cache write failed, continue
        }

        setPeople(peopleWithRoles);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [supabase]);

  // Separate people into governor, DFL, and Republican (optimized single pass)
  const { governor, dflPeople, republicanPeople } = useMemo(() => {
    let governorPerson: PersonRecord | null = null;
    const dfl: PersonRecord[] = [];
    const republican: PersonRecord[] = [];

    // Single pass through people array
    for (const person of people) {
      const isGovernor = person.roles?.some(role => role.toLowerCase().includes('governor'));
      
      if (isGovernor) {
        governorPerson = person;
      } else if (person.party === 'DFL') {
        dfl.push(person);
      } else if (person.party === 'Republican' || person.party === 'R') {
        republican.push(person);
      }
    }

    return {
      governor: governorPerson,
      dflPeople: dfl.sort(sortByDistrict),
      republicanPeople: republican.sort(sortByDistrict),
    };
  }, [people]);

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  // PersonCard component (moved outside render for performance)
  const PersonCard = ({ person }: { person: PersonRecord }) => (
    <Link
      href={person.slug ? `/gov/executive/person/${person.slug}` : '#'}
      className="block border border-gray-200 rounded-md bg-white p-[10px] hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start gap-2">
        {person.photo_url ? (
          <img 
            src={person.photo_url} 
            alt={person.name} 
            className="w-10 h-10 rounded object-cover flex-shrink-0"
            loading="lazy"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-gray-200 flex items-center justify-center text-[8px] text-gray-500 flex-shrink-0">
            No photo
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-gray-900 truncate">{person.name}</p>
          {person.district && (
            <p className="text-[10px] text-gray-600 mt-0.5">District {person.district}</p>
          )}
          {person.roles && person.roles.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {person.roles.slice(0, 2).map((role, index) => (
                <span
                  key={index}
                  className="text-[10px] font-medium text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded"
                >
                  {role}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Link>
  );

  return (
    <div className="space-y-3">
      {/* Governor at top */}
      {governor && (
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <h2 className="text-xs font-semibold text-gray-700 mb-2">Governor</h2>
          <PersonCard person={governor} />
        </div>
      )}

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* DFL Column - Blue */}
        <div className="bg-blue-50 border border-blue-200 rounded-md p-[10px]">
          <h2 className="text-xs font-semibold text-blue-900 mb-2">
            DFL ({dflPeople.length})
          </h2>
          <div className="space-y-2">
            {dflPeople.length === 0 ? (
              <p className="text-xs text-gray-600">No DFL representatives</p>
            ) : (
              dflPeople.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))
            )}
          </div>
        </div>

        {/* Republican Column - Red */}
        <div className="bg-red-50 border border-red-200 rounded-md p-[10px]">
          <h2 className="text-xs font-semibold text-red-900 mb-2">
            Republican ({republicanPeople.length})
          </h2>
          <div className="space-y-2">
            {republicanPeople.length === 0 ? (
              <p className="text-xs text-gray-600">No Republican representatives</p>
            ) : (
              republicanPeople.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
