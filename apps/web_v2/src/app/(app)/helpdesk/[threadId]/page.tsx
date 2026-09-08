import ChatThreadPage from '@/features/chat/ChatThreadPage';

/**
 * /helpdesk/[threadId] — conversation push over the Helpdesk inbox.
 * Footer is hidden via `appTabBarHidden` so the composer owns the bottom.
 */
export default async function HelpdeskThreadRoutePage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <ChatThreadPage threadId={threadId} />;
}
