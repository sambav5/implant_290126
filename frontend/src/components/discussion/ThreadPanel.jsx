import { X } from 'lucide-react';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ThreadPanel({ parent, messages, onClose, onSend, onReact, onDelete, canDelete, mentionables }) {
  if (!parent) return null;
  return (
    <div className="fixed top-0 right-0 w-full sm:w-[420px] h-full z-50" style={{ background: 'var(--card)', borderLeft: '1px solid var(--border)' }}>
      <div className="p-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>Thread</div>
        <button onClick={onClose}><X className="h-4 w-4" /></button>
      </div>
      <div className="p-3 text-sm" style={{ color: 'var(--t1)', borderBottom: '1px solid var(--border)' }}>{parent.message}</div>
      <MessageList messages={messages} onReply={() => {}} onReact={onReact} onDelete={onDelete} canDelete={canDelete} />
      <div className="p-2"><MessageInput onSend={onSend} mentionables={mentionables} /></div>
    </div>
  );
}
