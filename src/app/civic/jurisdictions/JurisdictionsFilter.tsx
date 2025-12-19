'use client';

import { useRouter, useSearchParams } from 'next/navigation';

interface JurisdictionsFilterProps {
  types: string[];
  counts: Record<string, number>;
}

export default function JurisdictionsFilter({ types, counts }: JurisdictionsFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Get currently selected types from URL
  const selectedTypes = searchParams.get('type')?.split(',').filter(Boolean) || [];
  const showAll = selectedTypes.length === 0;

  const toggleType = (type: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (selectedTypes.includes(type)) {
      // Remove type
      const newTypes = selectedTypes.filter(t => t !== type);
      if (newTypes.length === 0) {
        params.delete('type');
      } else {
        params.set('type', newTypes.join(','));
      }
    } else {
      // Add type
      const newTypes = [...selectedTypes, type];
      params.set('type', newTypes.join(','));
    }
    
    router.push(`/civic/jurisdictions?${params.toString()}`, { scroll: false });
  };

  const showAllTypes = () => {
    router.push('/civic/jurisdictions', { scroll: false });
  };

  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      <button
        onClick={showAllTypes}
        className={`px-2 py-1 text-xs rounded-md border transition-colors ${
          showAll
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        }`}
      >
        All
      </button>
      {types.map((type) => {
        const isSelected = selectedTypes.includes(type);
        const count = counts[type] || 0;
        
        return (
          <button
            key={type}
            onClick={() => toggleType(type)}
            className={`px-2 py-1 text-xs rounded-md border transition-colors ${
              isSelected
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {type} ({count})
          </button>
        );
      })}
    </div>
  );
}

