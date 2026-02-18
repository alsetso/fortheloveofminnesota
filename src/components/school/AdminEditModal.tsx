'use client';

import { useState, useRef, useCallback, type DragEvent } from 'react';
import { XMarkIcon, PhotoIcon, ArrowUpTrayIcon, TrashIcon } from '@heroicons/react/24/outline';
import { supabase } from '@/lib/supabase';

interface AdminStaffRecord {
  id?: string;
  school_id?: string;
  name: string;
  role: string;
  photo_url?: string | null;
  phone?: string | null;
  directory_number?: string | null;
  email?: string | null;
  bio?: string | null;
  sort_order: number;
  claimed_by?: string | null;
}

interface AdminEditModalProps {
  schoolId: string;
  staff: AdminStaffRecord | null;
  onClose: () => void;
  onSaved: (record: AdminStaffRecord & { id: string }) => void;
  onDeleted?: (id: string) => void;
}

export default function AdminEditModal({
  schoolId,
  staff,
  onClose,
  onSaved,
  onDeleted,
}: AdminEditModalProps) {
  const isNew = !staff?.id;
  const [name, setName] = useState(staff?.name ?? '');
  const [role, setRole] = useState(staff?.role ?? '');
  const [photoUrl, setPhotoUrl] = useState<string | null>(staff?.photo_url ?? null);
  const [phone, setPhone] = useState(staff?.phone ?? '');
  const [directoryNumber, setDirectoryNumber] = useState(staff?.directory_number ?? '');
  const [email, setEmail] = useState(staff?.email ?? '');
  const [bio, setBio] = useState(staff?.bio ?? '');
  const [sortOrder, setSortOrder] = useState(staff?.sort_order ?? 0);

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const uploadPhoto = useCallback(async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setError('Image must be smaller than 5 MB'); return; }
    if (!file.type.startsWith('image/')) { setError('File must be an image'); return; }

    setUploading(true);
    setError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `schools/${schoolId}/admin-${Date.now()}.${ext}`;
      const { error: err } = await supabase.storage
        .from('logos')
        .upload(path, file, { cacheControl: '3600', upsert: false });
      if (err) throw new Error(err.message);
      const { data } = supabase.storage.from('logos').getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Failed to get URL');
      setPhotoUrl(data.publicUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [schoolId]);

  const handleSave = async () => {
    if (!name.trim() || !role.trim()) { setError('Name and role are required'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/atlas/schools/administration/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(staff?.id ? { id: staff.id } : {}),
          school_id: schoolId,
          name: name.trim(),
          role: role.trim(),
          photo_url: photoUrl,
          phone: phone.trim() || null,
          directory_number: directoryNumber.trim() || null,
          email: email.trim() || null,
          bio: bio.trim() || null,
          sort_order: sortOrder,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Save failed (${res.status})`);
      }
      const data = await res.json();
      onSaved(data);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!staff?.id || !onDeleted) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch('/api/atlas/schools/administration/manage', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id }),
      });
      if (!res.ok) throw new Error('Delete failed');
      onDeleted(staff.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const busy = saving || uploading || deleting;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg border border-gray-200 shadow-sm w-full max-w-md mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-3 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-sm font-semibold text-gray-900">{isNew ? 'Add Staff' : 'Edit Staff'}</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 transition-colors">
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {/* Photo */}
          <PhotoDropZone
            photoUrl={photoUrl}
            uploading={uploading}
            fileRef={fileRef}
            onFile={uploadPhoto}
            onRemove={() => setPhotoUrl(null)}
          />

          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name" value={name} onChange={setName} required placeholder="Full name" />
            <Field label="Role" value={role} onChange={setRole} required placeholder="e.g. Principal" />
          </div>

          {/* Contact */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" value={phone} onChange={setPhone} placeholder="(763) 241-3434" />
            <Field label="Extension" value={directoryNumber} onChange={setDirectoryNumber} placeholder="x2101" />
          </div>

          <Field label="Email" value={email} onChange={setEmail} placeholder="name@school.org" />

          {/* Bio */}
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Background and experience…"
              className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 text-gray-700 placeholder:text-gray-300 focus:outline-none focus:border-gray-400 resize-none"
            />
          </div>

          {/* Sort Order */}
          <div className="w-24">
            <Field
              label="Order"
              value={String(sortOrder)}
              onChange={(v) => setSortOrder(Math.max(0, parseInt(v) || 0))}
              placeholder="0"
            />
          </div>

          {error && <p className="text-[10px] text-red-500">{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 p-3 border-t border-gray-200 flex-shrink-0">
          <div>
            {!isNew && onDeleted && (
              <button
                onClick={handleDelete}
                disabled={busy}
                className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              >
                <TrashIcon className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy}
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-gray-900 text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Add' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoDropZone({
  photoUrl,
  uploading,
  fileRef,
  onFile,
  onRemove,
}: {
  photoUrl: string | null;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFile: (f: File) => void;
  onRemove: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
  const onDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
  const onDrop = (e: DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Photo</label>
        {photoUrl && !uploading && (
          <button onClick={onRemove} className="text-[10px] text-gray-400 hover:text-red-500 transition-colors">Remove</button>
        )}
      </div>
      {photoUrl && !uploading ? (
        <div
          className="w-16 h-16 rounded-full border border-gray-200 overflow-hidden cursor-pointer group relative mx-auto"
          onClick={() => fileRef.current?.click()}
        >
          <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
            <span className="text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity font-medium">Replace</span>
          </div>
        </div>
      ) : (
        <div
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => !uploading && fileRef.current?.click()}
          className={`w-16 h-16 mx-auto rounded-full border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
            dragOver ? 'border-gray-400 bg-gray-100' : 'border-gray-200 bg-gray-50 hover:border-gray-300 hover:bg-gray-100'
          } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {uploading ? (
            <span className="text-[8px] text-gray-400">…</span>
          ) : dragOver ? (
            <ArrowUpTrayIcon className="w-4 h-4 text-gray-400" />
          ) : (
            <PhotoIcon className="w-4 h-4 text-gray-400" />
          )}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
      />
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
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
