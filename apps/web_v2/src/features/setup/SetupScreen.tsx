'use client';

import type { User } from '@supabase/supabase-js';
import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useRouter } from 'next/navigation';
import {
  AccountAvatar,
  useAuthSafe,
  type AccountRow,
} from '@/features/auth';
import { WELCOME_PATH } from '@/lib/routes/routePolicy';
import {
  normalizeUsername,
  updateAccountProfile,
  uploadAccountImage,
  validateUsername,
  generateRandomUsername,
  checkUsernameAvailable,
} from '@/features/account/accountProfile';
import {
  isAccountComplete,
  isAccountDeactivated,
  isEmailVerified,
  isPasswordSet,
} from '@/lib/account/accountCompleteness';
import { safePadBottom } from '@/lib/despia/safeArea';
import { haptic } from '@/lib/despia/haptics';
import {
  getWarmedChosenAvatarId,
  warmupSetupAvatars,
  getSetupAvatarSex,
  hydrateSetupAvatarSexFromCatalog,
  selectSetupAvatar,
  subscribeSetupAvatarSex,
  type SetupAvatarSex,
} from '@/features/setup/setupAvatarStore';
import { MAP_DOCK_DOCK_PAD_HALF_PX } from '@/features/map/dockCore/core/mapDockTokens';

const DOCK_PAD = MAP_DOCK_DOCK_PAD_HALF_PX;
const ACCENT = '#2F5D4A';

const CHIP_YES =
  'min-w-[3.25rem] flex-1 rounded-full border border-green-700/20 bg-green-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(22,163,74,0.35)] transition active:scale-95 hover:bg-green-500 disabled:opacity-60';
const CHIP_NO =
  'min-w-[3.25rem] flex-1 rounded-full border border-red-700/20 bg-red-600 px-3 py-1.5 text-[12px] font-bold text-white shadow-[0_4px_14px_rgba(220,38,38,0.35)] transition active:scale-95 hover:bg-red-500 disabled:opacity-60';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

/**
 * Locked onboarding funnel:
 *   verify email → set password → one profile card → POST /onboard
 *
 * Profile card collects the four fields the gate actually needs:
 *   avatar (world mesh) · photo (image_url) · name · username
 * Completeness = username + image_url + onboarded === true.
 * Demo 12-steps run after this, on the real /game map.
 */
type SetupPhase = 'verify_email' | 'set_password' | 'profile';

const RESEND_COOLDOWN_SEC = 45;
const OTP_TIMEOUT_MS = 20_000;
const NAME_MAX = 40;
const BIO_MIN = 8;
const BIO_MAX = 280;
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

type ProfileField = 'photo' | 'sex' | 'first' | 'last' | 'username' | 'bio';
type ProfileIssues = Partial<Record<ProfileField, string>>;

function validatePersonName(raw: string, which: 'first' | 'last'): string | null {
  const value = raw.trim();
  const label = which === 'first' ? 'first name' : 'last name';
  if (!value) return `Enter your ${label}.`;
  if (value.length > NAME_MAX) return `That ${label} is too long.`;
  const letters = value.replace(/[^\p{L}]/gu, '');
  if (letters.length < 2) return `Your ${label} needs at least 2 letters.`;
  if (!/^[\p{L}][\p{L} .'-]*$/u.test(value)) {
    return `Use letters in your ${label}.`;
  }
  return null;
}

function validateBio(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null; // optional — can be added later from Profile
  if (value.length < BIO_MIN) return `Bio needs at least ${BIO_MIN} characters.`;
  if (value.length > BIO_MAX) return `Bio must be ${BIO_MAX} characters or less.`;
  return null;
}

function usernameFail(raw: string, status: UsernameStatus): string | null {
  const value = raw.trim();
  if (!value) return 'Choose a username.';
  if (validateUsername(value) !== null) {
    return 'Usernames are 3–30 letters, numbers, _ or -.';
  }
  if (status === 'checking') return 'Checking if that username is free…';
  if (status === 'taken') return 'That username is taken. Try another.';
  if (status === 'invalid') return 'Usernames are 3–30 letters, numbers, _ or -.';
  if (status !== 'available') return 'Choose a username that’s free.';
  return null;
}

function profileIssues(args: {
  hasPhoto: boolean;
  photoHint: string | null;
  pickedSex: SetupAvatarSex | null;
  firstName: string;
  lastName: string;
  username: string;
  usernameStatus: UsernameStatus;
  bio: string;
}): ProfileIssues {
  const next: ProfileIssues = {};
  const photo = args.photoHint ?? (args.hasPhoto ? null : 'Add a photo of you.');
  const sex = args.pickedSex ? null : 'Pick male or female.';
  const first = validatePersonName(args.firstName, 'first');
  const last = validatePersonName(args.lastName, 'last');
  const username = usernameFail(args.username, args.usernameStatus);
  const bio = validateBio(args.bio);
  if (photo) next.photo = photo;
  if (sex) next.sex = sex;
  if (first) next.first = first;
  if (last) next.last = last;
  if (username) next.username = username;
  if (bio) next.bio = bio;
  return next;
}

function FieldFail({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-1 text-[10px] font-medium leading-snug text-red-600" role="alert">
      {message}
    </p>
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = window.setTimeout(() => {
      reject(new Error(`${label} timed out. Check your connection and try again.`));
    }, ms);
    promise.then(
      (value) => {
        window.clearTimeout(t);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(t);
        reject(err);
      },
    );
  });
}

