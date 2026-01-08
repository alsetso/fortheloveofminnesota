'use client';

import { useAppModalContext } from '@/contexts/AppModalContext';
import WelcomeModal from '@/features/account/components/WelcomeModal';
import CreateAccountModal from '@/features/account/components/CreateAccountModal';
import LiveAccountModal from '@/components/layout/LiveAccountModal';
import BillingModal from '@/components/modals/BillingModal';
import ComingSoonModal from '@/components/modals/ComingSoonModal';

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

      {/* Create Account Modal - for creating new accounts */}
      <CreateAccountModal
        isOpen={modal.type === 'createAccount'}
        onClose={closeModal}
      />

      {/* Live Account Modal - works globally, includes tabs and onboarding */}
      <LiveAccountModal
        isOpen={modal.type === 'account'}
        onClose={closeModal}
        initialTab={modal.tab as 'settings' | 'analytics' | 'profile' | 'profiles' | undefined}
      />

      {/* Billing & Upgrade Modal */}
      <BillingModal
        isOpen={modal.type === 'upgrade'}
        onClose={closeModal}
        feature={modal.feature}
      />

      {/* Coming Soon Modal */}
      <ComingSoonModal
        isOpen={modal.type === 'coming-soon'}
        onClose={closeModal}
        feature={modal.comingSoonFeature || 'This feature'}
      />

    </>
  );
}

