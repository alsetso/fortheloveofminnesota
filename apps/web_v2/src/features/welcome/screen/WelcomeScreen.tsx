'use client';

import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import { SETUP_PATH } from '@/lib/routes/routePolicy';
import DespiaAppFrame from '@/components/despia/DespiaAppFrame';
import SpinningHeartCanvas from '@/components/brand/SpinningHeartCanvas';

type Step = 'intro' | 'email' | 'signup' | 'password' | 'sending' | 'code';

const RESEND_COOLDOWN_SEC = 45;
const SEND_MIN_MS = 900;
const OTP_TIMEOUT_MS = 20_000;
const OTP_SEND_KEY = 'ftlomn_otp_last_send';
const EMAIL_STORAGE_KEY = 'user_email';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Check your connection and try again.`));
    }, ms);
    promise.then(
      (value) => { window.clearTimeout(t); resolve(value); },
      (err)   => { window.clearTimeout(t); reject(err); },
    );
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

function readStoredEmail(): string {
  if (typeof window === 'undefined') return '';
  try { return localStorage.getItem(EMAIL_STORAGE_KEY)?.trim().toLowerCase() ?? ''; }
  catch { return ''; }
}

function writeStoredEmail(email: string): void {
  if (typeof window === 'undefined') return;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  localStorage.setItem(EMAIL_STORAGE_KEY, normalized);
}

function friendlyAuthError(err: unknown, fallback: string): string {
  const raw   = err instanceof Error ? err.message : String(err ?? '');
  const lower = raw.toLowerCase();
  if (lower.includes('rate') || lower.includes('security') || lower.includes('too many'))
    return 'Please wait a moment before requesting another code.';
  if (lower.includes('expired') || lower.includes('otp_expired'))
    return 'That code expired — request a new one.';
  if (lower.includes('invalid') || lower.includes('token'))
    return "That code didn't match. Try again.";
  if (lower.includes('invalid login') || lower.includes('invalid credentials'))
    return "Email or password didn't match. Try again or use a code.";
  if (lower.includes('user not found') || lower.includes('signups not allowed'))
    return 'No account for that email yet — create one instead.';
  if (lower.includes('already registered') || lower.includes('already been registered'))
    return 'That email already has an account — sign in instead.';
  if (lower.includes('password') && lower.includes('weak'))
    return 'Choose a stronger password (at least 8 characters).';
  return fallback;
}

function readLastSendAt(email: string): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(OTP_SEND_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { email?: string; at?: number };
    if (parsed.email !== email || typeof parsed.at !== 'number') return 0;
    return parsed.at;
  } catch { return 0; }
}

function writeLastSendAt(email: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OTP_SEND_KEY, JSON.stringify({ email, at: Date.now() }));
}

function cooldownRemaining(email: string): number {
  const elapsed = Date.now() - readLastSendAt(email);
  return Math.max(0, Math.ceil((RESEND_COOLDOWN_SEC * 1000 - elapsed) / 1000));
}

// ── Design tokens ──────────────────────────────────────────────────────────

const BG           = '#0B0D10';
const INK          = '#FFFaf5';
const MUTED        = 'rgba(255,250,245,0.55)';
const SUBTLE       = 'rgba(255,250,245,0.22)';
const LINE         = 'rgba(255,255,255,0.10)';
const CARD         = 'rgba(255,255,255,0.05)';
const INPUT_BG     = 'rgba(255,255,255,0.08)';
const ACCENT_FILL  = '#E8F0E8';
const ACCENT_TEXT  = '#0F2015';

/**
 * Welcome / auth — email lookup → signup (name+password) | password | OTP.
 * Never creates an auth user on bare email submit.
 * Visual style matches the cold-splash dark-glass aesthetic.
 */
export default function WelcomeScreen() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const nextPath     = searchParams.get('next') || SETUP_PATH;

  const {
    user, authStatus, needsAccountSelection,
    signInWithOtp, verifyOtp, signInWithPassword, signUpWithPassword,
  } = useAuthSafe();

  const [step,            setStep]            = useState<Step>('intro');
  const [email,           setEmail]           = useState('');
  const [otp,             setOtp]             = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName,       setFirstName]       = useState('');
  const [lastName,        setLastName]        = useState('');
  const [hasPasswordOption, setHasPasswordOption] = useState(false);
  const [accountExists,   setAccountExists]   = useState(false);
  const [busy,            setBusy]            = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [resendIn,        setResendIn]        = useState(0);
  const [emailFocused,    setEmailFocused]    = useState(false);
  const [emailTouched,    setEmailTouched]    = useState(false);

  const emailRef   = useRef<HTMLInputElement>(null);
  const codeRef    = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const sendLock   = useRef(false);

  const formInCard      = step !== 'intro';
  const showBackBar     = step !== 'intro' && step !== 'sending';
  const emailTrimmed    = email.trim();
  const emailIsValid    = isValidEmail(emailTrimmed);
  const emailShowInvalid = emailTouched && emailTrimmed.length > 0 && !emailIsValid;
  const canContinueEmail = emailIsValid && !busy;
  const emailCtaInHeader = step === 'email' && emailFocused;

  const goStep = (next: Step) => {
    setStep(next);
    setError(null);
    if (next !== 'email') {
      setEmailFocused(false);
      setEmailTouched(false);
    }
  };

  const finishAuth = () => {
    const dest = needsAccountSelection || !nextPath.startsWith('/') ? SETUP_PATH : nextPath;
    router.replace(dest);
    router.refresh();
  };

  useEffect(() => {
    const stored = readStoredEmail();
    if (stored) setEmail(stored);
  }, []);

  useEffect(() => {
    if (authStatus === 'unknown' || !user) return;
    const dest = needsAccountSelection || !nextPath.startsWith('/') ? SETUP_PATH : nextPath;
    router.replace(dest);
  }, [authStatus, user, needsAccountSelection, router, nextPath]);

  useEffect(() => {
    if (step === 'email') {
      const stored = readStoredEmail();
      if (stored) setEmail(stored);
      const t = setTimeout(() => emailRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
    if (step === 'code') {
      const t = setTimeout(() => codeRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
    if (step === 'password' || step === 'signup') {
      const t = setTimeout(() => passwordRef.current?.focus(), 180);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  useEffect(() => {
    if (step !== 'code' || !email) return;
    setResendIn(cooldownRemaining(email));
    const id = window.setInterval(() => setResendIn(cooldownRemaining(email)), 500);
    return () => window.clearInterval(id);
  }, [step, email]);

  const lookupEmail = async (e?: FormEvent) => {
    e?.preventDefault();
    if (sendLock.current || busy) return;
    setError(null);
    setEmailTouched(true);
    const normalized = email.trim().toLowerCase();
    if (!isValidEmail(normalized)) {
      setError('Enter a valid email — like name@example.com.');
      return;
    }
    setEmail(normalized);
    writeStoredEmail(normalized);
    sendLock.current = true;
    setBusy(true);
    try {
      const res = await withTimeout(
        fetch('/api/auth/email-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalized }),
        }),
        OTP_TIMEOUT_MS,
        'Checking email',
      );
      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) throw new Error('Could not check email. Please try again.');
      const body = (await res.json().catch(() => null)) as {
        exists?: boolean; hasPassword?: boolean; error?: string;
      } | null;
      if (!res.ok || !body || typeof body.exists !== 'boolean')
        throw new Error(body?.error ?? 'Could not check email.');

      if (body.exists) {
        setAccountExists(true);
        if (body.hasPassword) {
          setHasPasswordOption(true);
          setPassword('');
          goStep('password');
          return;
        }
        setHasPasswordOption(false);
        await sendCodeInternal(normalized);
        return;
      }
      setAccountExists(false);
      setHasPasswordOption(false);
      setPassword('');
      setConfirmPassword('');
      goStep('signup');
    } catch (err) {
      setError(friendlyAuthError(err, 'Could not check email. Please try again.'));
    } finally {
      setBusy(false);
      sendLock.current = false;
    }
  };

  const sendCodeInternal = async (normalized: string) => {
    const wait = cooldownRemaining(normalized);
    if (wait > 0) {
      goStep('code');
      setResendIn(wait);
      setError(`You can request another code in ${wait}s.`);
      return;
    }
    setOtp('');
    goStep('sending');
    const started = Date.now();
    await withTimeout(signInWithOtp(normalized), OTP_TIMEOUT_MS, 'Sending code');
    writeLastSendAt(normalized);
    writeStoredEmail(normalized);
    const remaining = Math.max(0, SEND_MIN_MS - (Date.now() - started));
    if (remaining) await new Promise((r) => setTimeout(r, remaining));
    goStep('code');
    setResendIn(RESEND_COOLDOWN_SEC);
  };

  const sendCode = async () => {
    if (sendLock.current || busy) return;
    const normalized = email.trim().toLowerCase();
    setError(null);
    sendLock.current = true;
    setBusy(true);
    try {
      await sendCodeInternal(normalized);
    } catch (err) {
      goStep(hasPasswordOption ? 'password' : 'email');
      setError(friendlyAuthError(err, 'Could not send code. Please try again.'));
    } finally {
      setBusy(false);
      sendLock.current = false;
    }
  };

  const resendCode = async () => {
    if (busy || sendLock.current) return;
    const normalized = email.trim().toLowerCase();
    const wait = cooldownRemaining(normalized);
    if (wait > 0) { setResendIn(wait); return; }
    setError(null);
    setOtp('');
    sendLock.current = true;
    setBusy(true);
    goStep('sending');
    const started = Date.now();
    try {
      await withTimeout(signInWithOtp(normalized), OTP_TIMEOUT_MS, 'Sending code');
      writeLastSendAt(normalized);
      writeStoredEmail(normalized);
      const remaining = Math.max(0, SEND_MIN_MS - (Date.now() - started));
      if (remaining) await new Promise((r) => setTimeout(r, remaining));
      goStep('code');
      setResendIn(RESEND_COOLDOWN_SEC);
    } catch (err) {
      goStep('code');
      setError(friendlyAuthError(err, 'Failed to resend code.'));
    } finally {
      setBusy(false);
      sendLock.current = false;
      setTimeout(() => codeRef.current?.focus(), 100);
    }
  };

  const verifyCode = async (code: string) => {
    if (code.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const normalized = email.trim().toLowerCase();
      await withTimeout(verifyOtp(normalized, code, 'email'), OTP_TIMEOUT_MS, 'Signing in');
      writeStoredEmail(normalized);
      if (!accountExists) {
        fetch('/api/legal/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'signup', platform: 'ios2' }),
        }).catch(() => undefined);
      }
      finishAuth();
    } catch (err) {
      setError(friendlyAuthError(err, 'Invalid code. Please try again.'));
      setOtp('');
      setTimeout(() => codeRef.current?.focus(), 100);
    } finally {
      setBusy(false);
    }
  };

  const onPasswordSignIn = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    const normalized = email.trim().toLowerCase();
    if (!password) { setError('Enter your password.'); return; }
    setBusy(true);
    setError(null);
    try {
      await withTimeout(signInWithPassword(normalized, password), OTP_TIMEOUT_MS, 'Signing in');
      writeStoredEmail(normalized);
      finishAuth();
    } catch (err) {
      setError(friendlyAuthError(err, 'Could not sign in. Try again or use a code.'));
    } finally {
      setBusy(false);
    }
  };

  const onSignup = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy || sendLock.current) return;
    const normalized = email.trim().toLowerCase();
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn) { setError('Add your first name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirmPassword) { setError("Passwords don't match."); return; }
    setBusy(true);
    setError(null);
    sendLock.current = true;
    try {
      const { sessionCreated } = await withTimeout(
        signUpWithPassword({ email: normalized, password, firstName: fn, lastName: ln }),
        OTP_TIMEOUT_MS,
        'Creating account',
      );
      writeStoredEmail(normalized);
      if (sessionCreated) {
        fetch('/api/legal/accept', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ method: 'signup', platform: 'ios2' }),
        }).catch(() => undefined);
        finishAuth();
        return;
      }
      await sendCodeInternal(normalized);
    } catch (err) {
      goStep('signup');
      setError(friendlyAuthError(err, 'Could not create account. Please try again.'));
    } finally {
      setBusy(false);
      sendLock.current = false;
    }
  };

  const onCodeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    setError(null);
    if (digits.length === 6) void verifyCode(digits);
  };

  const onBack = () => {
    if (step === 'email') goStep('intro');
    else if (step === 'signup' || step === 'password') {
      setPassword('');
      setConfirmPassword('');
      goStep('email');
    } else if (step === 'code') {
      setOtp('');
      if (hasPasswordOption) goStep('password');
      else goStep('email');
    }
  };

  // ── Input shared style ─────────────────────────────────────────────────────

  const inputCls = 'mt-2 h-14 w-full rounded-2xl border px-4 text-base outline-none transition focus:border-white/30';
  const inputStyle = {
    backgroundColor: INPUT_BG,
    borderColor: LINE,
    color: INK,
  } as const;

  const inputSmCls = 'mt-2 h-12 w-full rounded-2xl border px-4 text-base outline-none transition focus:border-white/30';

  const labelCls  = 'text-left text-sm font-medium';
  const labelStyle = { color: MUTED } as const;

  // ── Legal ──────────────────────────────────────────────────────────────────

  const legal = (
    <p className="pt-0.5 text-center text-[10px] leading-relaxed" style={{ color: SUBTLE }}>
      By continuing you agree to our{' '}
      <Link href="/tos" className="underline underline-offset-2" style={{ color: MUTED }}>Terms</Link>{' '}
      and{' '}
      <Link href="/privacy" className="underline underline-offset-2" style={{ color: MUTED }}>Privacy Policy</Link>.
    </p>
  );

  return (
    <DespiaAppFrame
      scroll={false}
      style={{ backgroundColor: BG }}
      header={
        showBackBar ? (
          <div className="welcome-bar-in flex items-center justify-between gap-3 px-4 pb-2 pt-3">
            <button
              type="button"
              onClick={onBack}
              className="despia-touch-target inline-flex flex-row items-center gap-1.5 rounded-full border py-2 pl-2.5 pr-3.5 text-sm font-medium transition active:scale-[0.98]"
              style={{ color: INK, borderColor: LINE, backgroundColor: 'rgba(255,255,255,0.07)' }}
              aria-label="Back"
            >
              <ArrowLeftIcon />
              <span className="relative leading-none">Back</span>
            </button>
            {emailCtaInHeader ? (
              <button
                type="submit"
                form="welcome-email-form"
                disabled={!canContinueEmail}
                className="despia-touch-target inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-40"
                style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
              >
                Continue
              </button>
            ) : null}
          </div>
        ) : undefined
      }
      footer={
        <div className="flex flex-col justify-end px-5 pb-3 pt-3">
          <div className="mx-auto flex w-full max-w-sm flex-col gap-2.5">

            {step === 'intro' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const stored = readStoredEmail();
                    if (stored) setEmail(stored);
                    goStep('email');
                  }}
                  className="despia-touch-target flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition active:scale-[0.99]"
                  style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
                >
                  Come on in
                </button>
                <p className="text-center text-[12px] leading-snug" style={{ color: SUBTLE }}>
                  Sign in with email — password or a one-time code.
                </p>
              </>
            )}

            {step === 'email' && !emailCtaInHeader && (
              <button
                type="submit"
                form="welcome-email-form"
                disabled={!canContinueEmail}
                className="despia-touch-target flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40"
                style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
              >
                {busy ? 'One sec…' : 'Continue'}
              </button>
            )}

            {step === 'signup' && (
              <button
                type="submit"
                form="welcome-signup-form"
                disabled={busy}
                className="despia-touch-target flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40"
                style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
              >
                {busy ? 'Creating…' : 'Create account'}
              </button>
            )}

            {step === 'password' && (
              <>
                <button
                  type="submit"
                  form="welcome-password-form"
                  disabled={busy || !password}
                  className="despia-touch-target flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40"
                  style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
                >
                  {busy ? 'One sec…' : 'Sign in'}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void sendCode()}
                  className="despia-touch-target text-center text-sm font-medium underline-offset-2 hover:underline disabled:no-underline disabled:opacity-40"
                  style={{ color: MUTED }}
                >
                  Email me a one-time code instead
                </button>
              </>
            )}

            {step === 'sending' && (
              <div
                className="flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold"
                style={{ backgroundColor: 'rgba(232,240,232,0.15)', color: INK, opacity: 0.85 }}
                aria-live="polite"
              >
                Sending it over…
              </div>
            )}

            {step === 'code' && (
              <>
                <button
                  type="submit"
                  form="welcome-code-form"
                  disabled={busy || otp.length !== 6}
                  className="despia-touch-target flex h-[3.15rem] w-full items-center justify-center rounded-2xl text-[15px] font-semibold transition active:scale-[0.99] disabled:opacity-40"
                  style={{ backgroundColor: ACCENT_FILL, color: ACCENT_TEXT }}
                >
                  {busy && otp.length === 6 ? 'One sec…' : 'You bet'}
                </button>
                <button
                  type="button"
                  disabled={busy || resendIn > 0}
                  onClick={() => void resendCode()}
                  className="despia-touch-target text-center text-sm font-medium underline-offset-2 hover:underline disabled:no-underline disabled:opacity-40"
                  style={{ color: MUTED }}
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                </button>
              </>
            )}

            {legal}
          </div>
        </div>
      }
      contentClassName={`min-h-0 flex-1 ${showBackBar ? 'px-5 pt-1 pb-1' : 'px-5 pt-3 pb-1'}`}
    >
      {/* ── Intro — spinning heart + brand + tagline ── */}
      {!formInCard ? (
        <div className="welcome-fade-up flex min-h-0 flex-1 flex-col items-center justify-center gap-0 text-center">
          {/* Heart with ambient glow */}
          <div className="relative mb-1 flex items-center justify-center">
            <div
              className="absolute h-44 w-44 rounded-full"
              style={{
                background: 'radial-gradient(circle, rgba(248,113,113,0.18) 0%, transparent 70%)',
                filter: 'blur(10px)',
              }}
              aria-hidden
            />
            <SpinningHeartCanvas className="relative h-36 w-36" />
          </div>

          <p
            className="text-[10px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: SUBTLE }}
          >
            For the Love of Minnesota
          </p>
          <h1
            className="mt-5 max-w-[17rem] text-[1.55rem] font-semibold leading-snug tracking-tight"
            style={{
              color: INK,
              fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif',
            }}
          >
            Stand together.<br />Work together.
          </h1>
          <p className="mt-3 max-w-[16rem] text-[0.95rem] leading-relaxed" style={{ color: MUTED }}>
            Tools for your block — and your neighbors.
          </p>
        </div>
      ) : (
        /* ── Form steps — compact brand header + dark glass card ── */
        <div className="flex min-h-0 flex-1 flex-col gap-4">
          {/* Mini brand bar */}
          <div className="flex flex-col items-center gap-1 pt-2">
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-16 w-16 rounded-full"
                style={{
                  background: 'radial-gradient(circle, rgba(248,113,113,0.18) 0%, transparent 70%)',
                  filter: 'blur(6px)',
                }}
                aria-hidden
              />
              <SpinningHeartCanvas className="relative h-14 w-14" />
            </div>
            <p
              className="text-[9px] font-semibold uppercase tracking-[0.22em]"
              style={{ color: SUBTLE }}
            >
              For the Love of Minnesota
            </p>
          </div>

          {/* Glass card */}
          <div
            key={step === 'sending' ? 'sending' : step}
            className="welcome-morph-in relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[1.75rem] px-6 py-7"
            style={{ backgroundColor: CARD, border: `1px solid ${LINE}` }}
          >

            {step === 'email' && (
              <form
                id="welcome-email-form"
                onSubmit={lookupEmail}
                className="mx-auto flex w-full max-w-sm flex-col gap-5"
              >
                <div className="text-center">
                  <p className="text-[1.35rem] font-semibold tracking-tight"
                    style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}>
                    What&apos;s your email?
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    We&apos;ll check if you already have an account — then password or a one-time code.
                  </p>
                </div>
                <label className={labelCls} style={labelStyle}>
                  Email
                  <input
                    ref={emailRef}
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    enterKeyHint="go"
                    spellCheck={false}
                    autoCapitalize="none"
                    autoCorrect="off"
                    value={email}
                    aria-invalid={emailShowInvalid || undefined}
                    aria-describedby={emailShowInvalid ? 'welcome-email-hint' : undefined}
                    onChange={(e) => {
                      const next = e.target.value;
                      setEmail(next);
                      setError(null);
                      if (!emailTouched && next.length > 0) setEmailTouched(true);
                      if (isValidEmail(next)) writeStoredEmail(next);
                    }}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => {
                      setEmailTouched(true);
                      const normalized = email.trim().toLowerCase();
                      if (normalized) { setEmail(normalized); writeStoredEmail(normalized); }
                      window.setTimeout(() => setEmailFocused(false), 180);
                    }}
                    className={inputCls}
                    style={{
                      ...inputStyle,
                      borderColor: emailShowInvalid ? 'rgba(248,113,113,0.7)' : LINE,
                    }}
                    placeholder="you@example.com"
                  />
                </label>
                {emailShowInvalid && (
                  <p id="welcome-email-hint" className="text-sm" style={{ color: 'rgba(248,113,113,0.9)' }}>
                    That doesn&apos;t look like an email yet.
                  </p>
                )}
                {error && <p className="text-sm" style={{ color: 'rgba(248,113,113,0.9)' }}>{error}</p>}
              </form>
            )}

            {step === 'signup' && (
              <form
                id="welcome-signup-form"
                onSubmit={onSignup}
                className="mx-auto flex w-full max-w-sm flex-col gap-4"
              >
                <div className="text-center">
                  <p className="text-[1.35rem] font-semibold tracking-tight"
                    style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}>
                    Create your account
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    Name and a password for{' '}
                    <span className="font-medium" style={{ color: INK }}>{email}</span>
                    . We&apos;ll verify the email next.
                  </p>
                </div>
                <label className={labelCls} style={labelStyle}>
                  First name
                  <input type="text" autoComplete="given-name" value={firstName}
                    onChange={(e) => { setFirstName(e.target.value); setError(null); }}
                    className={inputSmCls} style={inputStyle} placeholder="First" />
                </label>
                <label className={labelCls} style={labelStyle}>
                  Last name
                  <input type="text" autoComplete="family-name" value={lastName}
                    onChange={(e) => { setLastName(e.target.value); setError(null); }}
                    className={inputSmCls} style={inputStyle} placeholder="Last" />
                </label>
                <label className={labelCls} style={labelStyle}>
                  Password
                  <input ref={passwordRef} type="password" autoComplete="new-password" value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className={inputSmCls} style={inputStyle} placeholder="At least 8 characters" />
                </label>
                <label className={labelCls} style={labelStyle}>
                  Confirm password
                  <input type="password" autoComplete="new-password" value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                    className={inputSmCls} style={inputStyle} placeholder="Again" />
                </label>
                {error && <p className="text-sm" style={{ color: 'rgba(248,113,113,0.9)' }}>{error}</p>}
              </form>
            )}

            {step === 'password' && (
              <form
                id="welcome-password-form"
                onSubmit={onPasswordSignIn}
                className="mx-auto flex w-full max-w-sm flex-col gap-5"
              >
                <div className="text-center">
                  <p className="text-[1.35rem] font-semibold tracking-tight"
                    style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}>
                    Welcome back
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    Sign in as{' '}
                    <span className="font-medium" style={{ color: INK }}>{email}</span>
                  </p>
                </div>
                <label className={labelCls} style={labelStyle}>
                  Password
                  <input
                    ref={passwordRef}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(null); }}
                    className={inputCls}
                    style={inputStyle}
                    placeholder="Your password"
                  />
                </label>
                {error && <p className="text-sm" style={{ color: 'rgba(248,113,113,0.9)' }}>{error}</p>}
              </form>
            )}

            {step === 'sending' && (
              <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5" aria-live="polite">
                <div className="text-center">
                  <p className="text-[1.35rem] font-semibold tracking-tight"
                    style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}>
                    {accountExists ? 'Welcome back' : 'Sending your code'}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    {accountExists ? 'Sending a one-time code to ' : 'On its way to '}
                    <span className="font-medium" style={{ color: INK }}>{email}</span>
                  </p>
                </div>
                <div className="relative h-14 w-full overflow-hidden">
                  <div className="welcome-mail-slide absolute top-1/2 flex -translate-y-1/2 items-center justify-center">
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
                      style={{ backgroundColor: 'rgba(232,240,232,0.15)', border: `1px solid ${LINE}` }}
                    >
                      <MailIcon />
                    </span>
                  </div>
                </div>
              </div>
            )}

            {step === 'code' && (
              <form
                id="welcome-code-form"
                onSubmit={(e) => { e.preventDefault(); void verifyCode(otp); }}
                className="mx-auto flex w-full max-w-sm flex-col gap-5"
              >
                <div className="text-center">
                  <p className="text-[1.35rem] font-semibold tracking-tight"
                    style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}>
                    Enter your code
                  </p>
                  <p className="mt-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    {accountExists ? 'We found your account. Code sent to ' : 'Sent to '}
                    <span className="font-medium" style={{ color: INK }}>{email}</span>
                  </p>
                </div>
                <input
                  ref={codeRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={onCodeChange}
                  maxLength={6}
                  className="h-16 w-full rounded-2xl border bg-transparent px-4 text-center text-[1.75rem] tracking-[0.4em] outline-none transition focus:border-white/30"
                  style={{ color: INK, borderColor: LINE, backgroundColor: INPUT_BG }}
                  placeholder="••••••"
                  aria-label="Verification code"
                />
                {error && <p className="text-center text-sm" style={{ color: 'rgba(248,113,113,0.9)' }}>{error}</p>}
              </form>
            )}

          </div>
        </div>
      )}

      <style>{`
        @keyframes welcomeFadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcomeBarIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes welcomeMorphIn {
          from { opacity: 0; transform: scale(0.98) translateY(8px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes welcomeMailSlide {
          0%   { left: -3.5rem; opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: calc(100% + 0.5rem); opacity: 0; }
        }
        .welcome-fade-up    { animation: welcomeFadeUp 0.55s ease-out both; }
        .welcome-bar-in     { animation: welcomeBarIn 0.28s ease-out both; }
        .welcome-morph-in   { animation: welcomeMorphIn 0.34s ease-out both; }
        .welcome-mail-slide { animation: welcomeMailSlide 1.05s cubic-bezier(0.4,0,0.2,1) infinite; }
      `}</style>
    </DespiaAppFrame>
  );
}

function MailIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
