import { redirect } from 'next/navigation';
import { GAME_PATH } from '@/lib/routes/routePolicy';

/**
 * Retired Map hub — permanently redirected to the game map.
 */
export default function MapRoutePage() {
  redirect(GAME_PATH);
}
