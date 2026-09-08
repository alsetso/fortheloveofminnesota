import { redirect } from 'next/navigation';
import { HELPDESK_PATH } from '@/lib/routes/routePolicy';

/** Legacy `/chat` → `/helpdesk`. */
export default function LegacyChatRedirectPage() {
  redirect(HELPDESK_PATH);
}
