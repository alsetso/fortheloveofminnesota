import { redirect } from 'next/navigation';
import { DISCOVER_PATH } from '@/lib/routes/routePolicy';

/**
 * Legacy /explore — permanently redirected to Discover.
 */
export default function ExploreLegacyRedirectPage() {
  redirect(DISCOVER_PATH);
}
