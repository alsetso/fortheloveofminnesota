'use client';

import { useState, useEffect } from 'react';
import { useCamera } from '@/hooks/useCamera';
import CameraView from './CameraView';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImageCaptured: (blob: Blob) => void;
}

/**
 * CameraModal - Wrapper component that manages camera lifecycle
 * Connects useCamera hook with CameraView component
 * 
 * Permissions:
 * - Camera access only requested on user interaction (when modal opens)
 */
export default function CameraModal({
  isOpen,
  onClose,
  onImageCaptured,
}: CameraModalProps) {
  const camera = useCamera();
  const [hasStarted, setHasStarted] = useState(false);

  // Start camera when modal opens (user interaction)
  useEffect(() => {
    if (isOpen && !hasStarted) {
      camera.startCamera().then(() => {
        setHasStarted(true);
      });
    }
  }, [isOpen, hasStarted, camera]);

  // Stop camera when modal closes
  useEffect(() => {
    if (!isOpen && hasStarted) {
      camera.stopCamera();
      setHasStarted(false);
    }
  }, [isOpen, hasStarted, camera]);

  const handleCapture = async (blob: Blob) => {
    // Stop camera stream
    await camera.stopCamera();
    // Pass blob to parent (will show preview and wait for location)
    // Parent will handle closing the modal after setting up preview
    onImageCaptured(blob);
  };

  const handleClose = async () => {
    // Stop camera stream
    await camera.stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <CameraView
      camera={camera}
      onCapture={handleCapture}
      onClose={handleClose}
    />
  );
}

