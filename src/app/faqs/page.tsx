import { Metadata } from 'next';
import Link from 'next/link';
import SimplePageLayout from '@/components/SimplePageLayout';
import FAQsClient from './FAQsClient';

export const metadata: Metadata = {
  title: 'FAQs | For the Love of Minnesota',
  description: 'Frequently asked questions about For the Love of Minnesota, including information about permissions, privacy, and how the platform works.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function FAQsPage() {
  return (
    <>
      <FAQsClient />
      <SimplePageLayout contentPadding="px-[10px] py-3" footerVariant="light">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-3" aria-label="Breadcrumb">
          <ol className="flex items-center gap-2 text-xs text-gray-600">
            <li>
              <Link href="/" className="hover:text-gray-900 transition-colors">Home</Link>
            </li>
            <li aria-hidden="true">/</li>
            <li className="text-gray-900 font-medium" aria-current="page">FAQs</li>
          </ol>
        </nav>

        <div className="bg-white border border-gray-200 rounded-md p-[10px] space-y-3">
          <h1 className="text-sm font-semibold text-gray-900 mb-3">Frequently Asked Questions</h1>

        <div className="space-y-4">
          {/* What is RLS */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">How does privacy work on the platform?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              We use advanced security features to make sure your content stays private when you want it to. You&apos;ll only see and be able to edit content that you&apos;ve created, while public content is shared with the community so everyone can discover great places across Minnesota.
            </p>
          </section>

          {/* Guest Account */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">What is a Guest account?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              A Guest account lets you use the platform without signing in! When you visit the site without an account, we automatically create a temporary guest account for you. You can set a name for your guest account, and it&apos;ll be stored locally in your browser. Guest accounts are fully private and specific to your device—they won&apos;t sync across different browsers or devices. Guest accounts are perfect if you want to explore and create content right away without going through the sign-up process.
            </p>
          </section>

          {/* Guest Account Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">What can Guest accounts do?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>Guest accounts can do quite a bit! You can:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Browse all public pins, areas, and posts</li>
                <li>Create your own pins to share with the community</li>
                <li>Set a display name for your guest account</li>
                <li>Have your content automatically saved to your guest account</li>
              </ul>
              <p className="mt-1.5">When you&apos;re ready to sign in, you can merge all your guest account content (like pins you&apos;ve created) into your permanent account—nothing gets lost! Guest accounts are a great way to try out the platform before committing to creating an account.</p>
            </div>
          </section>

          {/* Account Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">What can I do with my account?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>Once you&apos;re signed in, you can:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Update your account information anytime</li>
                <li>Create and manage multiple profiles</li>
                <li>Create, edit, and delete your own content (pins, areas, and posts)</li>
                <li>Browse all the public content shared by the community</li>
              </ul>
              <p className="mt-1.5">Don&apos;t worry—your private content stays private, and you can&apos;t accidentally see or change anyone else&apos;s content.</p>
            </div>
          </section>

          {/* Profile Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">How do profiles work?</h2>
            <p className="text-xs text-gray-600 leading-relaxed mb-1.5">
              Profiles are connected to your account, so you have full control over them. You can:
            </p>
            <ul className="list-disc list-inside space-y-0.5 ml-2 text-xs text-gray-600">
              <li>See all the profiles you&apos;ve created</li>
              <li>Create new profiles whenever you need them</li>
              <li>Edit or remove your profiles at any time</li>
            </ul>
            <p className="text-xs text-gray-600 leading-relaxed mt-1.5">
              Your profiles are yours alone—other users can&apos;t see or change them.
            </p>
          </section>

          {/* Pins Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Who can see the pins I create?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Pins are shared with everyone! They&apos;re designed to help the whole community discover special places across Minnesota. Anyone visiting the site, even without an account, can see all the pins on the map. This way, we can all explore and learn about great locations together.
            </p>
          </section>

          {/* Areas Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Can I keep my areas private?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>Absolutely! When you create an area, you can choose:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li><strong>Public:</strong> Share it with everyone so they can discover it too</li>
                <li><strong>Private:</strong> Keep it just for you—no one else will see it</li>
              </ul>
              <p className="mt-1.5">You&apos;re always in control. You can create, edit, or delete your areas anytime, and you can change the visibility setting whenever you want.</p>
            </div>
          </section>

          {/* Feed/Posts Permissions */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">How do I control who sees my posts?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>You have full control over who can see your posts! Choose from:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li><strong>Public:</strong> Share with everyone—even visitors without accounts can see it</li>
                <li><strong>Members Only:</strong> Keep it within the community—only signed-in users can see it</li>
                <li><strong>Only Me:</strong> Keep it completely private—just for your eyes</li>
                <li><strong>Draft:</strong> Save it for later—not published yet, only you can see it</li>
              </ul>
              <p className="mt-1.5">You can edit or delete your posts anytime, and you can change the visibility setting whenever you want. You&apos;ll see all public posts and members-only posts (when you&apos;re signed in), but other people&apos; private posts stay private to them.</p>
            </div>
          </section>

          {/* Anonymous Users */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">What can I do without signing in?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>You can do quite a bit even without an account! Visitors can:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Browse the public map pins</li>
                <li>Create a guest account</li>
                <li>Create guest account pins</li>
                <li>Explore the cities and counties</li>
                <li>Get in touch with us</li>
              </ul>
              <p className="mt-1.5">To access members-only content or manage a permanent account, you&apos;ll need to sign in. It&apos;s free and only takes a minute!</p>
            </div>
          </section>

          {/* Data Ownership */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Who owns the content I create?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              You do! Everything you create on the platform belongs to you. Whether it&apos;s a pin, an area, or a post, you have full control. The platform automatically keeps track of what&apos;s yours, so you can always edit or delete your own content, and no one else can change it without your permission.
            </p>
          </section>

          {/* Privacy */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">How is my private data protected?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              Your privacy is our top priority. We use multiple layers of security to protect your data. Your private content—like private areas and private posts—is locked down so only you can access it. Even if someone tried to access it directly, our security systems prevent unauthorized access. When you choose to make something public, that&apos;s your choice, and we respect it.
            </p>
          </section>

          {/* Troubleshooting */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Why can&apos;t I see or edit certain content?</h2>
            <div className="text-xs text-gray-600 leading-relaxed space-y-1">
              <p>If you&apos;re having trouble seeing or editing something, here are the most common reasons:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>It belongs to someone else (you can only edit your own content)</li>
                <li>It&apos;s set to private (only the creator can see it)</li>
                <li>You need to sign in (some content is only for members)</li>
                <li>It&apos;s still a draft (the creator hasn&apos;t published it yet)</li>
              </ul>
              <p className="mt-1.5">These restrictions are in place to protect everyone&apos;s privacy and make sure your content stays yours.</p>
            </div>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xs font-semibold text-gray-900 mb-1.5">Still have questions?</h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              We&apos;re here to help! If you have any questions or need assistance, feel free to reach out to us at{' '}
              <a href="mailto:hi@fortheloveofminnesota.com" className="text-blue-600 hover:underline">
                hi@fortheloveofminnesota.com
              </a>
              . We&apos;d love to hear from you!
            </p>
          </section>
        </div>
        </div>

        {/* Related Sections */}
        <div className="mt-3 pt-3 border-t border-gray-200">
          <h2 className="text-xs font-semibold text-gray-900 mb-2">Explore More</h2>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Explore Minnesota
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/cities" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Cities Directory
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/explore/counties" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Counties Directory
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/civic" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Civic Leaders
            </Link>
            <span className="text-gray-300">•</span>
            <Link href="/contact" className="text-xs text-gray-600 hover:text-gray-900 underline transition-colors">
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </SimplePageLayout>
    </>
  );
}

