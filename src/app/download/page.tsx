import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import { 
  ArrowDownTrayIcon,
  DevicePhoneMobileIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import Image from 'next/image';

export const metadata: Metadata = {
  title: 'Download App - For the Love of Minnesota',
  description: 'Download the For the Love of Minnesota app for iOS, Android, or use the Progressive Web App.',
};

export default function DownloadPage() {
  return (
    <SimplePageLayout containerMaxWidth="full" backgroundColor="bg-[#f4f2ef]" contentPadding="px-[10px] py-3">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-sm font-semibold text-gray-900">Download the App</h1>
          <p className="text-xs text-gray-600">
            Access For the Love of Minnesota on your mobile device or desktop
          </p>
        </div>

        {/* iOS App Section */}
        <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">iOS</span>
            </div>
            <h2 className="text-xs font-semibold text-gray-900">iOS App</h2>
            <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-medium text-gray-600 rounded">
              Coming Soon
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Native iOS app coming to the App Store. Get push notifications, enhanced offline support, and optimized performance.
            </p>
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ClockIcon className="w-3 h-3" />
              <span>Expected release: Q2 2025</span>
            </div>

            <div className="pt-2">
              <button
                disabled
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-500 text-xs font-medium rounded-md cursor-not-allowed"
              >
                <Image
                  src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/en-us?size=250x83&releaseDate=1269302400"
                  alt="Download on the App Store"
                  width={120}
                  height={40}
                  className="h-8 w-auto opacity-50"
                  unoptimized
                />
              </button>
            </div>
          </div>
        </section>

        {/* Google Play Section */}
        <section className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-900 rounded flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">GP</span>
            </div>
            <h2 className="text-xs font-semibold text-gray-900">Google Play</h2>
            <span className="px-1.5 py-0.5 bg-gray-100 text-[10px] font-medium text-gray-600 rounded">
              Coming Soon
            </span>
          </div>
          
          <div className="space-y-2">
            <p className="text-xs text-gray-600">
              Native Android app coming to Google Play. Full feature access, background sync, and native Android integration.
            </p>
            
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ClockIcon className="w-3 h-3" />
              <span>Expected release: Q2 2025</span>
            </div>

            <div className="pt-2">
              <button
                disabled
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-200 text-gray-500 text-xs font-medium rounded-md cursor-not-allowed"
              >
                <Image
                  src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
                  alt="Get it on Google Play"
                  width={155}
                  height={60}
                  className="h-10 w-auto opacity-50"
                  unoptimized
                />
              </button>
            </div>
          </div>
        </section>
      </div>
    </SimplePageLayout>
  );
}

