'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import { XMarkIcon, PhotoIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

/* ─── Types ─── */

interface SchoolEditData {
  name?: string;
  address?: string | null;
  phone?: string | null;
  website_url?: string | null;
  principal_name?: string | null;
  enrollment?: number | null;
  year_established?: number | null;
  grade_low?: number | null;
  grade_high?: number | null;
  tagline?: string | null;
  description?: string | null;
  conference?: string | null;
  mascot_name?: string | null;
  primary_color?: string | null;
  secondary_color?: string | null;
  logo_url?: string | null;
  cover_url?: string | null;
  mascot_url?: string | null;
}

interface SchoolEditModalProps {
  schoolId: string;
  schoolName: string;
  initialData: SchoolEditData;
  onClose: () => void;
  onSaved: (data: SchoolEditData) => void;
}

type TabId = 'details' | 'branding' | 'media';

const TABS: { id: TabId; label: string }[] = [
  { id: 'details', label: 'Details' },
  { id: 'branding', label: 'Branding' },
  { id: 'media', label: 'Media' },
];

/* ─── Modal ─── */

export default function SchoolEditModal({
  schoolId,
  schoolName,
  initialData,
  onClose,
  onSaved,
}: SchoolEditModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('details');

  const [name, setName] = useState(initialData.name ?? schoolName);
  const [address, setAddress] = useState(initialData.address ?? '');
  const [phone, setPhone] = useState(initialData.phone ?? '');
  const [websiteUrl, setWebsiteUrl] = useState(initialData.website_url ?? '');
  const [principalName, setPrincipalName] = useState(initialData.principal_name ?? '');
  const [enrollment, setEnrollment] = useState(initialData.enrollment?.toString() ?? '');
  const [yearEstablished, setYearEstablished] = useState(initialData.year_established?.toString() ?? '');
  const [gradeLow, setGradeLow] = useState(initialData.grade_low?.toString() ?? '');
  const [gradeHigh, setGradeHigh] = useState(initialData.grade_high?.toString() ?? '');
  const [tagline, setTagline] = useState(initialData.tagline ?? '');
  const [description, setDescription] = useState(initialData.description ?? '');
  const [conference, setConference] = useState(initialData.conference ?? '');
  const [mascotName, setMascotName] = useState(initialData.mascot_name ?? '');

  const [primaryColor, setPrimaryColor] = useState(initialData.primary_color ?? '');
  const [secondaryColor, setSecondaryColor] = useState(initialData.secondary_color ?? '');

  const [logoUrl, setLogoUrl] = useState<string | null>(initialData.logo_url ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialData.cover_url ?? null);
  const [mascotUrl, setMascotUrl] = useState<string | null>(initialData.mascot_url ?? null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingMascot, setUploadingMascot] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logoFileRef = useRef<HTMLInputElement>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const mascotFileRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File, role: 'logo' | 'cover' | 'mascot'): Promise<string> => {
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be smaller than 5 MB');
    if (!file.type.startsWith('image/')) throw new Error('File must be an image');

    const ext = file.name.split('.').pop() || 'png';
    const path = `schools/${schoolId}/${role}-${Date.now()}.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from('logos')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(path);
    if (!urlData?.publicUrl) throw new Error('Failed to get URL');
    return urlData.publicUrl;
  }, [schoolId]);

  const handleUpload = useCallback(async (file: File, role: 'logo' | 'cover' | 'mascot') => {
    const setUploading = role === 'logo' ? setUploadingLogo : role === 'cover' ? setUploadingCover : setUploadingMascot;
    const setUrl = role === 'logo' ? setLogoUrl : role === 'cover' ? setCoverUrl : setMascotUrl;
    const ref = role === 'logo' ? logoFileRef : role === 'cover' ? coverFileRef : mascotFileRef;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadImage(file, role);
      setUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (ref.current) ref.current.value = '';
    }
  }, [uploadImage]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { school_id: schoolId };

      payload.name = name || schoolName;
      payload.address = address || null;
      payload.phone = phone || null;
      payload.website_url = websiteUrl || null;
      payload.principal_name = principalName || null;
      payload.enrollment = enrollment ? parseInt(enrollment, 10) : null;
      payload.year_established = yearEstablished ? parseInt(yearEstablished, 10) : null;
      payload.grade_low = gradeLow !== '' ? parseInt(gradeLow, 10) : null;
      payload.grade_high = gradeHigh !== '' ? parseInt(gradeHigh, 10) : null;
      payload.tagline = tagline || null;
      payload.description = description || null;
      payload.conference = conference || null;
      payload.mascot_name = mascotName || null;
      payload.primary_color = primaryColor || null;
      payload.secondary_color = secondaryColor || null;
      payload.logo_url = logoUrl;
      payload.cover_url = coverUrl;
      payload.mascot_url = mascotUrl;

      const res = await fetch('/api/atlas/schools/identity', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
      const data = await res.json();
      onSaved({
        name: data.name,
        address: data.address,
        phone: data.phone,
        website_url: data.website_url,
        principal_name: data.principal_name,
        enrollment: data.enrollment,
        year_established: data.year_established,
        grade_low: data.grade_low,
        grade_high: data.grade_high,
        tagline: data.tagline,
        description: data.description,
        conference: data.conference,
        mascot_name: data.mascot_name,
        primary_color: data.primary_color,
        secondary_color: data.secondary_color,
        logo_url: data.logo_url,
        cover_url: data.cover_url,
        mascot_url: data.mascot_url,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const isUploading = uploadingLogo || uploadingCover || uploadingMascot;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">Edit {schoolName}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-gray-200 flex-shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-gray-900'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gray-900" />
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {activeTab === 'details' && (
            <>
              <TextField label="School Name" value={name} onChange={setName} placeholder="School name" />
              <TextField label="Tagline" value={tagline} onChange={setTagline} placeholder="Short motto or tagline" />
              <TextArea label="Description" value={description} onChange={setDescription} placeholder="About this school…" rows={3} />
              <TextField label="Address" value={address} onChange={setAddress} placeholder="Street address" />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Phone" value={phone} onChange={setPhone} placeholder="(000) 000-0000" />
                <TextField label="Website" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." />
              </div>
              <TextField label="Principal" value={principalName} onChange={setPrincipalName} placeholder="Principal name" />
              <div className="grid grid-cols-2 gap-3">
                <TextField label="Mascot" value={mascotName} onChange={setMascotName} placeholder="Elks" />
                <TextField label="Conference" value={conference} onChange={setConference} placeholder="Northwest Suburban" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <NumberField label="Enrollment" value={enrollment} onChange={setEnrollment} placeholder="0" />
                <NumberField label="Year Est." value={yearEstablished} onChange={setYearEstablished} placeholder="1960" />
                <div />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Grade Low" value={gradeLow} onChange={setGradeLow} placeholder="-1" />
                <NumberField label="Grade High" value={gradeHigh} onChange={setGradeHigh} placeholder="12" />
              </div>
            </>
          )}

          {activeTab === 'branding' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <ColorField label="Primary Color" value={primaryColor} onChange={setPrimaryColor} />
                <ColorField label="Secondary Color" value={secondaryColor} onChange={setSecondaryColor} />
              </div>
              {(primaryColor || secondaryColor) && (
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Preview</label>
                  <div className="flex items-center gap-2">
                    {primaryColor && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: primaryColor }} />
                        <span className="text-[10px] text-gray-500">{primaryColor}</span>
                      </div>
                    )}
                    {secondaryColor && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: secondaryColor }} />
                        <span className="text-[10px] text-gray-500">{secondaryColor}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'media' && (
            <>
              <ImageDropZone
                label="Logo"
                description="School crest or logo image"
                imageUrl={logoUrl}
                uploading={uploadingLogo}
                aspect="square"
                fileRef={logoFileRef}
                onFile={(f) => handleUpload(f, 'logo')}
                onRemove={() => setLogoUrl(null)}
              />
              <ImageDropZone
                label="Cover Photo"
                description="Photo of the front of the building"
                imageUrl={coverUrl}
                uploading={uploadingCover}
                aspect="wide"
                fileRef={coverFileRef}
                onFile={(f) => handleUpload(f, 'cover')}
                onRemove={() => setCoverUrl(null)}
              />
              <ImageDropZone
                label="Mascot Image"
                description="School mascot logo or illustration"
                imageUrl={mascotUrl}
                uploading={uploadingMascot}
                aspect="square"
                fileRef={mascotFileRef}
                onFile={(f) => handleUpload(f, 'mascot')}
                onRemove={() => setMascotUrl(null)}
              />
            </>
          )}

          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-3 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || isUploading}
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Text Field ─── */

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
      />
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
      />
    </div>
  );
}

/* ─── Number Field ─── */

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
      />
    </div>
  );
}

/* ─── Color Field ─── */

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="w-7 h-7 rounded border border-gray-200 cursor-pointer p-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400"
        />
      </div>
    </div>
  );
}

/* ─── Drag & Drop Image Zone ─── */

function ImageDropZone({
  label,
  description,
  imageUrl,
  uploading,
  aspect,
  fileRef,
  onFile,
  onRemove,
}: {
  label: string;
  description: string;
  imageUrl: string | null;
  uploading: boolean;
  aspect: 'square' | 'wide';
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  const heightClass = aspect === 'wide' ? 'h-28' : 'h-20';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{label}</label>
        {imageUrl && !uploading && (
          <button
            onClick={onRemove}
            className="text-[10px] text-gray-400 hover:text-red-500 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {imageUrl && !uploading ? (
        <div
          className={`relative rounded-md border border-gray-200 overflow-hidden ${heightClass} cursor-pointer group`}
          onClick={() => fileRef.current?.click()}
        >
          <img
            src={imageUrl}
            alt=""
            className={`w-full h-full ${aspect === 'square' ? 'object-contain' : 'object-cover'}`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="text-[10px] text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">
              Replace
            </span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`${heightClass} rounded-md border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer ${
            dragOver
              ? 'border-gray-400 bg-gray-100'
              : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <span className="text-[10px] text-gray-400">Uploading…</span>
          ) : (
            <>
              {dragOver ? (
                <ArrowUpTrayIcon className="w-4 h-4 text-gray-400" />
              ) : (
                <PhotoIcon className="w-4 h-4 text-gray-400" />
              )}
              <span className="text-[10px] text-gray-400">
                {dragOver ? 'Drop image' : 'Drag & drop or click'}
              </span>
              <span className="text-[9px] text-gray-300">{description}</span>
            </>
          )}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}
