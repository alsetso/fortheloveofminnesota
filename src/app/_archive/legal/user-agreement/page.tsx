import { Metadata } from 'next';
import LegalPageLayout from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'User Agreement - MNUDA',
  description: 'MNUDA User Agreement - The agreement between you and MNUDA that outlines the rules and guidelines for using our platform.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function UserAgreementPage() {
  return (
    <LegalPageLayout title="User Agreement">
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">1. Acceptance of Agreement</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            This User Agreement (&quot;Agreement&quot;) is a legally binding contract between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and MNUDA Network (&quot;MNUDA,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) governing your use of the MNUDA platform, services, and all related features (collectively, the &quot;Services&quot;).
          </p>
          <p>
            By creating an account, accessing, or using the Services, you acknowledge that you have read, understood, and agree to be bound by this Agreement, our Terms of Service, Privacy Policy, and Community Guidelines. If you do not agree to this Agreement, you must not use the Services.
          </p>
          <p>
            You represent and warrant that you are at least eighteen (18) years of age and have the legal capacity to enter into this Agreement. If you are using the Services on behalf of a company or organization, you represent that you have the authority to bind that entity to this Agreement.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">2. Account Creation and Responsibilities</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            To use certain features of the Services, you must create an account. When creating an account, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide accurate, current, and complete information</li>
            <li>Maintain and promptly update your account information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Accept responsibility for all activities that occur under your account</li>
            <li>Notify MNUDA immediately of any unauthorized use of your account</li>
          </ul>
          <p>
            You are solely responsible for maintaining the confidentiality of your account credentials. MNUDA will not be liable for any loss or damage arising from your failure to comply with this section.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">3. User Conduct and Responsibilities</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            As a user of the Services, you agree to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Services only for lawful purposes and in accordance with this Agreement</li>
            <li>Respect the rights and dignity of all other users</li>
            <li>Provide accurate and truthful information in all interactions</li>
            <li>Comply with all applicable local, state, and federal laws and regulations</li>
            <li>Not engage in any activity that could harm, disable, or impair the Services</li>
            <li>Not attempt to gain unauthorized access to any part of the Services</li>
            <li>Not use the Services to transmit any malicious code, viruses, or harmful software</li>
            <li>Not impersonate any person or entity or misrepresent your affiliation with any person or entity</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">4. Content and Intellectual Property</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You retain ownership of any content you create, upload, or post on the Services (&quot;User Content&quot;). However, by submitting User Content, you grant MNUDA a worldwide, non-exclusive, royalty-free license to use, reproduce, distribute, modify, and display your User Content in connection with the Services.
          </p>
          <p>
            You represent and warrant that you own or have the necessary rights to all User Content you submit, and that your User Content does not violate any third-party rights, including intellectual property, privacy, or publicity rights.
          </p>
          <p>
            All content, features, and functionality of the Services, including but not limited to text, graphics, logos, icons, images, and software, are the exclusive property of MNUDA or its licensors and are protected by copyright, trademark, and other intellectual property laws.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">5. Privacy and Data</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into this Agreement by reference.
          </p>
          <p>
            By using the Services, you consent to the collection, use, and disclosure of your information as described in our Privacy Policy. You acknowledge that certain information may be transmitted over networks and may be subject to security breaches, and MNUDA cannot guarantee the absolute security of your data.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">6. Prohibited Activities</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You agree not to engage in any of the following prohibited activities:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Violating any applicable law, regulation, or court order</li>
            <li>Infringing upon the rights of others, including intellectual property rights</li>
            <li>Harassing, threatening, or abusing other users</li>
            <li>Posting false, misleading, or defamatory content</li>
            <li>Spamming, phishing, or engaging in any fraudulent activity</li>
            <li>Collecting or harvesting information about other users without their consent</li>
            <li>Using automated systems to access the Services without permission</li>
            <li>Interfering with or disrupting the Services or servers</li>
            <li>Attempting to reverse engineer or decompile any part of the Services</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">7. Termination</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You may terminate your account at any time by contacting us or discontinuing use of the Services. MNUDA reserves the right to suspend or terminate your account and access to the Services at any time, with or without notice, for any reason, including if you breach this Agreement.
          </p>
          <p>
            Upon termination, your right to use the Services will immediately cease. All provisions of this Agreement that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, and limitations of liability.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">8. Disclaimers and Limitation of Liability</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            THE SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. MNUDA DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
          </p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, MNUDA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">9. Indemnification</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You agree to defend, indemnify, and hold harmless MNUDA, its affiliates, and their respective officers, directors, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable attorneys&apos; fees, arising out of or relating to your use of the Services, your User Content, or your violation of this Agreement.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">10. Modifications to Agreement</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MNUDA reserves the right to modify this Agreement at any time. If we make material changes, we will notify you by email or through the Services. Your continued use of the Services after such modifications constitutes your acceptance of the modified Agreement.
          </p>
          <p>
            If you do not agree to the modified Agreement, you must stop using the Services and may terminate your account.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">11. Governing Law</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            This Agreement shall be governed by and construed in accordance with the laws of the State of Minnesota, without regard to its conflict of law provisions. Any disputes arising out of or relating to this Agreement shall be resolved in the state and federal courts located in Hennepin County, Minnesota.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">12. Contact Information</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you have any questions about this User Agreement, please contact us at:
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


