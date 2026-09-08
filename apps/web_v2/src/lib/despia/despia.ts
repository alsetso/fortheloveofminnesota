/**
 * Despia runtime gate — use for every native bridge call.
 * Despia injects a userAgent containing "despia" inside the WKWebView shell.
 *
 * https://setup.despia.com/native-features/user-agent.md
 */

export function isDespia(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.userAgent.toLowerCase().includes('despia');
}

/** HealthKit and other iOS-only native bridges. False on Android Despia / browser. */
export function isDespiaIOS(): boolean {
  if (!isDespia() || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return ua.includes('iphone') || ua.includes('ipad');
}

export type DespiaBridge = (command: string, keys?: string[]) => Promise<unknown>;

/** Lazy import so browser builds don't hard-require the native package at call sites. */
export async function getDespia(): Promise<DespiaBridge | null> {
  if (!isDespia()) return null;
  const mod = await import('despia-native');
  return (mod.default ?? mod) as DespiaBridge;
}

export async function despiaCall(
  command: string,
  keys?: string[],
): Promise<unknown | null> {
  const despia = await getDespia();
  if (!despia) return null;
  return keys ? despia(command, keys) : despia(command);
}

export {
  disableDespiaAutoscroll,
  setDespiaAutoscrollEnabled,
} from '@/lib/despia/preventAutoscroll';

export { despiaHaptic, haptic } from '@/lib/despia/haptics';
export type { DespiaHaptic } from '@/lib/despia/haptics';

export {
  getMockStepCount,
  loadSharedStepCount,
  readStepCount,
  readTodayStepCount,
  requestStepSharing,
  stopStepSharing,
  STEP_COUNT_TYPE,
} from '@/lib/despia/healthKit';
export type {
  HealthKitDaySample,
  RequestStepSharingResult,
} from '@/lib/despia/healthKit';
export {
  getHealthStepsStatus,
  isHealthStepsShared,
  setHealthStepsStatus,
} from '@/lib/despia/healthStepsPreference';
export type { HealthStepsStatus } from '@/lib/despia/healthStepsPreference';

export {
  KEYBOARD_INSET,
  SAFE_AREA,
  SAFE_OR_KEYBOARD_BOTTOM,
  safeClearBottom,
  safeClearBottomKeyboard,
  safeClearTop,
  safePadBottom,
  safePadBottomKeyboard,
  safePadBottomTabOrKeyboard,
  safePadTop,
} from '@/lib/despia/safeArea';

export { readScreenRadiusPx } from '@/lib/despia/screenRadius';

export {
  abortSpeechRecognition,
  isSpeechRecognitionAvailable,
  startSpeechRecognition,
  stopSpeechRecognition,
  subscribeSpeechRecognition,
} from '@/lib/despia/speechRecognition';
export type {
  SpeechRecognitionEvent,
  StartSpeechRecognitionOptions,
} from '@/lib/despia/speechRecognition';
