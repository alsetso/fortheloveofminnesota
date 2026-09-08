'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PageScroll } from '@/features/appShell/PageScroll';
import {
  clearDirectoryPageMedia,
  deleteDirectoryPage,
  fetchDirectoryPageDetail,
  patchDirectoryPage,
  setDirectoryPageMedia,
} from '@/features/map/directory/directoryPages';
import { uploadDirectoryPageImage } from '@/features/map/directory/uploadPageMedia';
import { PageLogoDisc } from '@/features/map/directory/PageLogoDisc';
import DockCategorySearchField from '@/features/map/directory/DockCategorySearchField';
import PostLocationPanel, {
  resolvePostLocationSeed,
  type PostLocationValue,
} from '@/components/media/capture/PostLocationPanel';
import { canViewPrivatePage } from '@/lib/directory/pageAudience';
import type { DirectoryPageDetail } from '@/lib/directory/directoryPageTypes';
import type { PageStatus } from '@/lib/directory/launchPageForm';
import type { PageVisibility } from '@/lib/directory/pageAudience';
import type { PageMediaPrimaryRole } from '@/lib/directory/pageMediaRoles';
import {
  categoryParentForPageType,
  type PageCategoryParent,
} from '@/lib/directory/pageCategoryParents';
import {
  isLaunchPageType,
  isPageLogoHttpUrl,
  LAUNCH_PAGE_TYPES,
  LAUNCH_PAGE_TYPE_META,
  type LaunchPageTypeSlug,
} from '@/lib/directory/pageTypes';
import { directoryPageSharePath } from '@/lib/directory/pageContactLinks';
import { PAGES_PATH } from '@/lib/routes/routePolicy';
import { safePadTop } from '@/lib/despia/safeArea';
import { useAuthSafe } from '@/features/auth';

const FORM_ID = 'page-manage-primary';

const FIELD_CLASS =
  'w-full bg-transparent text-[17px] text-foreground outline-none placeholder:text-foreground-muted/40';

function emptyToNull(value: string): string | null {
  const t = value.trim();
  return t ? t : null;
}

/**
 * /page/:slug/manage — primary listing editor (Cancel / Done).
 * Logo & cover upload immediately; text fields save on Done.
 */
