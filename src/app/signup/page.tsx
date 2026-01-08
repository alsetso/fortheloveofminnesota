'use client';

import SimplePageLayout from '@/components/layout/SimplePageLayout';
import EmailVerificationForm from '@/components/auth/EmailVerificationForm';
import { useAuth } from '@/features/auth/contexts/AuthContext';

export default function SignUpPage() {
  const { signUpWithOtp } = useAuth();

  return (
    <SimplePageLayout containerMaxWidth="sm" backgroundColor="bg-[#f4f2ef]" contentPadding="py-6 px-[10px]">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <EmailVerificationForm
          title="Sign Up"
          subtitle="Create an account with email verification"
          buttonText="Send Verification Code"
          verifyButtonText="Verify & Sign Up"
          sendOtpMethod={signUpWithOtp}
        />
      </div>
    </SimplePageLayout>
  );
}

