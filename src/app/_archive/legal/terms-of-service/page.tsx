import { Metadata } from 'next';
import LegalPageLayout from '../components/LegalPageLayout';

export const metadata: Metadata = {
  title: 'Terms of Service - MNUDA',
  description: 'MNUDA Terms of Service - Please read our terms and conditions for using our platform.',
  robots: {
    index: true,
    follow: true,
  },
};

export default function TermsOfServicePage() {
  return (
    <LegalPageLayout title="Terms of Service">
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">1. Agreement to Terms</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            These Terms of Service (&quot;Terms&quot;) constitute a legally binding agreement between you (&quot;User,&quot; &quot;you,&quot; or &quot;your&quot;) and MNUDA Network, a Minnesota-based entity (&quot;MNUDA,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;), governing your access to and use of the MNUDA website located at mnuda.com (the &quot;Website&quot;) and any related services, applications, features, content, and functionality offered by MNUDA (collectively, the &quot;Services&quot;).
          </p>
          <p>
            By accessing, browsing, or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms and all applicable laws and regulations of the State of Minnesota and the United States. If you do not agree with any part of these Terms, you must immediately discontinue your use of the Services and may not access or use the Services.
          </p>
          <p>
            These Terms apply to all visitors, users, and others who access or use the Services. By using the Services, you represent and warrant that you are at least eighteen (18) years of age and have the legal capacity to enter into these Terms.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">2. Definitions</h2>
        <div className="space-y-3 text-gray-700 leading-relaxed">
          <p>
            <strong>&quot;Services&quot;</strong> means all products, services, websites, applications, tools, features, and functionality provided by MNUDA, including but not limited to property search and mapping tools, community features, and any related software or technology.
          </p>
          <p>
            <strong>&quot;User Content&quot;</strong> means any data, information, text, graphics, photos, or other materials uploaded, posted, transmitted, or otherwise made available by you through the Services.
          </p>
          <p>
            <strong>&quot;Third-Party Services&quot;</strong> means any external services, APIs, data providers, or third-party integrations utilized by or accessible through the Services.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">3. Description of Services</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            MNUDA provides a technology platform that combines software tools, data services, and business resources to facilitate real estate investment activities in Minnesota. The Services include, but are not limited to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Interactive property mapping and geocoding tools</li>
            <li>Community features and networking tools</li>
            <li>Project management services</li>
            <li>Home acquisition services</li>
          </ul>
          <p>
            MNUDA reserves the right to modify, suspend, or discontinue any aspect of the Services at any time, with or without notice, and without liability to you or any third party.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">4. User Accounts and Registration</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            To access certain features of the Services, you may be required to create an account and provide accurate, current, and complete information. You are solely responsible for maintaining the confidentiality of your account credentials, including your username and password, and for all activities that occur under your account.
          </p>
          <p>
            You agree to: (a) immediately notify MNUDA of any unauthorized use of your account or any other breach of security; (b) ensure that you exit from your account at the end of each session; and (c) use a strong password and restrict access to your computer or device. MNUDA will not be liable for any loss or damage arising from your failure to comply with this section.
          </p>
          <p>
            You represent and warrant that all information provided during registration is accurate, current, and complete, and you agree to update such information to maintain its accuracy. MNUDA reserves the right to suspend or terminate your account if any information provided is found to be inaccurate, not current, or incomplete.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">5. Acceptable Use Policy</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You agree to use the Services only for lawful purposes and in accordance with these Terms and all applicable federal, state, and local laws, rules, and regulations, including but not limited to Minnesota state laws and regulations governing real estate transactions, fair housing, data privacy, and consumer protection.
          </p>
          <p>
            You agree not to, and will not permit any third party to:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Use the Services in any manner that violates any applicable law, regulation, or court order</li>
            <li>Infringe upon or violate the intellectual property rights, privacy rights, or other rights of any third party</li>
            <li>Harass, abuse, harm, or defame any individual or entity</li>
            <li>Transmit, upload, or distribute any viruses, malware, worms, Trojan horses, or other malicious code</li>
            <li>Attempt to gain unauthorized access to the Services, other accounts, computer systems, or networks connected to the Services</li>
            <li>Interfere with or disrupt the integrity or performance of the Services or the data contained therein</li>
            <li>Use the Services to collect, store, or process personal information in violation of applicable privacy laws</li>
            <li>Use the Services for stalking, harassment, or any unlawful purpose</li>
            <li>Use automated systems, bots, scrapers, or crawlers to access the Services without express written permission</li>
            <li>Reverse engineer, decompile, disassemble, or otherwise attempt to derive the source code of any software component of the Services</li>
            <li>Use the Services for any commercial purpose without MNUDA&apos;s express written consent, except as expressly permitted herein</li>
            <li>Impersonate any person or entity or falsely state or misrepresent your affiliation with any person or entity</li>
          </ul>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">6. User Content and Data</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            You retain all ownership rights in any User Content you submit, post, or display on or through the Services. By submitting User Content, you grant MNUDA a worldwide, non-exclusive, royalty-free, perpetual, irrevocable, sublicensable, and transferable license to use, reproduce, distribute, prepare derivative works of, display, and perform such User Content in connection with the Services and MNUDA&apos;s business.
          </p>
          <p>
            You are solely responsible for your User Content and the consequences of posting or publishing it. You represent and warrant that: (a) you own or have the necessary licenses, rights, consents, and permissions to use and authorize MNUDA to use all User Content in the manner contemplated by these Terms; and (b) your User Content does not violate any third-party rights, including intellectual property rights, privacy rights, or publicity rights.
          </p>
          <p>
            MNUDA reserves the right, but has no obligation, to monitor, review, edit, or remove any User Content at any time, for any reason, in its sole discretion, without prior notice.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">7. Intellectual Property Rights</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            The Services, including all content, features, functionality, software, text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and the design, selection, and arrangement thereof, are the exclusive property of MNUDA or its licensors and are protected by United States and international copyright, trademark, patent, trade secret, and other intellectual property laws.
          </p>
          <p>
            The MNUDA name, logo, and all related names, logos, product and service names, designs, and slogans are trademarks of MNUDA or its affiliates. You may not use such marks without the prior written permission of MNUDA.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">8. Privacy and Data Protection</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            Your privacy is important to us. Our collection, use, and disclosure of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference. By using the Services, you consent to the collection and use of your information as described in our Privacy Policy.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">9. Disclaimers</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            THE SERVICES ARE PROVIDED ON AN &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR COURSE OF PERFORMANCE.
          </p>
          <p>
            MNUDA DOES NOT WARRANT THAT: (a) THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE; (b) THE RESULTS THAT MAY BE OBTAINED FROM THE USE OF THE SERVICES WILL BE ACCURATE OR RELIABLE; OR (c) ANY ERRORS IN THE SERVICES WILL BE CORRECTED.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">10. Limitation of Liability</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, INCLUDING MINNESOTA STATE LAW, IN NO EVENT SHALL MNUDA, ITS AFFILIATES, AGENTS, DIRECTORS, EMPLOYEES, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, PUNITIVE, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR EXEMPLARY DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, GOODWILL, USE, DATA, OR OTHER INTANGIBLE LOSSES.
          </p>
          <p>
            IN NO EVENT SHALL MNUDA&apos;S TOTAL LIABILITY TO YOU FOR ALL DAMAGES EXCEED THE AMOUNT OF ONE HUNDRED DOLLARS ($100.00) OR THE AMOUNT YOU PAID MNUDA IN THE TWELVE (12) MONTHS PRIOR TO THE ACTION GIVING RISE TO THE LIABILITY, WHICHEVER IS GREATER.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">11. Governing Law and Jurisdiction</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of Minnesota, without regard to its conflict of law provisions. You agree to submit to the personal and exclusive jurisdiction of the state and federal courts located in Hennepin County, Minnesota, for the resolution of any disputes arising out of or relating to these Terms or the Services.
          </p>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-bold text-black mb-4">12. Contact Information</h2>
        <div className="space-y-4 text-gray-700 leading-relaxed">
          <p>
            If you have any questions about these Terms of Service, please contact us at:
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


