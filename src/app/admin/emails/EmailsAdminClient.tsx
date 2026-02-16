'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  EnvelopeIcon,
  PaperAirplaneIcon,
  CheckIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import toast, { Toaster } from 'react-hot-toast';

interface AuthUser {
  id: string;
  email: string | undefined;
  created_at: string;
  last_sign_in_at: string | null;
}

export default function EmailsAdminClient() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/emails/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }

  const usersWithEmail = useMemo(
    () => users.filter((u) => u.email),
    [users]
  );

  const filtered = useMemo(() => {
    if (!search) return usersWithEmail;
    const q = search.toLowerCase();
    return usersWithEmail.filter((u) => u.email?.toLowerCase().includes(q));
  }, [usersWithEmail, search]);

  const allSelected = filtered.length > 0 && filtered.every((u) => selected.has(u.id));

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((u) => u.id)));
    }
  }

  function toggleUser(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSend() {
    const recipients = usersWithEmail
      .filter((u) => selected.has(u.id))
      .map((u) => u.email!)
      .filter(Boolean);

    if (!recipients.length) {
      toast.error('Select at least one recipient');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!html.trim()) {
      toast.error('Email body is required');
      return;
    }

    setSending(true);
    try {
      const res = await fetch('/api/admin/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipients, subject, html }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Send failed');
      }

      const result = await res.json();
      toast.success(`Sent ${result.sent} of ${result.total} emails`);
      setSubject('');
      setHtml('');
      setSelected(new Set());
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  }

  function formatDate(iso: string | null) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  return (
    <NewPageWrapper>
      <Toaster position="top-right" />
      <div className="max-w-5xl mx-auto p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <EnvelopeIcon className="w-4 h-4 text-gray-500" />
          <h1 className="text-sm font-semibold text-gray-900">Email Management</h1>
          <span className="text-xs text-gray-500 ml-auto">
            {usersWithEmail.length} users with email
          </span>
        </div>

        {/* Compose */}
        <div className="border border-gray-200 rounded-md bg-white p-[10px] space-y-2">
          <p className="text-xs font-medium text-gray-700">Compose</p>
          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          <textarea
            placeholder="HTML body"
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={6}
            className="w-full border border-gray-200 rounded-md px-2 py-1.5 text-xs text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300 resize-y"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleSend}
              disabled={sending || selected.size === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded-md hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <PaperAirplaneIcon className="w-3 h-3" />
              {sending ? 'Sending...' : `Send to ${selected.size} recipient${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-md pl-7 pr-2 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
        </div>

        {/* Users Table */}
        <div className="border border-gray-200 rounded-md bg-white overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-8 px-2 py-1.5">
                  <button
                    onClick={toggleAll}
                    className="w-4 h-4 border border-gray-300 rounded flex items-center justify-center hover:bg-gray-100 transition-colors"
                  >
                    {allSelected && <CheckIcon className="w-3 h-3 text-gray-700" />}
                  </button>
                </th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Email</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Created</th>
                <th className="text-left px-2 py-1.5 font-medium text-gray-600">Last Sign In</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-gray-500">
                    No users found
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="w-8 px-2 py-1.5">
                      <div
                        className={`w-4 h-4 border rounded flex items-center justify-center ${
                          selected.has(user.id)
                            ? 'border-gray-700 bg-gray-900'
                            : 'border-gray-300'
                        }`}
                      >
                        {selected.has(user.id) && (
                          <CheckIcon className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-gray-900">{user.email}</td>
                    <td className="px-2 py-1.5 text-gray-500">{formatDate(user.created_at)}</td>
                    <td className="px-2 py-1.5 text-gray-500">{formatDate(user.last_sign_in_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </NewPageWrapper>
  );
}
