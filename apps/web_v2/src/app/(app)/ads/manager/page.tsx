import { redirect } from 'next/navigation';
import { pagesAdvertisePath } from '@/lib/routes/routePolicy';

/**
 * Legacy Ads Manager hub — ownership lives on My Pages; ads ops on the page.
 */
export default function AdsManagerLegacyRedirectPage() {
  redirect(pagesAdvertisePath());
}
