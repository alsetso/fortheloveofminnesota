'use client';

import { useState, useRef, useEffect } from 'react';
import { XMarkIcon, EllipsisVerticalIcon, PencilIcon, TrashIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import BuildingPeopleTab from './BuildingPeopleTab';
import BuildingTransparencyTab from './BuildingTransparencyTab';

type Tab = 'overview' | 'people' | 'transparency';

interface Building {
  id: string;
  type: 'state' | 'city' | 'town' | 'federal';
  name: string;
  description: string | null;
  lat: number | null;
  lng: number | null;
  full_address: string | null;
  cover_images: string[] | null;
  website: string | null;
  created_at: string;
  updated_at: string;
}

interface BuildingDetailViewProps {
  building: Building;
  onClose: () => void;
  onEdit?: (building: Building) => void;
  onDelete?: (building: Building) => void;
}

export default function BuildingDetailView({
  building,
  onClose,
  onEdit,
  onDelete,
}: BuildingDetailViewProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const menuRef = useRef<HTMLDivElement>(null);
  
  const coverImages = building.cover_images || [];
  const hasMultipleImages = coverImages.length > 1;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const handleEdit = () => {
    setShowMenu(false);
    if (onEdit) {
      onEdit(building);
    }
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (onDelete) {
      onDelete(building);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
      />
      
      {/* Content Container */}
      <div className="relative w-full max-w-[800px] h-full bg-white flex flex-col pointer-events-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 flex-shrink-0 z-10 bg-white gap-3">
          {/* Logo - Far Left */}
          <div className="flex-shrink-0">
            <Image
              src="/logo.png"
              alt="Logo"
              width={35}
              height={35}
              className="object-contain"
              priority
            />
          </div>
          
          {/* Building Name - Centered */}
          <h1 className="flex-1 text-sm font-semibold text-gray-900 text-center truncate max-w-[200px] sm:max-w-none">
            {building.name}
          </h1>
          
          {/* Three dots menu and Close button - Right side */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {(onEdit || onDelete) && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
                  aria-label="Menu"
                >
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                    {onEdit && (
                      <button
                        onClick={handleEdit}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors first:rounded-t-md"
                      >
                        <PencilIcon className="w-4 h-4" />
                        Edit
                      </button>
                    )}
                    {onDelete && (
                      <button
                        onClick={handleDelete}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors last:rounded-b-md"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-900 transition-colors"
              aria-label="Close"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-6">
              {/* Cover Images - At Top (shown in all tabs) */}
              {coverImages.length > 0 && (
                <div className="mb-6">
                  {/* Main Selected Image */}
                  <div className="relative w-full mb-3">
                    <Image
                      src={coverImages[selectedImageIndex]}
                      alt={`${building.name} image ${selectedImageIndex + 1}`}
                      width={800}
                      height={400}
                      className="w-full h-auto rounded-md object-cover"
                      unoptimized={coverImages[selectedImageIndex].includes('supabase.co')}
                    />
                  </div>

                  {/* Thumbnail Cards - Horizontal List (only if multiple images) */}
                  {hasMultipleImages && (
                    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                      {coverImages.map((imageUrl, index) => (
                        <button
                          key={index}
                          onClick={() => setSelectedImageIndex(index)}
                          className={`flex-shrink-0 relative w-20 h-20 rounded-md overflow-hidden border-2 transition-colors ${
                            selectedImageIndex === index
                              ? 'border-gray-900'
                              : 'border-gray-200 hover:border-gray-400'
                          }`}
                          aria-label={`Select image ${index + 1}`}
                        >
                          <Image
                            src={imageUrl}
                            alt={`${building.name} thumbnail ${index + 1}`}
                            fill
                            className="object-cover"
                            unoptimized={imageUrl.includes('supabase.co')}
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tabs Navigation - Below Images */}
              <div className="flex-shrink-0 border-b border-gray-200 mb-6 -mx-4 px-4">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'overview'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('people')}
                    className={`py-3 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'people'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    People
                  </button>
                  <button
                    onClick={() => setActiveTab('transparency')}
                    className={`flex items-center gap-1.5 py-3 text-xs font-medium border-b-2 transition-colors ${
                      activeTab === 'transparency'
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <CurrencyDollarIcon className="w-3 h-3 text-green-600" />
                    Transparency
                  </button>
                </div>
              </div>

              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                    {/* Name - Large Heading */}
                    <div>
                      <h1 className="text-2xl font-semibold text-gray-900">
                        {building.name}
                      </h1>
                    </div>

                    {/* Type - Label */}
                    <div>
                      <span className="inline-block px-2 py-0.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md capitalize">
                        {building.type}
                      </span>
                    </div>

                    {/* Description */}
                    {building.description && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Description
                        </span>
                        <p className="text-sm text-gray-900 mt-1">
                          {building.description}
                        </p>
                      </div>
                    )}

                    {/* Address */}
                    {building.full_address && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Address
                        </span>
                        <p className="text-sm text-gray-900 mt-1">
                          {building.full_address}
                        </p>
                      </div>
                    )}

                    {/* Website */}
                    {building.website && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Website
                        </span>
                        <p className="text-sm text-gray-900 mt-1">
                          <a
                            href={building.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 underline"
                          >
                            {building.website}
                          </a>
                        </p>
                      </div>
                    )}

                    {/* Coordinates */}
                    {(building.lat !== null && building.lng !== null) && (
                      <div>
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          Coordinates
                        </span>
                        <p className="text-sm text-gray-900 mt-1 font-mono">
                          {building.lat.toFixed(6)}, {building.lng.toFixed(6)}
                        </p>
                      </div>
                    )}
                </div>
              )}

              {/* People Tab */}
              {activeTab === 'people' && (
                <BuildingPeopleTab buildingId={building.id} />
              )}

              {/* Transparency Tab */}
              {activeTab === 'transparency' && (
                <BuildingTransparencyTab />
              )}
            </div>
          </div>
        </div>

        {/* Footer - Call to Action */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-gray-200 bg-white z-10">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Text */}
            <p className="text-xs text-gray-900 flex-shrink-0">
              Start making a real difference For the Love of Minnesota
            </p>
            
            {/* Right: Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  // TODO: Handle Citizen action
                  console.log('Citizen clicked');
                }}
                className="px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"
              >
                Citizen
              </button>
              <button
                onClick={() => {
                  // TODO: Handle Official action
                  console.log('Official clicked');
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors"
              >
                Official
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
