'use client';

import { BuildingOfficeIcon, MapPinIcon, ChartBarIcon } from '@heroicons/react/24/outline';
import { ModalNav } from '@/components/ui/ModalNav';

interface AboutMnUDAModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutMnUDAModal({ isOpen, onClose }: AboutMnUDAModalProps) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center pointer-events-none p-4">
        <div
          className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full pointer-events-auto animate-in fade-in slide-in-from-bottom-2 duration-200 max-h-[90vh] overflow-y-auto flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <ModalNav title="About" onClose={onClose} />
          
          <div className="p-6 space-y-6">
            {/* Main Description */}
            <div>
              <p className="text-gray-700 leading-relaxed text-lg mb-4">
                <strong className="text-gray-900">For the Love of Minnesota</strong> connects residents, neighbors, and professionals across the state. Drop a pin to archive a special part of your life in Minnesota.
              </p>
              <p className="text-gray-600 leading-relaxed">
                Share your Minnesota story and connect with others who love this state as much as you do.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="w-6 h-6 text-gold-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Drop Pins</h3>
                  <p className="text-sm text-gray-600">
                    Archive special places and moments that matter to you across Minnesota.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MapPinIcon className="w-6 h-6 text-gold-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Statewide Coverage</h3>
                  <p className="text-sm text-gray-600">
                    Connect with residents, neighbors, and professionals across all Minnesota cities and counties.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Connect</h3>
                  <p className="text-sm text-gray-600">
                    Share your Minnesota story and connect with others who love this state.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gold-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6 text-gold-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Archive Memories</h3>
                  <p className="text-sm text-gray-600">
                    Preserve and share the special moments that make Minnesota home.
                  </p>
                </div>
              </div>
            </div>

            {/* Call to Action */}
            <div className="pt-4 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Start archiving your special Minnesota moments today.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

