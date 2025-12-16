'use client';

import { useCallback } from 'react';
import { MapPin, MapPinService, CreateMapPinData, UpdateMapPinData } from '../services/mapPinService';
import { useAuth } from '@/features/auth';
import { useProfile } from '@/features/profiles/contexts/ProfileContext';
import { useToast } from '@/features/ui/hooks/useToast';

export interface UseMapPinCRUDOptions {
  onPinCreated?: (pin: MapPin) => void;
  onPinUpdated?: (pin: MapPin) => void;
  onPinDeleted?: (pinId: string) => void;
}

export interface UseMapPinCRUDReturn {
  createPin: (data: Omit<CreateMapPinData, 'profile_id'>) => Promise<MapPin>;
  updatePin: (pinId: string, data: UpdateMapPinData) => Promise<MapPin>;
  deletePin: (pinId: string) => Promise<void>;
}

/**
 * Simple hook for pin CRUD operations on the map page
 */
export function useMapPinCRUD({
  onPinCreated,
  onPinUpdated,
  onPinDeleted,
}: UseMapPinCRUDOptions = {}): UseMapPinCRUDReturn {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { toast } = useToast();

  const createPin = useCallback(
    async (data: Omit<CreateMapPinData, 'profile_id'>) => {
      if (!profile?.id) {
        toast({
          title: 'Error',
          description: 'You must have a profile to create a pin.',
          variant: 'destructive',
        });
        throw new Error('Profile not found');
      }

      try {
        const newPin = await MapPinService.createPin({ ...data, profile_id: profile.id });
        onPinCreated?.(newPin);
        toast({
          title: 'Success',
          description: 'Pin created successfully.',
        });
        return newPin;
      } catch (error) {
        console.error('Error creating pin:', error);
        toast({
          title: 'Error',
          description: `Failed to create pin: ${error instanceof Error ? error.message : String(error)}`,
          variant: 'destructive',
        });
        throw error;
      }
    },
    [profile?.id, onPinCreated, toast]
  );

  const updatePin = useCallback(
    async (pinId: string, data: UpdateMapPinData) => {
      try {
        const updatedPin = await MapPinService.updatePin(pinId, data);
        onPinUpdated?.(updatedPin);
        toast({
          title: 'Success',
          description: 'Pin updated successfully.',
        });
        return updatedPin;
      } catch (error) {
        console.error('Error updating pin:', error);
        toast({
          title: 'Error',
          description: `Failed to update pin: ${error instanceof Error ? error.message : String(error)}`,
          variant: 'destructive',
        });
        throw error;
      }
    },
    [onPinUpdated, toast]
  );

  const deletePin = useCallback(
    async (pinId: string) => {
      try {
        await MapPinService.deletePin(pinId);
        onPinDeleted?.(pinId);
        toast({
          title: 'Success',
          description: 'Pin deleted successfully.',
        });
      } catch (error) {
        console.error('Error deleting pin:', error);
        toast({
          title: 'Error',
          description: `Failed to delete pin: ${error instanceof Error ? error.message : String(error)}`,
          variant: 'destructive',
        });
        throw error;
      }
    },
    [onPinDeleted, toast]
  );

  return { createPin, updatePin, deletePin };
}




