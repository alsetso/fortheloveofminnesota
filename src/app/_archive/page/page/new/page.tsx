import { redirect } from 'next/navigation';
import { getServerAuth } from '@/lib/authServer';
import { getServerAccount } from '@/lib/accountServer';
import SimplePageLayout from '@/components/SimplePageLayout';
import NewBusinessClient from '@/components/_archive/business/NewBusinessClient';

export const metadata = {
  title: 'Create New Page | Minnesota Pages Directory | MNUDA',
  description: 'Create a new page in the official Minnesota Pages Directory. Add your company to the directory for free.',
};

export default async function NewPagePage() {
  const auth = await getServerAuth();
  
  if (!auth) {
    redirect('/?modal=account&tab=settings&redirect=/page/new&message=Please sign in to create a page');
  }

  const account = await getServerAccount();

  return (
    <SimplePageLayout backgroundColor="bg-gray-50" contentPadding="px-4 sm:px-6" footerVariant="light">
      <div className="max-w-4xl mx-auto py-3">
        {/* Header */}
        <div className="mb-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-gray-900 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-semibold">MN</span>
            </div>
            <div>
              <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wider">
                State of Minnesota
              </p>
              <h1 className="text-sm font-semibold text-gray-900">
                Create New Page
              </h1>
            </div>
          </div>
          <p className="text-xs text-gray-600">
            Complete the form below to create a new page in the official Minnesota Pages Directory. 
            All fields marked with an asterisk (*) are required.
          </p>
        </div>

        {/* Form */}
        <NewBusinessClient initialAccount={account} />
      </div>
    </SimplePageLayout>
  );
}

