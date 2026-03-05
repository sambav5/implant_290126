import { useEffect, useRef } from 'react';
import MessageItem from './MessageItem';

export default function MessageList({ messages, onReply, onReact, onDelete, canDelete }) {
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages]);

  if (!messages.length) {
    return (
      <div className="h-96 flex items-center justify-center text-sm" style={{ color: 'var(--t2)' }}>
        <div className="text-center">Start the discussion for this case.<br />Mention teammates to collaborate.</div>
      </div>
    );
  }

  return (
    <div ref={listRef} className="h-96 overflow-y-auto">
      {messages.map((message, index) => {
        const prev = messages[index - 1];
        const showSender = !prev || prev.sender_id !== message.sender_id;
        return (
          <MessageItem
            key={message.id}
            message={message}
            showSender={showSender}
            onReply={() => onReply(message)}
            onReact={(emoji) => onReact(message.id, emoji)}
            onDelete={() => onDelete(message.id)}
            canDelete={canDelete}
          />
        );
      })}
    </div>
  );
}