function resolvePhase(user: User | null): SetupPhase {
  if (!isEmailVerified(user)) return 'verify_email';
  if (!isPasswordSet(user)) return 'set_password';
  return 'profile';
}

async function pickAvailableUsername(preferred?: string | null): Promise<string> {
  if (preferred && validateUsername(preferred) === null) {
    const ok = await checkUsernameAvailable(preferred);
    if (ok) return normalizeUsername(preferred);
  }
  for (let i = 0; i < 8; i += 1) {
    const candidate = generateRandomUsername('mn');
    if (await checkUsernameAvailable(candidate)) return candidate;
  }
  return generateRandomUsername('mn');
}

export default function SetupScreen() {
  const {
    account,
    accounts,
    user,
    isLoading,
    applyAccount,
    refreshAccount,
    signInWithOtp,
    verifyOtp,
    setPassword,
    refreshUser,
    signOut,
    clearAccountSelection,
  } = useAuthSafe();
  const router = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seededUsernameFor = useRef<string | null>(null);
  const checkedAvailableUsernameRef = useRef<string | null>(null);
  const verifySentFor = useRef<string | null>(null);

  const [phase, setPhase] = useState<SetupPhase>(() => resolvePhase(user));

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoHint, setPhotoHint] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const lastOtpSend = useRef(0);

  const pickedSex = useSyncExternalStore(
    subscribeSetupAvatarSex,
    getSetupAvatarSex,
    getSetupAvatarSex,
  );

  useEffect(() => {
    setPhase(resolvePhase(user));
  }, [user?.id, user?.email_confirmed_at, user?.user_metadata?.password_set]);

  useEffect(() => {
    void warmupSetupAvatars().then((list) => {
      hydrateSetupAvatarSexFromCatalog(list, getWarmedChosenAvatarId());
    });
  }, []);

  useEffect(() => {
    const metaFirst =
      typeof user?.user_metadata?.first_name === 'string'
        ? user.user_metadata.first_name
        : '';
    const metaLast =
      typeof user?.user_metadata?.last_name === 'string'
        ? user.user_metadata.last_name
        : '';
    setFirstName(account?.first_name ?? metaFirst ?? '');
    setLastName(account?.last_name ?? metaLast ?? '');
    setBio(account?.bio ?? '');
  }, [
    account?.id,
    account?.first_name,
    account?.last_name,
    account?.bio,
    user?.user_metadata?.first_name,
    user?.user_metadata?.last_name,
  ]);

  useEffect(() => {
    if (phase !== 'verify_email' || !user?.email) return;
    const key = user.email.toLowerCase();
    if (verifySentFor.current === key) return;
    verifySentFor.current = key;
    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await withTimeout(signInWithOtp(key), OTP_TIMEOUT_MS, 'Sending code');
        lastOtpSend.current = Date.now();
        setResendIn(RESEND_COOLDOWN_SEC);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not send verification code.');
        verifySentFor.current = null;
      } finally {
        setBusy(false);
        setTimeout(() => codeRef.current?.focus(), 100);
      }
    })();
  }, [phase, user?.email, signInWithOtp]);

  useEffect(() => {
    if (phase !== 'verify_email') return;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - lastOtpSend.current;
      setResendIn(Math.max(0, Math.ceil((RESEND_COOLDOWN_SEC * 1000 - elapsed) / 1000)));
    }, 500);
    return () => window.clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (!account?.id) return;
    if (phase !== 'profile') return;
    if (seededUsernameFor.current === account.id) return;
    seededUsernameFor.current = account.id;

    const existing = account.username?.trim() ?? '';
    checkedAvailableUsernameRef.current = null;
    setUsernameStatus('checking');

    if (existing) {
      setUsername(existing);
      return;
    }

    let cancelled = false;
    void (async () => {
      const picked = await pickAvailableUsername(null);
      if (cancelled) return;
      setUsername(picked);
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.id, account?.username, phase]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (phase !== 'profile') return;
    if (!username) return;
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    const formatErr = validateUsername(username);
    if (formatErr) {
      setUsernameStatus('invalid');
      return;
    }
    const normalized = normalizeUsername(username);
    if (checkedAvailableUsernameRef.current === normalized) {
      setUsernameStatus('available');
      return;
    }
    setUsernameStatus('checking');
    usernameDebounceRef.current = setTimeout(() => {
      void (async () => {
        const ok = await checkUsernameAvailable(username);
        if (ok) {
          checkedAvailableUsernameRef.current = normalizeUsername(username);
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
        }
      })();
    }, 400);
    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [username, phase]);

  const onSignOut = async () => {
    // Freeze UI immediately so the user can't trigger other actions while auth
    // state tears down. The ongoing gate in AuthBootstrap will redirect to
    // /welcome once authStatus becomes 'anon'.
    setBusy(true);
    await signOut();
    // Fallback navigation in case bootDone is false and the gate is inactive.
    router.replace(WELCOME_PATH);
  };

  const onSwitchAccount = () => {
    clearAccountSelection();
  };

  const hasPhoto = !!(pendingFile || account?.image_url || previewUrl);

  const issues = useMemo(
    () =>
      profileIssues({
        hasPhoto,
        photoHint,
        pickedSex,
        firstName,
        lastName,
        username,
        usernameStatus,
        bio,
      }),
    [hasPhoto, photoHint, pickedSex, firstName, lastName, username, usernameStatus, bio],
  );

  const show = (field: ProfileField): string | undefined => {
    if (attempted) return issues[field];
    if (field === 'photo' && photoHint) return issues.photo;
    if (field === 'username' && (usernameStatus === 'taken' || usernameStatus === 'invalid')) {
      return issues.username;
    }
    return undefined;
  };

  const onPickPhoto = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoHint('Choose a photo (JPG or PNG).');
      return;
    }
    if (file.size > PHOTO_MAX_BYTES) {
      setPhotoHint('Photo must be under 5MB.');
      return;
    }
    setPhotoHint(null);
    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPendingFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const onVerifyEmail = async (code: string) => {
    if (code.length !== 6 || busy || !user?.email) return;
    setBusy(true);
    setError(null);
    try {
      await withTimeout(
        verifyOtp(user.email.toLowerCase(), code, 'email'),
        OTP_TIMEOUT_MS,
        'Verifying',
      );
      await refreshUser();
      setOtp('');
      haptic.play('light');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid code. Please try again.');
      setOtp('');
      setTimeout(() => codeRef.current?.focus(), 100);
    } finally {
      setBusy(false);
    }
  };

  const onResendVerify = async () => {
    if (busy || resendIn > 0 || !user?.email) return;
    setBusy(true);
    setError(null);
    try {
      await withTimeout(signInWithOtp(user.email.toLowerCase()), OTP_TIMEOUT_MS, 'Sending code');
      lastOtpSend.current = Date.now();
      setResendIn(RESEND_COOLDOWN_SEC);
      setOtp('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend code.');
    } finally {
      setBusy(false);
    }
  };

  const onSetPassword = async (e?: FormEvent) => {
    e?.preventDefault();
    if (busy) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords don’t match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await withTimeout(setPassword(newPassword), OTP_TIMEOUT_MS, 'Saving password');
      await refreshUser();
      setNewPassword('');
      setConfirmPassword('');
      haptic.play('light');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save password.');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!account || busy) return;
    setAttempted(true);
    const next = profileIssues({
      hasPhoto,
      photoHint,
      pickedSex,
      firstName,
      lastName,
      username,
      usernameStatus,
      bio,
    });
    const firstFail = (['photo', 'sex', 'first', 'last', 'username'] as ProfileField[]).find(
      (key) => next[key],
    );
    if (firstFail) {
      if (firstFail === 'first') firstNameRef.current?.focus();
      else if (firstFail === 'last') lastNameRef.current?.focus();
      else if (firstFail === 'username') usernameInputRef.current?.focus();
      else if (firstFail === 'bio') bioRef.current?.focus();
      return;
    }
    if (!pickedSex) return;

    setBusy(true);
    setError(null);
    try {
      await selectSetupAvatar(pickedSex);
      let updated = account;
      if (pendingFile) {
        updated = await uploadAccountImage(account.id, pendingFile);
        applyAccount(updated);
      }
      updated = await updateAccountProfile(updated.id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        username: normalizeUsername(username),
        bio: bio.trim() || null,
      });
      if (!updated.image_url) throw new Error('Add a photo of you.');
      applyAccount(updated);
      const res = await fetch('/api/accounts/onboard', { method: 'POST' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? 'Could not finish setup.');
      }
      // Refresh the account row so the gate can evaluate the new onboarded state
      // and route the user to demo or /game. Clear busy so the component can
      // transition to "You're all set" without the spinner blocking re-render.
      await refreshAccount();
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not finish setup.');
      setBusy(false);
    }
  };

  const onPickSex = (sex: SetupAvatarSex) => {
    setError(null);
    void selectSetupAvatar(sex);
  };

  if (isLoading && !account && !user) {
    return (
      <SetupShell step={null}>
        <div className="space-y-1.5" aria-hidden>
          <div className="h-3 w-1/3 animate-pulse rounded-full bg-black/10" />
          <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/10" />
          <div className="h-8 w-full animate-pulse rounded-full bg-black/10" />
        </div>
      </SetupShell>
    );
  }

  if (!user) {
    return (
      <SetupShell step={null}>
        <p className="text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          Sign in to finish setup.
        </p>
      </SetupShell>
    );
  }

  if (account && isAccountDeactivated(account)) {
    return (
      <SetupShell step={null}>
        <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
          Account paused
        </p>
        <p className="mt-0.5 text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          This account is deactivated. Contact support to reactivate.
        </p>
      </SetupShell>
    );
  }

  if (phase === 'verify_email') {
    return (
      <SetupShell step="verify_email">
        <p className="text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          Code sent to <span className="font-bold">{user.email}</span>
        </p>
        <input
          ref={codeRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={otp}
          maxLength={6}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
            setOtp(digits);
            setError(null);
            if (digits.length === 6) void onVerifyEmail(digits);
          }}
          className="mt-2 h-9 w-full rounded-full border border-black/10 bg-white px-3 text-center text-[15px] font-bold tracking-[0.35em] text-[#1C1C1E] outline-none focus:border-green-600"
          placeholder="••••••"
          aria-label="Verification code"
        />
        {error && (
          <p className="mt-1.5 text-[11px] font-medium text-red-600" role="alert">
            {error}
          </p>
        )}
        <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={busy || resendIn > 0}
            onClick={() => void onResendVerify()}
            className={CHIP_NO}
          >
            {resendIn > 0 ? `${resendIn}s` : 'Resend'}
          </button>
          <button
            type="button"
            disabled={busy || otp.length !== 6}
            onClick={() => void onVerifyEmail(otp)}
            className={CHIP_YES}
          >
            {busy && otp.length === 6 ? '…' : 'Verify'}
          </button>
        </div>
      </SetupShell>
    );
  }

  if (phase === 'set_password') {
    return (
      <SetupShell step="set_password">
        <form onSubmit={onSetPassword} className="space-y-1.5">
          <GlassInput
            value={newPassword}
            onChange={(v) => {
              setNewPassword(v);
              setError(null);
            }}
            placeholder="Password (8+ characters)"
            autoComplete="new-password"
            type="password"
          />
          <GlassInput
            value={confirmPassword}
            onChange={(v) => {
              setConfirmPassword(v);
              setError(null);
            }}
            placeholder="Confirm password"
            autoComplete="new-password"
            type="password"
          />
          {error && (
            <p className="text-[11px] font-medium text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={busy || newPassword.length < 8}
              className={CHIP_YES}
            >
              {busy ? '…' : 'Save'}
            </button>
          </div>
        </form>
      </SetupShell>
    );
  }

  if (!account) {
    return (
      <SetupShell step={null}>
        <p className="text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          Setting up your account…
        </p>
      </SetupShell>
    );
  }

  if (isAccountComplete(account)) {
    return (
      <SetupShell step={null}>
        <p className="text-[11px] font-semibold leading-snug text-[#1C1C1E]">
          You&apos;re all set — heading to the map…
        </p>
      </SetupShell>
    );
  }

  const displayAccount: AccountRow = previewUrl
    ? { ...account, image_url: previewUrl }
    : account;

  return (
    <SetupShell step="profile">
      <form onSubmit={onSubmit} className="space-y-2.5">
        <div>
          <div className="flex items-center justify-between gap-2.5">
            <button
              type="button"
              onClick={() => avatarRef.current?.click()}
              disabled={busy}
              aria-label="Add profile photo"
              aria-describedby={show('photo') ? 'setup-photo-error' : undefined}
              className="relative flex h-14 w-14 shrink-0 overflow-hidden rounded-full border transition active:scale-95 disabled:opacity-60"
              style={{ borderColor: show('photo') ? '#dc2626' : hasPhoto ? ACCENT : undefined }}
            >
              <AccountAvatar
                account={displayAccount}
                email={user?.email}
                size="sm"
                className="h-full w-full"
              />
              {!hasPhoto && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/5 text-[10px] font-bold text-[#5C6670]">
                  Add
                </span>
              )}
            </button>
            {show('photo') && (
              <span id="setup-photo-error" className="sr-only">Profile photo is required.</span>
            )}
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                onPickPhoto(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <SexToggle value={pickedSex} invalid={Boolean(show('sex'))} onChange={onPickSex} />
          </div>
          <div className="mt-1 grid grid-cols-2 gap-2">
            <FieldFail message={show('photo')} />
            <div className="text-right">
              <FieldFail message={show('sex')} />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <GlassInput
                inputRef={firstNameRef}
                value={firstName}
                invalid={Boolean(show('first'))}
                onChange={(v) => {
                  setFirstName(v);
                  setError(null);
                }}
                placeholder="First"
                autoComplete="given-name"
              />
              <FieldFail message={show('first')} />
            </div>
            <div>
              <GlassInput
                inputRef={lastNameRef}
                value={lastName}
                invalid={Boolean(show('last'))}
                onChange={(v) => {
                  setLastName(v);
                  setError(null);
                }}
                placeholder="Last"
                autoComplete="family-name"
              />
              <FieldFail message={show('last')} />
            </div>
          </div>
          <div>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-[12px] font-semibold text-[#5C6670]">
                @
              </span>
              <input
                ref={usernameInputRef}
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value.replace(/\s/g, ''));
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.preventDefault();
                }}
                autoComplete="username"
                spellCheck={false}
                placeholder="username"
                aria-label="Username"
                aria-invalid={Boolean(show('username'))}
                className={`h-9 w-full rounded-full border bg-white py-0 pl-7 pr-11 text-[12px] font-bold text-[#1C1C1E] outline-none ${
                  show('username')
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-black/10 focus:border-green-600'
                }`}
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                {usernameStatus === 'checking' && (
                  <span className="text-[10px] text-[#5C6670]">…</span>
                )}
                {usernameStatus === 'available' && (
                  <span className="text-[10px] font-bold text-green-600">✓</span>
                )}
                {(usernameStatus === 'taken' || usernameStatus === 'invalid') && (
                  <span className="text-[10px] font-bold text-red-600">✗</span>
                )}
              </div>
            </div>
            <FieldFail message={show('username')} />
          </div>
          <div>
            <textarea
              ref={bioRef}
              value={bio}
              onChange={(e) => {
                setBio(e.target.value.slice(0, BIO_MAX));
                setError(null);
              }}
              rows={2}
              maxLength={BIO_MAX}
              placeholder="Bio (optional)"
              aria-label="Bio (optional)"
              aria-invalid={Boolean(show('bio'))}
              className={`w-full resize-none rounded-2xl border bg-white px-3 py-2 text-[12px] font-semibold leading-snug text-[#1C1C1E] outline-none placeholder:font-medium placeholder:text-[#5C6670] ${
                show('bio')
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-black/10 focus:border-green-600'
              }`}
            />
            <FieldFail message={show('bio')} />
          </div>
        </div>

        {error && (
          <p className="text-[11px] font-medium text-red-600" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          onClick={() => {
            if (Object.keys(issues).length === 0) haptic.play('heavy');
          }}
          className={CHIP_YES}
        >
          {busy ? '…' : 'Finish setup'}
        </button>
      </form>

      <div className="mt-2.5 flex items-center justify-center gap-3 text-[11px] font-medium text-[#5C6670]">
        {accounts.length > 1 && (
          <>
            <button
              type="button"
              onClick={onSwitchAccount}
              disabled={busy}
              className="transition active:opacity-60 hover:text-[#1C1C1E] disabled:opacity-40"
            >
              Switch account
            </button>
            <span aria-hidden>·</span>
          </>
        )}
        <button
          type="button"
          onClick={() => void onSignOut()}
          disabled={busy}
          className="transition active:opacity-60 hover:text-[#1C1C1E] disabled:opacity-40"
        >
          Sign out
        </button>
      </div>
    </SetupShell>
  );
}

function SexToggle({
  value,
  invalid,
  onChange,
}: {
  value: SetupAvatarSex | null;
  invalid?: boolean;
  onChange: (sex: SetupAvatarSex) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Avatar"
      aria-invalid={invalid || undefined}
      className={`inline-flex h-7 shrink-0 rounded-full border bg-white p-0.5 ${
        invalid ? 'border-red-500' : 'border-black/10'
      }`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === 'male'}
        aria-label="Male"
        onClick={() => onChange('male')}
        className={`flex h-6 w-6 items-center justify-center rounded-full transition active:scale-95 ${
          value === 'male' ? 'bg-sky-500 text-white' : 'text-sky-500/70'
        }`}
      >
        <MarsIcon />
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === 'female'}
        aria-label="Female"
        onClick={() => onChange('female')}
        className={`flex h-6 w-6 items-center justify-center rounded-full transition active:scale-95 ${
          value === 'female' ? 'bg-rose-500 text-white' : 'text-rose-500/70'
        }`}
      >
        <VenusIcon />
      </button>
    </div>
  );
}

function MarsIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="6.4" cy="9.6" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9.2 6.8 14 2M10.2 2H14v3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VenusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="8" cy="6.2" r="3.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9.8v4.4M5.6 12.4h4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

interface SetupShellProps {
  children: React.ReactNode;
  step: SetupPhase | null;
}

function stepCopy(step: SetupShellProps['step']): {
  eyebrow: string;
  title: string;
  prompt?: string;
} | null {
  if (step === 'verify_email') return { eyebrow: 'Account', title: 'Verify your email' };
  if (step === 'set_password') return { eyebrow: 'Account', title: 'Create a password' };
  if (step === 'profile') {
    return { eyebrow: 'Profile', title: 'Create your profile' };
  }
  return null;
}

function SetupShell({ children, step }: SetupShellProps) {
  const copy = stepCopy(step);
  const pad: CSSProperties = {
    paddingLeft: DOCK_PAD,
    paddingRight: DOCK_PAD,
    paddingBottom: safePadBottom(`${DOCK_PAD}px`),
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[80]"
      style={pad}
      role="dialog"
      aria-modal="true"
      aria-label="Set up your profile"
    >
      <div className="setup-sheet-in pointer-events-auto w-full max-w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-black/10 bg-white/95 px-3.5 py-3 shadow-[0_8px_28px_rgba(15,26,23,0.14)] backdrop-blur-xl">
        {copy && (
          <>
            <p className="text-[10px] font-semibold tracking-[0.04em] text-[#5C6670]">
              {copy.eyebrow}
            </p>
            <p className="mt-0.5 text-[12px] font-semibold leading-snug text-[#1C1C1E]">
              <span className="font-bold">{copy.title}</span>
              {copy.prompt ? <> — {copy.prompt}</> : null}
            </p>
          </>
        )}
        <div className={copy ? 'mt-2.5' : undefined}>{children}</div>
      </div>

      <style>{`
        @keyframes setupSheetIn {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .setup-sheet-in { animation: setupSheetIn 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
      `}</style>
    </div>
  );
}

function GlassInput({
  value,
  onChange,
  placeholder,
  autoComplete,
  type = 'text',
  invalid,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  autoComplete?: string;
  type?: 'text' | 'password';
  invalid?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <input
      ref={inputRef}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      className={`h-9 w-full rounded-full border bg-white px-3 text-[12px] font-semibold text-[#1C1C1E] outline-none placeholder:font-medium placeholder:text-[#5C6670] ${
        invalid
          ? 'border-red-500 focus:border-red-500'
          : 'border-black/10 focus:border-green-600'
      }`}
    />
  );
}
