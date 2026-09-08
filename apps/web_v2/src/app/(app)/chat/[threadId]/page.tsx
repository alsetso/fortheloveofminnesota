import { redirect } from 'next/navigation';
import { HELPDESK_PATH } from '@/lib/routes/routePolicy';

/** Legacy `/chat/[threadId]` → `/helpdesk/[threadId]`. */
export default async function LegacyChatThreadRedirectPage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  redirect(`${HELPDESK_PATH}/${encodeURIComponent(threadId)}`);
}
