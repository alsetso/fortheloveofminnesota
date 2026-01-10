# Camera Recording Issues - Technical Breakdown

## Context
We're implementing a camera recording feature with MediaRecorder API. The component follows strict rules:
1. Video element never conditionally rendered
2. Explicit Start/Stop buttons (no press-and-hold)
3. Video element has `pointer-events: none`
4. MediaRecorder lifecycle properly managed
5. Safety stop on visibility change

## Architecture
- **CameraModal**: Wrapper that manages camera lifecycle
- **CameraView**: UI component that renders video and controls
- **useCamera**: Hook that manages MediaStream and MediaRecorder

## Issue #1: Stop Button Not Stopping Recording

### Symptoms
- User clicks "Stop Recording" button
- Button click handler fires (console logs show `[CameraView] Stop button clicked`)
- `handleStopRecording()` is called
- `camera.stopRecording()` is called
- But recording continues, `isRecording` state doesn't update

### Code Flow
```typescript
// CameraView.tsx:117-137
const handleStopRecording = async () => {
  console.log('[CameraView] Stop recording called, isRecording:', camera.state.isRecording);
  
  if (recordingTimerRef.current) {
    clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
  }

  try {
    const blob = await camera.stopRecording(); // <-- This should stop and return blob
    console.log('[CameraView] Recording stopped, blob:', blob ? 'exists' : 'null');
    
    if (blob) {
      setCapturedMediaType('video');
      onCapture(blob);
    }
  } catch (err) {
    console.error('[CameraView] Error stopping recording:', err);
  }
};
```

```typescript
// useCamera.ts:277-311
const stopRecording = useCallback(async (): Promise<Blob | null> => {
  if (!mediaRecorderRef.current) {
    return null; // <-- Early return if no recorder
  }

  const mediaRecorder = mediaRecorderRef.current;

  if (mediaRecorder.state === 'inactive') {
    console.warn('[useCamera] MediaRecorder already stopped');
    setIsRecording(false);
    mediaRecorderRef.current = null;
    return null;
  }

  return new Promise((resolve) => {
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      setIsRecording(false); // <-- State update here
      mediaRecorderRef.current = null;
      recordedChunksRef.current = [];
      resolve(blob);
    };

    if (mediaRecorder.state === 'recording') {
      mediaRecorder.stop(); // <-- Should trigger onstop
    } else {
      setIsRecording(false);
      mediaRecorderRef.current = null;
      resolve(null);
    }
  });
}, []);
```

### Potential Issues
1. **MediaRecorder state mismatch**: The `mediaRecorder.state` might not be `'recording'` when we expect it to be
2. **onstop handler not firing**: The `onstop` event might not be firing, leaving the Promise unresolved
3. **State update not propagating**: `setIsRecording(false)` might not trigger re-render in CameraView
4. **Race condition**: Multiple stop calls might be interfering with each other
5. **MediaRecorder ref stale**: The `mediaRecorderRef.current` might be null or pointing to wrong instance

### Questions
- Should we check `mediaRecorder.state` before calling `stop()`?
- Is there a better way to ensure `onstop` fires reliably?
- Should we add a timeout to the Promise to prevent hanging?
- Are there browser-specific MediaRecorder quirks we should handle?

---

## Issue #2: Black Screen During Recording

### Symptoms
- Video feed is visible before recording starts
- When recording starts, screen goes black
- Video element is still in DOM (not conditionally rendered)
- Controls remain visible and functional

### Code Structure
```typescript
// CameraView.tsx:153-173
return (
  <div className={`fixed inset-0 z-[60] bg-black ${className}`}> {/* <-- Black background */}
    {/* Video element always rendered */}
    <video
      ref={camera.videoRef}
      autoPlay
      playsInline
      muted
      className="w-full h-full object-cover"
      style={{ pointerEvents: 'none' }}
    />
    
    {/* Controls overlay */}
    {camera.state.isActive && (
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-4 pb-safe pointer-events-auto">
          {/* Controls */}
        </div>
      </div>
    )}
  </div>
);
```

### Stream Assignment
```typescript
// CameraView.tsx:38-50
useEffect(() => {
  if (camera.state.stream && camera.videoRef.current) {
    // Only assign if not already assigned (prevent reassignment during recording)
    if (camera.videoRef.current.srcObject !== camera.state.stream) {
      camera.videoRef.current.srcObject = camera.state.stream;
    }
    // Ensure video is playing
    if (camera.videoRef.current.paused) {
      camera.videoRef.current.play().catch(console.error);
    }
  }
}, [camera.state.stream, camera.videoRef]);
```

### Potential Issues
1. **Stream being stopped**: MediaRecorder might be stopping the stream tracks
2. **Video element paused**: Video might be pausing when recording starts
3. **Z-index/layering**: Something might be covering the video element
4. **Stream reassignment**: The check `srcObject !== stream` might prevent necessary reassignment
5. **MediaRecorder consuming stream**: MediaRecorder might be "consuming" the stream in a way that breaks video preview
6. **Browser security**: Some browsers might pause video when recording starts

### Questions
- Should we clone the stream for MediaRecorder instead of using the same stream?
- Is there a way to ensure video continues playing during recording?
- Should we add explicit `video.play()` calls when recording starts?
- Are there CSS/layout issues causing the black screen?
- Should the video element have a different z-index?

---

## Additional Observations

### State Management
- `isRecording` is managed in `useCamera` hook
- `CameraView` reads `camera.state.isRecording` but also has local `isRecordingLocally` (not used anymore)
- State updates might be async and not immediately reflected

### MediaRecorder Lifecycle
- Created once in `startRecording()`
- Stored in `mediaRecorderRef.current`
- Should persist until `stopRecording()` is called
- Cleaned up on unmount

### Browser Compatibility
- Using MediaRecorder API (desktop only)
- Video codec: webm/vp9 preferred, fallback to webm, then mp4
- Stream format: getUserMedia with video constraints

---

## Request for Advice

1. **Stop Button Issue**: What's the most reliable way to ensure MediaRecorder stops and state updates correctly?
2. **Black Screen Issue**: How do we maintain video preview while MediaRecorder is active?
3. **Best Practices**: Are there patterns we should follow for MediaRecorder + video preview?
4. **Debugging**: What should we check in browser DevTools to diagnose these issues?

Any insights on MediaRecorder lifecycle, stream management, or React state synchronization would be greatly appreciated.

