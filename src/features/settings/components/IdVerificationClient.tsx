'use client';

import { useState, useEffect, useRef } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  PhotoIcon,
  DocumentIcon,
  CameraIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import { useAuth } from '@/features/auth';

interface VerificationSubmission {
  id: string;
  account_id: string;
  state_id_front_url: string | null;
  state_id_back_url: string | null;
  billing_statement_front_url: string | null;
  billing_statement_back_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  rejection_reason: string | null;
  reviewed_by_account_id: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  signed_urls?: {
    state_id_front_url: string | null;
    state_id_back_url: string | null;
    billing_statement_front_url: string | null;
    billing_statement_back_url: string | null;
  };
}

export default function IdVerificationClient() {
  const { account } = useSettings();
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<VerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [currentSubmission, setCurrentSubmission] = useState<Partial<VerificationSubmission> | null>(null);
  const [showBillingStatement, setShowBillingStatement] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState<{
    documentType: 'state_id_front' | 'state_id_back' | 'billing_statement_front' | 'billing_statement_back' | null;
  }>({ documentType: null });

  const fileInputRefs = {
    state_id_front: useRef<HTMLInputElement>(null),
    state_id_back: useRef<HTMLInputElement>(null),
    billing_statement_front: useRef<HTMLInputElement>(null),
    billing_statement_back: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    loadSubmissions();
  }, [account?.id]);

  const loadSubmissions = async () => {
    if (!account?.id) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/id-verification/submissions?account_id=${account.id}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to load submissions');
      }

      const data = await response.json();
      setSubmissions(data.submissions || []);

      // Set current submission to latest pending or create new
      const pendingSubmission = data.submissions?.find(
        (s: VerificationSubmission) => s.status === 'pending'
      );
      if (pendingSubmission) {
        setCurrentSubmission(pendingSubmission);
        // Show billing statement section if they've uploaded billing statements
        if (pendingSubmission.billing_statement_front_url || pendingSubmission.billing_statement_back_url) {
          setShowBillingStatement(true);
        }
      } else {
        setCurrentSubmission({
          state_id_front_url: null,
          state_id_back_url: null,
          billing_statement_front_url: null,
          billing_statement_back_url: null,
        });
      }
    } catch (err) {
      console.error('Error loading submissions:', err);
      setError(err instanceof Error ? err.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (
    documentType: 'state_id_front' | 'state_id_back' | 'billing_statement_front' | 'billing_statement_back',
    file: File
  ) => {
    if (!file || !account?.id) return;

    setUploading(documentType);
    setError(null);

    try {
      // If we don't have a verification ID yet, create one first (empty)
      let verificationId = currentSubmission?.id;
      if (!verificationId) {
        const submitResponse = await fetch('/api/id-verification/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_id: account.id,
          }),
        });

        if (!submitResponse.ok) {
          const data = await submitResponse.json();
          throw new Error(data.error || 'Failed to create verification');
        }

        const submitData = await submitResponse.json();
        verificationId = submitData.verification.id;
        setCurrentSubmission((prev) => ({
          ...prev,
          id: verificationId,
        }));
      }

      // Upload file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('account_id', account.id || '');
      formData.append('verification_id', verificationId || '');

      const documentTypeMap: Record<string, string> = {
        state_id_front: 'state_id_front',
        state_id_back: 'state_id_back',
        billing_statement_front: 'billing_statement_front',
        billing_statement_back: 'billing_statement_back',
      };

      formData.append('document_type', documentTypeMap[documentType]);

      const uploadResponse = await fetch('/api/id-verification/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        const data = await uploadResponse.json();
        throw new Error(data.error || 'Failed to upload file');
      }

      const uploadData = await uploadResponse.json();

      // Update verification with file path
      const urlKey = `${documentType}_url` as keyof VerificationSubmission;
      const updateResponse = await fetch('/api/id-verification/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          account_id: account.id,
          verification_id: verificationId,
          [urlKey]: uploadData.path,
        }),
      });

      if (!updateResponse.ok) {
        const data = await updateResponse.json();
        throw new Error(data.error || 'Failed to update verification');
      }

      // Reload submissions to get updated data
      await loadSubmissions();
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
    } finally {
      setUploading(null);
      if (fileInputRefs[documentType].current) {
        fileInputRefs[documentType].current.value = '';
      }
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircleIcon className="w-3 h-3" />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircleIcon className="w-3 h-3" />
            Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <ClockIcon className="w-3 h-3" />
            Pending
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
    } catch {
      return null;
    }
  };

  const canEdit = currentSubmission && (!currentSubmission.id || currentSubmission.status === 'pending');

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Identity Verification</h3>
        <p className="text-xs text-gray-600 mb-3">
          Upload your state ID (front and back) to verify your identity. Billing statement is optional and can be used as an alternative verification method.
        </p>
        <div className="mb-3 p-[10px] bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-xs text-gray-600">
            Need help?{' '}
            <a
              href="mailto:loveofminnesota@gmail.com"
              className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
            >
              Email us
            </a>
          </p>
        </div>

        {error && (
          <div className="mb-3 bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs flex items-start gap-2">
            <XCircleIcon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : (
          <div className="space-y-3">
            {/* Document Upload Section */}
            {canEdit && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-900">Upload Documents</h4>

                {/* State ID Section - Hidden if showing billing statement */}
                {!showBillingStatement && (
                  <>
                    {/* State ID Front */}
                    <div className="p-[10px] border border-gray-200 rounded-md">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-900">State ID - Front <span className="text-gray-500 font-normal">(recommended)</span></label>
                        {currentSubmission?.state_id_front_url && (
                          <span className="text-xs text-green-600">Uploaded</span>
                        )}
                      </div>
                  <input
                    ref={fileInputRefs.state_id_front}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect('state_id_front', file);
                      }
                      if (fileInputRefs.state_id_front.current) {
                        fileInputRefs.state_id_front.current.value = '';
                      }
                    }}
                    disabled={uploading === 'state_id_front'}
                    className="hidden"
                    id="state_id_front"
                  />
                  <button
                    onClick={() => setShowUploadModal({ documentType: 'state_id_front' })}
                    disabled={uploading === 'state_id_front'}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading === 'state_id_front' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="w-3 h-3" />
                        <span>{currentSubmission?.state_id_front_url ? 'Replace' : 'Upload'}</span>
                      </>
                    )}
                  </button>
                    </div>

                    {/* State ID Back */}
                    <div className="p-[10px] border border-gray-200 rounded-md">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-900">State ID - Back</label>
                        {currentSubmission?.state_id_back_url && (
                          <span className="text-xs text-green-600">Uploaded</span>
                        )}
                      </div>
                  <input
                    ref={fileInputRefs.state_id_back}
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect('state_id_back', file);
                      }
                      if (fileInputRefs.state_id_back.current) {
                        fileInputRefs.state_id_back.current.value = '';
                      }
                    }}
                    disabled={uploading === 'state_id_back'}
                    className="hidden"
                    id="state_id_back"
                  />
                  <button
                    onClick={() => setShowUploadModal({ documentType: 'state_id_back' })}
                    disabled={uploading === 'state_id_back'}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {uploading === 'state_id_back' ? (
                      <>
                        <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <PhotoIcon className="w-3 h-3" />
                        <span>{currentSubmission?.state_id_back_url ? 'Replace' : 'Upload'}</span>
                      </>
                    )}
                  </button>
                    </div>

                    {/* Billing Statement Toggle Button */}
                    <button
                      onClick={() => setShowBillingStatement(true)}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                    >
                      Billing Statement
                    </button>
                  </>
                )}

                {/* Billing Statement Section - Only shown if user clicks the button */}
                {showBillingStatement && (
                  <>
                    {/* Billing Statement Front */}
                    <div className="p-[10px] border border-gray-200 rounded-md">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-900">Billing Statement - Front</label>
                        {currentSubmission?.billing_statement_front_url && (
                          <span className="text-xs text-green-600">Uploaded</span>
                        )}
                      </div>
                      <input
                        ref={fileInputRefs.billing_statement_front}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect('billing_statement_front', file);
                          }
                          if (fileInputRefs.billing_statement_front.current) {
                            fileInputRefs.billing_statement_front.current.value = '';
                          }
                        }}
                        disabled={uploading === 'billing_statement_front'}
                        className="hidden"
                        id="billing_statement_front"
                      />
                      <button
                        onClick={() => setShowUploadModal({ documentType: 'billing_statement_front' })}
                        disabled={uploading === 'billing_statement_front'}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading === 'billing_statement_front' ? (
                          <>
                            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <PhotoIcon className="w-3 h-3" />
                            <span>{currentSubmission?.billing_statement_front_url ? 'Replace' : 'Upload'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Billing Statement Back */}
                    <div className="p-[10px] border border-gray-200 rounded-md">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-medium text-gray-900">Billing Statement - Back</label>
                        {currentSubmission?.billing_statement_back_url && (
                          <span className="text-xs text-green-600">Uploaded</span>
                        )}
                      </div>
                      <input
                        ref={fileInputRefs.billing_statement_back}
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            handleFileSelect('billing_statement_back', file);
                          }
                          if (fileInputRefs.billing_statement_back.current) {
                            fileInputRefs.billing_statement_back.current.value = '';
                          }
                        }}
                        disabled={uploading === 'billing_statement_back'}
                        className="hidden"
                        id="billing_statement_back"
                      />
                      <button
                        onClick={() => setShowUploadModal({ documentType: 'billing_statement_back' })}
                        disabled={uploading === 'billing_statement_back'}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploading === 'billing_statement_back' ? (
                          <>
                            <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            <span>Uploading...</span>
                          </>
                        ) : (
                          <>
                            <PhotoIcon className="w-3 h-3" />
                            <span>{currentSubmission?.billing_statement_back_url ? 'Replace' : 'Upload'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* State ID Toggle Button */}
                    <button
                      onClick={() => setShowBillingStatement(false)}
                      className="w-full text-xs text-blue-600 hover:text-blue-800 hover:underline text-left"
                    >
                      State ID (recommended)
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Previous Submissions */}
            {submissions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-900">Submission History</h4>
                {submissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="p-[10px] border border-gray-200 rounded-md space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-900">
                          Submitted {formatDate(submission.created_at)}
                        </span>
                        {getStatusBadge(submission.status)}
                      </div>
                    </div>

                    {submission.status === 'rejected' && submission.rejection_reason && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-[10px] py-[10px] rounded-md text-xs">
                        <strong>Rejection reason:</strong> {submission.rejection_reason}
                      </div>
                    )}

                    {submission.reviewed_at && (
                      <p className="text-xs text-gray-500">
                        Reviewed {formatDate(submission.reviewed_at)}
                      </p>
                    )}

                    {submission.signed_urls && (
                      <div className="space-y-3">
                        {/* State ID Documents */}
                        {(submission.signed_urls.state_id_front_url || submission.signed_urls.state_id_back_url) && (
                          <div>
                            <p className="text-xs font-medium text-gray-900 mb-2">State ID</p>
                            <div className="grid grid-cols-2 gap-2">
                              {submission.signed_urls.state_id_front_url && (
                                <a
                                  href={submission.signed_urls.state_id_front_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors bg-gray-50"
                                >
                                  <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                                    {submission.signed_urls.state_id_front_url.toLowerCase().includes('.pdf') || submission.signed_urls.state_id_front_url.toLowerCase().includes('application/pdf') ? (
                                      <div className="text-center p-2">
                                        <DocumentIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs font-medium text-gray-600">PDF</p>
                                      </div>
                                    ) : (
                                      <img
                                        src={submission.signed_urls.state_id_front_url}
                                        alt="State ID Front"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="text-center p-2"><svg class="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image</p></div>';
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 px-2 py-1.5 text-center border-t border-gray-200">Front</p>
                                </a>
                              )}
                              {submission.signed_urls.state_id_back_url && (
                                <a
                                  href={submission.signed_urls.state_id_back_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors bg-gray-50"
                                >
                                  <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                                    {submission.signed_urls.state_id_back_url.toLowerCase().includes('.pdf') || submission.signed_urls.state_id_back_url.toLowerCase().includes('application/pdf') ? (
                                      <div className="text-center p-2">
                                        <DocumentIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs font-medium text-gray-600">PDF</p>
                                      </div>
                                    ) : (
                                      <img
                                        src={submission.signed_urls.state_id_back_url}
                                        alt="State ID Back"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="text-center p-2"><svg class="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image</p></div>';
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 px-2 py-1.5 text-center border-t border-gray-200">Back</p>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Billing Statement Documents */}
                        {(submission.signed_urls.billing_statement_front_url || submission.signed_urls.billing_statement_back_url) && (
                          <div>
                            <p className="text-xs font-medium text-gray-900 mb-2">Billing Statement</p>
                            <div className="grid grid-cols-2 gap-2">
                              {submission.signed_urls.billing_statement_front_url && (
                                <a
                                  href={submission.signed_urls.billing_statement_front_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors bg-gray-50"
                                >
                                  <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                                    {submission.signed_urls.billing_statement_front_url.toLowerCase().includes('.pdf') || submission.signed_urls.billing_statement_front_url.toLowerCase().includes('application/pdf') ? (
                                      <div className="text-center p-2">
                                        <DocumentIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs font-medium text-gray-600">PDF</p>
                                      </div>
                                    ) : (
                                      <img
                                        src={submission.signed_urls.billing_statement_front_url}
                                        alt="Billing Statement Front"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="text-center p-2"><svg class="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image</p></div>';
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 px-2 py-1.5 text-center border-t border-gray-200">Front</p>
                                </a>
                              )}
                              {submission.signed_urls.billing_statement_back_url && (
                                <a
                                  href={submission.signed_urls.billing_statement_back_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block border border-gray-200 rounded-md overflow-hidden hover:border-gray-300 transition-colors bg-gray-50"
                                >
                                  <div className="w-full h-32 flex items-center justify-center bg-gray-100">
                                    {submission.signed_urls.billing_statement_back_url.toLowerCase().includes('.pdf') || submission.signed_urls.billing_statement_back_url.toLowerCase().includes('application/pdf') ? (
                                      <div className="text-center p-2">
                                        <DocumentIcon className="w-8 h-8 text-gray-400 mx-auto mb-1" />
                                        <p className="text-xs font-medium text-gray-600">PDF</p>
                                      </div>
                                    ) : (
                                      <img
                                        src={submission.signed_urls.billing_statement_back_url}
                                        alt="Billing Statement Back"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          const target = e.target as HTMLImageElement;
                                          target.style.display = 'none';
                                          const parent = target.parentElement;
                                          if (parent) {
                                            parent.innerHTML = '<div class="text-center p-2"><svg class="w-8 h-8 text-gray-400 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg><p class="text-xs text-gray-500">Image</p></div>';
                                          }
                                        }}
                                      />
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 px-2 py-1.5 text-center border-t border-gray-200">Back</p>
                                </a>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal.documentType && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" 
          role="dialog" 
          aria-modal="true"
          onClick={() => setShowUploadModal({ documentType: null })}
        >
          <div 
            className="bg-white rounded-md border border-gray-200 w-full max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-[10px]">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Upload Document</h3>
                <button
                  onClick={() => setShowUploadModal({ documentType: null })}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const inputRef = fileInputRefs[showUploadModal.documentType!];
                    if (inputRef.current) {
                      inputRef.current.click();
                    }
                    setShowUploadModal({ documentType: null });
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <PhotoIcon className="w-4 h-4" />
                  <span>Upload Photo</span>
                </button>
                
                <button
                  onClick={async () => {
                    try {
                      // Check if camera is available
                      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
                      stream.getTracks().forEach(track => track.stop());
                      
                      // Create a file input with camera capture
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = 'image/*';
                      input.capture = 'environment';
                      input.onchange = (e) => {
                        const file = (e.target as HTMLInputElement).files?.[0];
                        if (file && showUploadModal.documentType) {
                          handleFileSelect(showUploadModal.documentType, file);
                        }
                      };
                      input.click();
                      setShowUploadModal({ documentType: null });
                    } catch (error) {
                      console.error('Camera access error:', error);
                      // Fallback to regular file input if camera is not available
                      const inputRef = fileInputRefs[showUploadModal.documentType!];
                      if (inputRef.current) {
                        inputRef.current.click();
                      }
                      setShowUploadModal({ documentType: null });
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-900 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors"
                >
                  <CameraIcon className="w-4 h-4" />
                  <span>Camera</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
