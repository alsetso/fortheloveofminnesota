'use client';

import { useState } from 'react';
import DraggableBottomSheet from './DraggableBottomSheet';

/**
 * Example usage of DraggableBottomSheet component
 * 
 * This component provides iOS-style drag-to-dismiss functionality
 * that works on both mobile (touch) and desktop (mouse).
 * 
 * Features:
 * - Drag handle to pull up/down
 * - Snap points for different heights
 * - Velocity-based snapping (quick swipe closes)
 * - Smooth animations
 * - Backdrop click to close
 * - Prevents body scroll when open
 */
export default function DraggableBottomSheetExample() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="p-4">
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-500 text-white rounded"
      >
        Open Draggable Sheet
      </button>

      <DraggableBottomSheet
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Example Sheet"
        initialHeight={50} // Opens at 50% of viewport height
        snapPoints={[25, 50, 75]} // Can snap to 25%, 50%, or 75%
        showBackdrop={true}
        backdropOpacity={0.4}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Drag the handle at the top to move this sheet up or down.
          </p>
          <p className="text-sm text-gray-600">
            Quick swipe down will close it. Slow drag will snap to the nearest height.
          </p>
          <div className="h-96 bg-gray-100 rounded p-4">
            <p>Scrollable content area</p>
          </div>
        </div>
      </DraggableBottomSheet>
    </div>
  );
}

