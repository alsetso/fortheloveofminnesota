import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import {
  HeartIcon,
  BuildingLibraryIcon,
  MapPinIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  MapIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'For the Love of Minnesota',
  description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
  keywords: 'Minnesota, Minnesota residents, Minnesota neighbors, Minnesota community, Minnesota locations, Minnesota cities, Minnesota counties, archive Minnesota, Minnesota memories, Minnesota stories',
  openGraph: {
    title: 'For the Love of Minnesota',
    description: "For the Love of Minnesota connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.",
    url: 'https://fortheloveofminnesota.com',
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/logo.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
};

export default function Home() {
  return (
    <SimplePageLayout containerMaxWidth="7xl" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <div className="max-w-4xl mx-auto">
        <div className="space-y-6">
        {/* V4: Community-Focused Hero with Large Desktop Heading */}
        <section className="space-y-3 text-center py-8">
          <h1 className="text-sm md:text-3xl font-semibold text-gray-900 leading-tight">For the Love of 5,793,151 People in Minnesota</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            A living map of Minnesota–pin whats happening, what matters and what should be remembered.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2 border-t border-gray-100">
            <Link
              href="/map"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors border border-red-700"
            >
              <MapIcon className="w-3 h-3" />
              <span>Live Map</span>
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-50 rounded hover:bg-gray-100 hover:text-gray-900 transition-colors border border-gray-200"
            >
              <GlobeAltIcon className="w-3 h-3" />
              <span>Explore Minnesotas</span>
              <ArrowRightIcon className="w-3 h-3" />
            </Link>
          </div>
        </section>

        {/* Archive Mentions Section */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Archive Your Minnesota Story</h2>
          <p className="text-xs text-gray-600">
            Drop pins on the map to archive special places, memories, and moments across Minnesota. Each mention becomes part of your personal collection and the community archive.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 pt-1">
            <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
              <div className="flex items-start gap-2">
                <MapPinIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-medium text-gray-900">Create Mentions</p>
                  <p className="text-xs text-gray-600">
                    Click anywhere on the Minnesota map to drop a pin. Add descriptions, photos, dates, and choose visibility.
                  </p>
                  <Link href="/map" className="inline-flex items-center gap-1 text-xs font-medium text-gray-900 hover:underline mt-1">
                    <span>Start archiving</span>
                    <ArrowRightIcon className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
              <div className="flex items-start gap-2">
                <HeartIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-medium text-gray-900">Organize Collections</p>
                  <p className="text-xs text-gray-600">
                    Group your mentions into themed collections. Build unique sets that tell your Minnesota story.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-2">
              <div className="flex items-start gap-2">
                <BuildingLibraryIcon className="w-4 h-4 text-gray-700 flex-shrink-0 mt-0.5" />
                <div className="space-y-0.5 flex-1">
                  <p className="text-xs font-medium text-gray-900">Contribute to the Archive</p>
                  <p className="text-xs text-gray-600">
                    Every mention adds to Minnesota's collective memory. Public pins help others discover and connect with places across the state.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Atlas Legend */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900">Map Legend</h2>
          <p className="text-xs text-gray-600">
            Explore Minnesota's geography with our interactive atlas layers. <Link href="/map" className="text-gray-900 font-medium hover:underline">View on map</Link>
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Link href="/explore/atlas/cities" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/city.png" alt="City" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Cities</span>
            </Link>
            <Link href="/explore/atlas/neighborhoods" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/neighborhood.png" alt="Neighborhood" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Neighborhoods</span>
            </Link>
            <Link href="/explore/atlas/parks" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/park_like.png" alt="Park" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Parks</span>
            </Link>
            <Link href="/explore/atlas/schools" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/education.png" alt="School" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Schools</span>
            </Link>
            <Link href="/explore/atlas/lakes" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/lakes.png" alt="Lake" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Lakes</span>
            </Link>
            <Link href="/explore/atlas/churches" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/churches.png" alt="Church" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Churches</span>
            </Link>
            <Link href="/explore/atlas/hospitals" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/hospital.png" alt="Hospital" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Hospitals</span>
            </Link>
            <Link href="/explore/atlas/golf_courses" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/golf courses.png" alt="Golf Course" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Golf Courses</span>
            </Link>
            <Link href="/explore/atlas/municipals" className="flex items-center gap-1.5 transition-colors group">
              <Image src="/municiples.png" alt="Municipal" width={16} height={16} className="w-4 h-4 flex-shrink-0" unoptimized />
              <span className="text-xs text-gray-600 group-hover:text-gray-900">Municipals</span>
            </Link>
          </div>
        </section>

        {/* Pro/Business Section */}
        <section className="bg-gray-900 border border-gray-800 rounded-md p-[10px] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">For Professionals & Businesses</h2>
            <span className="text-xs font-medium text-gray-300">$20/mo</span>
          </div>
          <p className="text-xs text-gray-400">
            Pro accounts unlock powerful tools for Minnesota professionals, real estate agents, developers, and businesses.
          </p>
          <Link href="/contact" className="inline-flex items-center gap-1 text-xs font-medium text-white hover:text-gray-200 transition-colors">
            <span>Learn More</span>
            <ArrowRightIcon className="w-3 h-3" />
          </Link>
        </section>
        </div>
      </div>
    </SimplePageLayout>
  );
}