export default function PageManagePage() {
  const params = useParams<{ slug: string }>();
  const slugParam = typeof params?.slug === 'string' ? params.slug : '';
  const slug = decodeURIComponent(slugParam).trim();
  const router = useRouter();
  const { account } = useAuthSafe();

  const [page, setPage] = useState<DirectoryPageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mediaBusy, setMediaBusy] = useState<PageMediaPrimaryRole | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState('');
  const [instagram, setInstagram] = useState('');
  const [status, setStatus] = useState<PageStatus>('active');
  const [visibility, setVisibility] = useState<PageVisibility>('public');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [location, setLocation] = useState<PostLocationValue | null>(null);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [homeBased, setHomeBased] = useState(false);
  const [locationDirty, setLocationDirty] = useState(false);
  const [pageType, setPageType] = useState<LaunchPageTypeSlug | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [typeDirty, setTypeDirty] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const profileHref = (s: string) =>
    directoryPageSharePath(s) ?? `/page/${encodeURIComponent(s)}`;

  const hydrate = useCallback((row: DirectoryPageDetail) => {
    setTitle(row.title ?? '');
    setDescription(row.description ?? '');
    setPhone(row.phone ?? '');
    setEmail(row.email ?? '');
    setWebsite(row.website ?? '');
    setInstagram(row.instagramUrl ?? '');
    setStatus(row.status);
    setVisibility(row.visibility === 'unlisted' ? 'unlisted' : 'public');
    setLogoUrl(row.logoUrl && isPageLogoHttpUrl(row.logoUrl) ? row.logoUrl : null);
    setCoverUrl(row.coverUrl && isPageLogoHttpUrl(row.coverUrl) ? row.coverUrl : null);
    const hasPin =
      typeof row.lat === 'number' &&
      typeof row.lng === 'number' &&
      Number.isFinite(row.lat) &&
      Number.isFinite(row.lng);
    if (hasPin) {
      setLocation({
        lat: row.lat as number,
        lng: row.lng as number,
        address: row.addressLine,
      });
      setLocationEnabled(true);
    } else {
      setLocation(null);
      setLocationEnabled(false);
    }
    setHomeBased(row.homeBased === true);
    setLocationDirty(false);
    const parent = categoryParentForPageType(row.pageType);
    setPageType(
      isLaunchPageType(row.pageType)
        ? row.pageType
        : parent && isLaunchPageType(parent)
          ? parent
          : null,
    );
    setCategoryId(row.categoryId ?? '');
    setCategoryName(row.categoryName ?? '');
    setTypeDirty(false);
    setDeleteConfirm('');
    setDeleteError(null);
  }, []);

  const load = useCallback(async () => {
    if (!slug) {
      setPage(null);
      setError('Missing page');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await fetchDirectoryPageDetail(slug);
      if (!row) {
        setPage(null);
        setError('Page not found');
        return;
      }
      if (!canViewPrivatePage(row.viewer)) {
        router.replace(profileHref(row.slug));
        return;
      }
      setPage(row);
      hydrate(row);
    } catch (e: unknown) {
      setPage(null);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [slug, account?.id, hydrate, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCancel = () => {
    router.push(profileHref(page?.slug ?? slug));
  };

  const onMediaFile = async (role: PageMediaPrimaryRole, file: File | undefined) => {
    if (!page || !file || mediaBusy) return;
    setMediaBusy(role);
    setMediaError(null);
    try {
      const uploaded = await uploadDirectoryPageImage(file, role);
      const saved = await setDirectoryPageMedia(page.id, role, uploaded.publicUrl);
      if (role === 'logo') setLogoUrl(saved.url);
      else setCoverUrl(saved.url);
      setPage((prev) =>
        prev
          ? {
              ...prev,
              logoUrl: role === 'logo' ? saved.url : prev.logoUrl,
              coverUrl: role === 'cover' ? saved.url : prev.coverUrl,
              icon: role === 'logo' ? saved.url : prev.icon,
            }
          : prev,
      );
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setMediaBusy(null);
      const ref = role === 'logo' ? logoInputRef : coverInputRef;
      if (ref.current) ref.current.value = '';
    }
  };

  const onClearMedia = async (role: PageMediaPrimaryRole) => {
    if (!page || mediaBusy) return;
    setMediaBusy(role);
    setMediaError(null);
    try {
      await clearDirectoryPageMedia(page.id, role);
      if (role === 'logo') setLogoUrl(null);
      else setCoverUrl(null);
      setPage((prev) =>
        prev
          ? {
              ...prev,
              logoUrl: role === 'logo' ? null : prev.logoUrl,
              coverUrl: role === 'cover' ? null : prev.coverUrl,
              icon:
                role === 'logo' && isPageLogoHttpUrl(prev.icon) ? null : prev.icon,
            }
          : prev,
      );
    } catch (err: unknown) {
      setMediaError(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setMediaBusy(null);
    }
  };

  const onDelete = async () => {
    if (!page || deleting || busy) return;
    const confirm = deleteConfirm.trim();
    if (confirm !== page.title.trim()) {
      setDeleteError('Name does not match');
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteDirectoryPage(page.id, confirm);
      router.replace(PAGES_PATH);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!page || busy || mediaBusy) return;
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError('Title is required');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const nextStatus: PageStatus = status;
      const nextVisibility: PageVisibility =
        nextStatus === 'draft' ? 'unlisted' : visibility;
      const saved = await patchDirectoryPage(page.id, {
        title: nextTitle,
        description: emptyToNull(description),
        phone: emptyToNull(phone),
        email: emptyToNull(email),
        website: emptyToNull(website),
        instagramUrl: emptyToNull(instagram),
        status: nextStatus,
        visibility: nextVisibility,
        ...(typeDirty
          ? {
              ...(pageType ? { pageType } : {}),
              categoryId: categoryId.trim() ? categoryId.trim() : null,
            }
          : {}),
        ...(locationDirty
          ? locationEnabled && location
            ? {
                lat: location.lat,
                lng: location.lng,
                addressLine: location.address,
                homeBased,
              }
            : { clearLocation: true }
          : {}),
      });
      router.replace(profileHref(saved.slug));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f5f1]">
      <header
        className="sticky top-0 z-10 border-b border-black/[0.06] bg-[#f7f5f1]/92 backdrop-blur-xl"
        style={{ paddingTop: safePadTop('0.15rem') }}
      >
        <div className="relative flex h-11 items-center px-1.5">
          <button
            type="button"
            onClick={onCancel}
            className="relative z-[1] px-2.5 py-1.5 text-[17px] text-lake-blue active:opacity-60"
          >
            Cancel
          </button>
          <h1 className="pointer-events-none absolute inset-x-24 truncate text-center text-[17px] font-semibold text-foreground">
            Manage
          </h1>
          <button
            type="submit"
            form={FORM_ID}
            disabled={busy || loading || !page || Boolean(mediaBusy)}
            className="relative z-[1] ml-auto px-2.5 py-1.5 text-[17px] font-semibold text-lake-blue active:opacity-60 disabled:opacity-40"
          >
            Done
          </button>
        </div>
      </header>

      <PageScroll>
        {loading && !page ? (
          <div className="space-y-3 px-4 pt-6">
            <div className="h-24 animate-pulse rounded-[10px] bg-black/[0.06]" />
            <div className="h-40 animate-pulse rounded-[10px] bg-black/[0.05]" />
          </div>
        ) : null}

        {error && !page ? (
          <div className="px-6 py-16 text-center">
            <p className="text-[16px] font-semibold text-foreground">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 text-[14px] font-semibold text-lake-blue"
            >
              Retry
            </button>
          </div>
        ) : null}

        {page ? (
          <form id={FORM_ID} onSubmit={(e) => void onSubmit(e)} className="space-y-8 pb-16 pt-4">
            <section className="mx-4 space-y-3">
              <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
                Media
              </p>
              <div className="overflow-hidden rounded-[10px] bg-white">
                <div className="flex items-center gap-4 border-b border-black/[0.06] px-4 py-3.5">
                  <button
                    type="button"
                    disabled={Boolean(mediaBusy)}
                    onClick={() => logoInputRef.current?.click()}
                    className="relative shrink-0 active:opacity-80 disabled:opacity-50"
                    aria-label="Change logo"
                  >
                    <PageLogoDisc
                      title={title || page.title}
                      logoUrl={logoUrl}
                      icon={page.icon}
                      size="lg"
                      verified={page.isVerified}
                      executive={page.executivePass}
                    />
                    {mediaBusy === 'logo' ? (
                      <span className="absolute inset-0 flex items-center justify-center rounded-[0.95rem] bg-black/35 text-[11px] font-semibold text-white">
                        …
                      </span>
                    ) : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-medium text-foreground">Logo</p>
                    <p className="mt-0.5 text-[13px] text-foreground-muted">
                      Square mark · JPEG/PNG/WebP · max 15 MB
                    </p>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button
                        type="button"
                        disabled={Boolean(mediaBusy)}
                        onClick={() => logoInputRef.current?.click()}
                        className="text-[14px] font-semibold text-lake-blue active:opacity-60 disabled:opacity-40"
                      >
                        {logoUrl ? 'Replace' : 'Upload'}
                      </button>
                      {logoUrl ? (
                        <button
                          type="button"
                          disabled={Boolean(mediaBusy)}
                          onClick={() => void onClearMedia('logo')}
                          className="text-[14px] font-medium text-red-600 active:opacity-60 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onMediaFile('logo', e.target.files?.[0])}
                  />
                </div>

                <div className="px-4 py-3.5">
                  <p className="text-[16px] font-medium text-foreground">Cover</p>
                  <p className="mt-0.5 text-[13px] text-foreground-muted">
                    Banner image · JPEG/PNG/WebP · max 15 MB
                  </p>
                  <button
                    type="button"
                    disabled={Boolean(mediaBusy)}
                    onClick={() => coverInputRef.current?.click()}
                    className="relative mt-3 block w-full overflow-hidden rounded-[12px] border border-black/[0.08] bg-black/[0.04] active:opacity-90 disabled:opacity-50"
                    aria-label="Change cover"
                  >
                    {coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverUrl}
                        alt=""
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-36 items-center justify-center text-[14px] font-semibold text-lake-blue">
                        {mediaBusy === 'cover' ? 'Uploading…' : 'Add cover photo'}
                      </span>
                    )}
                    {mediaBusy === 'cover' && coverUrl ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-[13px] font-semibold text-white">
                        Uploading…
                      </span>
                    ) : null}
                  </button>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={Boolean(mediaBusy)}
                      onClick={() => coverInputRef.current?.click()}
                      className="text-[14px] font-semibold text-lake-blue active:opacity-60 disabled:opacity-40"
                    >
                      {coverUrl ? 'Replace' : 'Upload'}
                    </button>
                    {coverUrl ? (
                      <button
                        type="button"
                        disabled={Boolean(mediaBusy)}
                        onClick={() => void onClearMedia('cover')}
                        className="text-[14px] font-medium text-red-600 active:opacity-60 disabled:opacity-40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  <input
                    ref={coverInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => void onMediaFile('cover', e.target.files?.[0])}
                  />
                </div>
              </div>
              {mediaError ? (
                <p className="px-1 text-[13px] text-red-600">{mediaError}</p>
              ) : null}
            </section>

            <section className="mx-4 space-y-3">
              <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
                Type & subtype
              </p>
              <div className="space-y-3 rounded-[10px] bg-white px-3 py-3">
                <p className="px-0.5 text-[12px] font-semibold text-foreground-muted">
                  Page type
                </p>
                <div className="flex flex-wrap gap-2">
                  {LAUNCH_PAGE_TYPES.map((t) => {
                    const on = pageType === t.slug;
                    return (
                      <button
                        key={t.slug}
                        type="button"
                        onClick={() => {
                          if (pageType === t.slug) return;
                          setPageType(t.slug);
                          setCategoryId('');
                          setCategoryName('');
                          setTypeDirty(true);
                        }}
                        className={`rounded-lg px-3 py-1.5 text-left text-[13px] font-semibold transition ${
                          on
                            ? 'bg-lake-blue text-white'
                            : 'bg-black/[0.05] text-foreground'
                        }`}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
                {pageType ? (
                  <p className="px-0.5 text-[12px] text-foreground-muted">
                    {LAUNCH_PAGE_TYPE_META[pageType].description}
                  </p>
                ) : null}
                {pageType && categoryParentForPageType(pageType) ? (
                  <div className="border-t border-black/[0.06] pt-3">
                    <DockCategorySearchField
                      parentSlug={
                        categoryParentForPageType(pageType) as PageCategoryParent
                      }
                      categoryId={categoryId}
                      categoryName={categoryName}
                      onSelect={(cat) => {
                        setCategoryId(cat?.id ?? '');
                        setCategoryName(cat?.name ?? '');
                        setTypeDirty(true);
                      }}
                    />
                  </div>
                ) : null}
              </div>
            </section>

            <section className="mx-4 space-y-3">
              <div className="flex items-center justify-between gap-2 px-1">
                <p className="text-[13px] font-semibold uppercase tracking-wide text-foreground-muted">
                  Default location
                </p>
                {locationEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      setLocationEnabled(false);
                      setLocation(null);
                      setLocationDirty(true);
                    }}
                    className="text-[13px] font-medium text-red-600 active:opacity-60"
                  >
                    Clear
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLocation(resolvePostLocationSeed(null));
                      setLocationEnabled(true);
                    }}
                    className="text-[13px] font-semibold text-lake-blue active:opacity-60"
                  >
                    Set location
                  </button>
                )}
              </div>
              {locationEnabled && location ? (
                <div className="rounded-[10px] bg-white px-3 pb-1 pt-3">
                  <PostLocationPanel
                    tone="light"
                    findMeSetsPin
                    pinHint="Default pin for the map and directory"
                    value={location}
                    onChange={(next) => {
                      setLocation(next);
                      setLocationDirty(true);
                    }}
                    className="mb-2"
                  />
                  {page.pageType === 'local-business' ? (
                    <label className="mb-3 flex items-start gap-3 border-t border-black/[0.06] px-1 py-3">
                      <input
                        type="checkbox"
                        checked={homeBased}
                        onChange={(e) => {
                          setHomeBased(e.target.checked);
                          setLocationDirty(true);
                        }}
                        className="mt-1 h-4 w-4 accent-[rgb(var(--lake-blue))]"
                      />
                      <span>
                        <span className="block text-[15px] font-medium text-foreground">
                          Home-based
                        </span>
                        <span className="mt-0.5 block text-[12px] text-foreground-muted">
                          Pin is approximate — don’t publish a private home address.
                        </span>
                      </span>
                    </label>
                  ) : null}
                </div>
              ) : (
                <p className="px-1 text-[13px] text-foreground-muted">
                  No default pin yet. Set one so the page shows on the map.
                </p>
              )}
            </section>

            <FieldGroup>
              <EditRow label="Title">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={160}
                  required
                  placeholder="Page name"
                  className={FIELD_CLASS}
                />
              </EditRow>
              <EditRow label="About" last>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                  rows={4}
                  placeholder="Short description"
                  className={`${FIELD_CLASS} min-h-[5rem] resize-none`}
                />
              </EditRow>
            </FieldGroup>

            <FieldGroup>
              <EditRow label="Phone">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={40}
                  placeholder="Phone"
                  className={FIELD_CLASS}
                />
              </EditRow>
              <EditRow label="Email">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  maxLength={200}
                  placeholder="Email"
                  className={FIELD_CLASS}
                />
              </EditRow>
              <EditRow label="Website">
                <input
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  maxLength={500}
                  placeholder="https://"
                  className={FIELD_CLASS}
                />
              </EditRow>
              <EditRow label="Instagram" last>
                <input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  maxLength={300}
                  placeholder="@handle or URL"
                  className={FIELD_CLASS}
                />
              </EditRow>
            </FieldGroup>

            <FieldGroup>
              <div className="border-b border-black/[0.06] px-4 py-3">
                <p className="text-[13px] font-medium text-foreground-muted">Status</p>
                <div className="mt-2 flex gap-2">
                  {(
                    [
                      { id: 'active' as const, label: 'Published' },
                      { id: 'draft' as const, label: 'Draft' },
                    ] as const
                  ).map((opt) => {
                    const on = status === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setStatus(opt.id);
                          if (opt.id === 'draft') setVisibility('unlisted');
                        }}
                        className={`rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition ${
                          on
                            ? 'bg-lake-blue text-white'
                            : 'bg-black/[0.05] text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="px-4 py-3">
                <p className="text-[13px] font-medium text-foreground-muted">Visibility</p>
                <div className="mt-2 flex gap-2">
                  {(
                    [
                      { id: 'public' as const, label: 'Public' },
                      { id: 'unlisted' as const, label: 'Unlisted' },
                    ] as const
                  ).map((opt) => {
                    const disabled = status === 'draft';
                    const on =
                      visibility === opt.id ||
                      (status === 'draft' && opt.id === 'unlisted');
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => setVisibility(opt.id)}
                        className={`rounded-lg px-3.5 py-1.5 text-[14px] font-semibold transition disabled:opacity-45 ${
                          on
                            ? 'bg-lake-blue text-white'
                            : 'bg-black/[0.05] text-foreground'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {status === 'draft' ? (
                  <p className="mt-2 text-[12px] text-foreground-muted">
                    Drafts stay unlisted until you publish.
                  </p>
                ) : null}
              </div>
            </FieldGroup>

            <section className="mx-4 space-y-3">
              <p className="px-1 text-[13px] font-semibold uppercase tracking-wide text-red-600/80">
                Danger zone
              </p>
              <div className="space-y-3 rounded-[10px] bg-white px-4 py-3.5">
                <p className="text-[15px] font-medium text-foreground">Delete page</p>
                <p className="text-[13px] leading-snug text-foreground-muted">
                  This permanently removes the listing, media, and locations. Type{' '}
                  <span className="font-semibold text-foreground">
                    {page.title}
                  </span>{' '}
                  to confirm.
                </p>
                <input
                  value={deleteConfirm}
                  onChange={(e) => {
                    setDeleteConfirm(e.target.value);
                    setDeleteError(null);
                  }}
                  placeholder="Page name"
                  className="h-11 w-full rounded-[10px] border border-black/[0.08] bg-[#f7f5f1] px-3 text-[16px] text-foreground outline-none placeholder:text-foreground-muted/40"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  disabled={
                    deleting ||
                    busy ||
                    deleteConfirm.trim() !== page.title.trim()
                  }
                  onClick={() => void onDelete()}
                  className="w-full rounded-[10px] bg-red-600 py-3 text-[16px] font-semibold text-white transition active:opacity-80 disabled:opacity-40"
                >
                  {deleting ? 'Deleting…' : 'Delete page'}
                </button>
                {deleteError ? (
                  <p className="text-center text-[13px] text-red-600">{deleteError}</p>
                ) : null}
              </div>
            </section>

            {error ? (
              <p className="px-4 text-center text-[14px] text-red-600">{error}</p>
            ) : null}
          </form>
        ) : null}
      </PageScroll>
    </div>
  );
}

function FieldGroup({ children }: { children: ReactNode }) {
  return (
    <div className="mx-4 overflow-hidden rounded-[10px] bg-white">{children}</div>
  );
}

function EditRow({
  label,
  last,
  children,
}: {
  label: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={`flex items-start gap-3 px-4 py-2.5 ${
        last ? '' : 'border-b border-black/[0.06]'
      }`}
    >
      <span className="w-[5.5rem] shrink-0 pt-1 text-[17px] text-foreground">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}
