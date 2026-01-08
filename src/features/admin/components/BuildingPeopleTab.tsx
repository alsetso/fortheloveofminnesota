'use client';

import { useState, useEffect } from 'react';
import { UserIcon, EnvelopeIcon, PhoneIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import type { CivicPerson } from '@/features/civic/services/civicService';

interface BuildingPeopleTabProps {
  buildingId: string;
}

export default function BuildingPeopleTab({ buildingId }: BuildingPeopleTabProps) {
  const supabase = useSupabaseClient();
  const [people, setPeople] = useState<CivicPerson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPeople() {
      try {
        setLoading(true);
        setError(null);
        
        // Query civic.people directly since public.people view may not have building_id yet
        const { data, error: fetchError } = await (supabase as any)
          .schema('civic')
          .from('people')
          .select('id, name, slug, party, photo_url, district, email, phone, address, title, building_id, created_at')
          .eq('building_id', buildingId);

        if (fetchError) {
          console.error('[BuildingPeopleTab] Error fetching people:', fetchError);
          console.error('[BuildingPeopleTab] Building ID:', buildingId);
          console.error('[BuildingPeopleTab] Error details:', JSON.stringify(fetchError, null, 2));
          setError(`Failed to load people: ${fetchError.message || 'Unknown error'}`);
          return;
        }

        // Sort by district number (extract numeric part and sort)
        const sortedPeople = (data || []).sort((a: CivicPerson, b: CivicPerson) => {
          const districtA = a.district || '';
          const districtB = b.district || '';
          
          // Extract numeric part (e.g., "SD01" -> 1, "HD01A" -> 1)
          const numA = parseInt(districtA.replace(/\D/g, '')) || 0;
          const numB = parseInt(districtB.replace(/\D/g, '')) || 0;
          
          // First sort by district number
          if (numA !== numB) {
            return numA - numB;
          }
          
          // If same number, sort by suffix (A before B, or Senate before House)
          // SD comes before HD, A comes before B
          if (districtA.startsWith('SD') && districtB.startsWith('HD')) {
            return -1;
          }
          if (districtA.startsWith('HD') && districtB.startsWith('SD')) {
            return 1;
          }
          
          // Both same type, sort by suffix
          const suffixA = districtA.slice(-1);
          const suffixB = districtB.slice(-1);
          if (suffixA === 'A' && suffixB === 'B') return -1;
          if (suffixA === 'B' && suffixB === 'A') return 1;
          
          // Fallback to string comparison
          return districtA.localeCompare(districtB);
        });

        setPeople(sortedPeople as CivicPerson[]);
      } catch (err) {
        console.error('[BuildingPeopleTab] Unexpected error:', err);
        setError('An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    }

    if (buildingId && buildingId.trim() !== '') {
      fetchPeople();
    } else {
      setLoading(false);
      setError('Invalid building ID');
    }
  }, [buildingId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  if (people.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-xs text-gray-500">No people found for this building</p>
      </div>
    );
  }

  // Calculate stats
  const total = people.length;
  const dflCount = people.filter(p => p.party === 'DFL').length;
  const rCount = people.filter(p => p.party === 'R').length;
  const dflPercent = total > 0 ? Math.round((dflCount / total) * 100) : 0;
  const rPercent = total > 0 ? Math.round((rCount / total) * 100) : 0;
  const otherCount = total - dflCount - rCount;

  return (
    <div className="space-y-3">
      {/* Stats Container */}
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <div className="space-y-2">
          {/* Description */}
          <p className="text-xs text-gray-600">
            {total} {total === 1 ? 'person' : 'people'} connected to this building
          </p>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {/* Total */}
            <div className="text-center">
              <div className="text-sm font-semibold text-gray-900">{total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            
            {/* DFL */}
            <div className="text-center">
              <div className="text-sm font-semibold text-blue-700">{dflCount}</div>
              <div className="text-xs text-gray-500">DFL ({dflPercent}%)</div>
            </div>
            
            {/* R */}
            <div className="text-center">
              <div className="text-sm font-semibold text-red-700">{rCount}</div>
              <div className="text-xs text-gray-500">R ({rPercent}%)</div>
            </div>
          </div>
        </div>
      </div>
      {people.map((person) => (
        <div
          key={person.id}
          className="bg-white border border-gray-200 rounded-md p-[10px] hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-2">
            {/* Avatar/Icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              {person.photo_url ? (
                <img
                  src={person.photo_url}
                  alt={person.name}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-gray-500" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1.5">
              {/* Name and Title */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 truncate">
                  {person.name}
                </h3>
                {person.title && (
                  <p className="text-xs text-gray-500 mt-0.5">{person.title}</p>
                )}
              </div>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600">
                {person.district && (
                  <div className="flex items-center gap-1">
                    <MapPinIcon className="w-3 h-3" />
                    <span>{person.district}</span>
                  </div>
                )}
                {person.party && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      person.party === 'R'
                        ? 'bg-red-100 text-red-700'
                        : person.party === 'DFL'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {person.party}
                  </span>
                )}
              </div>

              {/* Contact Info */}
              <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                {person.email && (
                  <a
                    href={`mailto:${person.email}`}
                    className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                  >
                    <EnvelopeIcon className="w-3 h-3" />
                    <span className="truncate">{person.email}</span>
                  </a>
                )}
                {person.phone && (
                  <a
                    href={`tel:${person.phone}`}
                    className="flex items-center gap-1 hover:text-gray-900 transition-colors"
                  >
                    <PhoneIcon className="w-3 h-3" />
                    <span>{person.phone}</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

