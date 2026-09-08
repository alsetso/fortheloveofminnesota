import { LegalPolicyPage } from '@/components/legal/LegalPolicyPage';

export const dynamic = 'force-dynamic';

export default function PrivacyPage() {
  return <LegalPolicyPage slug="privacy_policy" heading="Privacy Policy" />;
}
