'use client';

import { useState } from 'react';

const SECTION_LABEL = 'text-[10px] font-medium text-foreground-muted uppercase tracking-wide mb-0.5';

function getRecordDisplayName(r: Record<string, unknown>): string {
  const name =
    (r.Name as string) ??
    (r.name as string) ??
    (r.FullName as string) ??
    (r.full_name as string) ??
    ([r.FirstName, r.LastName].filter(Boolean).join(' ') || [r.first_name, r.last_name].filter(Boolean).join(' ')) ??
    '';
  return String(name || 'Unknown');
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/** Try multiple key variants (API may store camelCase, "all Relatives", or "Person Details"). */
function get<T>(obj: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null) return v as T;
  }
  return undefined;
}

function strFrom(obj: Record<string, unknown>, ...keys: string[]): string {
  return str(get<unknown>(obj, ...keys));
}

/** Renders normalized pulled_data from people.pull_requests. Handles camelCase and partially-normalized keys (e.g. "all Relatives"). */
export interface PulledDataCardProps {
  pulledData: Record<string, unknown>;
  /** Optional record from public_record_results for fallback name/context */
  record?: Record<string, unknown> | null;
  /** Compact: show fewer items before "Show more" */
  compact?: boolean;
}

export default function PulledDataCard({ pulledData, record, compact = true }: PulledDataCardProps) {
  const [showMorePrevAddr, setShowMorePrevAddr] = useState(false);
  const [showMoreRelatives, setShowMoreRelatives] = useState(false);
  const [showMoreAssociates, setShowMoreAssociates] = useState(false);

  const personDetailsArr = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'personDetails', 'person Details', 'Person Details') ?? []
  );
  const personDetails0 = personDetailsArr[0];
  const name = personDetails0 ? getRecordDisplayName(personDetails0) : (record ? getRecordDisplayName(record) : '');
  const age = personDetails0 != null && (personDetails0.age ?? personDetails0.Age) != null ? String(personDetails0.age ?? personDetails0.Age) : (record?.Age != null ? String(record.Age) : (record?.age as string) ?? '');
  const born = personDetails0 ? str(personDetails0.born ?? personDetails0.Born) : '';
  const telephone = personDetails0 ? str(personDetails0.telephone ?? personDetails0.Telephone) : '';

  const currentAddrList = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'currentAddressDetailsList', 'current Address Details List', 'Current Address Details List') ?? []
  );
  const currentAddr = currentAddrList[0];
  const allPhones = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'allPhoneDetails', 'all Phone Details', 'All Phone Details') ?? []
  );
  const emailAddresses = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'emailAddresses', 'email Addresses', 'Email Addresses') ?? []
  );
  const previousAddresses = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'previousAddressDetails', 'previous Address Details', 'Previous Address Details') ?? []
  );
  const allRelatives = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'allRelatives', 'all Relatives', 'All Relatives') ?? []
  );
  const allAssociates = arr<Record<string, unknown>>(
    get<unknown>(pulledData, 'allAssociates', 'all Associates', 'All Associates') ?? []
  );

  const prevLimit = 3;
  const relativesLimit = 5;
  const associatesLimit = 5;
  const prevAddrShow = showMorePrevAddr ? previousAddresses : previousAddresses.slice(0, prevLimit);
  const relativesShow = showMoreRelatives ? allRelatives : allRelatives.slice(0, relativesLimit);
  const associatesShow = showMoreAssociates ? allAssociates : allAssociates.slice(0, associatesLimit);

  const street = str((currentAddr as Record<string, unknown>)?.street ?? (currentAddr as Record<string, unknown>)?.Street);
  const city = str((currentAddr as Record<string, unknown>)?.city ?? (currentAddr as Record<string, unknown>)?.City);
  const state = str((currentAddr as Record<string, unknown>)?.state ?? (currentAddr as Record<string, unknown>)?.State);
  const zip = str((currentAddr as Record<string, unknown>)?.zip ?? (currentAddr as Record<string, unknown>)?.Zip);
  const county = str((currentAddr as Record<string, unknown>)?.county ?? (currentAddr as Record<string, unknown>)?.County);
  const dateRange = str((currentAddr as Record<string, unknown>)?.date_range ?? (currentAddr as Record<string, unknown>)?.dateRange ?? (currentAddr as Record<string, unknown>)?.['Date Range']);
  const cityStateZip = [city, [state, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');

  return (
    <div className="space-y-3">
      {/* Person header: Name + Age from Person Details[0]; Born and Telephone inline below if present */}
      <div>
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0 text-xs">
          {name && <span className="font-medium text-foreground">{name}</span>}
          {age && <span className="text-foreground-muted">Age {age}</span>}
        </div>
        {(born || telephone) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0 text-xs text-foreground-muted mt-0.5">
            {born && <span>Born {born}</span>}
            {telephone && <span>{telephone}</span>}
          </div>
        )}
      </div>
      {/* Current Address — single entry from Current Address Details List[0]: full street, city/state/zip, county, date range */}
      {currentAddr && (street || cityStateZip || county || dateRange) && (
        <div>
          <p className={SECTION_LABEL}>Current address</p>
          <div className="text-xs text-foreground space-y-0.5">
            {street && <p>{street}</p>}
            {cityStateZip && <p>{cityStateZip}</p>}
            {county && <p>{county}</p>}
            {dateRange && <p>{dateRange}</p>}
          </div>
        </div>
      )}
      {/* Phone Numbers — number, type, provider, last reported; stack as list */}
      {/* Phone Numbers — number, type, provider, last reported per row */}
      {allPhones.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Phone numbers</p>
          <ul className="space-y-1">
            {allPhones.map((ph, i) => {
              const p = ph as Record<string, unknown>;
              return (
                <li key={i} className="text-xs text-foreground">
                  {[strFrom(p, 'number', 'Number'), strFrom(p, 'type', 'Type'), strFrom(p, 'provider', 'Provider'), strFrom(p, 'lastReported', 'last Reported', 'Last Reported')].filter(Boolean).join(' · ')}
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {/* Email Addresses — skip section if empty */}
      {emailAddresses.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Email addresses</p>
          <ul className="space-y-0.5">
            {emailAddresses.map((em, i) => (
              <li key={i} className="text-xs text-foreground">
                {typeof em === 'string' ? em : strFrom(em as Record<string, unknown>, 'email', 'Email', 'address', 'Address')}
              </li>
            ))}
          </ul>
        </div>
      )}
      {/* Previous Addresses — street, city/state/zip, county, timespan; show 3 then "Show more" */}
      {previousAddresses.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Previous addresses</p>
          <ul className="space-y-1">
            {prevAddrShow.map((addr, i) => {
              const a = addr as Record<string, unknown>;
              const st = strFrom(a, 'street', 'Street');
              const c = strFrom(a, 'city', 'City');
              const s = strFrom(a, 'state', 'State');
              const z = strFrom(a, 'zip', 'Zip');
              const cityStateZip = [c, [s, z].filter(Boolean).join(' ')].filter(Boolean).join(', ');
              const co = strFrom(a, 'county', 'County');
              const ts = strFrom(a, 'timespan', 'Timespan', 'date_range', 'date Range', 'Date Range');
              return (
                <li key={i} className="text-xs text-foreground">
                  {[st, cityStateZip, co, ts].filter(Boolean).join(' · ')}
                </li>
              );
            })}
          </ul>
          {previousAddresses.length > prevLimit && (
            <button type="button" onClick={() => setShowMorePrevAddr((v) => !v)} className="text-xs text-lake-blue hover:underline mt-0.5">
              {showMorePrevAddr ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}
      {/* Relatives — Name + Age per row; 5 then "Show X more". No Person Links. */}
      {allRelatives.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Relatives</p>
          <ul className="space-y-0.5">
            {relativesShow.map((rel, i) => {
              const r = rel as Record<string, unknown>;
              const ageVal = r.age ?? r.Age;
              return (
                <li key={i} className="text-xs text-foreground">
                  {getRecordDisplayName(r)}
                  {ageVal != null && ` · Age ${ageVal}`}
                </li>
              );
            })}
          </ul>
          {allRelatives.length > relativesLimit && (
            <button type="button" onClick={() => setShowMoreRelatives((v) => !v)} className="text-xs text-lake-blue hover:underline mt-0.5">
              {showMoreRelatives ? 'Show less' : `Show ${allRelatives.length - relativesLimit} more`}
            </button>
          )}
        </div>
      )}
      {/* Associates — same as Relatives: Name + Age per row; 5 then "Show X more" */}
      {allAssociates.length > 0 && (
        <div>
          <p className={SECTION_LABEL}>Associates</p>
          <ul className="space-y-0.5">
            {associatesShow.map((assoc, i) => {
              const a = assoc as Record<string, unknown>;
              const ageVal = a.age ?? a.Age;
              return (
                <li key={i} className="text-xs text-foreground">
                  {getRecordDisplayName(a)}
                  {ageVal != null && ` · Age ${ageVal}`}
                </li>
              );
            })}
          </ul>
          {allAssociates.length > associatesLimit && (
            <button type="button" onClick={() => setShowMoreAssociates((v) => !v)} className="text-xs text-lake-blue hover:underline mt-0.5">
              {showMoreAssociates ? 'Show less' : `Show ${allAssociates.length - associatesLimit} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
