'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BuildingOfficeIcon, UserIcon, BriefcaseIcon } from '@heroicons/react/24/outline';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import OrgTable from './OrgTable';
import PersonTable from './PersonTable';
import RoleTable from './RoleTable';
import type { OrgRecord, PersonRecord, RoleRecord } from './types';

type Tab = 'orgs' | 'people' | 'roles';

export default function GovAdminClient() {
  const [activeTab, setActiveTab] = useState<Tab>('orgs');
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [people, setPeople] = useState<PersonRecord[]>([]);
  const [roles, setRoles] = useState<RoleRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Set<Tab>>(new Set());

  const supabase = useSupabaseClient();

  const loadData = useCallback(async () => {
    // Skip if already loaded
    if (loadedTabs.has(activeTab)) {
      return;
    }

    setLoading(true);
    try {
      if (activeTab === 'orgs') {
        const { data, error } = await supabase
          .from('orgs')
          .select('*')
          .order('name');
        if (error) throw error;
        setOrgs(data || []);
      } else if (activeTab === 'people') {
        const { data, error } = await supabase
          .from('people')
          .select('id, name, slug, party, photo_url, district, email, phone, address, created_at')
          .order('name');
        if (error) throw error;
        setPeople(data || []);
      } else if (activeTab === 'roles') {
        const { data, error } = await supabase
          .from('roles')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setRoles(data || []);
      }
      setLoadedTabs(prev => new Set(prev).add(activeTab));
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadedTabs, supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOrgUpdate = useCallback(async (id: string, field: keyof OrgRecord, value: string | null) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('orgs')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
      setOrgs(prev => prev.map(org => org.id === id ? { ...org, [field]: value } : org));
    } catch (error) {
      console.error('Error updating org:', error);
      alert('Failed to update. Please try again.'); // TODO: Replace with ErrorToast
      // Reload data for this tab
      setLoadedTabs(prev => {
        const next = new Set(prev);
        next.delete('orgs');
        return next;
      });
      await loadData();
    } finally {
      setSaving(null);
    }
  }, [supabase, loadData]);

  const handlePersonUpdate = useCallback(async (id: string, field: keyof PersonRecord, value: string | null | boolean) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('people')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
      setPeople(prev => prev.map(person => person.id === id ? { ...person, [field]: value } : person));
    } catch (error) {
      console.error('Error updating person:', error);
      alert('Failed to update. Please try again.'); // TODO: Replace with ErrorToast
      // Reload data for this tab
      setLoadedTabs(prev => {
        const next = new Set(prev);
        next.delete('people');
        return next;
      });
      await loadData();
    } finally {
      setSaving(null);
    }
  }, [supabase, loadData]);

  const handleRoleUpdate = useCallback(async (id: string, field: keyof RoleRecord, value: string | null | boolean) => {
    setSaving(id);
    try {
      const { error } = await supabase
        .from('roles')
        .update({ [field]: value })
        .eq('id', id);
      if (error) throw error;
      setRoles(prev => prev.map(role => role.id === id ? { ...role, [field]: value } : role));
    } catch (error) {
      console.error('Error updating role:', error);
      alert('Failed to update. Please try again.'); // TODO: Replace with ErrorToast
      // Reload data for this tab
      setLoadedTabs(prev => {
        const next = new Set(prev);
        next.delete('roles');
        return next;
      });
      await loadData();
    } finally {
      setSaving(null);
    }
  }, [supabase, loadData]);

  if (loading) {
    return (
      <div className="bg-white rounded-md border border-gray-200 p-[10px]">
        <p className="text-xs text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('orgs')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'orgs'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BuildingOfficeIcon className="w-3 h-3 inline mr-1" />
          Orgs ({orgs.length})
        </button>
        <button
          onClick={() => setActiveTab('people')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'people'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <UserIcon className="w-3 h-3 inline mr-1" />
          People ({people.length})
        </button>
        <button
          onClick={() => setActiveTab('roles')}
          className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors ${
            activeTab === 'roles'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <BriefcaseIcon className="w-3 h-3 inline mr-1" />
          Roles ({roles.length})
        </button>
      </div>

      <div className="bg-white rounded-md border border-gray-200 overflow-x-auto">
        {activeTab === 'orgs' && (
          <OrgTable orgs={orgs} onUpdate={handleOrgUpdate} saving={saving} />
        )}
        {activeTab === 'people' && (
          <PersonTable people={people} onUpdate={handlePersonUpdate} saving={saving} />
        )}
        {activeTab === 'roles' && (
          <RoleTable roles={roles} onUpdate={handleRoleUpdate} saving={saving} />
        )}
      </div>
    </div>
  );
}
