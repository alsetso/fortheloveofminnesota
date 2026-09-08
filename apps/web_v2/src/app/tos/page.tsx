import { LegalPolicyPage } from '@/components/legal/LegalPolicyPage';

export const dynamic = 'force-dynamic';

export default function TosPage() {
  return <LegalPolicyPage slug="terms_of_service" heading="Terms of Service" />;
}
