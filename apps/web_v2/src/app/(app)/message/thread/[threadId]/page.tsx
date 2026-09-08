import MessageThreadPage from '@/features/messages/MessageThreadPage';

/**
 * /message/thread/:threadId — DM conversation.
 */
export default async function MessageThreadRoutePage({
  params,
}: {
  params: Promise<{ threadId: string }>;
}) {
  const { threadId } = await params;
  return <MessageThreadPage threadId={threadId} />;
}
