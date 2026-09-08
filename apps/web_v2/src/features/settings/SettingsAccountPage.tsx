'use client';

import { useRouter } from 'next/navigation';
import { EditProfileForm } from '@/features/account';
import { SettingsChrome } from '@/features/settings/SettingsChrome';
import { SETTINGS_PATH } from '@/lib/routes/routePolicy';

/**
 * /settings/account — edit name, username, contact, bio, traits, privacy.
 */
export default function SettingsAccountPage() {
  const router = useRouter();

  return (
    <SettingsChrome title="Account" backHref={SETTINGS_PATH}>
      <div className="px-4 pb-12 pt-4">
        <h2 className="mb-4 px-1 text-[28px] font-extrabold tracking-tight text-foreground">
          Account
        </h2>
        <EditProfileForm
          onCancel={() => router.push(SETTINGS_PATH)}
          onSaved={() => router.push(SETTINGS_PATH)}
        />
      </div>
    </SettingsChrome>
  );
}
