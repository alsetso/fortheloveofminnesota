import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms and Conditions - For the Love of Minnesota',
  description: 'Terms and Conditions for using For the Love of Minnesota platform',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#f4f2ef] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms and Conditions</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: January 8, 2026</p>

        <div className="space-y-8 text-sm text-gray-700">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              Welcome to For the Love of Minnesota ("Platform," "Service," "we," "us," or "our"). By accessing or using our Platform at fortheloveofminnesota.vercel.app, you agree to be bound by these Terms and Conditions ("Terms"). If you disagree with any part of these Terms, you may not access the Service.
            </p>
          </section>

          {/* Account Types */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Account Types and Registration</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">2.1 Account Types</h3>
            <p className="mb-3">The Platform supports two types of accounts:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Authenticated Accounts:</strong> Users who verify their email address via one-time password (OTP)</li>
              <li><strong>Guest Accounts:</strong> Temporary accounts stored locally in your browser with limited functionality</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">2.2 Authentication</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Email verification is required to access authenticated features including the Live Map</li>
              <li>You must provide a valid email address to create an authenticated account</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>One-time passwords (OTP) expire and must be verified promptly</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">2.3 Account Roles</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>General Accounts:</strong> Standard user access with content creation and viewing capabilities</li>
              <li><strong>Admin Accounts:</strong> Extended permissions for platform moderation and civic data management</li>
            </ul>
          </section>

          {/* Subscription Plans */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. Subscription Plans</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">3.1 Available Plans</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Hobby:</strong> Free basic access with limited features</li>
              <li><strong>Contributor:</strong> Paid subscription with access to all-time historical data and advanced features</li>
              <li><strong>Plus:</strong> Premium subscription with additional capabilities</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.2 Billing</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Payments are processed through Stripe</li>
              <li>Subscriptions may be billed monthly or annually</li>
              <li>Trial periods may be offered at our discretion</li>
              <li>Refunds are handled on a case-by-case basis</li>
            </ul>
          </section>

          {/* Content and User Contributions */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Content and User Contributions</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Content Types</h3>
            <p className="mb-3">Users may create and share the following content on the Platform:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Mentions:</strong> Location-based posts with text, images, and videos</li>
              <li><strong>Profile Information:</strong> Personal details, biography, and profile images</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Content Visibility</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Public:</strong> Visible to all users (authenticated and anonymous)</li>
              <li><strong>Only Me:</strong> Visible only to the content creator</li>
              <li>You can archive content to hide it from public view while retaining ownership</li>
              <li>Unauthenticated users can view public mentions with limited detail (first 90 characters, no usernames)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.3 Content Ownership and License</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>You retain ownership of content you create</li>
              <li>By posting content, you grant us a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content on the Platform</li>
              <li>You represent that you have the right to share all content you post</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.4 Prohibited Content</h3>
            <p className="mb-2">You may not post content that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Violates any law or regulation</li>
              <li>Infringes on intellectual property rights</li>
              <li>Contains hate speech, harassment, or threats</li>
              <li>Is fraudulent, misleading, or deceptive</li>
              <li>Contains malware or malicious code</li>
              <li>Violates the privacy of others</li>
            </ul>
          </section>

          {/* Data and Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Data Collection and Usage</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">5.1 Information We Collect</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Email address (for authenticated accounts)</li>
              <li>Profile information (username, name, bio, location, phone)</li>
              <li>Content you create (mentions, comments, images, videos)</li>
              <li>Location data associated with mentions</li>
              <li>Usage analytics and page views</li>
              <li>Billing information (processed by Stripe, not stored by us)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.2 Data Protection</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>We implement Row Level Security (RLS) policies to protect your data</li>
              <li>You can only access and modify content you own</li>
              <li>Other users cannot access your private content or personal data</li>
              <li>Admin users have limited access for moderation purposes only</li>
              <li>See our <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> for complete details</li>
            </ul>
          </section>

          {/* Civic and Government Data */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Civic and Government Data</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">6.1 Public Information</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>The Platform displays public government data including buildings, officials, budgets, and districts</li>
              <li>This information is sourced from public government databases and APIs</li>
              <li>We do not guarantee the accuracy or completeness of government data</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">6.2 News Content</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>News articles are aggregated from third-party sources</li>
              <li>We do not control or verify the accuracy of news content</li>
              <li>News sources retain all rights to their content</li>
            </ul>
          </section>

          {/* User Conduct */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. User Conduct</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">7.1 Acceptable Use</h3>
            <p className="mb-2">You agree to:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Use the Platform lawfully and respectfully</li>
              <li>Respect the privacy and rights of other users</li>
              <li>Provide accurate information in your profile</li>
              <li>Report violations of these Terms</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">7.2 Prohibited Activities</h3>
            <p className="mb-2">You may not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Attempt to access data you are not authorized to view</li>
              <li>Circumvent security measures or authentication systems</li>
              <li>Use automated systems (bots, scrapers) without permission</li>
              <li>Impersonate other users or entities</li>
              <li>Interfere with the Platform's functionality</li>
              <li>Harvest or collect user information</li>
            </ul>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Intellectual Property</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">8.1 Platform IP</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>The Platform, including its design, features, and functionality, is owned by For the Love of Minnesota</li>
              <li>Our logo, trademarks, and branding are protected intellectual property</li>
              <li>You may not copy, modify, or distribute our intellectual property without permission</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">8.2 Third-Party Services</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>The Platform uses Mapbox for mapping services</li>
              <li>Map data © Mapbox, © OpenStreetMap</li>
              <li>Stripe for payment processing</li>
              <li>Each service is subject to its own terms and conditions</li>
            </ul>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Disclaimers and Limitations</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">9.1 Service Availability</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>The Platform is provided "as is" and "as available"</li>
              <li>We do not guarantee uninterrupted or error-free service</li>
              <li>We may modify, suspend, or discontinue features at any time</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">9.2 Content Accuracy</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>User-generated content reflects the views of individual users, not the Platform</li>
              <li>We do not verify the accuracy of user content</li>
              <li>Government and civic data may contain errors or be outdated</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">9.3 Limitation of Liability</h3>
            <p className="mb-2">To the fullest extent permitted by law:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to the amount you paid us in the past 12 months</li>
              <li>We are not responsible for user-generated content or third-party services</li>
            </ul>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. Termination</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">10.1 Account Termination</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>You may delete your account at any time through your account settings</li>
              <li>We may suspend or terminate accounts that violate these Terms</li>
              <li>We reserve the right to refuse service to anyone</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">10.2 Effect of Termination</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Upon termination, your access to the Platform will cease</li>
              <li>Your content may be retained for legal or operational purposes</li>
              <li>Provisions regarding liability, disclaimers, and disputes survive termination</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to These Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. Changes will be effective immediately upon posting to the Platform. Your continued use of the Platform after changes constitutes acceptance of the modified Terms. We encourage you to review these Terms periodically.
            </p>
          </section>

          {/* Governing Law */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Governing Law and Disputes</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">12.1 Jurisdiction</h3>
            <p className="mb-4">
              These Terms are governed by the laws of the State of Minnesota, United States, without regard to conflict of law principles.
            </p>

            <h3 className="text-lg font-medium text-gray-900 mb-2">12.2 Dispute Resolution</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Any disputes arising from these Terms or the Platform shall be resolved in the state or federal courts located in Minnesota</li>
              <li>You agree to submit to the personal jurisdiction of these courts</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">13. Contact Information</h2>
            <p className="mb-2">
              If you have questions about these Terms, please contact us at:
            </p>
            <p className="font-medium">
              Email: contact@fortheloveofminnesota.com
            </p>
          </section>

          {/* Acceptance */}
          <section className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 italic">
              By using For the Love of Minnesota, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions.
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-sm">
          <Link href="/" className="text-blue-600 hover:underline">
            ← Back to Home
          </Link>
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy →
          </Link>
        </div>
      </div>
    </div>
  );
}

