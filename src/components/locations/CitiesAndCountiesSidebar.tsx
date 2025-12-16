import Link from 'next/link';

interface City {
  id: string;
  name: string;
  slug: string;
  population: string;
  county: string;
}

interface County {
  id: string;
  name: string;
  slug: string;
  population: string;
  area: string;
}

interface CitiesAndCountiesSidebarProps {
  cities: City[];
  counties: County[];
}

export default function CitiesAndCountiesSidebar({ cities, counties }: CitiesAndCountiesSidebarProps) {
  const displayCount = 5;
  const displayedCities = cities.slice(0, displayCount);
  const displayedCounties = counties.slice(0, displayCount);

  return (
    <div className="text-xs text-gray-600 space-y-3">
      <div>
        <div className="text-xs font-semibold text-gray-900 mb-1.5">Cities</div>
        <div className="space-y-0.5">
          {displayedCities.map((city) => (
            <div key={city.id}>
              <Link
                href={`/explore/city/${city.slug}`}
                className="text-gray-700 underline hover:text-gray-900 transition-colors"
              >
                {city.name}
              </Link>
              {city.population && (
                <span className="text-gray-500 ml-1">({city.population})</span>
              )}
            </div>
          ))}
        </div>
        {cities.length > displayCount && (
          <div className="mt-1.5">
            <Link
              href="/explore/cities"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              View all {cities.length} cities
            </Link>
          </div>
        )}
      </div>

      <div>
        <div className="text-xs font-semibold text-gray-900 mb-1.5">Counties</div>
        <div className="space-y-0.5">
          {displayedCounties.map((county) => (
            <div key={county.id}>
              <Link
                href={`/explore/county/${county.slug}`}
                className="text-gray-700 underline hover:text-gray-900 transition-colors"
              >
                {county.name}
              </Link>
              {county.population && (
                <span className="text-gray-500 ml-1">({county.population})</span>
              )}
            </div>
          ))}
        </div>
        {counties.length > displayCount && (
          <div className="mt-1.5">
            <Link
              href="/explore/counties"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              View all {counties.length} counties
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
