'use client';

import { useEffect, useState } from 'react';
import { DockCardShell } from '@/features/map/dockCore/dockCard/DockCardShell';
import { useMapDock } from '@/features/map/dockCore/shell/MapDockContext';
import { useContactTags } from '@/features/contacts/state/useContactTags';
import { PENDING_CONTACT_TAG_KEY } from '@/features/contacts/state/pendingContactTag';
import {
  IconChevronDown,
  IconChevronRight,
  IconPeopleGroup,
  IconPlus,
} from '@/features/map/dockCore/core/icons';
import { useAuthSafe } from '@/features/auth';
import {
  MAP_DOCK_GLASS_BORDER_CLASS,
  MAP_DOCK_GLASS_FILL_CLASS,
} from '@/features/map/dockCore/core/mapDockTokens';

const LIST_ROW = `flex w-full items-center gap-3 rounded-[1.15rem] px-3.5 py-3.5 text-left transition active:scale-[0.99] disabled:opacity-40 ${MAP_DOCK_GLASS_FILL_CLASS} ${MAP_DOCK_GLASS_BORDER_CLASS} hover:bg-map-glass-hover`;

/** Contact book dock card — Lists-style hub: All Contacts + Tags. */
export default function ContactsDockCard() {
  const { account } = useAuthSafe();
  const { closeDockCard, openSubpage, openContactsSheet } = useMapDock();
  const { tags, counts, loading: tagsLoading } = useContactTags(Boolean(account));
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [tagsOpen, setTagsOpen] = useState(true);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (!account) {
      setContactCount(0);
      return;
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const res = await fetch('/api/contacts', {
          credentials: 'include',
          signal: ac.signal,
        });
        const json = (await res.json()) as {
          people?: unknown[];
          addresses?: unknown[];
        };
        if (!ac.signal.aborted && res.ok) {
          setContactCount((json.people?.length ?? 0) + (json.addresses?.length ?? 0));
        }
      } catch {
        if (!ac.signal.aborted) setContactCount(null);
      }
    })();
    return () => ac.abort();
  }, [account]);

  const openSheet = (opts?: { tag?: string; kind?: 'people' | 'addresses' }) => {
    if (!account) return;
    openContactsSheet({
      kind: opts?.kind ?? 'people',
      tag: opts?.tag,
    });
  };

  const startAddTag = () => {
    if (!account) return;
    setAddingTag(true);
    setTagsOpen(true);
  };

  const submitNewTag = () => {
    const tag = newTag.trim().slice(0, 48);
    if (!tag || !account) return;
    try {
      sessionStorage.setItem(PENDING_CONTACT_TAG_KEY, tag);
    } catch {
      /* ignore */
    }
    setNewTag('');
    setAddingTag(false);
    closeDockCard();
    openSubpage({
      title: 'People',
      subtitle: `Tag as ${tag}`,
      kind: 'people',
    });
  };

  const countLabel = contactCount == null ? '…' : String(contactCount);

  return (
    <DockCardShell titleMode="center" title="Lists">
      <button
        type="button"
        disabled={!account}
        onClick={() => openSheet()}
        className={LIST_ROW}
      >
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center text-foreground">
          <IconPeopleGroup className="h-6 w-6" />
        </span>
        <span className="min-w-0 flex-1 text-[16px] font-medium text-foreground">
          All Contacts
        </span>
        <span className="shrink-0 text-[15px] tabular-nums text-foreground-muted">
          {countLabel}
        </span>
        <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/70" />
      </button>

      <section>
        <button
          type="button"
          onClick={() => setTagsOpen((open) => !open)}
          className="mb-2 flex w-full items-center gap-1 px-0.5 text-left"
          aria-expanded={tagsOpen}
        >
          <span className="text-[13px] font-semibold text-foreground-muted">Tags</span>
          <IconChevronDown
            className={`h-3.5 w-3.5 text-foreground-muted transition ${
              tagsOpen ? '' : '-rotate-90'
            }`}
          />
        </button>

        {tagsOpen ? (
          <div className="space-y-1.5">
            {tagsLoading && tags.length === 0 ? (
              <div
                className={`h-14 animate-pulse rounded-[1.15rem] ${MAP_DOCK_GLASS_FILL_CLASS}`}
              />
            ) : null}

            {!tagsLoading && tags.length === 0 && !addingTag ? (
              <p className="px-1 py-1 text-[13px] leading-snug text-foreground-muted">
                No tags yet. Add one, then save someone with that label.
              </p>
            ) : null}

            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                disabled={!account}
                onClick={() => openSheet({ tag })}
                className={LIST_ROW}
              >
                <span className="min-w-0 flex-1 text-[16px] font-medium text-foreground">
                  {tag}
                </span>
                <span className="shrink-0 text-[15px] tabular-nums text-foreground-muted">
                  {counts[tag] ?? 0}
                </span>
                <IconChevronRight className="h-4 w-4 shrink-0 text-foreground-muted/70" />
              </button>
            ))}

            {addingTag ? (
              <form
                className={`${LIST_ROW} !py-2.5`}
                onSubmit={(e) => {
                  e.preventDefault();
                  submitNewTag();
                }}
              >
                <input
                  autoFocus
                  value={newTag}
                  maxLength={48}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="New tag name"
                  className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-foreground outline-none placeholder:text-foreground-muted/60"
                  aria-label="New tag name"
                />
                <button
                  type="submit"
                  disabled={!newTag.trim()}
                  className="shrink-0 text-[14px] font-semibold text-lake-blue disabled:opacity-40"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingTag(false);
                    setNewTag('');
                  }}
                  className="shrink-0 text-[14px] font-medium text-foreground-muted"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                type="button"
                disabled={!account}
                onClick={startAddTag}
                className={`${LIST_ROW} text-lake-blue`}
              >
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lake-blue/10">
                  <IconPlus className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 text-[16px] font-medium">Add Tag</span>
              </button>
            )}
          </div>
        ) : null}
      </section>
    </DockCardShell>
  );
}
