'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightOnRectangleIcon, MapPinIcon, CheckCircleIcon, XCircleIcon, MapIcon, IdentificationIcon, ClockIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { verifyMinnesotaLocation } from '@/lib/utils/stateVerification';
import LocationPreferencesModal from '@/components/settings/LocationPreferencesModal';

export default function GeneralSettingsClient() {
  const router = useRouter();
  const { signOut } = useAuth();
  const { account, userEmail } = useSettings();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [stateVerified, setStateVerified] = useState<boolean | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);
  const [locationPreferences, setLocationPreferences] = useState({
    cities_and_towns: null as any,
    county: null as any,
    districts: null as any,
  });
  const [showLocationModal, setShowLocationModal] = useState<{
    layerType: 'cities_and_towns' | 'county' | 'districts' | null;
  }>({ layerType: null });
  const [idVerificationStatus, setIdVerificationStatus] = useState<{
    hasVerification: boolean;
    status: 'pending' | 'approved' | 'rejected' | null;
    created_at: string | null;
    reviewed_at: string | null;
  } | null>(null);
  const [loadingIdVerification, setLoadingIdVerification] = useState(false);

  // Sync state from account after mount (client-side only to avoid hydration mismatch)
  useEffect(() => {
    if (account) {
      setStateVerified((account as any).state_verified ?? null);
      setLastChecked((account as any).state_verification_checked_at ?? null);
      setLocationPreferences({
        cities_and_towns: (account as any).cities_and_towns ?? null,
        county: (account as any).county ?? null,
        districts: (account as any).districts ?? null,
      });
      loadIdVerificationStatus();
    }
  }, [account]);

  const loadIdVerificationStatus = async () => {
    if (!account?.id) return;

    try {
      setLoadingIdVerification(true);
      const response = await fetch(`/api/id-verification/submissions?account_id=${account.id}`);
      if (response.ok) {
        const data = await response.json();
        const submissions = data.submissions || [];
        if (submissions.length > 0) {
          const latest = submissions[0]; // Already sorted by created_at DESC
          setIdVerificationStatus({
            hasVerification: true,
            status: latest.status,
            created_at: latest.created_at,
            reviewed_at: latest.reviewed_at,
          });
        } else {
          setIdVerificationStatus({
            hasVerification: false,
            status: null,
            created_at: null,
            reviewed_at: null,
          });
        }
      }
    } catch (error) {
      console.error('Error loading ID verification status:', error);
    } finally {
      setLoadingIdVerification(false);
    }
  };

  const handleSignOutClick = () => setShowSignOutConfirm(true);

  const handleSignOutConfirm = async () => {
    setIsSigningOut(true);
    setSignOutError('');
    setShowSignOutConfirm(false);
    try {
      await signOut();
      localStorage.removeItem('freemap_sessions');
      localStorage.removeItem('freemap_current_session');
      router.replace('/');
    } catch (error) {
      console.error('Sign out error:', error);
      setSignOutError('Failed to sign out. Please try again.');
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleSignOutCancel = () => setShowSignOutConfirm(false);

  const handleCheckLocation = async () => {
    setIsCheckingLocation(true);
    setLocationError('');
    
    try {
      const result = await verifyMinnesotaLocation();
      
      if (result.error && !result.verified) {
        setLocationError(result.error);
        setStateVerified(false);
      } else {
        // Update state verification via API
        // Pass the current account ID from settings context
        console.log('[State Verification] Sending request:', {
          accountId: account.id,
          state_verified: result.verified,
        });

        const response = await fetch('/api/settings/state-verification', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            state_verified: result.verified,
            account_id: account.id, // Use the account ID from settings context
          }),
        });

        console.log('[State Verification] Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          console.error('[State Verification] API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
          throw new Error(errorData.error || `Failed to update state verification (${response.status})`);
        }

        const data = await response.json();
        console.log('[State Verification] Success:', data);
        setStateVerified(data.state_verified);
        setLastChecked(data.state_verification_checked_at);
        setLocationError('');
      }
    } catch (error) {
      console.error('State verification error:', error);
      setLocationError(error instanceof Error ? error.message : 'Failed to verify location');
      setStateVerified(false);
    } finally {
      setIsCheckingLocation(false);
    }
  };

  const formatLastChecked = (timestamp: string | null) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
      
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return null;
    }
  };

  // Calculate expiration date (30 days from last check)
  const getVerificationExpiration = (checkedAt: string | null): { expiresAt: Date | null; daysRemaining: number | null; isExpired: boolean } => {
    if (!checkedAt) return { expiresAt: null, daysRemaining: null, isExpired: false };
    
    try {
      const checkDate = new Date(checkedAt);
      const expiresAt = new Date(checkDate);
      expiresAt.setDate(expiresAt.getDate() + 30); // Add 30 days
      
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const isExpired = daysRemaining < 0;
      
      return { expiresAt, daysRemaining, isExpired };
    } catch {
      return { expiresAt: null, daysRemaining: null, isExpired: false };
    }
  };

  const verificationExpiration = getVerificationExpiration(lastChecked);

  const handleLocationSave = async (layerType: 'cities_and_towns' | 'county' | 'districts', data: any) => {
    try {
      const response = await fetch('/api/settings/location-preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: account.id,
          [layerType]: data,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to update location preferences');
      }

      const updated = await response.json();
      setLocationPreferences({
        ...locationPreferences,
        [layerType]: updated[layerType],
      });
    } catch (error) {
      console.error('Error updating location preferences:', error);
      throw error; // Re-throw to let modal handle it
    }
  };

  const handleLocationSelect = (layerType: 'cities_and_towns' | 'county' | 'districts', data: any) => {
    // This is called when selection changes (for non-auto-save mode)
    // For auto-save mode, handleLocationSave is called directly
  };

  const getLocationDisplayName = (data: any, type: 'cities_and_towns' | 'county' | 'districts') => {
    if (!data) return null;
    
    if (type === 'cities_and_towns') {
      if (Array.isArray(data)) {
        if (data.length === 1) return data[0].feature_name || data[0].name;
        return `${data.length} cities/towns`;
      }
      return data.feature_name || data.name;
    }
    
    if (type === 'county') {
      return data.county_name || data.name;
    }
    
    if (type === 'districts') {
      if (Array.isArray(data)) {
        if (data.length === 1) return `District ${data[0].district_number || data[0].name}`;
        return `${data.length} districts`;
      }
      return `District ${data.district_number || data.name}`;
    }
    
    return null;
  };

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-md p-[10px] flex flex-col gap-1.5">
        <p className="text-xs text-gray-600">Signed in as {userEmail || '—'}</p>
        {account.username && (
          <Link href={`/${encodeURIComponent(account.username)}`} className="text-xs font-medium text-gray-900 hover:underline">
            View profile →
          </Link>
        )}
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Currently in Minnesota</h3>
        <div className="space-y-2">
          {locationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
              <XCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{locationError}</span>
            </div>
          )}
          
          <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="text-xs font-semibold text-gray-900">State Verification</h4>
                {stateVerified === true && (
                  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    verificationExpiration.isExpired 
                      ? 'bg-red-100 text-red-800'
                      : verificationExpiration.daysRemaining !== null && verificationExpiration.daysRemaining <= 7
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}>
                    <CheckCircleIcon className="w-3 h-3" />
                    {verificationExpiration.isExpired ? 'Expired' : 'Verified'}
                  </span>
                )}
                {stateVerified === false && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <XCircleIcon className="w-3 h-3" />
                    Not Verified
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600">
                {stateVerified === null 
                  ? 'Verify your current location in Minnesota'
                  : stateVerified
                  ? (
                      <>
                        Verified in Minnesota{lastChecked ? ` • ${formatLastChecked(lastChecked)}` : ''}
                        {verificationExpiration.expiresAt && (
                          <>
                            <br />
                            {verificationExpiration.isExpired ? (
                              <span className="text-red-600 font-medium">
                                Expired • Recheck required
                              </span>
                            ) : verificationExpiration.daysRemaining !== null && verificationExpiration.daysRemaining <= 7 ? (
                              <span className="text-yellow-600">
                                Expires {verificationExpiration.daysRemaining === 0 
                                  ? 'today' 
                                  : verificationExpiration.daysRemaining === 1 
                                  ? 'tomorrow'
                                  : `in ${verificationExpiration.daysRemaining} days`
                                } • Recheck by {verificationExpiration.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </span>
                            ) : (
                              <span className="text-gray-500">
                                Recheck by {verificationExpiration.expiresAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} ({verificationExpiration.daysRemaining} days remaining)
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )
                  : `Not currently in Minnesota${lastChecked ? ` • ${formatLastChecked(lastChecked)}` : ''}`
                }
              </p>
            </div>
            <button
              onClick={handleCheckLocation}
              disabled={isCheckingLocation}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCheckingLocation ? (
                <>
                  <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  <span>Checking...</span>
                </>
              ) : (
                <>
                  <MapPinIcon className="w-3 h-3" />
                  <span>Check</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Location Preferences</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Cities & Towns</h4>
              <p className="text-xs text-gray-600">
                {getLocationDisplayName(locationPreferences.cities_and_towns, 'cities_and_towns') || 'Not set'}
              </p>
            </div>
            <button
              onClick={() => setShowLocationModal({ layerType: 'cities_and_towns' })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
            >
              <MapIcon className="w-3 h-3" />
              <span>{locationPreferences.cities_and_towns ? 'Change' : 'Select'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-gray-900 mb-0.5">County</h4>
              <p className="text-xs text-gray-600">
                {getLocationDisplayName(locationPreferences.county, 'county') || 'Not set'}
              </p>
            </div>
            <button
              onClick={() => setShowLocationModal({ layerType: 'county' })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
            >
              <MapIcon className="w-3 h-3" />
              <span>{locationPreferences.county ? 'Change' : 'Select'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Districts</h4>
              <p className="text-xs text-gray-600">
                {getLocationDisplayName(locationPreferences.districts, 'districts') || 'Not set'}
              </p>
            </div>
            <button
              onClick={() => setShowLocationModal({ layerType: 'districts' })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
            >
              <MapIcon className="w-3 h-3" />
              <span>{locationPreferences.districts ? 'Change' : 'Select'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">ID Verification</h3>
        <div className="space-y-2">
          {loadingIdVerification ? (
            <div className="text-xs text-gray-500">Loading...</div>
          ) : (
            <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xs font-semibold text-gray-900">Identity Verification</h4>
                  {idVerificationStatus?.hasVerification && idVerificationStatus.status === 'approved' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <CheckCircleIcon className="w-3 h-3" />
                      Approved
                    </span>
                  )}
                  {idVerificationStatus?.hasVerification && idVerificationStatus.status === 'pending' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <ClockIcon className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                  {idVerificationStatus?.hasVerification && idVerificationStatus.status === 'rejected' && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <XCircleIcon className="w-3 h-3" />
                      Rejected
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600">
                  {idVerificationStatus?.hasVerification
                    ? idVerificationStatus.status === 'approved'
                      ? 'Your identity has been verified'
                      : idVerificationStatus.status === 'pending'
                      ? 'Your verification is under review'
                      : 'Your verification was rejected'
                    : 'Upload your state ID to verify your identity'}
                </p>
              </div>
              <Link
                href="/settings/id"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors flex-shrink-0"
              >
                <IdentificationIcon className="w-3 h-3" />
                <span>{idVerificationStatus?.hasVerification ? 'Manage' : 'Verify'}</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Actions</h3>
        {signOutError && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span>{signOutError}</span>
          </div>
        )}
        <div className="flex items-center justify-between p-[10px] border border-gray-200 rounded-md hover:bg-gray-50 transition-colors">
          <div>
            <h4 className="text-xs font-semibold text-gray-900 mb-0.5">Sign Out</h4>
            <p className="text-xs text-gray-600">Sign out of your account on this device</p>
          </div>
          <button onClick={handleSignOutClick} disabled={isSigningOut} className="flex items-center gap-1.5 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
            {isSigningOut ? (<><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> Signing out...</>) : 'Sign Out'}
          </button>
        </div>
      </div>

      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" role="dialog" aria-modal="true" aria-labelledby="signout-title" onKeyDown={(e) => e.key === 'Escape' && handleSignOutCancel()}>
          <div className="bg-white rounded-md border border-gray-200 w-full max-w-md mx-4">
            <div className="p-[10px]">
              <div className="flex items-center mb-3">
                <div className="flex-shrink-0 w-8 h-8 mx-auto bg-red-100 rounded-md flex items-center justify-center">
                  <ArrowRightOnRectangleIcon className="w-4 h-4 text-red-600" aria-hidden />
                </div>
              </div>
              <div className="text-center">
                <h3 id="signout-title" className="text-sm font-semibold text-gray-900 mb-1.5">Sign out of your account?</h3>
                <p className="text-xs text-gray-600 mb-3">You&apos;ll need to sign in again to access your account.</p>
                <div className="flex gap-2">
                  <button onClick={handleSignOutCancel} className="flex-1 px-[10px] py-[10px] text-xs font-medium text-gray-900 border border-gray-200 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors">Cancel</button>
                  <button onClick={handleSignOutConfirm} disabled={isSigningOut} className="flex-1 px-[10px] py-[10px] text-xs font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isSigningOut ? 'Signing out...' : 'Sign out'}</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLocationModal.layerType && (
        <LocationPreferencesModal
          isOpen={true}
          onClose={() => setShowLocationModal({ layerType: null })}
          layerType={showLocationModal.layerType}
          onSelect={(data) => handleLocationSelect(showLocationModal.layerType!, data)}
          onSave={async (data) => {
            await handleLocationSave(showLocationModal.layerType!, data);
          }}
          currentSelection={locationPreferences[showLocationModal.layerType]}
        />
      )}
    </>
  );
}
