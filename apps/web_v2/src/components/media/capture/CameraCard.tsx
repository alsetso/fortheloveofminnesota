'use client';

/**
 * Fixed-size rounded camera preview. Parent scroll pushes this card up —
 * it does not resize or morph into a grid cell.
 *
 * Capture behavior mirrors ComposeCameraSheet (tap photo / hold video).
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from 'react';
import PlaybackView from '@/components/media/capture/PlaybackView';
import TextLayer from '@/components/media/capture/TextOverlay/TextLayer';
import type { TextLayerData } from '@/components/media/capture/TextOverlay/types';
import { IconSpinner, IconSwitch, IconX } from '@/features/map/dockCore/core/icons';
import { COMMUNITY_POST_VIDEO_MAX_SECONDS } from '@/lib/community/composeMediaLimits';
import { openAppSettings } from '@/lib/despia/openAppSettings';
import { haptic } from '@/lib/despia/haptics';
import {
  extensionForUpload,
  normalizeR2ContentType,
} from '@/lib/r2/presignHelpers';

type Facing = 'environment' | 'user';
type CameraErrorKind = 'permission' | 'unsupported' | 'busy' | 'unknown';

const HOLD_MS = 220;
const MAX_MS = COMMUNITY_POST_VIDEO_MAX_SECONDS * 1000;

function classifyCameraError(err: unknown): CameraErrorKind {
  const name =
    err && typeof err === 'object' && 'name' in err
      ? String((err as { name: unknown }).name)
      : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') return 'permission';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') return 'unsupported';
  if (name === 'NotReadableError' || name === 'TrackStartError') return 'busy';
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'unsupported';
  }
  return 'unknown';
}

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  const candidates = [
    'video/mp4',
    'video/mp4;codecs=avc1',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t));
}

/**
 * TEMP DIAGNOSTIC — remove after device hold-to-record logs are captured.
 * Probes whether a recorded blob retained a decodable audio track.
 */
async function verifyBlobHasAudio(blob: Blob): Promise<{
  webkitAudioDecodedByteCount: number | null;
  captureStreamAudioTracks: number | null;
  error: string | null;
}> {
  const url = URL.createObjectURL(blob);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      el.onloadeddata = () => resolve();
      el.onerror = () => reject(new Error('video element failed to load blob'));
      window.setTimeout(() => reject(new Error('audio verify timeout')), 4000);
    });

    await el.play().catch(() => undefined);
    // Give the decoder a short window to accumulate audio bytes.
    await new Promise((r) => window.setTimeout(r, 350));

    const webkitCount =
      typeof (el as HTMLVideoElement & { webkitAudioDecodedByteCount?: number })
        .webkitAudioDecodedByteCount === 'number'
        ? (el as HTMLVideoElement & { webkitAudioDecodedByteCount: number })
            .webkitAudioDecodedByteCount
        : null;

    let captureStreamAudioTracks: number | null = null;
    const maybeCapture = (
      el as HTMLVideoElement & {
        captureStream?: () => MediaStream;
      }
    ).captureStream;
    if (typeof maybeCapture === 'function') {
      try {
        const probed = maybeCapture.call(el);
        captureStreamAudioTracks = probed.getAudioTracks().length;
        for (const t of probed.getTracks()) t.stop();
      } catch {
        captureStreamAudioTracks = null;
      }
    }

    el.pause();
    return {
      webkitAudioDecodedByteCount: webkitCount,
      captureStreamAudioTracks,
      error: null,
    };
  } catch (err) {
    return {
      webkitAudioDecodedByteCount: null,
      captureStreamAudioTracks: null,
      error: err instanceof Error ? err.message : 'audio verify failed',
    };
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

function ToolRailButton({
  children,
  onClick,
  label,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        haptic.toggle();
        onClick?.();
      }}
      className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-[15px] font-semibold text-white backdrop-blur-md transition active:scale-95 disabled:opacity-40"
    >
      {children}
    </button>
  );
}

export type CameraCapturePreview = {
  file: File;
  url: string;
  kind: 'image' | 'video';
};

