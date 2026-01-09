import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - For the Love of Minnesota',
  description: 'Privacy Policy for For the Love of Minnesota platform',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#f4f2ef] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: January 8, 2026</p>

        <div className="space-y-8 text-sm text-gray-700">
          {/* Introduction */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">1. Introduction</h2>
            <p>
              For the Love of Minnesota ("we," "us," "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Platform at fortheloveofminnesota.vercel.app. By using the Platform, you consent to the data practices described in this policy.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">2.1 Information You Provide</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Account Information:</strong> Email address, username, first name, last name</li>
              <li><strong>Profile Information:</strong> Bio (max 220 characters), phone number, location (city), profile image, cover image</li>
              <li><strong>User Traits:</strong> Selected characteristics (homeowner, buyer, investor, etc.)</li>
              <li><strong>Content:</strong> Mentions (posts), comments, images, videos, and location data</li>
              <li><strong>Onboarding Responses:</strong> Answers to onboarding questions</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">2.2 Information Collected Automatically</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Analytics Data:</strong> Page views, profile views, content views</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address</li>
              <li><strong>Usage Data:</strong> Features used, time spent, navigation patterns</li>
              <li><strong>Location Data:</strong> Approximate location when creating mentions (if provided)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">2.3 Guest Account Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Guest accounts use a unique ID stored in your browser's local storage</li>
              <li>Guest account data is temporary and limited in functionality</li>
              <li>Converting to an authenticated account preserves your guest data</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">3. How We Use Your Information</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">3.1 Service Provision</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Create and manage your account</li>
              <li>Authenticate your access via one-time password (OTP)</li>
              <li>Display your profile and content to other users</li>
              <li>Enable location-based features and map functionality</li>
              <li>Process subscription payments through Stripe</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.2 Platform Improvement</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Analyze usage patterns to improve features</li>
              <li>Track page views and engagement metrics</li>
              <li>Monitor Platform performance and errors</li>
              <li>Develop new features based on user behavior</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.3 Communication</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Send verification codes for authentication</li>
              <li>Notify you of account activity</li>
              <li>Respond to your inquiries and support requests</li>
              <li>Send platform updates and announcements (if you opt in)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">3.4 Legal Compliance</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Comply with legal obligations</li>
              <li>Enforce our Terms and Conditions</li>
              <li>Protect against fraud and abuse</li>
              <li>Respond to law enforcement requests</li>
            </ul>
          </section>

          {/* Data Protection and Security */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">4. Data Protection and Security</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">4.1 Row Level Security (RLS)</h3>
            <p className="mb-3">We implement comprehensive Row Level Security policies to protect your data:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Account Data:</strong> Only you can view and edit your account information</li>
              <li><strong>Profiles:</strong> You can only modify profiles associated with your account</li>
              <li><strong>Mentions:</strong> You control visibility (public or private) and can archive content</li>
              <li><strong>Comments:</strong> Only you can edit or delete your comments</li>
              <li><strong>Admin Access:</strong> Limited to platform moderation and civic data management</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.2 Content Visibility Controls</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Public Content:</strong> Visible to all users, including unauthenticated visitors (with limited details for non-authenticated users)</li>
              <li><strong>Private Content ("Only Me"):</strong> Visible only to you</li>
              <li><strong>Archived Content:</strong> Hidden from public view but retained in your account</li>
              <li><strong>Deleted Content:</strong> Permanently removed after deletion (may be retained for legal compliance)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.3 Authentication Security</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Passwords are never stored; we use email-based OTP authentication</li>
              <li>One-time passwords expire after use or timeout</li>
              <li>Session tokens are securely managed</li>
              <li>We use Supabase Auth for authentication infrastructure</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">4.4 Technical Security Measures</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>HTTPS encryption for all data transmission</li>
              <li>Regular security audits and updates</li>
              <li>Database-level access controls</li>
              <li>Secure API endpoints with authentication requirements</li>
            </ul>
          </section>

          {/* Information Sharing */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">5. Information Sharing and Disclosure</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">5.1 Public Information</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Content marked as "public" is visible to all Platform users</li>
              <li>Your username, profile image, and bio may be visible on public content</li>
              <li>Unauthenticated users can view public mentions with limited detail (first 90 characters, profile image only, no username)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.2 Third-Party Services</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Supabase:</strong> Database and authentication services (your data is stored on Supabase servers)</li>
              <li><strong>Stripe:</strong> Payment processing (we do not store full payment card details)</li>
              <li><strong>Mapbox:</strong> Mapping and geocoding services</li>
              <li><strong>Vercel:</strong> Web hosting and deployment</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.3 Legal Requirements</h3>
            <p className="mb-2">We may disclose your information if required to:</p>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Comply with legal obligations or court orders</li>
              <li>Protect the rights, property, or safety of For the Love of Minnesota, users, or the public</li>
              <li>Prevent fraud or security issues</li>
              <li>Enforce our Terms and Conditions</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">5.4 Business Transfers</h3>
            <p>
              In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity. We will notify you of any such change.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">6. Data Retention</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">6.1 Active Accounts</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>We retain your account data as long as your account is active</li>
              <li>You can delete your account at any time through account settings</li>
              <li>Deleting your account removes most personal information</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">6.2 Deleted Accounts</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>After account deletion, personal data is removed within 30 days</li>
              <li>Some data may be retained for legal, security, or operational purposes</li>
              <li>Public content may remain in cached versions or archives</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">6.3 Analytics Data</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>Aggregate analytics data is retained indefinitely for platform improvement</li>
              <li>Individual usage logs are retained for up to 90 days</li>
            </ul>
          </section>

          {/* Your Privacy Rights */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">7. Your Privacy Rights</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">7.1 Access and Control</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Access:</strong> View your account information and content at any time</li>
              <li><strong>Edit:</strong> Update your profile, bio, and account details</li>
              <li><strong>Delete:</strong> Remove content or delete your entire account</li>
              <li><strong>Archive:</strong> Hide content from public view while keeping it in your account</li>
              <li><strong>Export:</strong> Request a copy of your data (contact us for manual export)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">7.2 Visibility Settings</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li>Control whether content is "public" or "only me"</li>
              <li>Archive content to remove from public feeds</li>
              <li>Edit profile information to limit what others see</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">7.3 Marketing Communications</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>We currently do not send marketing emails</li>
              <li>You will only receive transactional emails (verification codes, account notifications)</li>
              <li>If we introduce marketing communications, you will be able to opt out</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">8. Children's Privacy</h2>
            <p className="mb-3">
              The Platform is not intended for users under the age of 18. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete that information.
            </p>
            <p>
              If you believe we have collected information from a child under 18, please contact us immediately.
            </p>
          </section>

          {/* Cookies and Tracking */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">9. Cookies and Tracking Technologies</h2>
            
            <h3 className="text-lg font-medium text-gray-900 mb-2">9.1 What We Use</h3>
            <ul className="list-disc pl-6 space-y-2 mb-4">
              <li><strong>Essential Cookies:</strong> Required for authentication and core functionality</li>
              <li><strong>Local Storage:</strong> Used for guest accounts and session management</li>
              <li><strong>Analytics:</strong> Usage tracking to improve the Platform</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-900 mb-2">9.2 Your Choices</h3>
            <ul className="list-disc pl-6 space-y-2">
              <li>You can disable cookies in your browser settings, but this may limit functionality</li>
              <li>Essential cookies are required for the Platform to work</li>
              <li>Clearing local storage will remove guest account data</li>
            </ul>
          </section>

          {/* International Users */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">10. International Users</h2>
            <p className="mb-3">
              The Platform is hosted in the United States. If you access the Platform from outside the United States, your information will be transferred to, stored, and processed in the United States.
            </p>
            <p>
              By using the Platform, you consent to the transfer of your information to the United States and agree that the Privacy Policy and U.S. law will govern such transfer.
            </p>
          </section>

          {/* Changes to Privacy Policy */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">11. Changes to This Privacy Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Changes will be effective immediately upon posting to the Platform. We will update the "Last Updated" date at the top of this policy. Your continued use of the Platform after changes constitutes acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">12. Contact Us</h2>
            <p className="mb-2">
              If you have questions about this Privacy Policy or how we handle your data, please contact us at:
            </p>
            <p className="font-medium mb-4">
              Email: privacy@fortheloveofminnesota.com
            </p>
            <p className="text-sm text-gray-600 italic">
              For data access requests, account deletion, or privacy concerns, please include your account email address in your message.
            </p>
          </section>

          {/* Acceptance */}
          <section className="pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-600 italic">
              By using For the Love of Minnesota, you acknowledge that you have read, understood, and agree to this Privacy Policy.
            </p>
          </section>
        </div>

        {/* Footer Links */}
        <div className="mt-8 pt-6 border-t border-gray-200 flex items-center justify-between text-sm">
          <Link href="/terms" className="text-blue-600 hover:underline">
            ← Terms and Conditions
          </Link>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Home →
          </Link>
        </div>
      </div>
    </div>
  );
}

