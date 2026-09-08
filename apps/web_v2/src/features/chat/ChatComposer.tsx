'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { CHAT_ATTACHMENT_MAX_COUNT } from '@/lib/ai/chatAttachments';
import ChatAnswerModeSheet from '@/features/chat/ChatAnswerModeSheet';
import {
  enqueueChatAttachments,
  type PendingChatAttachment,
} from '@/features/chat/uploadChatAttachment';
import {
  ANSWER_MODE_COPY,
  DEFAULT_ANSWER_MODE,
  type AnswerMode,
} from '@/lib/ai/answerModes';
import {
  IconChevronDown,
  IconPlus,
  IconSpinner,
  IconX,
} from '@/features/map/dockCore/core/icons';
import { haptic } from '@/lib/despia/haptics';
import {
  abortSpeechRecognition,
  isSpeechRecognitionAvailable,
  startSpeechRecognition,
  stopSpeechRecognition,
  subscribeSpeechRecognition,
} from '@/lib/despia/speechRecognition';

function IconSendUp({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.25}
      className={className}
      aria-hidden
    >
      <path d="M12 19V5" strokeLinecap="round" />
      <path
        d="M6.5 10.5 12 5l5.5 5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMic({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.85}
      className={className}
      aria-hidden
    >
      <rect x="9" y="3.5" width="6" height="11" rx="3" strokeLinejoin="round" />
      <path d="M6.5 11.5a5.5 5.5 0 0 0 11 0" strokeLinecap="round" />
      <path d="M12 17v3.5M9.5 20.5h5" strokeLinecap="round" />
    </svg>
  );
}

const CHAT_KNOWN_WORDS = [
  'Minnesota',
  'Minneapolis',
  'Saint Paul',
  'Duluth',
  'Walleye',
  'State Fair',
  'For the Love of Minnesota',
];

export type ChatComposerSubmitPayload = {
  content: string;
  attachmentIds: string[];
  mode: AnswerMode;
};

type ChatComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (payload: ChatComposerSubmitPayload) => void;
  disabled?: boolean;
  /** Blocks send only — input stays editable so the user can draft the next turn. */
  submitting?: boolean;
  placeholder?: string;
  variant?: 'hero' | 'bar';
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  id?: string;
  threadId?: string | null;
  /** Clear attachments after a successful send (parent sets `[]`). */
  attachments: PendingChatAttachment[];
  onAttachmentsChange: (next: PendingChatAttachment[]) => void;
  /** Answer mode chip — omit onModeChange to hide. */
  mode?: AnswerMode;
  onModeChange?: (mode: AnswerMode) => void;
};

const LINE = 24;
const BAR_MAX_LINES = 5;
const HERO_MAX_LINES = 7;

