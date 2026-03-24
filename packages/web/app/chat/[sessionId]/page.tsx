import { ChatView } from '@/components/chat/chat-view';

export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatView initialSessionId={sessionId} />;
}
