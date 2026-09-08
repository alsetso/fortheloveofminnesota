import ChatPage from '@/features/chat/ChatPage';

/**
 * /helpdesk — account AI Helpdesk inbox (threads). Opened from the left account menu.
 * Persistence: `ai.subject_threads` + `ai.subject_messages`.
 */
export default function HelpdeskRoutePage() {
  return <ChatPage />;
}
