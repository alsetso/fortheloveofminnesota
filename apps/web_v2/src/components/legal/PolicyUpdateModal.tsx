'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { PolicyUpdateInfo } from '@/app/api/legal/needs-reconsent/route';

const BG = '#F5F0E8';
const INK = '#2C2825';
const MUTED = '#7A736C';
const LINE = '#E0D9CE';
const ACCENT = '#2F5D4A';

const KIND_LABEL: Record<string, string> = {
  added: 'Added',
  updated: 'Updated',
  removed: 'Removed',
  clarified: 'Clarified',
};

const KIND_COLOR: Record<string, string> = {
  added: '#1A6B3A',
  updated: '#1A4A7A',
  removed: '#8B1A1A',
  clarified: '#7A5A1A',
};

const KIND_BG: Record<string, string> = {
  added: '#EAF5EE',
  updated: '#EAF0F8',
  removed: '#F8EAEA',
  clarified: '#F8F3EA',
};

type Props = {
  updates: PolicyUpdateInfo[];
  onAccept: () => Promise<void>;
};

/**
 * PolicyUpdateModal — full-screen reconsent sheet shown when published policy
 * versions advance beyond what the account last accepted.
 *
 * Legal requirements met:
 *  - Shows exact version label and effective date for each updated policy
 *  - Lists every changelog entry (what changed, section, kind)
 *  - "I Agree" CTA is the only dismissal path — no skip, no close button
 *  - Links to full policy text for each document
 */
export default function PolicyUpdateModal({ updates, onAccept }: Props) {
  const [agreeing, setAgreeing] = useState(false);
  const [checked, setChecked] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-mark scrolled if content is short enough to not require scrolling
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 40) setScrolled(true);
    const handleScroll = () => {
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) setScrolled(true);
    };
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAgree = useCallback(async () => {
    if (!checked || agreeing) return;
    setAgreeing(true);
    try {
      await onAccept();
    } catch {
      setAgreeing(false);
    }
  }, [checked, agreeing, onAccept]);

  const policyPath = (slug: string) => (slug === 'terms_of_service' ? '/tos' : '/privacy');

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: BG }}
      role="dialog"
      aria-modal="true"
      aria-label="Policy Update — Review Required"
    >
      {/* Header */}
      <div
        className="flex-shrink-0 px-5 pt-safe-top pt-6 pb-4 border-b"
        style={{ borderColor: LINE }}
      >
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-1"
          style={{ color: ACCENT }}
        >
          Policy Update
        </p>
        <h1
          className="text-[19px] font-semibold leading-snug"
          style={{ color: INK, fontFamily: 'ui-serif, Georgia, Cambria, "Times New Roman", serif' }}
        >
          We&apos;ve updated our{' '}
          {updates.map((u, i) => (
            <span key={u.id}>
              {i > 0 && (i === updates.length - 1 ? ' and ' : ', ')}
              <span style={{ color: ACCENT }}>{u.policy_title}</span>
            </span>
          ))}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed" style={{ color: MUTED }}>
          Please review the changes below. Your continued use of For the Love of Minnesota
          is subject to the updated terms.
        </p>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-6"
      >
        {updates.map((update) => (
          <div key={update.id}>
            {/* Policy header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p
                  className="text-[13px] font-semibold"
                  style={{ color: INK }}
                >
                  {update.policy_title}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                  Version {update.version_label} · Effective{' '}
                  {new Date(update.effective_at).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: 'UTC',
                  })}
                </p>
                {update.summary && (
                  <p className="text-[12px] mt-1 leading-relaxed" style={{ color: MUTED }}>
                    {update.summary}
                  </p>
                )}
              </div>
              <Link
                href={policyPath(update.policy_slug)}
                target="_blank"
                className="text-[11px] font-medium underline underline-offset-2 flex-shrink-0 mt-0.5"
                style={{ color: ACCENT }}
              >
                Read full
              </Link>
            </div>

            {/* Changelog */}
            {update.changes.length > 0 ? (
              <div
                className="rounded-2xl overflow-hidden border divide-y"
                style={{ borderColor: LINE }}
              >
                {update.changes.map((c) => (
                  <div
                    key={c.id}
                    className="px-4 py-3 flex gap-3 items-start"
                    style={{ backgroundColor: 'rgba(255,255,255,0.6)' }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full flex-shrink-0 mt-0.5"
                      style={{
                        color: KIND_COLOR[c.change_kind] ?? MUTED,
                        backgroundColor: KIND_BG[c.change_kind] ?? '#F0F0F0',
                      }}
                    >
                      {KIND_LABEL[c.change_kind] ?? c.change_kind}
                    </span>
                    <div>
                      {c.section && (
                        <p className="text-[11px] font-semibold mb-0.5" style={{ color: INK }}>
                          {c.section}
                        </p>
                      )}
                      <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
                        {c.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="rounded-2xl px-4 py-3 text-[12px]"
                style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: MUTED, borderColor: LINE, border: `1px solid ${LINE}` }}
              >
                Full policy text updated. Tap &quot;Read full&quot; to review the complete document.
              </div>
            )}
          </div>
        ))}

        {/* Spacer so content isn't hidden under the sticky footer */}
        <div className="h-4" />
      </div>

      {/* Sticky footer — consent action */}
      <div
        className="flex-shrink-0 px-5 pb-safe-bottom pb-6 pt-4 border-t space-y-4"
        style={{ borderColor: LINE, backgroundColor: BG }}
      >
        {/* Scroll prompt */}
        {!scrolled && (
          <p className="text-center text-[11px]" style={{ color: MUTED }}>
            Scroll to review all changes before agreeing
          </p>
        )}

        {/* Checkbox consent */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="flex-shrink-0 mt-0.5">
            <div
              onClick={() => setChecked(c => !c)}
              className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: checked ? ACCENT : LINE,
                backgroundColor: checked ? ACCENT : 'transparent',
              }}
            >
              {checked && (
                <svg viewBox="0 0 12 10" fill="none" className="w-3 h-2.5">
                  <path d="M1 5l3.5 3.5L11 1" stroke="#F5F0E8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
          </div>
          <p className="text-[12px] leading-relaxed" style={{ color: MUTED }}>
            I have read and agree to the updated{' '}
            {updates.map((u, i) => (
              <span key={u.id}>
                {i > 0 && (i === updates.length - 1 ? ' and ' : ', ')}
                <Link
                  href={policyPath(u.policy_slug)}
                  target="_blank"
                  className="font-medium underline underline-offset-2"
                  style={{ color: INK }}
                  onClick={e => e.stopPropagation()}
                >
                  {u.policy_title}
                </Link>
              </span>
            ))}
            , effective{' '}
            {new Date(updates[0]!.effective_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              timeZone: 'UTC',
            })}.
          </p>
        </label>

        {/* CTA */}
        <button
          type="button"
          onClick={handleAgree}
          disabled={!checked || !scrolled || agreeing}
          className="w-full py-3.5 rounded-2xl text-[15px] font-semibold transition-all active:scale-[0.98]"
          style={{
            backgroundColor: checked && scrolled ? ACCENT : LINE,
            color: checked && scrolled ? BG : MUTED,
            cursor: checked && scrolled ? 'pointer' : 'default',
          }}
        >
          {agreeing ? 'Saving…' : 'I Agree — Continue'}
        </button>

        <p className="text-center text-[10px] leading-relaxed" style={{ color: MUTED }}>
          You must agree to continue using For the Love of Minnesota.
          This acceptance is logged with a timestamp for compliance.
        </p>
      </div>
    </div>
  );
}
