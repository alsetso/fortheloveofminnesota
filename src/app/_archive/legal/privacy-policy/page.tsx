import { Metadata } from 'next';
import LegalPageLayout from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Privacy Policy - MNUDA',
  description: 'MNUDA Privacy Policy - How we collect, use, protect, and share your personal information.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPageLayout title="Privacy Policy">
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">1. Introduction</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MNUDA Network (&quot;MNUDA,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our website, services, and platform (collectively, the &quot;Services&quot;).
          </p>
          <p>
            By using the Services, you consent to the collection and use of your information in accordance with this Privacy Policy. If you do not agree with our policies and practices, please do not use the Services.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">2. Information We Collect</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We collect information that you provide directly to us, as well as information that is automatically collected when you use the Services:
          </p>
          
          <h3 className="text-xl font-semibold text-black mt-6 mb-3">Information You Provide</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Account Information:</strong> Name, email address, username, password, and profile information</li>
            <li><strong>Profile Information:</strong> First name, last name, gender, age, location, and other profile details</li>
            <li><strong>Content:</strong> Posts, comments, messages, and other content you create or share</li>
            <li><strong>Communication:</strong> Information you provide when contacting us or participating in surveys</li>
            <li><strong>Payment Information:</strong> Billing address, payment method details (processed through secure third-party payment processors)</li>
          </ul>

          <h3 className="text-xl font-semibold text-black mt-6 mb-3">Automatically Collected Information</h3>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Usage Data:</strong> Information about how you access and use the Services, including pages viewed, time spent, and features used</li>
            <li><strong>Device Information:</strong> Device type, operating system, browser type, IP address, and unique device identifiers</li>
            <li><strong>Location Data:</strong> General location information based on your IP address or device settings</li>
            <li><strong>Cookies and Tracking:</strong> Information collected through cookies, web beacons, and similar tracking technologies</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">3. How We Use Your Information</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We use the information we collect to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide, maintain, and improve the Services</li>
            <li>Create and manage your account</li>
            <li>Process transactions and send related information</li>
            <li>Send you technical notices, updates, and support messages</li>
            <li>Respond to your comments, questions, and requests</li>
            <li>Monitor and analyze trends, usage, and activities</li>
            <li>Detect, prevent, and address technical issues and security threats</li>
            <li>Personalize your experience and provide content and features relevant to you</li>
            <li>Send you marketing communications (with your consent, where required)</li>
            <li>Comply with legal obligations and enforce our terms and policies</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">4. How We Share Your Information</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We may share your information in the following circumstances:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>With Your Consent:</strong> We may share your information when you explicitly consent to such sharing</li>
            <li><strong>Service Providers:</strong> We may share information with third-party service providers who perform services on our behalf, such as payment processing, data analysis, and hosting</li>
            <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government regulation</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets, your information may be transferred</li>
            <li><strong>Protection of Rights:</strong> We may share information to protect our rights, property, or safety, or that of our users or others</li>
            <li><strong>Public Information:</strong> Information you choose to make public on the Services will be visible to other users</li>
          </ul>
          <p>
            We do not sell your personal information to third parties.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">5. Data Security</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">6. Cookies and Tracking Technologies</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We use cookies, web beacons, and similar tracking technologies to collect and store information about your use of the Services. Cookies are small data files stored on your device that help us improve your experience.
          </p>
          <p>
            You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of the Services.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">7. Your Rights and Choices</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You have certain rights regarding your personal information:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Access:</strong> You can request access to the personal information we hold about you</li>
            <li><strong>Correction:</strong> You can update or correct your personal information through your account settings</li>
            <li><strong>Deletion:</strong> You can request deletion of your personal information, subject to certain exceptions</li>
            <li><strong>Opt-Out:</strong> You can opt out of receiving marketing communications from us</li>
            <li><strong>Data Portability:</strong> You can request a copy of your data in a portable format</li>
          </ul>
          <p>
            To exercise these rights, please contact us using the information provided in the Contact section below.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">8. Children&apos;s Privacy</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            The Services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children under 18. If you believe we have collected information from a child under 18, please contact us immediately, and we will take steps to delete such information.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">9. Data Retention</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We retain your personal information for as long as necessary to provide the Services, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">10. Changes to This Privacy Policy</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the &quot;Last updated&quot; date. Your continued use of the Services after such changes constitutes your acceptance of the updated Privacy Policy.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">11. Contact Us</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us at:
          </p>
          <p className="font-semibold">
            MNUDA Network<br />
            Email: privacy@mnuda.com<br />
            Website: mnuda.com
          </p>
        </div>
      </section>
    </LegalPageLayout>
  );
}


