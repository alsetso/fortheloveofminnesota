'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';

interface DynamicSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  type: 'news' | 'people';
}

export default function DynamicSearchModal({ isOpen, onClose, data, type }: DynamicSearchModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [entityData, setEntityData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchEntityData = async () => {
      if (!data || !isOpen) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const { supabase } = await import('@/lib/supabase');
        
        if (type === 'people') {
          const { data: personData, error: personError } = await (supabase as any)
            .schema('civic')
            .from('people')
            .select('*')
            .eq('id', data.id)
            .single();
          
          if (personError) throw personError;
          setEntityData(personData);
        } else if (type === 'news') {
          const { data: newsData, error: newsError } = await (supabase as any)
            .schema('news')
            .from('generated')
            .select('*')
            .eq('article_id', data.article_id || data.id)
            .single();
          
          if (newsError) throw newsError;
          setEntityData(newsData);
        }
      } catch (err: any) {
        console.error('[DynamicSearchModal] Error fetching entity:', err);
        setError(err.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    if (isOpen && data) {
      fetchEntityData();
    } else {
      setEntityData(null);
      setError(null);
    }
  }, [isOpen, data, type]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        if (modalRef.current) {
          modalRef.current.style.transform = 'translate(-50%, 0)';
        }
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    if (modalRef.current) {
      modalRef.current.style.transform = 'translate(-50%, 100%)';
    }
    setTimeout(() => {
      onClose();
    }, 300);
  };

  if (!isOpen || !mounted) return null;

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } catch {
      return dateString;
    }
  };

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/20 transition-opacity duration-300"
        onClick={handleClose}
      />
      <div
        ref={modalRef}
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[60] bg-white shadow-2xl transition-all duration-300 ease-out flex flex-col rounded-t-3xl"
        style={{
          transform: 'translate(-50%, 100%)',
          maxHeight: '80vh',
          maxWidth: '600px',
          width: 'calc(100% - 2rem)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex items-center justify-center pt-2 pb-1 flex-shrink-0">
          <div className="w-12 h-1 bg-gray-300 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900 capitalize">{type}</h2>
          <button
            onClick={handleClose}
            className="p-1 -mr-1 text-gray-500 hover:text-gray-900 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="text-xs text-red-600 p-3 bg-red-50 rounded-md border border-red-200">
              {error}
            </div>
          ) : entityData ? (
            <div className="space-y-3">
              {type === 'people' ? (
                <>
                  {entityData.image_url && (
                    <div className="w-full aspect-video relative rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      <Image
                        src={entityData.image_url}
                        alt={entityData.name || 'Person'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">
                      {entityData.name || 'Unknown'}
                    </h3>
                    {entityData.description && (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {entityData.description}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {entityData.image_url && (
                    <div className="w-full aspect-video relative rounded-md overflow-hidden bg-gray-100 border border-gray-200">
                      <Image
                        src={entityData.image_url}
                        alt={entityData.headline || entityData.title || 'News'}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {entityData.headline || entityData.title || 'No headline'}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      {entityData.source_name && (
                        <span className="font-medium">{entityData.source_name}</span>
                      )}
                      {entityData.published_at && (
                        <>
                          {entityData.source_name && <span>•</span>}
                          <span>{formatDate(entityData.published_at)}</span>
                        </>
                      )}
                    </div>
                    {entityData.snippet && (
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {entityData.snippet}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-500 text-center py-4">
              No data available
            </div>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}

