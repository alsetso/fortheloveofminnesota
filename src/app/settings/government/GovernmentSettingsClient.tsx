'use client';

import { useState } from 'react';
import { useSettings } from '@/features/settings/contexts/SettingsContext';
import DraggableBottomSheet from '@/components/ui/DraggableBottomSheet';
import GovernmentSetupForm from '@/features/upgrade/components/GovernmentSetupForm';

export default function GovernmentSettingsClient() {
  const { account } = useSettings();
  const [showGovernmentModal, setShowGovernmentModal] = useState(false);

  return (
    <>
      <div className="bg-surface border border-border-muted dark:border-white/10 rounded-md p-[10px]">
        <h3 className="text-sm font-semibold text-foreground mb-3">Government Plan</h3>
        <div className="space-y-2">
          <div className="p-[10px] border border-border-muted dark:border-white/10 rounded-md bg-surface-accent">
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-semibold text-foreground">Government</h4>
              {account.plan === 'gov' && (
                <span className="px-1.5 py-0.5 text-[10px] font-medium text-foreground-muted bg-surface rounded-full">
                  Current
                </span>
              )}
            </div>
            <p className="text-[10px] text-foreground-muted mb-2">
              Help your residents love Minnesota more. Strategic initiatives and civic engagement tools.
            </p>
            {account.plan === 'gov' ? (
              <p className="text-xs text-foreground-muted">
                Your account is currently on the Government plan.
              </p>
            ) : (
              <button
                onClick={() => setShowGovernmentModal(true)}
                className="text-xs font-medium text-foreground hover:text-foreground/80 underline"
              >
                Set up Government plan →
              </button>
            )}
          </div>
        </div>
      </div>

      <DraggableBottomSheet
        isOpen={showGovernmentModal}
        onClose={() => setShowGovernmentModal(false)}
        initialHeight={90}
        snapPoints={[50, 90]}
        showCloseButton={false}
        showDragHandle={false}
        hideScrollbar={true}
        contentClassName="p-0"
        sheetClassName="w-full max-w-[700px] rounded-t-2xl"
        centered={true}
      >
        <GovernmentSetupForm onBack={() => setShowGovernmentModal(false)} />
      </DraggableBottomSheet>
    </>
  );
}
