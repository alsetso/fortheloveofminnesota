'use client';

import { useState, useEffect } from 'react';
import { useToastContext } from '@/features/ui/contexts/ToastContext';
import { createToast } from '@/features/ui/services/toast';
import MembershipRequestItem from './MembershipRequestItem';
import type { MapMembershipRequest } from '@/types/map';

interface MapMembershipRequestsProps {
  mapId: string;
  membershipQuestions: Array<{ id: number; question: string }>;
  onMemberAdded?: () => void;
}

export default function MapMembershipRequests({
  mapId,
  membershipQuestions,
  onMemberAdded,
}: MapMembershipRequestsProps) {
  const { addToast } = useToastContext();
  const [requests, setRequests] = useState<MapMembershipRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/maps/${mapId}/membership-requests`);
      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
      }
    } catch (err) {
      console.error('Error fetching membership requests:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [mapId]);

  const handleApprove = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(
        `/api/maps/${mapId}/membership-requests/${requestId}`,
        { method: 'PUT' }
      );
      
      if (!response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to approve request');
        } else {
          const text = await response.text();
          throw new Error(`Failed to approve request: ${response.status} ${response.statusText}`);
        }
      }

      // Refetch requests to get updated list (status changed to 'approved', so it won't appear)
      await fetchRequests();
      onMemberAdded?.();
      addToast(createToast('success', 'Membership request approved', {
        duration: 3000,
      }));
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to approve request', {
        duration: 4000,
      }));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const response = await fetch(
        `/api/maps/${mapId}/membership-requests/${requestId}`,
        { method: 'DELETE' }
      );
      
      if (!response.ok) {
        // Check if response is JSON before parsing
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to reject request');
        } else {
          const text = await response.text();
          throw new Error(`Failed to reject request: ${response.status} ${response.statusText}`);
        }
      }

      // Refetch requests to get updated list (status changed to 'rejected', so it won't appear)
      await fetchRequests();
      addToast(createToast('success', 'Membership request rejected', {
        duration: 3000,
      }));
    } catch (err: any) {
      addToast(createToast('error', err.message || 'Failed to reject request', {
        duration: 4000,
      }));
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-xs text-gray-500 mt-2">Loading requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-4">
        <p className="text-xs text-gray-500">No pending requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((request) => (
        <MembershipRequestItem
          key={request.id}
          request={request}
          onApprove={() => handleApprove(request.id)}
          onReject={() => handleReject(request.id)}
          membershipQuestions={membershipQuestions}
          isProcessing={processingId === request.id}
        />
      ))}
    </div>
  );
}
