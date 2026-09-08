'use client';

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  AccountAvatar,
  useAuthSafe,
  type AccountRow,
} from '@/features/auth';
import {
  checkUsernameAvailable,
  normalizeUsername,
  updateAccountProfile,
  uploadAccountImage,
  validateUsername,
} from '@/features/account/accountProfile';
import {
  ACCOUNT_TRAIT_VALUES,
  MAX_ACCOUNT_TRAITS,
  formatTraitLabel,
} from '@/features/account/accountTraits';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';

const FIELD_CLASS = `mt-1.5 h-12 w-full rounded-2xl border bg-white/70 px-3.5 text-[15px] text-foreground outline-none transition focus:border-lake-blue/50 focus:ring-2 focus:ring-lake-blue/20 ${MAP_DOCK_GLASS_BORDER_CLASS}`;
const LABEL_CLASS = 'block text-[12px] font-semibold text-foreground-muted';
const SECTION_TITLE =
  'text-[11px] font-semibold uppercase tracking-wide text-foreground-muted';

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

type EditProfileFormProps = {
  onSaved?: (account: AccountRow) => void;
  onCancel?: () => void;
};

function PrivacyToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-black/[0.05] px-3.5 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-foreground">{label}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-foreground-muted">{hint}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${
          checked ? 'bg-lake-blue' : 'bg-black/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? 'left-[1.35rem]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

/**
 * Edit profile — avatar, name, username, contact, bio, traits, privacy.
 * Embedded in the profile dock card’s edit state.
 */
export default function EditProfileForm({ onSaved, onCancel }: EditProfileFormProps) {
  const { back } = useMapDock();
  const { account, user, applyAccount, isLoading } = useAuthSafe();

  const avatarRef = useRef<HTMLInputElement>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const usernameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkedAvailableUsernameRef = useRef<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [traitQuery, setTraitQuery] = useState('');
  const [searchVisibility, setSearchVisibility] = useState(true);
  const [accountTaggable, setAccountTaggable] = useState(true);
  const [hideFollowers, setHideFollowers] = useState(false);
  const [hideFollowing, setHideFollowing] = useState(false);
  const [hideLevel, setHideLevel] = useState(false);
  const [hideStreak, setHideStreak] = useState(false);
  const [hideDiscovers, setHideDiscovers] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!account) return;
    setFirstName(account.first_name ?? '');
    setLastName(account.last_name ?? '');
    setUsername(account.username ?? '');
    setUsernameDraft(account.username ?? '');
    setEditingUsername(false);
    setUsernameStatus('idle');
    checkedAvailableUsernameRef.current = account.username
      ? normalizeUsername(account.username)
      : null;
    setPhone(account.phone ?? '');
    setBio(account.bio ?? '');
    setTraits(account.traits ?? []);
    setSearchVisibility(account.search_visibility !== false);
    setAccountTaggable(account.account_taggable !== false);
    setHideFollowers(account.hide_followers === true);
    setHideFollowing(account.hide_following === true);
    setHideLevel(account.hide_level === true);
    setHideStreak(account.hide_streak === true);
    setHideDiscovers(account.hide_discovers === true);
  }, [
    account?.id,
    account?.first_name,
    account?.last_name,
    account?.username,
    account?.phone,
    account?.bio,
    account?.traits,
    account?.search_visibility,
    account?.account_taggable,
    account?.hide_followers,
    account?.hide_following,
    account?.hide_level,
    account?.hide_streak,
    account?.hide_discovers,
  ]);

  useEffect(() => {
    if (!editingUsername) return;
    if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);

    const formatErr = validateUsername(usernameDraft);
    if (formatErr) {
      setUsernameStatus('invalid');
      return;
    }

    const normalized = normalizeUsername(usernameDraft);
    if (checkedAvailableUsernameRef.current === normalized) {
      setUsernameStatus('available');
      return;
    }

    setUsernameStatus('checking');
    usernameDebounceRef.current = setTimeout(() => {
      void (async () => {
        const ok = await checkUsernameAvailable(usernameDraft);
        if (ok) {
          checkedAvailableUsernameRef.current = normalizeUsername(usernameDraft);
          setUsernameStatus('available');
        } else {
          setUsernameStatus('taken');
        }
      })();
    }, 400);

    return () => {
      if (usernameDebounceRef.current) clearTimeout(usernameDebounceRef.current);
    };
  }, [usernameDraft, editingUsername]);

  const accountTraits = account?.traits ?? [];
  const sameTraits =
    traits.length === accountTraits.length &&
    [...traits].sort().join('\0') === [...accountTraits].sort().join('\0');

  const dirty =
    !!account &&
    ((firstName.trim() || '') !== (account.first_name ?? '') ||
      (lastName.trim() || '') !== (account.last_name ?? '') ||
      normalizeUsername(username) !== (account.username ?? '') ||
      (phone.trim() || '') !== (account.phone ?? '') ||
      (bio.trim() || '') !== (account.bio ?? '') ||
      !sameTraits ||
      searchVisibility !== (account.search_visibility !== false) ||
      accountTaggable !== (account.account_taggable !== false) ||
      hideFollowers !== (account.hide_followers === true) ||
      hideFollowing !== (account.hide_following === true) ||
      hideLevel !== (account.hide_level === true) ||
      hideStreak !== (account.hide_streak === true) ||
      hideDiscovers !== (account.hide_discovers === true));

  const emailDisplay = account?.email?.trim() || user?.email?.trim() || '';
  const currentUsernamePlaceholder = account?.username?.trim() || 'username';
  const canSetUsername = usernameStatus === 'available';

  const filteredTraits = ACCOUNT_TRAIT_VALUES.filter((t) => {
    if (!traitQuery.trim()) return true;
    const q = traitQuery.trim().toLowerCase();
    return t.includes(q) || formatTraitLabel(t).toLowerCase().includes(q);
  });

  const toggleTrait = (trait: string) => {
    setError(null);
    setTraits((prev) => {
      if (prev.includes(trait)) return prev.filter((t) => t !== trait);
      if (prev.length >= MAX_ACCOUNT_TRAITS) {
        setError(`Pick up to ${MAX_ACCOUNT_TRAITS} traits.`);
        return prev;
      }
      return [...prev, trait];
    });
  };

  const startEditUsername = () => {
    setUsernameDraft(username);
    setEditingUsername(true);
    setError(null);
    window.setTimeout(() => usernameInputRef.current?.focus(), 50);
  };

  const setUsernameFromDraft = () => {
    if (!canSetUsername) return;
    const next = normalizeUsername(usernameDraft);
    setUsername(next);
    setUsernameDraft(next);
    setEditingUsername(false);
    setUsernameStatus('idle');
    setError(null);
  };

  const onAvatar = async (file: File | undefined) => {
    if (!file || !account) return;
    setError(null);
    setUploadingAvatar(true);
    try {
      const updated = await uploadAccountImage(account.id, file);
      applyAccount(updated);
      onSaved?.(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const onSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!account || !dirty || editingUsername) return;

    const usernameErr = validateUsername(username);
    if (usernameErr) {
      setError(usernameErr);
      return;
    }

    setBusy(true);
    setError(null);
    setSavedFlash(false);
    try {
      const updated = await updateAccountProfile(account.id, {
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
        username: normalizeUsername(username),
        phone: phone.trim() || null,
        bio: bio.trim() || null,
        traits,
        search_visibility: searchVisibility,
        account_taggable: accountTaggable,
        hide_followers: hideFollowers,
        hide_following: hideFollowing,
        hide_level: hideLevel,
        hide_streak: hideStreak,
        hide_discovers: hideDiscovers,
      });
      applyAccount(updated);
      onSaved?.(updated);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (isLoading && !account) {
    return (
      <div className="space-y-3 pb-6" aria-hidden>
        <div className="mx-auto h-20 w-20 animate-pulse rounded-full bg-map-ink-subtle" />
        <div className="h-12 animate-pulse rounded-2xl bg-map-ink-subtle" />
        <div className="h-12 animate-pulse rounded-2xl bg-map-ink-subtle" />
      </div>
    );
  }

  if (!account) {
    return (
      <p className="px-1 py-6 text-center text-sm text-foreground-muted">
        Sign in to edit your profile.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 pb-8">
      <div
        className={`flex flex-col items-center gap-3 rounded-[1.35rem] px-4 py-5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
      >
        <button
          type="button"
          onClick={() => avatarRef.current?.click()}
          disabled={uploadingAvatar}
          aria-label="Change profile photo"
          className="relative inline-flex h-20 w-20 shrink-0 overflow-hidden rounded-full border-[3px] border-white/90 bg-white/70 shadow-sm shadow-black/10 transition active:scale-[0.98] disabled:opacity-60"
        >
          <AccountAvatar
            account={account}
            email={user?.email}
            size="lg"
            className="h-full w-full"
          />
          <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
            {uploadingAvatar ? '…' : 'Edit'}
          </span>
        </button>
        <p className="text-center text-[12px] text-foreground-muted">
          {uploadingAvatar ? 'Uploading…' : 'Tap to change your photo'}
        </p>
        <input
          ref={avatarRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            void onAvatar(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-2.5">
          <label className={LABEL_CLASS}>
            First name
            <input
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                setError(null);
              }}
              autoComplete="given-name"
              className={FIELD_CLASS}
              placeholder="First"
            />
          </label>
          <label className={LABEL_CLASS}>
            Last name
            <input
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value);
                setError(null);
              }}
              autoComplete="family-name"
              className={FIELD_CLASS}
              placeholder="Last"
            />
          </label>
        </div>

        <div>
          <p className={LABEL_CLASS}>Username</p>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 z-[1] -translate-y-1/2 text-[15px] text-foreground-muted">
              @
            </span>
            <input
              ref={usernameInputRef}
              value={editingUsername ? usernameDraft : username}
              readOnly={!editingUsername}
              onChange={(e) => {
                if (!editingUsername) return;
                setUsernameDraft(e.target.value.replace(/\s/g, ''));
                setError(null);
              }}
              onKeyDown={(e) => {
                if (!editingUsername) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setUsernameFromDraft();
                }
              }}
              autoComplete="username"
              spellCheck={false}
              placeholder={currentUsernamePlaceholder}
              aria-label="Username"
              className={`h-12 w-full rounded-2xl border bg-white/70 py-0 pl-8 pr-[4.25rem] text-[15px] text-foreground outline-none transition ${MAP_DOCK_GLASS_BORDER_CLASS} ${
                editingUsername
                  ? 'focus:border-lake-blue/50 focus:ring-2 focus:ring-lake-blue/20'
                  : 'cursor-default caret-transparent opacity-70'
              }`}
            />
            {!editingUsername ? (
              <button
                type="button"
                onClick={startEditUsername}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[rgb(47_93_74)] underline underline-offset-2"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={setUsernameFromDraft}
                disabled={!canSetUsername}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[rgb(47_93_74)] underline underline-offset-2 disabled:opacity-40"
              >
                Set
              </button>
            )}
          </div>
          {editingUsername ? (
            <p className="mt-1.5 min-h-[1rem] text-[12px] text-foreground-muted">
              {usernameStatus === 'checking' && 'Checking…'}
              {usernameStatus === 'taken' && 'Already taken'}
              {usernameStatus === 'invalid' && '3–30 letters, numbers, _ or -'}
              {usernameStatus === 'available' && 'Available'}
            </p>
          ) : null}
        </div>

        <div>
          <p className={LABEL_CLASS}>Email</p>
          <input
            value={emailDisplay}
            readOnly
            aria-readonly
            className={`${FIELD_CLASS} cursor-default caret-transparent opacity-70`}
            placeholder="No email on file"
          />
          <p className="mt-1 text-[11px] text-foreground-muted">
            Only you can see this. Managed by your sign-in.
          </p>
        </div>

        <label className={LABEL_CLASS}>
          Phone
          <input
            type="tel"
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value);
              setError(null);
            }}
            autoComplete="tel"
            className={FIELD_CLASS}
            placeholder="Optional"
          />
        </label>

        <label className={LABEL_CLASS}>
          Bio
          <textarea
            value={bio}
            onChange={(e) => {
              setBio(e.target.value.slice(0, 280));
              setError(null);
            }}
            rows={3}
            maxLength={280}
            className={`mt-1.5 w-full resize-none rounded-2xl border bg-white/70 px-3.5 py-3 text-[15px] leading-relaxed text-foreground outline-none transition focus:border-lake-blue/50 focus:ring-2 focus:ring-lake-blue/20 ${MAP_DOCK_GLASS_BORDER_CLASS}`}
            placeholder="A short line about you in Minnesota…"
          />
          <span className="mt-1 block text-right text-[11px] text-foreground-muted">
            {bio.length}/280
          </span>
        </label>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className={SECTION_TITLE}>
            Traits ({traits.length}/{MAX_ACCOUNT_TRAITS})
          </p>
        </div>
        {traits.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {traits.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => toggleTrait(t)}
                className="rounded-full bg-lake-blue/10 px-2.5 py-1 text-[12px] font-medium text-lake-blue"
              >
                {formatTraitLabel(t)} ×
              </button>
            ))}
          </div>
        ) : null}
        <input
          value={traitQuery}
          onChange={(e) => setTraitQuery(e.target.value)}
          placeholder="Search traits…"
          className={FIELD_CLASS}
        />
        <div
          className={`mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-2xl p-1 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          {filteredTraits.slice(0, 40).map((t) => {
            const on = traits.includes(t);
            const disabled = !on && traits.length >= MAX_ACCOUNT_TRAITS;
            return (
              <button
                key={t}
                type="button"
                disabled={disabled}
                onClick={() => toggleTrait(t)}
                className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2 text-left text-[13px] transition disabled:opacity-40 ${
                  on
                    ? 'bg-lake-blue/10 font-medium text-lake-blue'
                    : 'text-foreground hover:bg-black/[0.04]'
                }`}
              >
                <span>{formatTraitLabel(t)}</span>
                <span className="text-[11px] text-foreground-muted">{on ? 'Selected' : 'Add'}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className={`${SECTION_TITLE} mb-2`}>Privacy</p>
        <div
          className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          <PrivacyToggle
            label="Appear in search"
            hint="Let others find your account in search"
            checked={searchVisibility}
            onChange={(v) => {
              setSearchVisibility(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Allow tagging"
            hint="Others can tag you on posts and pins"
            checked={accountTaggable}
            onChange={(v) => {
              setAccountTaggable(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Hide followers"
            hint="Only you can see who follows you"
            checked={hideFollowers}
            onChange={(v) => {
              setHideFollowers(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Hide following"
            hint="Only you can see who you follow"
            checked={hideFollowing}
            onChange={(v) => {
              setHideFollowing(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Hide level"
            hint="Only you can see your level and XP on your profile"
            checked={hideLevel}
            onChange={(v) => {
              setHideLevel(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Hide streak"
            hint="Only you can see your login streak on your profile"
            checked={hideStreak}
            onChange={(v) => {
              setHideStreak(v);
              setError(null);
            }}
          />
          <PrivacyToggle
            label="Hide discovers"
            hint="Only you can see items found on your profile"
            checked={hideDiscovers}
            onChange={(v) => {
              setHideDiscovers(v);
              setError(null);
            }}
          />
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl bg-red-50/90 px-3.5 py-2.5 text-[13px] text-red-800/90" role="alert">
          {error}
        </p>
      ) : null}

      {savedFlash ? (
        <p className="text-center text-[13px] font-medium text-lake-blue">Saved</p>
      ) : null}

      <div className="flex gap-2.5">
        <button
          type="button"
          onClick={() => {
            if (onCancel) onCancel();
            else back();
          }}
          className={`h-12 flex-1 rounded-2xl text-[15px] font-semibold text-foreground transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !dirty || editingUsername}
          className="h-12 flex-[1.35] rounded-2xl bg-[rgb(47_93_74)] text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-40"
        >
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
