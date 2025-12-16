import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/authServer';
import { getServerAccount } from '@/lib/accountServer';
import OnboardingAccountDetails from './OnboardingAccountDetails';

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=onboarding&message=Please sign in to complete your account setup');
  }

  const account = await getServerAccount();

  return (
    <div className="flex flex-col min-h-screen bg-[#f4f2ef]">
      {/* No nav - hidden as requested */}
      
      {/* Main Content */}
      <main className="flex-1 max-w-md mx-auto w-full">
        <div className="p-[10px]">
          <div className="flex flex-col gap-3">
            {/* Logo */}
            <div>
              <OnboardingAccountDetails account={account} />
            </div>

            {/* Main content */}
            <div className="min-w-0">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}



