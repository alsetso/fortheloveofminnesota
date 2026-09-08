'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthSafe } from '@/features/auth';
import DockCategorySearchField from '@/features/map/directory/DockCategorySearchField';
import { launchDirectoryPage } from '@/features/map/directory/launchPage';
import { refreshDirectoryPages } from '@/features/map/directory/directoryPagesStore';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { directoryPageManagePath } from '@/lib/directory/pageContactLinks';
import {
  DockActionRow,
  DockPaneShell,
  DockRowChevron,
  DockSection,
} from '@/features/map/dockCore/panes/DockPaneShell';
import {
  IconCheck,
  IconChevronRight,
  IconFlag,
  IconHome,
  IconMapPin,
  IconPeopleGroup,
  IconPlus,
  IconUser,
} from '@/features/map/dockCore/core/icons';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';
import { ToolCostNote, ToolPrimaryButton, TOOL_FIELD_CLASS } from '@/features/tools/core/toolUi';
import {
  EMPTY_LAUNCH_FORM,
  launchCtaHint,
  launchCtaLabel,
  launchFormComplete,
  launchFormConfig,
  launchTypeStepComplete,
  type LaunchFieldKey,
  type LaunchFormValues,
  type LaunchLocationMode,
} from '@/lib/directory/launchPageForm';
import {
  LAUNCH_PAGE_TYPE_META,
  LAUNCH_PAGE_TYPES,
  pageTypeName,
  type LaunchPageTypeSlug,
} from '@/lib/directory/pageTypes';
import { useSelectedPointCoords } from '@/map/location/camera/useSelectedPointCoords';
import {
  getPointAtLocationCache,
  pointAtLocationCacheKey,
} from '@/features/map/dockCore/store/pointAtLocationCache';
import { resetSelectedPinMode } from '@/map/points/selectedPinModeStore';

const TYPE_ICONS: Record<LaunchPageTypeSlug, typeof IconHome> = {
  'local-business': IconHome,
  'public-figure': IconUser,
  community: IconPeopleGroup,
  event: IconFlag,
};

const TEXTAREA_CLASS = `${TOOL_FIELD_CLASS} h-auto min-h-[5.5rem] resize-none py-3 leading-relaxed`;

