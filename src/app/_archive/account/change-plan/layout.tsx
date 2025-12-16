import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/authServer';
import { getServerBillingData } from '@/lib/billingServer';
import Link from 'next/link';
import { ArrowLeftIcon, CheckIcon } from '@heroicons/react/24/outline';

export default async function ChangePlanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=billing&message=Please sign in to change your plan');
  }

  const billingData = await getServerBillingData();
  const currentPlan = billingData.plan;
  const isProActive = currentPlan === 'pro' && billingData.isActive;

  return (
    <div className="max-w-7xl xl:max-w-[90rem] 2xl:max-w-[100rem] mx-auto p-[10px]">
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-3">
        {/* Left sidebar - Selected Plan */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Link
            href="/?modal=account&tab=billing"
            className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeftIcon className="w-3 h-3" />
            Back to Billing
          </Link>
          
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-900 mb-2">Current Plan</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  {currentPlan === 'pro' ? 'Pro' : 'Hobby'}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-900 text-white">
                  Active
                </span>
              </div>
              {currentPlan === 'pro' && billingData.billing_mode === 'standard' && (
                <p className="text-xs text-gray-600">$20/month</p>
              )}
              {currentPlan === 'hobby' && (
                <p className="text-xs text-gray-600">Free plan</p>
              )}
            </div>
            
            {isProActive && (
              <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>Unlimited pins</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>Unlimited areas</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>Multiple profiles</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>Private visibility</span>
                </div>
              </div>
            )}
            
            {currentPlan === 'hobby' && (
              <div className="pt-2 mt-2 border-t border-gray-200 space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>10 pins</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>3 areas</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>1 profile</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <CheckIcon className="w-3 h-3 text-gray-500" />
                  <span>Public visibility</span>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}


