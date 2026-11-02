import React from 'react';

interface TypingIndicatorProps {
  users: { id: string; username: string; displayName: string }[];
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ users }) => {
  if (!users || users.length === 0) return null;

  let text = '';
  if (users.length === 1) {
    text = `${users[0].displayName} is typing...`;
  } else if (users.length === 2) {
    text = `${users[0].displayName} and ${users[1].displayName} are typing...`;
  } else {
    text = `${users[0].displayName} and ${users.length - 1} others are typing...`;
  }

  return (
    <div className="flex items-center space-x-2 px-4 py-1.5 text-xs text-slate-400 italic">
      <div className="flex space-x-1 items-center">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
      </div>
      <span>{text}</span>
    </div>
  );
};