function joinTranscript(prefix: string, spoken: string): string {
  const head = prefix.trimEnd();
  const tail = spoken.trim();
  if (!head) return tail;
  if (!tail) return head;
  const needsSpace = !/[\s([{/]$/.test(head);
  return needsSpace ? `${head} ${tail}` : `${head}${tail}`;
}

/**
 * Shared chat input — attachments, mic dictation, circular send.
 */
export default function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled = false,
  submitting = false,
  placeholder = 'Ask anything',
  variant = 'bar',
  inputRef,
  id = 'chat-composer',
  threadId = null,
  attachments,
  onAttachmentsChange,
  mode = DEFAULT_ANSWER_MODE,
  onModeChange,
}: ChatComposerProps) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const ref = inputRef ?? localRef;
  const valueRef = useRef(value);
  const prefixRef = useRef('');
  const attachmentsRef = useRef(attachments);
  const [listening, setListening] = useState(false);
  const [dictationError, setDictationError] = useState<string | null>(null);
  const [modeOpen, setModeOpen] = useState(false);
  const showMode = typeof onModeChange === 'function';

  const micAvailable = isSpeechRecognitionAvailable();
  const uploading = attachments.some((a) => a.uploading);
  const readyIds = attachments
    .filter((a) => !a.uploading && !a.error && !a.id.startsWith('pending_'))
    .map((a) => a.id);
  const canSend =
    (Boolean(value.trim()) || readyIds.length > 0) &&
    !disabled &&
    !submitting &&
    !uploading;
  const isHero = variant === 'hero';
  const maxH = (isHero ? HERO_MAX_LINES : BAR_MAX_LINES) * LINE;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    if (el.offsetParent === null && el.getClientRects().length === 0) return;
    const next = Math.min(Math.max(el.scrollHeight, LINE), maxH);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden';
  }, [value, maxH, ref, attachments.length]);

  useEffect(() => {
    return subscribeSpeechRecognition((event) => {
      if (event.type === 'start') {
        setListening(true);
        setDictationError(null);
        return;
      }
      if (event.type === 'result') {
        const next = joinTranscript(prefixRef.current, event.transcript);
        if (event.isFinal) {
          prefixRef.current = next;
          onChange(next);
        } else {
          onChange(next);
        }
        return;
      }
      if (event.type === 'error') {
        if (event.error === 'not-allowed') {
          setDictationError('Microphone access needed');
        } else if (event.error === 'no-speech') {
          setDictationError(null);
        } else if (event.error !== 'aborted') {
          setDictationError('Could not hear that — try again');
        }
        setListening(false);
        return;
      }
      if (event.type === 'end') {
        setListening(false);
      }
    });
  }, [onChange]);

  useEffect(() => {
    return () => {
      void abortSpeechRecognition();
    };
  }, []);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    if (listening) void stopSpeechRecognition();
    if (!canSend) return;
    onSubmit({ content: value.trim(), attachmentIds: readyIds, mode });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleMic = useCallback(async () => {
    if (disabled) return;
    haptic.toggle();
    setDictationError(null);

    if (listening) {
      await stopSpeechRecognition();
      setListening(false);
      return;
    }

    prefixRef.current = valueRef.current;
    const started = await startSpeechRecognition({
      language: 'en-US',
      continuous: true,
      interim: true,
      knownWords: CHAT_KNOWN_WORDS,
    });
    if (!started) {
      setDictationError('Voice input unavailable');
      setListening(false);
      return;
    }
    setListening(true);
  }, [disabled, listening]);

  const removeAttachment = (id: string) => {
    const next = attachmentsRef.current.filter((a) => {
      if (a.id === id && a.previewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(a.previewUrl);
      }
      return a.id !== id;
    });
    onAttachmentsChange(next);
  };

  const onFileInputChange = async (files: FileList | null) => {
    if (!files?.length) return;
    await enqueueChatAttachments({
      files: Array.from(files),
      current: attachmentsRef.current,
      threadId,
      onChange: onAttachmentsChange,
    });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      {attachments.length > 0 ? (
        <ul className="mb-2 flex flex-wrap gap-2 px-0.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="relative flex max-w-[10rem] items-center gap-2 rounded-2xl bg-black/[0.05] px-2 py-1.5 ring-1 ring-black/[0.06]"
            >
              {att.kind === 'image' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.previewUrl || att.public_url}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-bold text-foreground-muted ring-1 ring-black/[0.06]">
                  PDF
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-medium text-foreground">
                  {att.original_name || 'File'}
                </span>
                {att.uploading ? (
                  <span className="text-[11px] text-foreground-muted">Uploading…</span>
                ) : att.error ? (
                  <span className="text-[11px] text-red-700">{att.error}</span>
                ) : null}
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                aria-label="Remove attachment"
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-foreground-muted transition active:bg-black/[0.06]"
              >
                <IconX className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div
        className={`flex w-full items-end gap-1 bg-white ring-1 ring-black/[0.08] ${
          isHero
            ? 'rounded-[28px] px-3 py-2.5 shadow-[0_2px_12px_rgba(0,0,0,0.06)] sm:px-3.5 sm:py-3'
            : 'rounded-[24px] px-2.5 py-2 shadow-[0_1px_4px_rgba(0,0,0,0.05)]'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => void onFileInputChange(e.target.files)}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={disabled || attachments.length >= CHAT_ATTACHMENT_MAX_COUNT}
          aria-label="Attach image or PDF"
          className="grid h-9 w-9 shrink-0 place-items-center self-end rounded-full text-foreground-muted transition active:bg-black/[0.05] disabled:opacity-35"
        >
          <IconPlus className="h-5 w-5" />
        </button>

        <label htmlFor={id} className="sr-only">
          {placeholder}
        </label>
        <textarea
          ref={ref}
          id={id}
          value={value}
          onChange={(e) => {
            if (listening) prefixRef.current = e.target.value;
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          rows={1}
          disabled={disabled}
          placeholder={listening ? 'Listening…' : placeholder}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="on"
          spellCheck
          className="min-h-6 min-w-0 flex-1 resize-none bg-transparent py-1.5 text-[16px] leading-6 text-foreground outline-none placeholder:text-foreground-muted/50 disabled:opacity-50"
          style={{ height: LINE, maxHeight: maxH }}
        />

        {micAvailable ? (
          <button
            type="button"
            onClick={() => void toggleMic()}
            disabled={disabled}
            aria-label={listening ? 'Stop dictation' : 'Dictate with microphone'}
            aria-pressed={listening}
            className={`grid h-9 w-9 shrink-0 place-items-center self-end rounded-full transition active:scale-95 disabled:opacity-35 ${
              listening
                ? 'bg-red-600 text-white'
                : 'text-foreground-muted hover:bg-black/[0.05]'
            }`}
          >
            <IconMic
              className={`h-[1.15rem] w-[1.15rem] ${listening ? 'animate-pulse' : ''}`}
            />
          </button>
        ) : null}

        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          className={`grid h-9 w-9 shrink-0 place-items-center self-end rounded-full transition active:scale-95 disabled:opacity-35 ${
            canSend
              ? 'bg-[#2a6f8f] text-white'
              : 'bg-black/[0.08] text-foreground-muted'
          }`}
        >
          {submitting || uploading ? (
            <IconSpinner className="h-4 w-4 animate-spin" />
          ) : (
            <IconSendUp className="h-4 w-4" />
          )}
        </button>
      </div>
      {dictationError ? (
        <p className="mt-1.5 px-1 text-center text-[12px] text-red-700">
          {dictationError}
        </p>
      ) : null}

      {showMode ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={() => setModeOpen(true)}
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={modeOpen}
            aria-label={`Answer mode: ${ANSWER_MODE_COPY[mode].label}`}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-medium text-foreground-muted transition hover:bg-black/[0.04] active:bg-black/[0.06] disabled:opacity-40"
          >
            {ANSWER_MODE_COPY[mode].label}
            <IconChevronDown className="h-3.5 w-3.5 opacity-70" />
          </button>
        </div>
      ) : null}

      {showMode ? (
        <ChatAnswerModeSheet
          open={modeOpen}
          value={mode}
          onChange={onModeChange!}
          onClose={() => setModeOpen(false)}
        />
      ) : null}
    </form>
  );
}
