'use client';

import { useState, useCallback, useEffect } from 'react';
import { XMarkIcon, UserIcon } from '@heroicons/react/24/outline';

const SECTION_LABEL = 'text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5';

function getRecordDisplayName(r: Record<string, unknown>): string {
  const name =
    (r.Name as string) ??
    (r.name as string) ??
    (r.FullName as string) ??
    (r.full_name as string) ??
    (([r.FirstName, r.LastName].filter(Boolean).join(' ') || [r.first_name, r.last_name].filter(Boolean).join(' ')) ?? '');
  return String(name || 'Unknown');
}

/** Person ID from public record (e.g. "Person ID" or person_id) */
function getPersonId(r: Record<string, unknown> | null): string | null {
  if (!r) return null;
  const id = (r['Person ID'] as string) ?? (r.person_id as string) ?? (r.PersonId as string) ?? (r.peo_id as string);
  return id && typeof id === 'string' ? id.trim() : null;
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

export interface PersonDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: Record<string, unknown> | null;
  /** When present, sent to details API so pull is linked to people.search */
  searchId?: string | null;
}

export default function PersonDataModal({ isOpen, onClose, record, searchId }: PersonDataModalProps) {
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [detailsData, setDetailsData] = useState<Record<string, unknown> | null>(null);

  const personId = getPersonId(record);
  const canPullDetails = Boolean(personId);

  useEffect(() => {
    setDetailsData(null);
    setDetailsError(null);
  }, [personId]);

  const handlePullPublicData = useCallback(async () => {
    if (!personId) return;
    setDetailsError(null);
    setDetailsData(null);
    setDetailsLoading(true);
    try {
      const params = new URLSearchParams({ peo_id: personId });
      if (searchId) params.set('search_id', searchId);
      const res = await fetch(
        `/api/people/public-records/details?${params.toString()}`,
        { credentials: 'include' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailsError((data as { error?: string }).error ?? 'Failed to load details');
        return;
      }
      setDetailsData(data as Record<string, unknown>);
      setShowMorePrevAddr(false);
      setShowMoreRelatives(false);
      setShowMoreAssociates(false);
    } catch {
      setDetailsError('Failed to load details');
    } finally {
      setDetailsLoading(false);
    }
  }, [personId, searchId]);

  const [showMorePrevAddr, setShowMorePrevAddr] = useState(false);
  const [showMoreRelatives, setShowMoreRelatives] = useState(false);
  const [showMoreAssociates, setShowMoreAssociates] = useState(false);

  if (!isOpen) return null;

  const personDetailsArr = detailsData ? arr<Record<string, unknown>>(detailsData['personDetails'] ?? detailsData['Person Details']) : [];
  const personDetails0 = personDetailsArr[0];
  const name = personDetails0 ? getRecordDisplayName(personDetails0) : (record ? getRecordDisplayName(record) : '');
  const age = personDetails0 != null && (personDetails0.age ?? personDetails0.Age) != null ? String(personDetails0.age ?? personDetails0.Age) : (record?.Age != null ? String(record.Age) : (record?.age as string) ?? '');
  const born = personDetails0 ? str(personDetails0.born ?? personDetails0.Born) : '';
  const telephone = personDetails0 ? str(personDetails0.telephone ?? personDetails0.Telephone) : '';
  const livesIn = (record?.['Lives in'] as string) ?? (record?.Address as string) ?? (record?.address as string) ?? '';
  const usedToLive = (record?.['Used to live in'] as string) ?? '';
  const relatedTo = (record?.['Related to'] as string) ?? '';

  const currentAddrList = detailsData ? arr<Record<string, unknown>>(detailsData['currentAddressDetailsList'] ?? detailsData['Current Address Details List']) : [];
  const currentAddr = currentAddrList[0];
  const allPhones = detailsData ? arr<Record<string, unknown>>(detailsData['allPhoneDetails'] ?? detailsData['All Phone Details']) : [];
  const emailAddresses = detailsData ? arr<Record<string, unknown>>(detailsData['emailAddresses'] ?? detailsData['Email Addresses']) : [];
  const previousAddresses = detailsData ? arr<Record<string, unknown>>(detailsData['previousAddressDetails'] ?? detailsData['Previous Address Details']) : [];
  const allRelatives = detailsData ? arr<Record<string, unknown>>(detailsData['allRelatives'] ?? detailsData['All Relatives']) : [];
  const allAssociates = detailsData ? arr<Record<string, unknown>>(detailsData['allAssociates'] ?? detailsData['All Associates']) : [];

  const prevAddrShow = showMorePrevAddr ? previousAddresses : previousAddresses.slice(0, 3);
  const relativesShow = showMoreRelatives ? allRelatives : allRelatives.slice(0, 5);
  const associatesShow = showMoreAssociates ? allAssociates : allAssociates.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-label="Public record details"
    >
      <div
        className="border border-border-muted dark:border-white/10 rounded-md bg-white dark:bg-surface w-full max-w-sm shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-[10px] border-b border-border-muted dark:border-white/10">
          <h2 className="text-sm font-semibold text-foreground">Public record</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-foreground-muted hover:text-foreground transition-colors rounded"
            aria-label="Close"
          >
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-[10px] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0 bg-surface-accent dark:bg-white/10 flex items-center justify-center">
              <UserIcon className="w-5 h-5 text-foreground-muted" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{name || 'Unknown'}</p>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-foreground-muted">
                {age && <span>Age {age}</span>}
                {born && <span>Born {born}</span>}
                {telephone && <span>{telephone}</span>}
              </div>
            </div>
          </div>
          {livesIn && (
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5">Lives in</p>
              <p className="text-xs text-foreground">{livesIn}</p>
            </div>
          )}
          {usedToLive && (
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5">Used to live in</p>
              <p className="text-xs text-foreground">{usedToLive}</p>
            </div>
          )}
          {relatedTo && (
            <div>
              <p className="text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5">Related to</p>
              <p className="text-xs text-foreground">{relatedTo}</p>
            </div>
          )}

          <div className="pt-2 space-y-2">
            <button
              type="button"
              disabled={!canPullDetails || detailsLoading}
              onClick={handlePullPublicData}
              className="w-full py-3 px-4 rounded-xl bg-lake-blue text-white text-sm font-medium hover:bg-lake-blue/90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none transition-all"
            >
              {detailsLoading ? 'Loading…' : 'Pull Public Data'}
            </button>
            {detailsError && (
              <p className="text-xs text-red-600 dark:text-red-400">{detailsError}</p>
            )}
            {detailsData && (
              <div className="space-y-3">
                {currentAddr && (
                  <div>
                    <p className={SECTION_LABEL}>Current address</p>
                    <p className="text-xs text-foreground">
                      {[str(currentAddr.Street ?? currentAddr.street), [str(currentAddr.City ?? currentAddr.city), str(currentAddr.State ?? currentAddr.state), str(currentAddr.Zip ?? currentAddr.zip)].filter(Boolean).join(', '), str(currentAddr.County ?? currentAddr.county), str(currentAddr['Date Range'] ?? currentAddr.date_range)].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                )}
                {allPhones.length > 0 && (
                  <div>
                    <p className={SECTION_LABEL}>Phone numbers</p>
                    <ul className="space-y-1">
                      {allPhones.map((ph, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {[str(ph.Number ?? ph.number), str(ph.Type ?? ph.type), str(ph.Provider ?? ph.provider), str(ph['Last Reported'] ?? ph.last_reported)].filter(Boolean).join(' · ')}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {emailAddresses.length > 0 && (
                  <div>
                    <p className={SECTION_LABEL}>Email addresses</p>
                    <ul className="space-y-0.5">
                      {emailAddresses.map((em, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {typeof em === 'string' ? em : str((em as Record<string, unknown>).Email ?? (em as Record<string, unknown>).email ?? (em as Record<string, unknown>).Address ?? (em as Record<string, unknown>).address)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {previousAddresses.length > 0 && (
                  <div>
                    <p className={SECTION_LABEL}>Previous addresses</p>
                    <ul className="space-y-1">
                      {prevAddrShow.map((addr, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {[str(addr.Street ?? addr.street), [str(addr.City ?? addr.city), str(addr.State ?? addr.state), str(addr.Zip ?? addr.zip)].filter(Boolean).join(', '), str(addr.County ?? addr.county), str(addr.Timespan ?? addr.timespan ?? addr['Date Range'] ?? addr.date_range)].filter(Boolean).join(' · ')}
                        </li>
                      ))}
                    </ul>
                    {previousAddresses.length > 3 && (
                      <button type="button" onClick={() => setShowMorePrevAddr((v) => !v)} className="text-xs text-lake-blue hover:underline mt-1">
                        {showMorePrevAddr ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}
                {allRelatives.length > 0 && (
                  <div>
                    <p className={SECTION_LABEL}>Relatives</p>
                    <ul className="space-y-0.5">
                      {relativesShow.map((rel, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {getRecordDisplayName(rel as Record<string, unknown>)}
                          {(rel as Record<string, unknown>).Age != null && ` · Age ${(rel as Record<string, unknown>).Age}`}
                        </li>
                      ))}
                    </ul>
                    {allRelatives.length > 5 && (
                      <button type="button" onClick={() => setShowMoreRelatives((v) => !v)} className="text-xs text-lake-blue hover:underline mt-1">
                        {showMoreRelatives ? 'Show less' : `Show ${allRelatives.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
                {allAssociates.length > 0 && (
                  <div>
                    <p className={SECTION_LABEL}>Associates</p>
                    <ul className="space-y-0.5">
                      {associatesShow.map((assoc, i) => (
                        <li key={i} className="text-xs text-foreground">
                          {getRecordDisplayName(assoc as Record<string, unknown>)}
                          {(assoc as Record<string, unknown>).Age != null && ` · Age ${(assoc as Record<string, unknown>).Age}`}
                        </li>
                      ))}
                    </ul>
                    {allAssociates.length > 5 && (
                      <button type="button" onClick={() => setShowMoreAssociates((v) => !v)} className="text-xs text-lake-blue hover:underline mt-1">
                        {showMoreAssociates ? 'Show less' : `Show ${allAssociates.length - 5} more`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            <p className="text-[10px] text-foreground-muted leading-snug">
              For the Love of Minnesota uses third‑party API solutions for searches and public records. Information may not be 100% accurate.
            </p>
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
