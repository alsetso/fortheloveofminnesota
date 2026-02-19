'use client';

import { XMarkIcon } from '@heroicons/react/24/outline';
import PulledDataCard from './PulledDataCard';

/** Rendered section order: Person header (name, age, born, telephone), Current Address, Phone Numbers, Email Addresses (skip if empty), Previous Addresses (3 + Show more), Relatives (5 + Show X more), Associates (5 + Show X more). Raw JSON at bottom. */
export interface PublicPullRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  pulledData: Record<string, unknown>;
  record?: Record<string, unknown> | null;
  /** Optional label e.g. pull date */
  pulledAt?: string | null;
}

export default function PublicPullRecordModal({
  isOpen,
  onClose,
  pulledData,
  record,
  pulledAt,
}: PublicPullRecordModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Saved pull details"
    >
      <div
        className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface w-full max-w-md max-h-[90vh] shadow-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-[10px] border-b border-border-muted dark:border-white/10 flex-shrink-0">
          <h2 className="text-sm font-semibold text-foreground">
            Saved pull
            {pulledAt && <span className="font-normal text-foreground-muted ml-1">· {pulledAt}</span>}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors rounded"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-[10px] overflow-y-auto flex-1 min-h-0 space-y-3">
          <PulledDataCard pulledData={pulledData} record={record} compact={false} />
          <div className="pt-2 border-t border-border-muted dark:border-white/10">
            <p className="text-[10px] font-medium text-foreground-muted mb-1">JSON response</p>
            <pre
              className="text-[10px] text-foreground-muted overflow-auto max-h-48 p-2 rounded-md bg-surface-accent dark:bg-white/5 border border-border-muted dark:border-white/10"
              style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
            >
              {JSON.stringify(pulledData, null, 2)}
            </pre>
          </div>
        </div>
      </div>
      <button
        type="button"
        className="absolute inset-0 -z-10"
        aria-label="Close"
        onClick={onClose}
      />
    </div>
  );
}
