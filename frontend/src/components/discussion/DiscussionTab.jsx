import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { discussionApi } from '@/services/api';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import ThreadPanel from './ThreadPanel';
import DiscussionHeader from './DiscussionHeader';
import TypingIndicator from './TypingIndicator';

export default function DiscussionTab({ caseId, activeRole, caseData }) {
  const [messages, setMessages] = useState([]);
  const [threadParent, setThreadParent] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const lastCursorRef = useRef('');

  const canDelete = activeRole === 'clinician';

  const mentionables = useMemo(() => {
    const roles = ['everyone', 'clinician', 'implantologist', 'prostho', 'assistant'];
    const users = [caseData?.clinician?.name, caseData?.implantologist?.name, caseData?.prosthodontist?.name, caseData?.assistant?.name]
      .filter(Boolean)
      .map((name) => name.replace(/\s+/g, '').toLowerCase());
    return [...roles, ...users];
  }, [caseData]);

  // Initial load of messages
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await discussionApi.getMessages(caseId, { limit: 50 });
      const fetchedMessages = response.data.messages || [];
      setMessages(fetchedMessages);
      
      // Store the latest message timestamp as cursor for polling
      if (fetchedMessages.length > 0) {
        lastCursorRef.current = fetchedMessages[fetchedMessages.length - 1].created_at;
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
      setError('Failed to load messages. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { 
    loadMessages(); 
  }, [loadMessages]);

  // Polling for new messages using incremental fetching
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        // Use the discussion-events endpoint for incremental updates
        const response = await discussionApi.getEvents(caseId, lastCursorRef.current);
        const newMessages = response.data.messages || [];
        
        if (newMessages.length > 0) {
          setMessages((prev) => [...prev, ...newMessages]);
          lastCursorRef.current = response.data.cursor;
        }
      } catch (err) {
        console.error('Polling failed:', err);
        // Don't show error for polling failures, just log them
      }
    }, 3000); // Poll every 3 seconds
    
    return () => clearInterval(timer);
  }, [caseId]);

  const sendMessage = async (message, mentions, parentId) => {
    if (!message?.trim()) return;
    try {
      await discussionApi.sendMessage(caseId, { 
        message, 
        mentions, 
        parent_message_id: parentId || null 
      });
      // Immediately fetch new messages after sending
      const response = await discussionApi.getEvents(caseId, lastCursorRef.current);
      const newMessages = response.data.messages || [];
      if (newMessages.length > 0) {
        setMessages((prev) => [...prev, ...newMessages]);
        lastCursorRef.current = response.data.cursor;
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setError('Failed to send message. Please try again.');
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      const response = await discussionApi.addReaction(messageId, emoji);
      // Update the specific message's reactions in state
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, reactions: response.data.reactions }
            : msg
        )
      );
    } catch (err) {
      console.error('Failed to add reaction:', err);
      setError('Failed to add reaction. Please try again.');
    }
  };

  const handleDelete = async (messageId) => {
    if (!window.confirm('Are you sure you want to delete this message?')) {
      return;
    }
    try {
      await discussionApi.deleteMessage(messageId);
      // Update the message in state to show as deleted
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId
            ? { ...msg, deleted: true, message: 'This message was deleted' }
            : msg
        )
      );
    } catch (err) {
      console.error('Failed to delete message:', err);
      setError('Failed to delete message. Please try again.');
    }
  };

  const threadMessages = messages.filter((m) => m.parent_message_id === threadParent?.id);

  if (loading && messages.length === 0) {
    return (
      <div className="rounded-xl p-8 flex items-center justify-center" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        <div className="text-sm" style={{ color: 'var(--t2)' }}>Loading messages...</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
      <DiscussionHeader />
      
      {error && (
        <div className="mx-4 mt-3 p-2 rounded text-sm" style={{ background: 'var(--destructive)', color: 'white' }}>
          {error}
        </div>
      )}
      
      <MessageList 
        messages={messages.filter((m) => !m.parent_message_id)} 
        onReply={setThreadParent} 
        onReact={handleReaction} 
        onDelete={handleDelete} 
        canDelete={canDelete} 
      />
      
      <div className="p-3" style={{ borderTop: '1px solid var(--border)' }}>
        <MessageInput
          mentionables={mentionables}
          onSend={(message, mentions) => sendMessage(message, mentions)}
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
      />
    </div>
  );
}
