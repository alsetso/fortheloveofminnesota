'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';

interface Pin {
  id: string;
  map_id: string;
  geometry: any;
  image_url?: string | null;
  video_url?: string | null;
  icon_url?: string | null;
  caption?: string | null;
  body?: string | null;
  author_account_id: string;
  media_type?: string | null;
}

interface PinsMediaMigrationDebugProps {
  schema: string;
  table: string;
}

export default function PinsMediaMigrationDebug({ schema, table }: PinsMediaMigrationDebugProps) {
  const supabase = useSupabaseClient();
  const [pins, setPins] = useState<Pin[]>([]);
  const [selectedPin, setSelectedPin] = useState<Pin | null>(null);
  const [loading, setLoading] = useState(true);
  const [migratingPinId, setMigratingPinId] = useState<string | null>(null);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [migratedPinData, setMigratedPinData] = useState<{ pinId: string; oldUrls: Record<string, string>; newUrls: Record<string, string> } | null>(null);

  const fetchPins = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/database/maps/pins?limit=50');
      if (!response.ok) throw new Error('Failed to fetch pins');
      
      const result = await response.json();
      setPins(result.data || []);
    } catch (err) {
      console.error('Error fetching pins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (schema === 'maps' && table === 'pins') {
      fetchPins();
    }
  }, [schema, table, fetchPins]);

  const migratePinMedia = async (pinId: string) => {
    setMigratingPinId(pinId);
    setMigrationStatus('Starting migration...');
    
    // Find the pin being migrated
    const pinToMigrate = pins.find(p => p.id === pinId) || selectedPin;
    
    try {
      // Store old URLs BEFORE migration
      const oldUrls: Record<string, string> = {};
      if (pinToMigrate) {
        if (pinToMigrate.image_url) oldUrls.image_url = pinToMigrate.image_url;
        if (pinToMigrate.video_url) oldUrls.video_url = pinToMigrate.video_url;
        if (pinToMigrate.icon_url) oldUrls.icon_url = pinToMigrate.icon_url;
      }
      
      const response = await fetch(`/api/admin/migrate-pin-media/${pinId}`, {
        method: 'POST',
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Migration failed');
      }
      
      setMigrationStatus(`✅ Migrated: ${result.migrated_files} file(s)`);
      
      // Refresh pins to get updated URLs
      await fetchPins();
      
      // Get new URLs from updated pin or result
      const newUrls: Record<string, string> = {};
      const updatedPin = pins.find(p => p.id === pinId);
      if (updatedPin) {
        if (result.updates?.image_url) newUrls.image_url = result.updates.image_url;
        else if (updatedPin.image_url && isNewBucket(updatedPin.image_url)) newUrls.image_url = updatedPin.image_url;
        
        if (result.updates?.video_url) newUrls.video_url = result.updates.video_url;
        else if (updatedPin.video_url && isNewBucket(updatedPin.video_url)) newUrls.video_url = updatedPin.video_url;
        
        if (result.updates?.icon_url) newUrls.icon_url = result.updates.icon_url;
        else if (updatedPin.icon_url && isNewBucket(updatedPin.icon_url)) newUrls.icon_url = updatedPin.icon_url;
        
        // Update selected pin if it's the one we migrated
        if (selectedPin?.id === pinId) {
          setSelectedPin(updatedPin);
        }
      }
      
      // Store comparison data (persists until pin is deselected or component unmounts)
      setMigratedPinData({ pinId, oldUrls, newUrls });
      
    } catch (err) {
      setMigrationStatus(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setMigratingPinId(null);
      setTimeout(() => setMigrationStatus(''), 5000);
    }
  };

  if (schema !== 'maps' || table !== 'pins') {
    return null;
  }

  const legacyCount = pins.filter(p => 
    (p.image_url?.includes('map-pins-media') || 
     p.image_url?.includes('mentions-media') || 
     p.video_url?.includes('map-pins-media') ||
     p.video_url?.includes('mentions-media') ||
     p.icon_url?.includes('map-pins-media') ||
     p.icon_url?.includes('mentions-media'))
  ).length;

  const getBucketName = (url: string | null | undefined): string => {
    if (!url) return 'none';
    const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)/);
    return match ? match[1] : 'unknown';
  };

  const isNewBucket = (url: string | null | undefined): boolean => {
    return url?.includes('pins-media') || false;
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-border-muted flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white">
            Media Debug ({pins.length} pins)
          </span>
          {migrationStatus && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-surface-accent text-white">
              {migrationStatus}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground-muted">
            Legacy: {legacyCount}
          </span>
          <button
            onClick={fetchPins}
            className="px-1.5 py-0.5 text-xs font-medium text-foreground-muted hover:text-foreground border border-border-muted rounded"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-foreground-muted">Loading pins...</div>
          </div>
        ) : pins.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-foreground-muted">No pins found</div>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {pins.map((pin) => {
              const coords = pin.geometry?.coordinates || [0, 0];
              const hasLegacyMedia = 
                pin.image_url?.includes('map-pins-media') || 
                pin.image_url?.includes('mentions-media') ||
                pin.video_url?.includes('map-pins-media') ||
                pin.video_url?.includes('mentions-media') ||
                pin.icon_url?.includes('map-pins-media') ||
                pin.icon_url?.includes('mentions-media');

              return (
                <div
                  key={pin.id}
                  onClick={() => setSelectedPin(pin)}
                  className={`p-2 rounded border cursor-pointer transition-colors ${
                    selectedPin?.id === pin.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-border-muted hover:bg-surface-accent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-white mb-1">
                        Pin {pin.id.slice(0, 8)}...
                      </div>
                      <div className="text-[10px] text-foreground-muted mb-1.5">
                        {coords[1]?.toFixed(4)}, {coords[0]?.toFixed(4)}
                      </div>
                      
                      {/* Media Thumbnails Grid */}
                      <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                        {pin.image_url && (
                          <div className="relative">
                            <img 
                              src={pin.image_url} 
                              alt="Image"
                              className="w-full h-16 object-cover rounded border border-gray-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white px-0.5 py-0.5 text-center truncate">
                              {isNewBucket(pin.image_url) ? '✅ pins-media' : `⚠️ ${getBucketName(pin.image_url)}`}
                            </div>
                          </div>
                        )}
                        {pin.video_url && (
                          <div className="relative">
                            <video 
                              src={pin.video_url}
                              className="w-full h-16 object-cover rounded border border-gray-300"
                              muted
                              onError={(e) => {
                                (e.target as HTMLVideoElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white px-0.5 py-0.5 text-center truncate">
                              {isNewBucket(pin.video_url) ? '✅ pins-media' : `⚠️ ${getBucketName(pin.video_url)}`}
                            </div>
                          </div>
                        )}
                        {pin.icon_url && (
                          <div className="relative">
                            <img 
                              src={pin.icon_url} 
                              alt="Icon"
                              className="w-full h-16 object-contain rounded border border-gray-300 bg-gray-50"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[8px] text-white px-0.5 py-0.5 text-center truncate">
                              {isNewBucket(pin.icon_url) ? '✅ pins-media' : `⚠️ ${getBucketName(pin.icon_url)}`}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Media Status Summary */}
                      <div className="space-y-0.5">
                        {pin.image_url && (
                          <div className="text-[10px] flex items-center gap-1.5">
                            <span className="text-foreground-muted">Image:</span>
                            {isNewBucket(pin.image_url) ? (
                              <span className="text-green-500 font-medium">✅ pins-media</span>
                            ) : (
                              <span className="text-orange-500 font-medium">⚠️ {getBucketName(pin.image_url)}</span>
                            )}
                          </div>
                        )}
                        {pin.video_url && (
                          <div className="text-[10px] flex items-center gap-1.5">
                            <span className="text-foreground-muted">Video:</span>
                            {isNewBucket(pin.video_url) ? (
                              <span className="text-green-500 font-medium">✅ pins-media</span>
                            ) : (
                              <span className="text-orange-500 font-medium">⚠️ {getBucketName(pin.video_url)}</span>
                            )}
                          </div>
                        )}
                        {pin.icon_url && (
                          <div className="text-[10px] flex items-center gap-1.5">
                            <span className="text-foreground-muted">Icon:</span>
                            {isNewBucket(pin.icon_url) ? (
                              <span className="text-green-500 font-medium">✅ pins-media</span>
                            ) : (
                              <span className="text-orange-500 font-medium">⚠️ {getBucketName(pin.icon_url)}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    {hasLegacyMedia && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          migratePinMedia(pin.id);
                        }}
                        disabled={migratingPinId === pin.id}
                        className="px-2 py-1 text-[10px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {migratingPinId === pin.id ? 'Migrating...' : 'Migrate'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Pin Detail Modal */}
      {selectedPin && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-md p-4 max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-gray-900">
                Pin Details: {selectedPin.id.slice(0, 8)}...
              </div>
              <button
                onClick={() => {
                  setSelectedPin(null);
                  // Clear migrated data when closing modal
                  setMigratedPinData(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="text-xs font-semibold text-gray-700 mb-2">Media Comparison:</div>
                <div className="space-y-3">
                  {/* Image Comparison */}
                  <div className="p-2 rounded bg-gray-50">
                    <div className="text-xs text-gray-600 mb-2 font-medium">Image:</div>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Legacy Bucket Column */}
                      <div className="border border-orange-300 rounded p-1.5 bg-orange-50/30">
                        <div className="text-[10px] text-orange-700 font-medium mb-1">Legacy Bucket</div>
                        {selectedPin.image_url && !isNewBucket(selectedPin.image_url) ? (
                          <>
                            <img 
                              src={selectedPin.image_url} 
                              alt="Legacy" 
                              className="w-full h-auto rounded border border-orange-300 max-h-40 object-contain bg-gray-100 mb-1"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(selectedPin.image_url)}</div>
                            <div className="text-[9px] text-orange-500 break-all mt-0.5">{selectedPin.image_url}</div>
                          </>
                        ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.oldUrls.image_url ? (
                          <>
                            <img 
                              src={migratedPinData.oldUrls.image_url} 
                              alt="Legacy" 
                              className="w-full h-auto rounded border border-orange-300 max-h-40 object-contain bg-gray-100 mb-1"
                            />
                            <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(migratedPinData.oldUrls.image_url)}</div>
                            <div className="text-[9px] text-orange-500 break-all mt-0.5">{migratedPinData.oldUrls.image_url}</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-gray-400 py-8 text-center">No legacy image</div>
                        )}
                      </div>
                      
                      {/* New Bucket Column */}
                      <div className="border border-green-300 rounded p-1.5 bg-green-50/30">
                        <div className="text-[10px] text-green-700 font-medium mb-1">New Bucket (pins-media)</div>
                        {selectedPin.image_url && isNewBucket(selectedPin.image_url) ? (
                          <>
                            <img 
                              src={selectedPin.image_url} 
                              alt="New" 
                              className="w-full h-auto rounded border border-green-300 max-h-40 object-contain bg-gray-100 mb-1"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                            <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                            <div className="text-[9px] text-green-500 break-all mt-0.5">{selectedPin.image_url}</div>
                          </>
                        ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.newUrls.image_url ? (
                          <>
                            <img 
                              src={migratedPinData.newUrls.image_url} 
                              alt="New" 
                              className="w-full h-auto rounded border border-green-300 max-h-40 object-contain bg-gray-100 mb-1"
                            />
                            <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                            <div className="text-[9px] text-green-500 break-all mt-0.5">{migratedPinData.newUrls.image_url}</div>
                          </>
                        ) : (
                          <div className="text-[10px] text-gray-400 py-8 text-center">No new image</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Video Comparison */}
                  {(selectedPin.video_url || (migratedPinData?.pinId === selectedPin.id && (migratedPinData.oldUrls.video_url || migratedPinData.newUrls.video_url))) ? (
                    <div className="p-2 rounded bg-gray-50">
                      <div className="text-xs text-gray-600 mb-2 font-medium">Video:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Legacy Bucket Column */}
                        <div className="border border-orange-300 rounded p-1.5 bg-orange-50/30">
                          <div className="text-[10px] text-orange-700 font-medium mb-1">Legacy Bucket</div>
                          {selectedPin.video_url && !isNewBucket(selectedPin.video_url) ? (
                            <>
                              <video 
                                src={selectedPin.video_url} 
                                controls
                                className="w-full h-auto rounded border border-orange-300 max-h-40 bg-gray-100 mb-1"
                                onError={(e) => {
                                  (e.target as HTMLVideoElement).style.display = 'none';
                                }}
                              />
                              <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(selectedPin.video_url)}</div>
                              <div className="text-[9px] text-orange-500 break-all mt-0.5">{selectedPin.video_url}</div>
                            </>
                          ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.oldUrls.video_url ? (
                            <>
                              <video 
                                src={migratedPinData.oldUrls.video_url} 
                                controls
                                className="w-full h-auto rounded border border-orange-300 max-h-40 bg-gray-100 mb-1"
                              />
                              <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(migratedPinData.oldUrls.video_url)}</div>
                              <div className="text-[9px] text-orange-500 break-all mt-0.5">{migratedPinData.oldUrls.video_url}</div>
                            </>
                          ) : (
                            <div className="text-[10px] text-gray-400 py-8 text-center">No legacy video</div>
                          )}
                        </div>
                        
                        {/* New Bucket Column */}
                        <div className="border border-green-300 rounded p-1.5 bg-green-50/30">
                          <div className="text-[10px] text-green-700 font-medium mb-1">New Bucket (pins-media)</div>
                          {selectedPin.video_url && isNewBucket(selectedPin.video_url) ? (
                            <>
                              <video 
                                src={selectedPin.video_url} 
                                controls
                                className="w-full h-auto rounded border border-green-300 max-h-40 bg-gray-100 mb-1"
                                onError={(e) => {
                                  (e.target as HTMLVideoElement).style.display = 'none';
                                }}
                              />
                              <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                              <div className="text-[9px] text-green-500 break-all mt-0.5">{selectedPin.video_url}</div>
                            </>
                          ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.newUrls.video_url ? (
                            <>
                              <video 
                                src={migratedPinData.newUrls.video_url} 
                                controls
                                className="w-full h-auto rounded border border-green-300 max-h-40 bg-gray-100 mb-1"
                              />
                              <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                              <div className="text-[9px] text-green-500 break-all mt-0.5">{migratedPinData.newUrls.video_url}</div>
                            </>
                          ) : (
                            <div className="text-[10px] text-gray-400 py-8 text-center">No new video</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Icon Comparison */}
                  {(selectedPin.icon_url || (migratedPinData?.pinId === selectedPin.id && (migratedPinData.oldUrls.icon_url || migratedPinData.newUrls.icon_url))) ? (
                    <div className="p-2 rounded bg-gray-50">
                      <div className="text-xs text-gray-600 mb-2 font-medium">Icon:</div>
                      <div className="grid grid-cols-2 gap-2">
                        {/* Legacy Bucket Column */}
                        <div className="border border-orange-300 rounded p-1.5 bg-orange-50/30">
                          <div className="text-[10px] text-orange-700 font-medium mb-1">Legacy Bucket</div>
                          {selectedPin.icon_url && !isNewBucket(selectedPin.icon_url) ? (
                            <>
                              <img 
                                src={selectedPin.icon_url} 
                                alt="Legacy" 
                                className="w-full h-20 object-contain rounded border border-orange-300 bg-gray-100 mb-1"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(selectedPin.icon_url)}</div>
                              <div className="text-[9px] text-orange-500 break-all mt-0.5">{selectedPin.icon_url}</div>
                            </>
                          ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.oldUrls.icon_url ? (
                            <>
                              <img 
                                src={migratedPinData.oldUrls.icon_url} 
                                alt="Legacy" 
                                className="w-full h-20 object-contain rounded border border-orange-300 bg-gray-100 mb-1"
                              />
                              <div className="text-[10px] text-orange-600 break-all font-medium">{getBucketName(migratedPinData.oldUrls.icon_url)}</div>
                              <div className="text-[9px] text-orange-500 break-all mt-0.5">{migratedPinData.oldUrls.icon_url}</div>
                            </>
                          ) : (
                            <div className="text-[10px] text-gray-400 py-8 text-center">No legacy icon</div>
                          )}
                        </div>
                        
                        {/* New Bucket Column */}
                        <div className="border border-green-300 rounded p-1.5 bg-green-50/30">
                          <div className="text-[10px] text-green-700 font-medium mb-1">New Bucket (pins-media)</div>
                          {selectedPin.icon_url && isNewBucket(selectedPin.icon_url) ? (
                            <>
                              <img 
                                src={selectedPin.icon_url} 
                                alt="New" 
                                className="w-full h-20 object-contain rounded border border-green-300 bg-gray-100 mb-1"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                              <div className="text-[9px] text-green-500 break-all mt-0.5">{selectedPin.icon_url}</div>
                            </>
                          ) : migratedPinData?.pinId === selectedPin.id && migratedPinData.newUrls.icon_url ? (
                            <>
                              <img 
                                src={migratedPinData.newUrls.icon_url} 
                                alt="New" 
                                className="w-full h-20 object-contain rounded border border-green-300 bg-gray-100 mb-1"
                              />
                              <div className="text-[10px] text-green-600 break-all font-medium">pins-media</div>
                              <div className="text-[9px] text-green-500 break-all mt-0.5">{migratedPinData.newUrls.icon_url}</div>
                            </>
                          ) : (
                            <div className="text-[10px] text-gray-400 py-8 text-center">No new icon</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {(selectedPin.image_url?.includes('map-pins-media') || 
                selectedPin.image_url?.includes('mentions-media') ||
                selectedPin.video_url?.includes('map-pins-media') ||
                selectedPin.video_url?.includes('mentions-media') ||
                selectedPin.icon_url?.includes('map-pins-media') ||
                selectedPin.icon_url?.includes('mentions-media')) && (
                <div className="space-y-2">
                  <div className="text-[10px] text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
                    <strong>Note:</strong> Migration copies files to the new bucket. Old files remain in legacy buckets and are not deleted.
                  </div>
                  <button
                    onClick={() => migratePinMedia(selectedPin.id)}
                    disabled={migratingPinId === selectedPin.id}
                    className="w-full px-3 py-2 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {migratingPinId === selectedPin.id ? 'Migrating...' : 'Migrate to pins-media'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
