import { Metadata } from 'next';
import SimplePageLayout from '@/components/layout/SimplePageLayout';
import PageViewTracker from '@/components/analytics/PageViewTracker';

export const metadata: Metadata = {
  title: 'Registry Levels | For the Love of Minnesota',
  description: 'For the Love of Minnesota operates as a public civic map. Membership records your level of participation in the shared ledger of this State.',
  openGraph: {
    title: 'Registry Levels | For the Love of Minnesota',
    description: 'For the Love of Minnesota operates as a public civic map. Membership records your level of participation in the shared ledger of this State.',
    url: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/pricing`,
    siteName: 'For the Love of Minnesota',
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://fortheloveofminnesota.com'}/pricing`,
  },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'] as const;

const PLANS = [
  {
    id: 'public',
    name: 'Public',
    description: "Basic access to Minnesota's shared map.",
    price: '$0',
  },
  {
    id: 'member',
    name: 'Member',
    description: 'For those who believe this should exist.',
    price: '$6.00/mo',
  },
  {
    id: 'operator',
    name: 'Operator',
    description: 'For individuals who actively use the platform in their work.',
    price: '$20/mo',
  },
  {
    id: 'organization',
    name: 'Organization',
    description: 'For organizations managing places, people, or services.',
    price: '$60/mo',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    description: 'For multi-location systems, infrastructure partners, and statewide operators.',
    price: '$180/mo',
  },
] as const;

export default function PricingPage() {
  return (
    <SimplePageLayout
      containerMaxWidth="6xl"
      backgroundColor="bg-[#f4f2ef]"
      contentPadding="px-4 sm:px-6 lg:px-8 py-8 sm:py-12"
    >
      <PageViewTracker />
      <div className="space-y-12">
        {/* Hero: Registry framing */}
        <header className="text-center space-y-4 max-w-2xl mx-auto">
          <p className="text-[10px] sm:text-xs font-medium tracking-[0.25em] text-gray-500 uppercase">
            The Minnesota Registry
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
            Join the Registry
          </h1>
          <p className="text-sm sm:text-base text-gray-600 leading-relaxed">
            For the Love of Minnesota operates as a public civic map. Membership records your level of participation in the shared ledger of this State.
          </p>
        </header>

        {/* Registry Levels: tier ledger */}
        <section
          className="space-y-6"
          aria-label="Registry levels"
        >
          <h2 className="text-xs font-medium tracking-[0.2em] text-gray-500 uppercase">
            Registry Levels
          </h2>
          <div className="flex w-full min-w-0 flex-wrap">
          {PLANS.map((plan, i) => (
            <div
              key={plan.id}
              className="flex flex-1 flex-col min-w-0 basis-full sm:basis-0 border-r border-b last:border-b-0 sm:border-b-0 border-gray-200 last:border-r-0 py-8 px-5 sm:px-6 transition-[border-color,color] duration-150 hover:border-gray-300 hover:[&_.ledger-name]:text-gray-900 hover:[&_.ledger-desc]:text-gray-600 hover:[&_.ledger-price]:text-gray-900"
            >
              {/* Top row: Roman + name (left); Claim on mobile (right) */}
              <div className="flex flex-row justify-between items-start gap-4 mb-3 sm:mb-0">
                <div className="min-w-0">
                  <span
                    className="font-libre-baskerville text-4xl sm:text-5xl text-gray-900 opacity-20 leading-none mb-4 sm:mb-4 block"
                    aria-hidden
                  >
                    {ROMAN[i]}
                  </span>
                  <h2 className="ledger-name text-xs font-medium tracking-[0.2em] text-gray-700 uppercase mb-3 sm:mb-4">
                    {plan.name}
                  </h2>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-xs font-medium tracking-widest uppercase text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 py-2 px-3 transition-colors sm:hidden"
                  aria-label={`Claim ${plan.name}`}
                >
                  Claim
                </button>
              </div>
              <hr className="border-0 border-t border-gray-200 w-full mb-4" />
              <p className="ledger-desc text-sm text-gray-500 leading-snug flex-1 mb-5">
                {plan.description}
              </p>
              <div className="flex flex-col gap-3">
                <span className="ledger-price text-lg font-bold tabular-nums text-gray-800">
                  {plan.price}
                </span>
                <button
                  type="button"
                  className="hidden sm:inline-flex self-start text-xs font-medium tracking-widest uppercase text-gray-600 hover:text-gray-900 border border-gray-300 hover:border-gray-400 py-2 px-3 transition-colors"
                  aria-label={`Claim ${plan.name}`}
                >
                  Claim
                </button>
              </div>
            </div>
          ))}
          </div>
        </section>

        {/* Footnote */}
        <p className="text-center text-xs text-gray-500 max-w-xl mx-auto">
          Levels of entry into a civic system.
        </p>
      </div>
    </SimplePageLayout>
  );
}
