'use client';

import { ArrowLeftIcon, EnvelopeIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

type PlanTab = 'business' | 'government';

interface ComingSoonScreenProps {
  plan: PlanTab;
  onBack: () => void;
}

export default function ComingSoonScreen({ plan, onBack }: ComingSoonScreenProps) {
  const planName = plan === 'business' ? 'Business' : 'Government';

  const handleEmailContact = () => {
    const subject = `Apply for ${planName} Membership`;
    const body = `I'm interested in applying for ${planName} membership. Please contact me to discuss options.`;
    window.location.href = `mailto:loveofminnesota@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="max-w-[600px] mx-auto px-4 py-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeftIcon className="w-4 h-4" />
        Back to Plans
      </button>

      {/* Coming Soon Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold mb-2 text-gray-900">{planName} Membership Coming Soon</h1>
        <p className="text-gray-600">
          We're currently setting up {planName} memberships. Connect with us to be notified when it's available.
        </p>
      </div>

      {/* Main Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
            <CheckCircleIcon className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">What's Next?</h3>
            <p className="text-sm text-gray-600 mb-4">
              {planName} memberships are currently in development. We're working on custom pricing, dedicated support, and enterprise features tailored to your needs.
            </p>
            <p className="text-sm text-gray-600">
              Email us to discuss your requirements and we'll reach out when {planName} memberships become available.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-4">
          <button
            onClick={handleEmailContact}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-md text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <EnvelopeIcon className="w-5 h-5" />
            Email Us to Connect
          </button>
        </div>

        <div className="bg-gray-50 rounded-md p-4 border border-gray-200">
          <p className="text-xs text-gray-600 text-center">
            We'll review your inquiry and contact you within 24-48 hours to discuss {planName} membership options.
          </p>
        </div>
      </div>
    </div>
  );
}
