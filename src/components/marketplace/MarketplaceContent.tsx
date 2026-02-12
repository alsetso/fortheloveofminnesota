'use client';

import { useSearchParams } from 'next/navigation';
import { PhotoIcon, MapPinIcon } from '@heroicons/react/24/outline';
import ProfilePhoto from '@/components/shared/ProfilePhoto';

interface Listing {
  id: string;
  title: string;
  price: string;
  location: string;
  image?: string;
  isJustListed?: boolean;
  details?: string;
  category?: string;
  section?: string;
  postedBy?: {
    name: string;
    avatar?: string;
  };
  postedTime?: string;
}

/**
 * Marketplace Content - Product listings grid
 * Responds to URL parameters for section and category filtering
 */
export default function MarketplaceContent() {
  const searchParams = useSearchParams();
  const section = searchParams.get('section') || 'all';
  const category = searchParams.get('category');
  // Mock listings with categories
  const allListings: Listing[] = [
    { id: '1', title: 'Ice bath with chiller', price: '$350', location: 'Anoka, MN', category: 'family', isJustListed: false },
    { id: '2', title: 'Framing/decks', price: '$500', location: 'Ramsey, MN', category: 'classifieds', isJustListed: false },
    { id: '3', title: 'Carhartt pants', price: '$25', location: 'Minneapolis, MN', category: 'apparel', isJustListed: true },
    { id: '4', title: '4 Beds 2 Baths - House', price: '$1,200', location: 'St. Paul, MN', category: 'property', details: '4 Beds 2 Baths', isJustListed: false },
    { id: '5', title: 'Dewalt', price: '$150', location: 'Duluth, MN', category: 'electronics', isJustListed: false },
    { id: '6', title: '2010 Honda accord EX-L Coupe 2D', price: '$8,500', location: 'Bloomington, MN', category: 'vehicles', details: '95K miles', isJustListed: true },
    { id: '7', title: 'Cervical Bone Growth Stimulator', price: '$200', location: 'Rochester, MN', category: 'family', isJustListed: false },
    { id: '8', title: 'Free bookshelf', price: 'Free', location: 'Edina, MN', category: 'classifieds', isJustListed: true },
    { id: '9', title: 'Lab Grown Diamond Ring', price: '$1,200', location: 'Plymouth, MN', category: 'family', isJustListed: true },
    { id: '10', title: 'Chocolate covered strawberries', price: '$15', location: 'Maple Grove, MN', category: 'family', isJustListed: false },
    { id: '11', title: 'Paint supplies', price: '$30', location: 'Woodbury, MN', category: 'classifieds', isJustListed: false },
    { id: '12', title: 'Silver minivan', price: '$12,000', location: 'Eagan, MN', category: 'vehicles', details: '120K miles', isJustListed: false },
  ];

  // Filter listings based on URL parameters
  let listings = allListings;
  
  if (category) {
    listings = listings.filter(listing => listing.category === category);
  }
  
  // Section filtering (for future use)
  if (section !== 'all') {
    // Apply section-specific filtering logic here
    // e.g., section === 'buying' shows only items user is interested in
    // section === 'selling' shows only user's listings
  }

  const getSectionTitle = () => {
    if (category) {
      const categoryLabels: Record<string, string> = {
        vehicles: 'Vehicles',
        property: 'Property Rentals',
        apparel: 'Apparel',
        classifieds: 'Classifieds',
        electronics: 'Electronics',
        entertainment: 'Entertainment',
        family: 'Family',
      };
      return categoryLabels[category] || 'Listings';
    }
    if (section === 'jobs') return "Jobs";
    if (section === 'buying') return "Items You're Buying";
    if (section === 'selling') return "Your Listings";
    return "Today's picks";
  };

  return (
    <div className="max-w-[1200px] mx-auto w-full px-4 py-6">
      {/* New for You Section */}
      <div className="bg-surface border border-white/10 rounded-md p-4 mb-6">
        <div className="flex items-start justify-between mb-3">
          <h2 className="text-base font-semibold text-white">New for you</h2>
          <div className="text-xs text-white/60">Anoka · 5 mi</div>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-surface-accent flex items-center justify-center border border-white/10">
            <PhotoIcon className="w-4 h-4 text-white/60" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/90">
              Browse more <span className="font-medium text-white">Household</span> listings in your area.
            </p>
            <p className="text-xs text-white/60 mt-0.5">20h</p>
          </div>
        </div>
      </div>

      {/* Section Title */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-white mb-4">{getSectionTitle()}</h2>
        {(category || section !== 'all') && (
          <p className="text-sm text-white/60 mb-4">
            {listings.length} {listings.length === 1 ? 'listing' : 'listings'} found
          </p>
        )}
      </div>

      {/* Listings Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {listings.map((listing) => (
          <div
            key={listing.id}
            className="bg-surface border border-white/10 rounded-md overflow-hidden cursor-pointer hover:border-white/20 transition-colors group"
          >
            {/* Image */}
            <div className="relative aspect-square bg-surface-accent flex items-center justify-center border-b border-white/10">
              <PhotoIcon className="w-16 h-16 text-white/20 group-hover:text-white/30 transition-colors" />
              {listing.isJustListed && (
                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-sm rounded-full">
                  <span className="text-xs font-medium text-white">Just listed</span>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-3">
              {/* Price */}
              <div className="text-base font-bold text-white mb-1 truncate">
                {listing.price}
              </div>

              {/* Title */}
              <h3 className="text-sm text-white/90 mb-1 line-clamp-2 min-h-[2.5rem]">
                {listing.title}
              </h3>

              {/* Details */}
              {listing.details && (
                <p className="text-xs text-white/60 mb-1 truncate">
                  {listing.details}
                </p>
              )}

              {/* Location */}
              <div className="flex items-center gap-1.5 text-xs text-white/60 mt-2">
                <MapPinIcon className="w-3 h-3" />
                <span className="truncate">{listing.location}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center mt-8">
        <button className="px-6 py-2.5 bg-surface-accent border border-white/10 text-white rounded-md hover:bg-surface-accent/80 transition-colors text-sm font-medium">
          Load more listings
        </button>
      </div>
    </div>
  );
}