export type CameraCardProps = {
  allowVideo?: boolean;
  /** When false, do not call getUserMedia — library/recents only until activated. */
  active?: boolean;
  onClose: () => void;
  /** Fired when shutter produces a file — parent owns preview lock + share rail. */
  onCaptured: (preview: CameraCapturePreview) => void;
  /** Controlled preview from parent (null = live camera). */
  preview?: CameraCapturePreview | null;
  /** X on preview — parent opens Discard media? sheet. */
  onDiscardRequest?: () => void;
  textLayers?: TextLayerData[];
  editingLayerId?: string | null;
  onOpenTextTool?: () => void;
  onTextLayerChange?: (layer: TextLayerData) => void;
  onTextLayerEdit?: (layer: TextLayerData) => void;
  /** Public HTTPS URL ready for Despia Photos save / share. */
  saveRemoteUrl?: string | null;
  saveUploading?: boolean;
  onSaveToDevice?: () => void;
  /** Compose caption drafted over the capture preview. */
  caption?: string;
  onCaptionChange?: (next: string) => void;
  captionMaxLength?: number;
  /** Post audience — preview rail toggle. */
  visibility?: 'public' | 'only_me';
  onVisibilityChange?: (next: 'public' | 'only_me') => void;
};

export default function CameraCard({
  allowVideo = true,
  active = true,
  onClose,
  onCaptured,
  preview = null,
  onDiscardRequest,
  textLayers = [],
  editingLayerId = null,
  onOpenTextTool,
  onTextLayerChange,
  onTextLayerEdit,
  saveRemoteUrl = null,
  saveUploading = false,
  onSaveToDevice,
  caption = '',
  onCaptionChange,
  captionMaxLength = 200,
  visibility = 'public',
  onVisibilityChange,
}: CameraCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordStartedAtRef = useRef(0);
  const pressActiveRef = useRef(false);
  const recordingRef = useRef(false);
  const captionInputRef = useRef<HTMLTextAreaElement>(null);
  const [captionEditing, setCaptionEditing] = useState(false);

  useEffect(() => {
    if (!preview) setCaptionEditing(false);
  }, [preview]);

  useEffect(() => {
    if (!captionEditing) return;
    const id = window.requestAnimationFrame(() => {
      captionInputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [captionEditing]);

  const [facing, setFacing] = useState<Facing>('environment');
  const [starting, setStarting] = useState(true);
  const [errorKind, setErrorKind] = useState<CameraErrorKind | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordProgress, setRecordProgress] = useState(0);
  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const clearRecordTick = () => {
    if (recordTickRef.current) {
      clearInterval(recordTickRef.current);
      recordTickRef.current = null;
    }
  };

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) track.stop();
    }
    const video = videoRef.current;
    if (video) video.srcObject = null;
  }, []);

  const startCamera = useCallback(
    async (nextFacing: Facing) => {
      setStarting(true);
      setErrorKind(null);
      stopStream();

      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorKind('unsupported');
        setStarting(false);
        return;
      }

      const videoConstraint = {
        facingMode: { ideal: nextFacing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      };

      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: videoConstraint,
          });
          // TEMP DIAGNOSTIC — remove after device capture logs are captured.
          console.info('[MediaCapture][gUM] audio:true ok', {
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
            audioLabel: stream.getAudioTracks()[0]?.label ?? null,
            audioReadyState: stream.getAudioTracks()[0]?.readyState ?? null,
          });
        } catch (audioErr) {
          // TEMP DIAGNOSTIC — remove after device capture logs are captured.
          console.warn('[MediaCapture][gUM] audio:true failed → retry audio:false', {
            errorName:
              audioErr && typeof audioErr === 'object' && 'name' in audioErr
                ? String((audioErr as { name: unknown }).name)
                : 'unknown',
            errorMessage:
              audioErr instanceof Error ? audioErr.message : String(audioErr),
          });
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: videoConstraint,
          });
          console.info('[MediaCapture][gUM] audio:false ok', {
            audioTracks: stream.getAudioTracks().length,
            videoTracks: stream.getVideoTracks().length,
          });
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        setFacing(nextFacing);
      } catch (err) {
        // TEMP DIAGNOSTIC — remove after device capture logs are captured.
        console.error('[MediaCapture][gUM] both attempts failed', err);
        setErrorKind(classifyCameraError(err));
      } finally {
        setStarting(false);
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!active || preview) {
      stopStream();
      setStarting(false);
      setErrorKind(null);
      return;
    }
    void startCamera('environment');
    return () => {
      clearHoldTimer();
      clearRecordTick();
      try {
        recorderRef.current?.stop();
      } catch {
        /* ignore */
      }
      stopStream();
    };
  }, [active, preview, startCamera, stopStream]);

  const flip = () => {
    if (starting || recording) return;
    haptic.toggle();
    void startCamera(facing === 'environment' ? 'user' : 'environment');
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video || capturing || starting || errorKind || recording) return;
    if (!video.videoWidth || !video.videoHeight) return;

    setCapturing(true);
    haptic.toggle();
    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture');

      if (facing === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('Could not capture');

      const file = new File([blob], `camera-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      haptic.findMe.success();
      onCaptured({
        file,
        url: URL.createObjectURL(file),
        kind: 'image',
      });
    } catch {
      setErrorKind('unknown');
    } finally {
      setCapturing(false);
    }
  };

  const finishRecording = useCallback(
    (blob: Blob, recorderMime: string | undefined) => {
      recordingRef.current = false;
      setRecording(false);
      setRecordProgress(0);
      clearRecordTick();
      recorderRef.current = null;

      if (blob.size < 1024) {
        setErrorKind('unknown');
        return;
      }

      // Single source of truth for allowlist / presign / PUT / key extension.
      // MediaRecorder often yields `video/mp4;codecs=avc1` — strip to canonical MIME.
      const contentType =
        normalizeR2ContentType(blob.type) ??
        normalizeR2ContentType(recorderMime ?? '') ??
        'video/mp4';
      const ext = extensionForUpload('video', contentType);
      const file = new File([blob], `camera-${Date.now()}.${ext}`, {
        type: contentType,
      });

      // TEMP DIAGNOSTIC — remove after device hold-to-record logs are captured.
      void (async () => {
        const audioProbe = await verifyBlobHasAudio(blob);
        console.info('[MediaCapture][record-stop]', {
          recorderMimeType: recorderMime ?? null,
          blobSize: blob.size,
          blobType: blob.type,
          normalizedContentType: contentType,
          fileType: file.type,
          fileName: file.name,
          audioProbe,
        });
      })();

      haptic.findMe.success();
      onCaptured({
        file,
        url: URL.createObjectURL(file),
        kind: 'video',
      });
    },
    [onCaptured],
  );

  const stopRecording = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') {
      recordingRef.current = false;
      setRecording(false);
      clearRecordTick();
      return;
    }
    try {
      rec.stop();
    } catch {
      recordingRef.current = false;
      setRecording(false);
      clearRecordTick();
    }
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !allowVideo || errorKind) return;
    if (typeof MediaRecorder === 'undefined') {
      setErrorKind('unsupported');
      return;
    }

    const mime = pickRecorderMime();
    // TEMP DIAGNOSTIC — remove after device hold-to-record logs are captured.
    console.info('[MediaCapture][record-start]', {
      audioTracks: stream.getAudioTracks().length,
      audioLabel: stream.getAudioTracks()[0]?.label ?? null,
      audioEnabled: stream.getAudioTracks()[0]?.enabled ?? null,
      audioReadyState: stream.getAudioTracks()[0]?.readyState ?? null,
      videoTracks: stream.getVideoTracks().length,
      mimeChosen: mime ?? '(browser default)',
      mimeSupported: mime ? MediaRecorder.isTypeSupported(mime) : null,
    });

    let recorder: MediaRecorder;
    try {
      recorder = mime
        ? new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 4_000_000 })
        : new MediaRecorder(stream);
    } catch {
      setErrorKind('unsupported');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const type = recorder.mimeType || mime || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      finishRecording(blob, recorder.mimeType || mime);
    };
    recorder.onerror = () => {
      recordingRef.current = false;
      setRecording(false);
      clearRecordTick();
      setErrorKind('unknown');
    };

    recorderRef.current = recorder;
    recordingRef.current = true;
    setRecording(true);
    setRecordProgress(0);
    recordStartedAtRef.current = Date.now();
    haptic.toggle();
    recorder.start(250);

    clearRecordTick();
    recordTickRef.current = setInterval(() => {
      const elapsed = Date.now() - recordStartedAtRef.current;
      setRecordProgress(Math.min(1, elapsed / MAX_MS));
      if (elapsed >= MAX_MS) stopRecording();
    }, 50);
  }, [allowVideo, errorKind, finishRecording, stopRecording]);

  const onShutterDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (starting || errorKind || capturing || recording) return;
    pressActiveRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (!allowVideo) return;
    clearHoldTimer();
    holdTimerRef.current = setTimeout(() => {
      if (!pressActiveRef.current) return;
      startRecording();
    }, HOLD_MS);
  };

  const onShutterUp = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!pressActiveRef.current) return;
    pressActiveRef.current = false;
    clearHoldTimer();
    if (recordingRef.current) {
      stopRecording();
      return;
    }
    void takePhoto();
  };

  const onShutterCancel = () => {
    pressActiveRef.current = false;
    clearHoldTimer();
    if (recordingRef.current) stopRecording();
  };

  const mirrored = facing === 'user';
  const ringStyle: CSSProperties = {
    background: `conic-gradient(#fff ${recordProgress * 360}deg, rgba(255,255,255,0.25) 0deg)`,
  };

  return (
    <div className="absolute inset-0 overflow-hidden rounded-[32px] bg-neutral-900 shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className={`absolute inset-0 h-full w-full object-cover ${
          mirrored ? 'scale-x-[-1]' : ''
        }`}
      />

      {starting && active ? (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40">
          <IconSpinner className="h-7 w-7 animate-spin text-white" />
        </div>
      ) : null}

      {!active && !preview ? (
        <div className="absolute inset-0 bg-neutral-900" aria-hidden />
      ) : null}

      {errorKind && active ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
          <p className="text-[15px] font-semibold">
            {errorKind === 'permission'
              ? 'Camera access is off'
              : errorKind === 'unsupported'
                ? 'Camera isn’t available here'
                : errorKind === 'busy'
                  ? 'Camera is in use'
                  : 'Couldn’t open the camera'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {errorKind === 'permission' ? (
              <button
                type="button"
                onClick={() => void openAppSettings()}
                className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-[13px] font-semibold text-black"
              >
                Open Settings
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void startCamera(facing)}
              className="inline-flex h-10 items-center justify-center rounded-full bg-white/20 px-4 text-[13px] font-semibold text-white"
            >
              Try again
            </button>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="absolute inset-0 z-20 bg-black">
          <PlaybackView src={preview.url} kind={preview.kind} />

          {textLayers.map((layer) => (
            <TextLayer
              key={layer.id}
              layer={layer}
              hidden={editingLayerId === layer.id}
              onChange={(next) => onTextLayerChange?.(next)}
              onEdit={(next) => onTextLayerEdit?.(next)}
            />
          ))}

          <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between px-3 pt-3">
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                onDiscardRequest?.();
              }}
              aria-label="Close preview"
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95"
            >
              <IconX className="h-6 w-6" />
            </button>
          </div>

          {/* Bottom-left compose caption — same field that lands in Create Post. */}
          <div className="pointer-events-auto absolute bottom-3 left-3 right-[4.5rem] z-30">
            {captionEditing || caption.trim() ? (
              <textarea
                ref={captionInputRef}
                value={caption}
                onChange={(e) =>
                  onCaptionChange?.(e.target.value.slice(0, captionMaxLength))
                }
                onBlur={() => {
                  if (!caption.trim()) setCaptionEditing(false);
                }}
                maxLength={captionMaxLength}
                rows={2}
                placeholder="+ Add caption"
                className="w-full resize-none rounded-2xl border border-white/15 bg-black/50 px-3.5 py-2.5 text-[15px] font-medium leading-snug text-white outline-none backdrop-blur-md placeholder:font-normal placeholder:text-white/55 focus:border-white/30"
              />
            ) : (
              <button
                type="button"
                onClick={() => {
                  haptic.toggle();
                  setCaptionEditing(true);
                }}
                className="inline-flex max-w-full items-center rounded-full bg-black/45 px-3.5 py-2 text-[14px] font-semibold text-white backdrop-blur-md transition active:scale-[0.98]"
              >
                + Add caption
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-0">
          <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between px-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white"
            >
              <IconX className="h-7 w-7" />
            </button>
            <button
              type="button"
              onClick={() => {
                haptic.toggle();
                setFlashOn((v) => !v);
              }}
              aria-label={flashOn ? 'Flash on' : 'Flash off'}
              aria-pressed={flashOn}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white"
            >
              {/* Flash stub — no torch wiring yet */}
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2L4 14h7l-1 8 10-14h-7l0-6z" strokeLinejoin="round" />
                {!flashOn ? <path d="M4 4l16 16" strokeLinecap="round" /> : null}
              </svg>
            </button>
          </div>

          <div className="pointer-events-auto absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-5 pb-5">
            <div className="relative flex w-full max-w-sm items-center justify-center">
              <button
                type="button"
                onPointerDown={onShutterDown}
                onPointerUp={onShutterUp}
                onPointerCancel={onShutterCancel}
                onContextMenu={(e) => e.preventDefault()}
                disabled={!active || starting || Boolean(errorKind) || capturing}
                aria-label={allowVideo ? 'Tap for photo, hold for video' : 'Take photo'}
                className="relative inline-flex h-[4.75rem] w-[4.75rem] touch-none items-center justify-center rounded-full disabled:opacity-40"
                style={recording ? ringStyle : undefined}
              >
                <span
                  className={`absolute inset-[3px] rounded-full ${
                    recording ? 'bg-transparent' : 'border-[3px] border-white/90'
                  }`}
                />
                <span
                  className={`relative rounded-full transition-all ${
                    recording
                      ? 'h-8 w-8 rounded-md bg-red-500'
                      : 'h-[3.55rem] w-[3.55rem] bg-white'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={flip}
                disabled={!active || starting || Boolean(errorKind) || recording}
                aria-label="Flip camera"
                className="absolute right-0 inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-md transition active:scale-95 disabled:opacity-40"
              >
                <IconSwitch className="h-5 w-5" />
              </button>
            </div>
            <p className="text-[12px] font-medium text-white/70">
              {allowVideo ? 'Tap photo · Hold video' : 'Tap for photo'}
            </p>
          </div>
        </div>
      )}

      {/* Preview-only right rail — privacy, text, save. No unwired live stubs. */}
      {preview ? (
        <div className="pointer-events-auto absolute right-2.5 top-3 z-30 flex flex-col items-end gap-3">
          <button
            type="button"
            aria-label={visibility === 'public' ? 'Public' : 'Only me'}
            onClick={() => {
              haptic.toggle();
              onVisibilityChange?.(
                visibility === 'public' ? 'only_me' : 'public',
              );
            }}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-black/35 pl-3 pr-2.5 text-white backdrop-blur-md transition active:scale-95"
          >
            <span className="text-[13px] font-semibold leading-none">
              {visibility === 'public' ? 'Public' : 'Only me'}
            </span>
            {visibility === 'public' ? (
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" strokeLinecap="round" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <ToolRailButton label="Add text" onClick={() => onOpenTextTool?.()}>
            Aa
          </ToolRailButton>
          <ToolRailButton
            disabled={saveUploading}
            label={
              saveUploading
                ? 'Uploading…'
                : preview.kind === 'video'
                  ? 'Share / save video'
                  : 'Save to Photos'
            }
            onClick={() => onSaveToDevice?.()}
          >
            {saveUploading ? (
              <IconSpinner className="h-5 w-5 animate-spin" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 3v12M7 10l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M5 19h14" strokeLinecap="round" />
              </svg>
            )}
          </ToolRailButton>
        </div>
      ) : null}
    </div>
  );
}