function GlassCheckRow({
  checked,
  onChange,
  title,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  title: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <label
      className={`flex items-start gap-3.5 rounded-2xl px-3.5 py-3.5 transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
      } ${
        checked
          ? 'border-lake-blue/40 bg-lake-blue/10 ring-1 ring-lake-blue/25'
          : 'hover:bg-map-glass-hover'
      }`}
    >
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition ${
            checked
              ? 'border-lake-blue bg-lake-blue'
              : 'border-foreground-muted/35 bg-transparent'
          }`}
        >
          {checked ? <IconCheck className="h-3 w-3 text-white" /> : null}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-foreground-muted">
          {hint}
        </span>
      </span>
    </label>
  );
}

function FieldLabel({
  label,
  hint,
  required,
}: {
  label: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <span className="block space-y-0.5 px-0.5">
      <span className="text-[12px] font-semibold text-foreground-muted">
        {label}
        {required ? <span className="text-lake-blue"> · required</span> : null}
      </span>
      {hint ? (
        <span className="block text-[11px] leading-snug text-foreground-muted/90">{hint}</span>
      ) : null}
    </span>
  );
}

/** Nested dock shell for create / manage. */
export default function DockPageFoundationPane({
  mode,
  title,
  slug,
}: {
  mode: 'launch' | 'manage';
  title: string;
  slug?: string;
}) {
  const {
    openDockCard,
    openSubpage,
    popPane,
    openSelectedPoint,
    openPageCard,
    resetToBrowse,
  } = useMapDock();
  const router = useRouter();
  const { account } = useAuthSafe();
  const { coords } = useSelectedPointCoords();
  const [step, setStep] = useState<0 | 1>(0);
  const [typeOpen, setTypeOpen] = useState(false);
  const [pageType, setPageType] = useState<LaunchPageTypeSlug | null>(null);
  const [form, setForm] = useState<LaunchFormValues>(EMPTY_LAUNCH_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = useMemo(
    () => (pageType ? launchFormConfig(pageType) : null),
    [pageType],
  );

  const pinAddress = useMemo(() => {
    if (!coords) return null;
    return (
      getPointAtLocationCache(pointAtLocationCacheKey(coords.lat, coords.lng))?.address ?? null
    );
  }, [coords]);

  const hasMapPin = Boolean(coords);

  useEffect(() => {
    if (!pageType) return;
    const guide = launchFormConfig(pageType);
    setForm((prev) => ({
      ...prev,
      locationMode: prev.locationMode ?? guide.location.recommended,
    }));
  }, [pageType]);

  const patchField = (key: LaunchFieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const setLocationMode = (modeId: LaunchLocationMode) => {
    setForm((prev) => ({ ...prev, locationMode: modeId }));
  };

  const openPageManager = () => {
    popPane();
    openDockCard('page-manager');
  };

  const typeStepReady = Boolean(pageType) && launchTypeStepComplete(form);
  const formReady =
    pageType != null && launchFormComplete(pageType, form, hasMapPin);

  async function onLaunch() {
    if (!pageType || !formReady || submitting) return;
    if (!account?.id) {
      setError('Sign in to publish a page.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await launchDirectoryPage({
        pageType,
        form,
        address: pinAddress,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });
      resetSelectedPinMode();
      resetToBrowse();
      if (result.status === 'active') {
        openPageCard({
          id: result.id,
          kind: 'page',
          title: form.title.trim(),
          subtitle: pinAddress ?? pageTypeName(pageType) ?? undefined,
          kindLabel: pageTypeName(pageType) ?? 'Page',
          summary: form.description.trim() || undefined,
        });
      } else {
        openDockCard('page-manager');
      }
      void refreshDirectoryPages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create page');
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === 'launch') {
    return (
      <DockPaneShell
        footer={
          step === 0 ? (
            <ToolPrimaryButton disabled={!typeStepReady} onClick={() => setStep(1)}>
              <span className="inline-flex items-center gap-2">
                Continue
                <IconChevronRight className="h-4 w-4" />
              </span>
            </ToolPrimaryButton>
          ) : (
            <div className="space-y-2">
              <ToolPrimaryButton
                disabled={!formReady || submitting || !account?.id}
                loading={submitting}
                onClick={() => void onLaunch()}
              >
                {launchCtaLabel(form)}
              </ToolPrimaryButton>
              <ToolCostNote>{launchCtaHint(form)}</ToolCostNote>
              <ToolPrimaryButton variant="secondary" disabled={submitting} onClick={() => setStep(0)}>
                Back
              </ToolPrimaryButton>
            </div>
          )
        }
      >
        <div className="space-y-5 pb-6">
          {step === 0 ? (
            <>
              {/* ── Hero CTA ─────────────────────────────────────────────── */}
              <div className="flex flex-col items-center gap-3 pb-2 pt-4 text-center">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-lake-blue/15 text-lake-blue">
                  <IconPlus className="h-6 w-6" />
                </span>
                <div className="space-y-1">
                  <h2 className="text-[20px] font-bold tracking-tight text-foreground">
                    What are you creating?
                  </h2>
                  <p className="text-[13px] leading-snug text-foreground-muted">
                    Pick a type to get started — we&apos;ll walk you through the rest.
                  </p>
                </div>
              </div>

              {/* ── Type dropdown / locked chip ───────────────────────────── */}
              {!pageType ? (
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setTypeOpen((o) => !o)}
                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`}
                  >
                    <span className="text-[15px] text-foreground-muted">Select a type…</span>
                    <IconChevronRight
                      className={`h-4 w-4 text-foreground-muted/60 transition-transform duration-200 ${typeOpen ? 'rotate-[270deg]' : 'rotate-90'}`}
                    />
                  </button>
                  {typeOpen ? (
                    <div className={`overflow-hidden rounded-2xl ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}>
                      {LAUNCH_PAGE_TYPES.map((t) => {
                        const Icon = TYPE_ICONS[t.slug];
                        const meta = LAUNCH_PAGE_TYPE_META[t.slug];
                        return (
                          <button
                            key={t.slug}
                            type="button"
                            onClick={() => {
                              setPageType(t.slug);
                              setForm({
                                ...EMPTY_LAUNCH_FORM,
                                locationMode: launchFormConfig(t.slug).location.recommended,
                              });
                              setTypeOpen(false);
                            }}
                            className="flex w-full items-center gap-3 border-b border-border/10 px-4 py-3.5 text-left transition last:border-0 hover:bg-map-glass-hover active:scale-[0.99]"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-map-ink-subtle text-foreground-muted">
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold text-foreground">
                                {t.name}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-snug text-foreground-muted">
                                {meta.description}
                              </span>
                            </span>
                            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground-muted/40" />
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              ) : (
                /* Locked type chip */
                (() => {
                  const t = LAUNCH_PAGE_TYPES.find((x) => x.slug === pageType)!;
                  const Icon = TYPE_ICONS[t.slug];
                  const meta = LAUNCH_PAGE_TYPE_META[t.slug];
                  return (
                    <div
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} border-lake-blue/30 ring-1 ring-lake-blue/20`}
                    >
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-lake-blue/15 text-lake-blue">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold text-foreground">
                          {t.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] leading-snug text-foreground-muted">
                          {meta.description}
                        </span>
                      </span>
                      <span className="rounded-full bg-lake-blue/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lake-blue">
                        Selected
                      </span>
                    </div>
                  );
                })()
              )}

              {/* ── Category — revealed once type is locked ───────────────── */}
              {pageType ? (
                <DockSection title="Category">
                  <DockCategorySearchField
                    parentSlug={pageType}
                    categoryId={form.categoryId}
                    categoryName={form.categoryName}
                    onSelect={(category) =>
                      setForm((prev) => ({
                        ...prev,
                        categoryId: category?.id ?? '',
                        categoryName: category?.name ?? '',
                      }))
                    }
                  />
                </DockSection>
              ) : null}
            </>
          ) : null}

          {step === 1 && config ? (
            <>
              {form.categoryName ? (
                <p className="px-0.5 text-[12px] font-semibold text-foreground-muted">
                  {config.typeLabel} · {form.categoryName}
                </p>
              ) : null}

              <DockSection title={config.headline} subtitle={config.subtitle}>
                <div className="space-y-3">
                  {config.fields.map((field) => (
                    <label key={field.key} className="block space-y-1.5">
                      <FieldLabel
                        label={field.label}
                        hint={field.hint}
                        required={field.required}
                      />
                      {field.kind === 'textarea' ? (
                        <textarea
                          value={form[field.key]}
                          onChange={(e) => patchField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className={TEXTAREA_CLASS}
                        />
                      ) : (
                        <input
                          type={
                            field.kind === 'tel'
                              ? 'tel'
                              : field.kind === 'email'
                                ? 'email'
                                : field.kind === 'url'
                                  ? 'url'
                                  : 'text'
                          }
                          value={form[field.key]}
                          onChange={(e) => patchField(field.key, e.target.value)}
                          placeholder={field.placeholder}
                          autoCapitalize={field.kind === 'text' ? 'words' : 'off'}
                          autoCorrect="off"
                          className={TOOL_FIELD_CLASS}
                        />
                      )}
                    </label>
                  ))}

                  {pageType === 'local-business' ? (
                    <GlassCheckRow
                      checked={form.homeBased}
                      onChange={(homeBased) => setForm((prev) => ({ ...prev, homeBased }))}
                      title="Home-based business"
                      hint="Operates from a home address."
                      disabled={submitting}
                    />
                  ) : null}

                  <GlassCheckRow
                    checked={form.status === 'draft'}
                    onChange={(draft) =>
                      setForm((prev) => ({ ...prev, status: draft ? 'draft' : 'active' }))
                    }
                    title="Save as draft"
                    hint="Page is created but not yet visible on the directory."
                    disabled={submitting}
                  />
                </div>
              </DockSection>

              <DockSection
                title={config.location.headline}
                subtitle={config.location.subtitle}
              >
                <div className="space-y-2">
                  {config.location.modes.map((modeOpt) => {
                    const selected = form.locationMode === modeOpt.id;
                    return (
                      <button
                        key={modeOpt.id}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setLocationMode(modeOpt.id)}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3.5 py-3.5 text-left transition active:scale-[0.99] ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} ${
                          selected
                            ? 'border-lake-blue/40 bg-lake-blue/10 ring-1 ring-lake-blue/25'
                            : 'hover:bg-map-glass-hover'
                        }`}
                      >
                        <span
                          className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                            selected
                              ? 'bg-lake-blue/15 text-lake-blue'
                              : 'bg-map-ink-subtle text-foreground-muted'
                          }`}
                        >
                          {modeOpt.id === 'building' ? (
                            <IconMapPin className="h-4 w-4" />
                          ) : modeOpt.id === 'city' ? (
                            <IconHome className="h-4 w-4" />
                          ) : (
                            <IconCheck className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="block text-[15px] font-semibold text-foreground">
                              {modeOpt.label}
                            </span>
                            {modeOpt.id === config.location.recommended ? (
                              <span className="rounded-full bg-lake-blue/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lake-blue">
                                Suggested
                              </span>
                            ) : null}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-foreground-muted">
                            {modeOpt.hint}
                          </span>
                        </span>
                        {selected ? (
                          <IconCheck className="mt-1 h-4 w-4 shrink-0 text-lake-blue" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                {form.locationMode === 'building' ? (
                  <div
                    className={`mt-3 space-y-2 rounded-2xl px-3.5 py-3 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS}`}
                  >
                    {hasMapPin ? (
                      <>
                        <p className="text-[13px] font-medium text-foreground">
                          {pinAddress ??
                            `${coords!.lat.toFixed(5)}, ${coords!.lng.toFixed(5)}`}
                        </p>
                        <p className="text-[12px] text-foreground-muted">
                          Using the pin on the map. Tap the map to move it.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-[13px] text-foreground-muted">
                          No pin yet — drop one on the map, then come back.
                        </p>
                        <ToolPrimaryButton variant="secondary" onClick={openSelectedPoint}>
                          Open map pin
                        </ToolPrimaryButton>
                      </>
                    )}
                  </div>
                ) : null}

                {form.locationMode === 'city' ? (
                  <p className="mt-3 px-0.5 text-[12px] leading-relaxed text-foreground-muted">
                    City search lands next. For now, choose this mode and we’ll attach a city
                    when launch writes the page.
                  </p>
                ) : null}
              </DockSection>

              <GlassCheckRow
                checked={form.selfClaim}
                onChange={(selfClaim) => setForm((prev) => ({ ...prev, selfClaim }))}
                title="I am the owner"
                hint={
                  form.title.trim()
                    ? `I have the right to represent “${form.title.trim()}”. Checking this claims the page as yours.`
                    : 'I have the right to represent this page. Checking this claims it as yours.'
                }
                disabled={submitting}
              />

              {error ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-red-500/10 px-3.5 py-3 text-[13px] font-medium text-red-600"
                >
                  {error}
                </p>
              ) : null}

              {!account?.id ? (
                <p className="px-0.5 text-center text-[12px] text-foreground-muted">
                  Sign in to publish a page.
                </p>
              ) : null}
            </>
          ) : null}

        </div>
      </DockPaneShell>
    );
  }

  return (
    <DockPaneShell
      footer={
        <ToolPrimaryButton
          variant="secondary"
          onClick={() =>
            openSubpage({
              title: 'Create a page',
              subtitle: 'Launch',
              kind: 'page-launch',
            })
          }
        >
          <span className="inline-flex items-center gap-2">
            <IconPlus className="h-4 w-4" />
            Create another page
          </span>
        </ToolPrimaryButton>
      }
    >
      <div className="space-y-5 pb-6">
        <DockSection
          title={title}
          subtitle={slug ? `Manage · /${slug}` : 'Manage'}
        >
          <p className="px-0.5 text-sm leading-relaxed text-foreground-muted">
            Owner settings for this page. Visibility, media, hours, and members
            will land here — same pattern as web, without leaving the map.
          </p>
        </DockSection>
        <DockSection title="Settings">
          <DockActionRow
            title="Edit listing"
            subtitle="Title, about, contact, publishing"
            onClick={() => {
              const path = directoryPageManagePath(slug);
              if (!path) return;
              popPane();
              router.push(path);
            }}
            trailing={<DockRowChevron />}
            disabled={!slug}
          />
          <DockActionRow
            title="Logo & cover"
            subtitle="Upload on Manage"
            onClick={() => {
              const path = directoryPageManagePath(slug);
              if (!path) return;
              popPane();
              router.push(path);
            }}
            trailing={<DockRowChevron />}
            disabled={!slug}
          />
        </DockSection>
        <DockSection title="Pages">
          <DockActionRow
            title="My pages"
            subtitle="Pages you created or claimed"
            onClick={openPageManager}
            trailing={<DockRowChevron />}
          />
        </DockSection>
      </div>
    </DockPaneShell>
  );
}
