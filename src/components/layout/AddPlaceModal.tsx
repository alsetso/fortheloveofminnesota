'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon, MapPinIcon, BuildingStorefrontIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  map?: any;
}

/**
 * Modal for adding a place to the map
 * Responsive: bottom sheet on mobile, bottom-left panel on desktop (≥1280px)
 */
export default function AddPlaceModal({ isOpen, onClose, map }: AddPlaceModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [isAtMaxHeight, setIsAtMaxHeight] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [useBlurStyle, setUseBlurStyle] = useState(() => {
    return typeof window !== 'undefined' && (window as any).__useBlurStyle === true;
  });
  const [currentMapStyle, setCurrentMapStyle] = useState<'streets' | 'satellite'>(() => {
    return typeof window !== 'undefined' ? ((window as any).__currentMapStyle || 'streets') : 'streets';
  });

  // Listen for blur style and map style changes
  useEffect(() => {
    const handleBlurStyleChange = (e: CustomEvent) => {
      setUseBlurStyle(e.detail.useBlurStyle);
    };
    const handleMapStyleChange = (e: CustomEvent) => {
      setCurrentMapStyle(e.detail.mapStyle);
    };
    window.addEventListener('blur-style-change', handleBlurStyleChange as EventListener);
    window.addEventListener('map-style-change', handleMapStyleChange as EventListener);
    return () => {
      window.removeEventListener('blur-style-change', handleBlurStyleChange as EventListener);
      window.removeEventListener('map-style-change', handleMapStyleChange as EventListener);
    };
  }, []);

  // Use transparent backgrounds and white text when satellite + blur
  const useTransparentUI = useBlurStyle && currentMapStyle === 'satellite';
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: 'MN',
    zipCode: '',
    description: '',
    category: '',
    phone: '',
    website: '',
    isOwner: false,
  });

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
      
      // Trigger animation on next frame
      requestAnimationFrame(() => {
        if (modalRef.current) {
          // Both mobile and desktop slide up from bottom
          modalRef.current.style.transform = 'translateY(0)';
        }
      });
    } else {
      // Restore body scroll
      document.body.style.overflow = '';
      setIsAtMaxHeight(false);
      // Reset form when closing
      setFormData({
        name: '',
        address: '',
        city: '',
        state: 'MN',
        zipCode: '',
        description: '',
        category: '',
        phone: '',
        website: '',
        isOwner: false,
      });
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Check if content reaches max height
  useEffect(() => {
    if (!isOpen || !contentRef.current || !modalRef.current) return;

    const checkMaxHeight = () => {
      if (contentRef.current && modalRef.current) {
        const contentHeight = contentRef.current.scrollHeight;
        const maxHeight = typeof window !== 'undefined' && window.innerWidth >= 1280 ? window.innerHeight * 0.5 : window.innerHeight;
        
        // Check if content is scrollable (reached max height)
        setIsAtMaxHeight(contentHeight >= maxHeight || contentRef.current.scrollHeight > contentRef.current.clientHeight);
      }
    };

    // Check immediately and after a short delay for content to render
    checkMaxHeight();
    const timeoutId = setTimeout(checkMaxHeight, 100);

    // Use ResizeObserver to watch for content changes
    const resizeObserver = new ResizeObserver(checkMaxHeight);
    if (contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
    };
  }, [isOpen, formData]);

  const handleClose = () => {
    if (modalRef.current) {
      // Both mobile and desktop slide down to bottom
      modalRef.current.style.transform = 'translateY(100%)';
    }
    // Wait for animation to complete
    setTimeout(() => {
      onClose();
    }, 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Coming soon - feature not yet implemented
    alert('Coming soon');
    handleClose();
  };

  if (!isOpen || !mounted) return null;

  const categories = [
    'Restaurant',
    'Retail',
    'Service',
    'Entertainment',
    'Healthcare',
    'Education',
    'Other',
  ];

  const modalContent = (
    <>
      {/* Backdrop - hidden on desktop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300 xl:hidden"
        onClick={handleClose}
      />
      
      {/* Modal - positioned at bottom on mobile and desktop */}
      <div
        ref={modalRef}
        className={`fixed z-[60] shadow-2xl transition-all duration-300 ease-out flex flex-col
          /* Mobile: bottom sheet */
          bottom-0 left-0 right-0 rounded-t-3xl
          /* Desktop: bottom sheet with 500px width, left side, squared bottom corners */
          xl:bottom-0 xl:left-4 xl:right-auto xl:w-[500px] xl:rounded-t-lg xl:rounded-b-none xl:max-h-[50vh]
          ${useBlurStyle ? 'bg-transparent backdrop-blur-md' : 'bg-white'}`}
        style={{
          transform: 'translateY(100%)',
          minHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? 'auto' : '40vh',
          maxHeight: typeof window !== 'undefined' && window.innerWidth >= 1280 ? '50vh' : '80vh',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle bar - hidden on desktop */}
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0 xl:hidden">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-2 border-b flex-shrink-0 ${
          useBlurStyle ? 'border-white/20' : 'border-gray-200'
        }`}>
          <div className="flex items-center gap-2">
            <MapPinIcon className={`w-4 h-4 ${useTransparentUI ? 'text-white/80' : 'text-gray-600'}`} />
            <h2 className={`text-sm font-semibold ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>Add Place</h2>
          </div>
          <button
            onClick={handleClose}
            className={`p-1 -mr-1 transition-colors ${
              useTransparentUI 
                ? 'text-white/80 hover:text-white' 
                : 'text-gray-500 hover:text-gray-900'
            }`}
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content - Always scrollable on desktop */}
        <div ref={contentRef} className="flex-1 overflow-y-auto xl:overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            {/* Ownership Verification */}
            <div className={`border rounded-md p-3 ${
              useTransparentUI
                ? 'bg-blue-500/20 border-blue-400/30'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-start gap-2">
                <CheckCircleIcon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                  useTransparentUI ? 'text-blue-300' : 'text-blue-600'
                }`} />
                <div className="flex-1">
                  <p className={`text-xs font-medium mb-1 ${
                    useTransparentUI ? 'text-white' : 'text-blue-900'
                  }`}>
                    Ownership Required
                  </p>
                  <p className={`text-[10px] ${
                    useTransparentUI ? 'text-white/90' : 'text-blue-700'
                  }`}>
                    You must be the owner or authorized representative of this place to add it to the map.
                  </p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Business Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter business name"
                className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-900"
                required
              />
            </div>

            {/* Category */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Category *
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white focus:ring-white'
                    : 'border-gray-200 bg-white focus:ring-gray-900'
                }`}
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Address */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Street Address *
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main St"
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
                required
              />
            </div>

            {/* City, State, ZIP */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                  City *
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Minneapolis"
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                    useTransparentUI
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                      : 'border-gray-200 focus:ring-gray-900'
                  }`}
                  required
                />
              </div>
              <div>
                <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                  State *
                </label>
                <input
                  type="text"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="MN"
                  maxLength={2}
                  className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                    useTransparentUI
                      ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                      : 'border-gray-200 focus:ring-gray-900'
                  }`}
                  required
                />
              </div>
            </div>

            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                ZIP Code *
              </label>
              <input
                type="text"
                value={formData.zipCode}
                onChange={(e) => setFormData({ ...formData, zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
                placeholder="55401"
                maxLength={5}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe your business, products, or services..."
                rows={3}
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 resize-none ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
              />
            </div>

            {/* Phone */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Phone Number
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                placeholder="(612) 555-1234"
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
              />
            </div>

            {/* Website */}
            <div>
              <label className={`text-xs font-medium mb-1 block ${useTransparentUI ? 'text-white' : 'text-gray-900'}`}>
                Website
              </label>
              <input
                type="url"
                value={formData.website}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://example.com"
                className={`w-full px-2 py-1.5 text-xs border rounded-md focus:outline-none focus:ring-1 ${
                  useTransparentUI
                    ? 'bg-white/10 border-white/20 text-white placeholder:text-white/50 focus:ring-white'
                    : 'border-gray-200 focus:ring-gray-900'
                }`}
              />
            </div>

            {/* Ownership Checkbox */}
            <div className={`flex items-start gap-2 pt-2 border-t ${
              useBlurStyle ? 'border-white/20' : 'border-gray-200'
            }`}>
              <input
                type="checkbox"
                id="isOwner"
                checked={formData.isOwner}
                onChange={(e) => setFormData({ ...formData, isOwner: e.target.checked })}
                className={`mt-0.5 w-4 h-4 rounded focus:ring-1 ${
                  useTransparentUI
                    ? 'text-white border-white/30 focus:ring-white'
                    : 'text-gray-900 border-gray-300 focus:ring-gray-900'
                }`}
                required
              />
              <label htmlFor="isOwner" className={`text-xs flex-1 ${
                useTransparentUI ? 'text-white/90' : 'text-gray-700'
              }`}>
                I confirm that I am the owner or authorized representative of this place and have permission to add it to the map. *
              </label>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  useTransparentUI
                    ? 'text-white bg-white/10 border border-white/20 hover:bg-white/20'
                    : 'text-gray-700 bg-white border border-gray-200 hover:bg-gray-50'
                }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!formData.isOwner}
                className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                <BuildingStorefrontIcon className="w-3.5 h-3.5" />
                Submit Place
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );

  // Render to document body to escape parent stacking context
  return createPortal(modalContent, document.body);
}

