'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

interface MentionType {
  id: string;
  emoji: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

type SortField = 'name' | 'emoji' | 'is_active' | 'created_at';
type SortDir = 'asc' | 'desc';

export default function MentionTypesClient() {
  const [rows, setRows] = useState<MentionType[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [search, setSearch] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editEmoji, setEditEmoji] = useState('');
  const [editName, setEditName] = useState('');
  const [editIsActive, setEditIsActive] = useState(false);

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [createEmoji, setCreateEmoji] = useState('');
  const [createName, setCreateName] = useState('');
  const [createIsActive, setCreateIsActive] = useState(true);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('mention_types')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      toast.error(`Failed to load: ${error.message}`);
    } else {
      setRows(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Sort + filter logic
  const filtered = rows
    .filter((r) => {
      if (filter === 'active') return r.is_active;
      if (filter === 'inactive') return !r.is_active;
      return true;
    })
    .filter((r) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return r.name.toLowerCase().includes(q) || r.emoji.includes(q);
    });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    if (sortField === 'name') return a.name.localeCompare(b.name) * dir;
    if (sortField === 'emoji') return a.emoji.localeCompare(b.emoji) * dir;
    if (sortField === 'is_active') return (Number(a.is_active) - Number(b.is_active)) * dir;
    if (sortField === 'created_at') return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
    return 0;
  });

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  // ---- CRUD ----

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim() || !createEmoji.trim()) return;

    const tid = toast.loading('Creating...');
    const { data, error } = await supabase
      .from('mention_types')
      .insert({ emoji: createEmoji.trim(), name: createName.trim(), is_active: createIsActive })
      .select()
      .single();

    if (error) {
      toast.error(`Create failed: ${error.message}`, { id: tid });
    } else {
      setRows((prev) => [...prev, data]);
      setShowCreate(false);
      setCreateEmoji('');
      setCreateName('');
      setCreateIsActive(true);
      toast.success('Created', { id: tid });
    }
  };

  const startEdit = (row: MentionType) => {
    setEditingId(row.id);
    setEditEmoji(row.emoji);
    setEditName(row.name);
    setEditIsActive(row.is_active);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim() || !editEmoji.trim()) return;

    const tid = toast.loading('Saving...');
    const { data, error } = await supabase
      .from('mention_types')
      .update({
        emoji: editEmoji.trim(),
        name: editName.trim(),
        is_active: editIsActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', editingId)
      .select()
      .single();

    if (error) {
      toast.error(`Update failed: ${error.message}`, { id: tid });
    } else {
      setRows((prev) => prev.map((r) => (r.id === editingId ? data : r)));
      setEditingId(null);
      toast.success('Updated', { id: tid });
    }
  };

  const toggleActive = async (row: MentionType) => {
    const newVal = !row.is_active;
    // Optimistic
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: newVal } : r)));

    const { error } = await supabase
      .from('mention_types')
      .update({ is_active: newVal, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (error) {
      // Revert
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: !newVal } : r)));
      toast.error(`Toggle failed: ${error.message}`);
    } else {
      toast.success(newVal ? 'Activated' : 'Deactivated');
    }
  };

  const handleDelete = async (row: MentionType) => {
    if (!confirm(`Delete "${row.emoji} ${row.name}"? This is permanent.`)) return;

    const tid = toast.loading('Deleting...');
    const { error } = await supabase.from('mention_types').delete().eq('id', row.id);

    if (error) {
      toast.error(`Delete failed: ${error.message}`, { id: tid });
    } else {
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      toast.success('Deleted', { id: tid });
    }
  };

  // ---- Stats ----
  const activeCount = rows.filter((r) => r.is_active).length;
  const inactiveCount = rows.filter((r) => !r.is_active).length;

  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: { fontSize: '12px', padding: '10px' },
        }}
      />

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          {/* Filter tabs */}
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                filter === f
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f === 'all' && `All (${rows.length})`}
              {f === 'active' && `Active (${activeCount})`}
              {f === 'inactive' && `Inactive (${inactiveCount})`}
            </button>
          ))}

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search..."
            className="px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400 w-40"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchRows}
            className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-50 border border-gray-200 rounded-md transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
          >
            <PlusIcon className="w-3 h-3" />
            New
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-md overflow-hidden">
        {loading ? (
          <div className="py-12 text-center">
            <p className="text-xs text-gray-500">Loading...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-gray-500">No mention types found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th
                    className="px-3 py-2 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 transition-colors w-16"
                    onClick={() => toggleSort('emoji')}
                  >
                    Emoji{sortIndicator('emoji')}
                  </th>
                  <th
                    className="px-3 py-2 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 transition-colors"
                    onClick={() => toggleSort('name')}
                  >
                    Name{sortIndicator('name')}
                  </th>
                  <th
                    className="px-3 py-2 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 transition-colors w-20"
                    onClick={() => toggleSort('is_active')}
                  >
                    Active{sortIndicator('is_active')}
                  </th>
                  <th
                    className="px-3 py-2 text-left font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-100 transition-colors w-40"
                    onClick={() => toggleSort('created_at')}
                  >
                    Created{sortIndicator('created_at')}
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-gray-900 w-24">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sorted.map((row) => {
                  const isEditing = editingId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-gray-50 transition-colors ${
                        !row.is_active ? 'opacity-50' : ''
                      }`}
                    >
                      {/* Emoji */}
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editEmoji}
                            onChange={(e) => setEditEmoji(e.target.value)}
                            className="w-10 px-1 py-0.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                            maxLength={4}
                          />
                        ) : (
                          <span className="text-sm">{row.emoji}</span>
                        )}
                      </td>

                      {/* Name */}
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full px-1.5 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEdit();
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="text-xs text-gray-900 font-medium">{row.name}</span>
                        )}
                      </td>

                      {/* Active */}
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <button
                            type="button"
                            onClick={() => setEditIsActive(!editIsActive)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              editIsActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {editIsActive ? 'Active' : 'Inactive'}
                          </button>
                        ) : (
                          <button
                            onClick={() => toggleActive(row)}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                              row.is_active
                                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {row.is_active ? 'Active' : 'Inactive'}
                          </button>
                        )}
                      </td>

                      {/* Created */}
                      <td className="px-3 py-2 text-[10px] text-gray-500">
                        {new Date(row.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {isEditing ? (
                            <>
                              <button
                                onClick={saveEdit}
                                className="p-1 text-green-600 hover:text-green-800 hover:bg-green-50 rounded transition-colors"
                                title="Save"
                              >
                                <CheckIcon className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="Cancel"
                              >
                                <XMarkIcon className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(row)}
                                className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                                title="Edit"
                              >
                                <PencilIcon className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDelete(row)}
                                className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ID reference */}
      <div className="mt-2 text-[10px] text-gray-400 font-mono">
        public.mention_types · {rows.length} rows · {activeCount} active · {inactiveCount} inactive
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 rounded-md p-[10px] w-full max-w-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">New Mention Type</h3>
              <button
                onClick={() => {
                  setShowCreate(false);
                  setCreateEmoji('');
                  setCreateName('');
                  setCreateIsActive(true);
                }}
                className="text-gray-500 hover:text-gray-900 text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Emoji</label>
                <input
                  type="text"
                  value={createEmoji}
                  onChange={(e) => setCreateEmoji(e.target.value)}
                  required
                  className="w-full px-2 py-1 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="📍"
                  maxLength={4}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Name</label>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                  className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-gray-400"
                  placeholder="Type name"
                  autoFocus
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="create_is_active"
                  checked={createIsActive}
                  onChange={(e) => setCreateIsActive(e.target.checked)}
                  className="w-3.5 h-3.5 text-gray-600 border-gray-300 rounded focus:ring-gray-400"
                />
                <label htmlFor="create_is_active" className="text-xs text-gray-700 cursor-pointer">
                  Active
                </label>
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreate(false);
                    setCreateEmoji('');
                    setCreateName('');
                    setCreateIsActive(true);
                  }}
                  className="px-3 py-1 text-xs text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs text-white bg-gray-900 hover:bg-gray-800 rounded-md transition-colors"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
