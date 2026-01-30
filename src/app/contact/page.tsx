import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { EnvelopeIcon } from '@heroicons/react/24/outline';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'Contact Us | For the Love of Minnesota',
  description: 'Get in touch with For the Love of Minnesota for support, questions, or inquiries about Minnesota real estate development, property acquisition, and networking opportunities. Contact our team at loveofminnesota@gmail.com.',
  keywords: [
    'For the Love of Minnesota contact',
    'Minnesota real estate support',
    'contact For the Love of Minnesota',
    'Minnesota real estate customer service',
    'Minnesota real estate questions',
    'property development support',
    'real estate platform contact',
    'Minnesota real estate help',
    'Minnesota support email',
    'Minnesota property acquisition support'
  ],
  openGraph: {
    title: 'Contact Us | For the Love of Minnesota',
    description: 'Get in touch with For the Love of Minnesota for support, questions, or inquiries about Minnesota real estate development, property acquisition, and networking opportunities.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/contact`,
    siteName: 'For the Love of Minnesota',
    images: [
      {
        url: '/seo_share_public_image.png',
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'For the Love of Minnesota',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'Contact Us | For the Love of Minnesota',
    description: 'Get in touch with For the Love of Minnesota for support, questions, or inquiries about Minnesota real estate development, property acquisition, and networking opportunities.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/contact`,
  },
};

export default function ContactPage() {
  return (
    <SimplePageLayout containerMaxWidth="lg" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <PageViewTracker />
      <div className="space-y-3">
        {/* Header */}
        <div className="space-y-1.5">
          <h1 className="text-sm font-semibold text-gray-900">Contact Us</h1>
          <p className="text-xs text-gray-600 leading-relaxed">
            We&apos;re here to help with questions about For the Love of Minnesota, Minnesota real estate development, property acquisition, platform features, or any other inquiries.
          </p>
        </div>

        {/* Contact Information Card */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-gray-900">Direct Email</h2>
            <p className="text-xs text-gray-600">
              You can contact us directly via email for the following:
            </p>
          </div>

          {/* Reasons for Inquiry */}
          <div className="space-y-1">
            <p className="text-xs text-gray-600">
              <span className="font-medium text-gray-900">Reasons for inquiry:</span> Press, Tips, Support, Donations, Collaboration
            </p>
          </div>

          {/* Email Contact */}
          <div className="flex items-start gap-2 p-[10px] bg-gray-50 rounded-md border border-gray-200 hover:bg-gray-100 transition-colors">
            <EnvelopeIcon className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Email Support</p>
              <a
                href="mailto:loveofminnesota@gmail.com"
                className="text-xs text-gray-600 hover:text-gray-900 transition-colors break-all"
              >
                loveofminnesota@gmail.com
              </a>
              <p className="text-xs text-gray-500 mt-1">
                We typically respond within 24-48 hours during business days.
              </p>
            </div>
          </div>
        </div>

        {/* Additional Information */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h2 className="text-sm font-medium text-gray-900">What We Can Help With</h2>
          <div className="space-y-2">
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Platform Support</p>
              <p className="text-xs text-gray-600">
                Questions about using For the Love of Minnesota, account management, features, or technical issues.
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Real Estate Inquiries</p>
              <p className="text-xs text-gray-600">
                Information about Minnesota real estate development opportunities, property acquisition, networking, and connecting with professionals.
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">Business Partnerships</p>
              <p className="text-xs text-gray-600">
                Opportunities for collaboration, partnerships, or integrating with the platform.
              </p>
            </div>
            <div className="space-y-0.5">
              <p className="text-xs font-medium text-gray-900">General Questions</p>
              <p className="text-xs text-gray-600">
                Any other questions about For the Love of Minnesota, our services, or how we can assist with your Minnesota real estate needs.
              </p>
            </div>
          </div>
        </div>

        {/* Response Time */}
        <div className="bg-white border border-gray-200 rounded-md p-[10px]">
          <p className="text-xs text-gray-600">
            <span className="font-medium text-gray-900">Response Time:</span> We aim to respond to all inquiries within 24-48 hours during business days (Monday through Friday, excluding holidays). For urgent matters, please indicate &quot;Urgent&quot; in your email subject line.
          </p>
        </div>
      </div>
    </SimplePageLayout>
  );
}

