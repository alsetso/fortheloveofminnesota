'use client';

import GeneralSettingsClient from '@/features/settings/components/GeneralSettingsClient';
import AccountSettingsClient from '@/features/settings/components/AccountSettingsClient';
import UsernameSettingsClient from '@/features/settings/components/UsernameSettingsClient';
import PrivacySettingsClient from '@/features/settings/components/PrivacySettingsClient';

export default function ProfileSettingsClient() {
  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider px-0.5">General</h2>
        <GeneralSettingsClient />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider px-0.5">Account</h2>
        <AccountSettingsClient />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider px-0.5">Username</h2>
        <UsernameSettingsClient />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground-muted uppercase tracking-wider px-0.5">Privacy</h2>
        <PrivacySettingsClient />
      </section>
    </div>
  );
}
