'use client';

import { useState, useEffect } from 'react';
import AccountSettingsForm from './AccountSettingsForm';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import type { ProfileAccount } from '@/types/profile';

export default function AccountSettingsClient() {
  const { account: initialAccount, userEmail } = useSettings();
  const [account, setAccount] = useState<ProfileAccount>({
    ...initialAccount,
    search_visibility: initialAccount.search_visibility ?? false,
    account_taggable: initialAccount.account_taggable ?? false,
  });

  useEffect(() => {
    setAccount({
      ...initialAccount,
      search_visibility: initialAccount.search_visibility ?? false,
      account_taggable: initialAccount.account_taggable ?? false,
    });
  }, [initialAccount]);

  return (
    <AccountSettingsForm
      initialAccount={account}
      userEmail={userEmail}
      showAccountSwitcher
      onAccountUpdate={setAccount}
    />
  );
}
