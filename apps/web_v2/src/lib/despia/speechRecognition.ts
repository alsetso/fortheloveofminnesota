/**
 * Despia native speech recognition — on-device STT via speechrecognition://.
 * @see https://setup.despia.com/native-features/speech-recognition
 *
 * Also falls back to the Web Speech API polyfill / browser engine when present.
 */

import { despiaCall, isDespia } from '@/lib/despia/despia';

export type SpeechRecognitionResultEvent = {
  type: 'result';
  transcript: string;
  confidence?: number;
  isFinal: boolean;
  alternatives?: Array<{ transcript: string; confidence?: number }>;
};

export type SpeechRecognitionErrorEvent = {
  type: 'error';
  error: string;
  message?: string;
};

export type SpeechRecognitionLifecycleEvent = {
  type: 'start' | 'end';
};

export type SpeechRecognitionEvent =
  | SpeechRecognitionResultEvent
  | SpeechRecognitionErrorEvent
  | SpeechRecognitionLifecycleEvent;

type Listener = (event: SpeechRecognitionEvent) => void;

const listeners = new Set<Listener>();

let bridgeInstalled = false;
let webRecognition: SpeechRecognitionLike | null = null;

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  knownWords?: string[];
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultListEvent) => void) | null;
  onerror: ((event: { error: string; message?: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionResultListEvent = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string; confidence?: number };
    length: number;
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    onSpeechRecognitionEvent?: (event: SpeechRecognitionEvent) => void;
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

function emit(event: SpeechRecognitionEvent) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (err) {
      console.error('[speechRecognition] listener', err);
    }
  }
}

function ensureBridge() {
  if (bridgeInstalled || typeof window === 'undefined') return;
  bridgeInstalled = true;
  const prev = window.onSpeechRecognitionEvent;
  window.onSpeechRecognitionEvent = (event) => {
    prev?.(event);
    if (!event || typeof event !== 'object' || !('type' in event)) return;
    emit(event as SpeechRecognitionEvent);
  };
}

function getBrowserCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** True when Despia native STT or a Web Speech engine is available. */
export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  if (isDespia()) return true;
  return Boolean(getBrowserCtor());
}

export type StartSpeechRecognitionOptions = {
  language?: string;
  continuous?: boolean;
  interim?: boolean;
  knownWords?: string[];
};

export function subscribeSpeechRecognition(listener: Listener): () => void {
  ensureBridge();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function startSpeechRecognition(
  options: StartSpeechRecognitionOptions = {},
): Promise<boolean> {
  ensureBridge();
  const language = options.language ?? 'en-US';
  const continuous = options.continuous ?? true;
  const interim = options.interim ?? true;
  const knownWords = options.knownWords ?? [];

  if (isDespia()) {
    const params = new URLSearchParams({
      language,
      continuous: String(continuous),
      interim: String(interim),
    });
    let query = params.toString();
    if (knownWords.length > 0) {
      // Percent-encode each phrase once — URLSearchParams would double-encode.
      query += `&known_words=${knownWords.map(encodeURIComponent).join(',')}`;
    }
    await despiaCall(`speechrecognition://start?${query}`);
    return true;
  }

  const Ctor = getBrowserCtor();
  if (!Ctor) return false;

  stopSpeechRecognition();
  const recognition = new Ctor();
  webRecognition = recognition;
  recognition.lang = language;
  recognition.continuous = continuous;
  recognition.interimResults = interim;
  recognition.maxAlternatives = 1;
  if (knownWords.length > 0) recognition.knownWords = knownWords;

  recognition.onstart = () => emit({ type: 'start' });
  recognition.onend = () => {
    webRecognition = null;
    emit({ type: 'end' });
  };
  recognition.onerror = (event) => {
    emit({
      type: 'error',
      error: event.error,
      message: event.message,
    });
  };
  recognition.onresult = (event) => {
    let interimText = '';
    let finalText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const row = event.results[i];
      if (!row?.[0]) continue;
      if (row.isFinal) finalText += row[0].transcript;
      else interimText += row[0].transcript;
    }
    if (finalText) {
      emit({
        type: 'result',
        transcript: finalText,
        isFinal: true,
        confidence: event.results[event.resultIndex]?.[0]?.confidence,
      });
    } else if (interimText) {
      emit({
        type: 'result',
        transcript: interimText,
        isFinal: false,
      });
    }
  };

  try {
    recognition.start();
    return true;
  } catch (err) {
    console.error('[speechRecognition] start', err);
    webRecognition = null;
    return false;
  }
}

export async function stopSpeechRecognition(): Promise<void> {
  if (isDespia()) {
    await despiaCall('speechrecognition://stop');
  }
  try {
    webRecognition?.stop();
  } catch {
    /* already stopped */
  }
  webRecognition = null;
}

export async function abortSpeechRecognition(): Promise<void> {
  if (isDespia()) {
    await despiaCall('speechrecognition://abort');
  }
  try {
    webRecognition?.abort();
  } catch {
    /* already aborted */
  }
  webRecognition = null;
}
