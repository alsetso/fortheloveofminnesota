import { redirect } from 'next/navigation';
import { GAME_PATH } from '@/lib/routes/routePolicy';

/** /story retired — Game is the Map tab. */
export default function StoryLegacyRedirectPage() {
  redirect(GAME_PATH);
}
