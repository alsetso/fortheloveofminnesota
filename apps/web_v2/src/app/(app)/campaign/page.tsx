import { redirect } from 'next/navigation';
import { GAME_PATH } from '@/lib/routes/routePolicy';

/** /campaign retired — Game is the Map tab. */
export default function CampaignLegacyRedirectPage() {
  redirect(GAME_PATH);
}
