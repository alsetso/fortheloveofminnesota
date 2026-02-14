'use client';

import { useAppModalContext } from '@/contexts/AppModalContext';
import WelcomeModal from '@/features/account/components/WelcomeModal';
import CreateAccountModal from '@/features/account/components/CreateAccountModal';
import BillingModal from '@/components/modals/BillingModal';
import ComingSoonModal from '@/components/modals/ComingSoonModal';
/**
 * GlobalModals — app-level modals rendered above all page content.
 *
 * Z-Index Tiers (see globals.css for full scale):
 *   Tier 4 — z-[100]  Modal backdrop / standard modals
 *   Tier 5 — z-[110]  Modal content that stacks over Tier 4
 *   Tier 6 — z-[120]  Priority modals (over other modals)
 *
 * Map markers/popups are isolated inside .mapboxgl-map and
 * cannot overlap these modals regardless of their local z-index.
 */
export default function GlobalModals() {
  const { modal, closeModal } = useAppModalContext();

  return (
    <>
      {/* Tier 4 — Sign In / Welcome */}
      <WelcomeModal
        isOpen={modal.type === 'welcome'}
        onClose={closeModal}
      />

      {/* Tier 5 — Create Account (opens over WelcomeModal) */}
      <CreateAccountModal
        isOpen={modal.type === 'createAccount'}
        onClose={closeModal}
      />

      {/* Tier 4 — Billing & Upgrade */}
      <BillingModal
        isOpen={modal.type === 'upgrade'}
        onClose={closeModal}
        feature={modal.feature}
      />

      {/* Tier 4 — Coming Soon */}
      <ComingSoonModal
        isOpen={modal.type === 'coming-soon'}
        onClose={closeModal}
        feature={modal.comingSoonFeature || 'This feature'}
      />
    </>
  );
}

