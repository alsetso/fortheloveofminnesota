/**
 * Answer modes — user-facing “how hard should this answer work?”
 * Clients send a mode; the server maps to model + reasoning. Never accept raw model IDs from the client.
 */

export type AnswerMode = 'fast' | 'standard' | 'deep';

export const ANSWER_MODES: readonly AnswerMode[] = [
  'fast',
  'standard',
  'deep',
] as const;

export const DEFAULT_ANSWER_MODE: AnswerMode = 'standard';

export type AnswerModeCopy = {
  label: string;
  blurb: string;
  hint: string;
};

export const ANSWER_MODE_COPY: Record<AnswerMode, AnswerModeCopy> = {
  fast: {
    label: 'Fast',
    blurb: 'Quick answers',
    hint: 'Lower usage',
  },
  standard: {
    label: 'Standard',
    blurb: 'Balanced (recommended)',
    hint: 'Default',
  },
  deep: {
    label: 'Deep',
    blurb: 'Think harder',
    hint: 'Higher usage',
  },
};

export function isAnswerMode(v: unknown): v is AnswerMode {
  return v === 'fast' || v === 'standard' || v === 'deep';
}

export function parseAnswerMode(v: unknown): AnswerMode {
  return isAnswerMode(v) ? v : DEFAULT_ANSWER_MODE;
}

export type AnswerModeReasoningEffort = 'none' | 'low' | 'medium' | 'high';

export type AnswerModeConfig = {
  mode: AnswerMode;
  model: string;
  reasoning: {
    effort: AnswerModeReasoningEffort;
    summary: 'concise';
  };
};

function envModel(key: string): string | null {
  const v = process.env[key]?.trim();
  return v || null;
}

/**
 * Server-only allowlist. Env overrides:
 * - OPENAI_SUBJECT_MODEL (standard, and fallback for others)
 * - OPENAI_SUBJECT_MODEL_FAST
 * - OPENAI_SUBJECT_MODEL_DEEP
 */
export function resolveAnswerModeConfig(modeInput: unknown): AnswerModeConfig {
  const mode = parseAnswerMode(modeInput);
  const standardModel =
    envModel('OPENAI_SUBJECT_MODEL') || 'gpt-5-mini';
  const fastModel = envModel('OPENAI_SUBJECT_MODEL_FAST') || standardModel;
  const deepModel = envModel('OPENAI_SUBJECT_MODEL_DEEP') || standardModel;

  switch (mode) {
    case 'fast':
      return {
        mode,
        model: fastModel,
        reasoning: { effort: 'none', summary: 'concise' },
      };
    case 'deep':
      return {
        mode,
        model: deepModel,
        reasoning: { effort: 'medium', summary: 'concise' },
      };
    case 'standard':
    default:
      return {
        mode: 'standard',
        model: standardModel,
        reasoning: { effort: 'low', summary: 'concise' },
      };
  }
}

const MODE_PREF_KEY = 'ftlom:chat:answer_mode';

/** Last mode the user picked (any thread). */
export function readPreferredAnswerMode(): AnswerMode {
  if (typeof window === 'undefined') return DEFAULT_ANSWER_MODE;
  try {
    return parseAnswerMode(window.localStorage.getItem(MODE_PREF_KEY));
  } catch {
    return DEFAULT_ANSWER_MODE;
  }
}

export function writePreferredAnswerMode(mode: AnswerMode) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(MODE_PREF_KEY, mode);
  } catch {
    // ignore
  }
}
