import { useCallback, useEffect, useMemo, useState } from 'react';
import { discussionApi } from '@/services/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ThreadPanel from './ThreadPanel';
import DiscussionHeader from './DiscussionHeader';
import TypingIndicator from './TypingIndicator';

export default function DiscussionTab({ caseId, activeRole, caseData }) {
  const [messages, setMessages] = useState([]);
  const [threadParent, setThreadParent] = useState(null);
  const [typingText, setTypingText] = useState('');

  const canDelete = activeRole === 'clinician';

  const mentionables = useMemo(() => {
    const roles = ['everyone', 'clinician', 'implantologist', 'prostho', 'assistant'];
    const users = [caseData?.clinician?.name, caseData?.implantologist?.name, caseData?.prosthodontist?.name, caseData?.assistant?.name]
      .filter(Boolean)
      .map((name) => name.replace(/\s+/g, '').toLowerCase());
    return [...roles, ...users];
  }, [caseData]);

  const loadMessages = useCallback(async () => {
    const response = await discussionApi.getMessages(caseId, { limit: 200 });
    setMessages(response.data.messages || []);
  }, [caseId]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    const timer = setInterval(async () => {
      const response = await discussionApi.getMessages(caseId, { limit: 200 });
      setMessages(response.data.messages || []);
      const typing = localStorage.getItem(`discussion_typing_${caseId}`);
      if (typing) {
        const parsed = JSON.parse(typing);
        if (Date.now() - parsed.at < 2000) setTypingText(`${parsed.name} is typing...`);
        else setTypingText('');
      }
    }, 2500);
    return () => clearInterval(timer);
  }, [caseId]);

  const sendMessage = async (message, mentions, parentId) => {
    if (!message?.trim()) return;
    await discussionApi.sendMessage(caseId, { message, mentions, parent_message_id: parentId || null });
    await loadMessages();
  };

  const handleReaction = async (messageId, emoji) => {
    await discussionApi.addReaction(messageId, emoji);
    await loadMessages();
  };

  const handleDelete = async (messageId) => {
    await discussionApi.deleteMessage(messageId);
    await loadMessages();
  };

  const threadMessages = messages.filter((m) => m.parent_message_id === threadParent?.id);

  return (
    <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <DiscussionHeader />
      <TypingIndicator text={typingText} />
      <MessageList messages={messages.filter((m) => !m.parent_message_id)} onReply={setThreadParent} onReact={handleReaction} onDelete={handleDelete} canDelete={canDelete} />
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <MessageInput
          mentionables={mentionables}
          onSend={(message, mentions) => sendMessage(message, mentions)}
          onTyping={() => {
            localStorage.setItem(`discussion_typing_${caseId}`, JSON.stringify({ name: 'A teammate', at: Date.now() }));
          }}
        />
      </div>

      <ThreadPanel
        parent={threadParent}
        messages={threadMessages}
        onClose={() => setThreadParent(null)}
        onSend={(message, mentions) => sendMessage(message, mentions, threadParent?.id)}
        onReact={handleReaction}
        onDelete={handleDelete}
        canDelete={canDelete}
        mentionables={mentionables}
        onTyping={() => localStorage.setItem(`discussion_typing_${caseId}`, JSON.stringify({ name: 'A teammate', at: Date.now() }))}
      />
    </div>
  );
}
