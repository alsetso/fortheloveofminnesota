import { Metadata } from 'next';
import LegalPageLayout from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Community Guidelines - MNUDA',
  description: 'MNUDA Community Guidelines - Standards and expectations for behavior within the MNUDA community.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function CommunityGuidelinesPage() {
  return (
    <LegalPageLayout title="Community Guidelines">
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">1. Introduction</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MNUDA is a community platform that connects Minnesotans through business, real estate, and community activity. These Community Guidelines outline the standards and expectations for behavior within our community to ensure a safe, respectful, and productive environment for all users.
          </p>
          <p>
            By using MNUDA, you agree to follow these guidelines. Violations may result in warnings, content removal, account suspension, or permanent ban, depending on the severity and frequency of the violation.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">2. Be Respectful and Civil</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Treat all community members with respect and kindness. We expect users to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use respectful language and tone in all interactions</li>
            <li>Listen to different perspectives and engage in constructive dialogue</li>
            <li>Disagree respectfully without personal attacks or insults</li>
            <li>Respect others&apos; privacy and boundaries</li>
            <li>Be patient and understanding, especially with new members</li>
          </ul>
          <p>
            We do not tolerate harassment, bullying, threats, hate speech, or discrimination of any kind, including based on race, ethnicity, religion, gender, sexual orientation, age, disability, or any other protected characteristic.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">3. Authenticity and Honesty</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Maintain authenticity in your interactions and content:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use your real identity and provide accurate information</li>
            <li>Do not impersonate others or create fake accounts</li>
            <li>Be honest about your intentions, affiliations, and relationships</li>
            <li>Do not misrepresent your qualifications, experience, or credentials</li>
            <li>Clearly disclose any conflicts of interest or financial relationships</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">4. Content Standards</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            All content posted on MNUDA must:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Be relevant to the MNUDA community and Minnesota</li>
            <li>Be accurate and truthful</li>
            <li>Respect intellectual property rights (do not post copyrighted material without permission)</li>
            <li>Not contain spam, scams, or fraudulent content</li>
            <li>Not promote illegal activities or services</li>
            <li>Not contain explicit, violent, or graphic content</li>
            <li>Not include personal information of others without consent</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">5. Business and Commercial Activity</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MNUDA supports legitimate business and commercial activity, but with guidelines:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Clearly identify commercial posts and advertisements</li>
            <li>Do not spam the community with excessive promotional content</li>
            <li>Provide accurate information about products, services, and pricing</li>
            <li>Honor commitments and deliver on promises made through the platform</li>
            <li>Respect fair competition and do not engage in anti-competitive behavior</li>
            <li>Comply with all applicable business and consumer protection laws</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">6. Real Estate and Property</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            When posting about real estate or properties:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide accurate property information and pricing</li>
            <li>Comply with fair housing laws and regulations</li>
            <li>Do not discriminate based on protected characteristics</li>
            <li>Respect privacy when posting property information</li>
            <li>Follow all applicable real estate licensing and disclosure requirements</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">7. Privacy and Safety</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Protect your privacy and the privacy of others:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Do not share personal information of others without their explicit consent</li>
            <li>Be cautious when sharing your own personal information</li>
            <li>Report any suspicious or harmful behavior immediately</li>
            <li>Do not engage in stalking, doxxing, or other invasive behavior</li>
            <li>Respect others&apos; boundaries and requests to disengage</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">8. Reporting and Enforcement</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you encounter content or behavior that violates these guidelines:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Report it using our reporting tools or by contacting support@mnuda.com</li>
            <li>Provide as much detail as possible, including screenshots if applicable</li>
            <li>Do not engage with or retaliate against violators</li>
          </ul>
          <p>
            MNUDA reserves the right to review reported content and take appropriate action, including:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Removing violating content</li>
            <li>Issuing warnings to users</li>
            <li>Temporarily or permanently suspending accounts</li>
            <li>Reporting illegal activity to law enforcement</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">9. Prohibited Conduct</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            The following conduct is strictly prohibited:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Harassment, bullying, or threats directed at individuals or groups</li>
            <li>Hate speech or discriminatory content</li>
            <li>Spam, scams, or fraudulent schemes</li>
            <li>Impersonation or false representation</li>
            <li>Sharing private information without consent</li>
            <li>Posting illegal content or promoting illegal activities</li>
            <li>Violating intellectual property rights</li>
            <li>Attempting to hack, disrupt, or damage the platform</li>
            <li>Creating multiple accounts to evade bans or restrictions</li>
            <li>Engaging in coordinated inauthentic behavior</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">10. Building a Positive Community</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Help us build a positive and productive community by:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Sharing valuable insights and information</li>
            <li>Supporting other community members</li>
            <li>Contributing constructively to discussions</li>
            <li>Welcoming new members and helping them navigate the platform</li>
            <li>Providing feedback to help improve MNUDA</li>
            <li>Celebrating the diversity and strength of Minnesota&apos;s communities</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">11. Consequences of Violations</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Violations of these guidelines may result in:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li><strong>Warning:</strong> A notification about the violation with guidance on how to correct it</li>
            <li><strong>Content Removal:</strong> Removal of violating posts, comments, or other content</li>
            <li><strong>Temporary Suspension:</strong> Temporary restriction of account access</li>
            <li><strong>Permanent Ban:</strong> Permanent removal from the platform for severe or repeated violations</li>
          </ul>
          <p>
            The severity of the consequence depends on the nature and frequency of the violation. MNUDA reserves the right to take any action we deem necessary to protect our community.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">12. Appeals</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you believe your content was removed or your account was suspended in error, you may appeal by contacting support@mnuda.com. Please provide:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Your account information</li>
            <li>Details about the action taken</li>
            <li>Your explanation of why you believe it was in error</li>
            <li>Any relevant evidence or context</li>
          </ul>
          <p>
            We will review appeals in a timely manner and respond with our decision.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">13. Contact Us</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you have questions about these Community Guidelines or need to report a violation, please contact us at:
          </p>
          <p className="font-semibold">
            MNUDA Network<br />
            Email: support@mnuda.com<br />
            Website: mnuda.com
          </p>
        </div>
      </section>
    </LegalPageLayout>
  );
}


