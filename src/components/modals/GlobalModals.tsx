'use client';

import { useAppModalContext } from '@/contexts/AppModalContext';
import WelcomeModal from '@/features/account/components/WelcomeModal';
import OnboardingModal from '@/features/account/components/OnboardingModal';
import AccountModal from '@/features/account/components/AccountModal';
import UpgradeToProModal from '@/components/modals/UpgradeToProModal';

/**
 * GlobalModals - Renders all URL-controlled modals at the app level
 * 
 * This ensures modals work consistently across all pages and are always
 * positioned in front of other content with proper z-index.
 */
export default function GlobalModals() {
  const { modal, closeModal, openWelcome } = useAppModalContext();

  return (
    <>
      {/* Welcome / Sign In Modal - z-[60] to be above nav but standard */}
      <WelcomeModal
        isOpen={modal.type === 'welcome'}
        onClose={closeModal}
      />

      {/* Onboarding Modal - separate from account settings */}
      <OnboardingModal
        isOpen={modal.type === 'onboarding'}
        onClose={closeModal}
      />

      {/* Account Settings Modal - only for authenticated users */}
      <AccountModal
        isOpen={modal.type === 'account'}
        onClose={closeModal}
        initialTab={modal.tab as 'settings' | 'analytics' | undefined}
        onAccountUpdate={() => {
          // Account updated - could trigger refresh if needed
        }}
      />

      {/* Upgrade Modal */}
      <UpgradeToProModal
        isOpen={modal.type === 'upgrade'}
        onClose={closeModal}
        onUpgrade={() => {
          closeModal();
          // Upgrade action - can be customized as needed
        }}
        feature={modal.feature}
      />

    </>
  );
}

