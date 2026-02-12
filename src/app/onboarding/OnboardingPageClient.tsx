'use client';

import { useState, useCallback } from 'react';
import NewPageWrapper from '@/components/layout/NewPageWrapper';
import OnboardingClient from '@/features/account/components/OnboardingClient';
import type { Account } from '@/features/auth';

interface OnboardingPageClientProps {
  initialAccount: Account | null;
  redirectTo: string;
}

export default function OnboardingPageClient({ initialAccount, redirectTo }: OnboardingPageClientProps) {
  const [stepperState, setStepperState] = useState<{
    currentStep: number;
    totalSteps: number;
    label?: string;
  } | null>(null);

  const handleStepperChange = useCallback((currentStep: number, totalSteps: number, label?: string) => {
    setStepperState({ currentStep, totalSteps, label });
  }, []);

  return (
    <NewPageWrapper>
      <div className="max-w-md mx-auto px-4 py-8">
        <OnboardingClient 
          initialAccount={initialAccount}
          redirectTo={redirectTo}
          onStepperChange={handleStepperChange}
        />
      </div>
    </NewPageWrapper>
  );
}
