import React, { useState } from 'react';
import type { Message } from '../types';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Pencil, Trash2, Check, X, ImageIcon } from 'lucide-react';

interface MessageItemProps {
  message: Message;
  onImageClick: (url: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onImageClick }) => {
  const { user } = useAuth();
  const { editMessage, deleteMessage } = useChat();

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(message.content);
  const [isSaving, setIsSaving] = useState(false);

  const isAuthor = user?.id === message.senderId;
  const isDeleted = message.isDeleted;

  const handleSaveEdit = async () => {
    if (!editContent.trim() || editContent.trim() === message.content) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await editMessage(message.id, editContent);
      setIsEditing(false);
    } catch (err) {
      // Error handled in context
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditContent(message.content);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this message?')) {
      await deleteMessage(message.id);
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <div
      className={`group relative flex space-x-3 px-4 py-2 hover:bg-slate-800/40 rounded-lg transition-colors ${
        isDeleted ? 'opacity-70' : ''
      }`}
    >
      {/* Sender Avatar */}
      <div className="flex-shrink-0">
        {message.sender.avatarUrl ? (
          <img
            src={message.sender.avatarUrl}
            alt={message.sender.displayName}
            className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-sm font-semibold text-indigo-300 uppercase">
            {message.sender.displayName.slice(0, 2)}
          </div>
        )}
      </div>

      {/* Message Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline space-x-2">
          <span className="font-semibold text-slate-100 text-sm">
            {message.sender.displayName}
          </span>
          <span className="text-xs text-slate-400">
            @{message.sender.username}
          </span>
          <span className="text-[11px] text-slate-400">
            {formatTime(message.createdAt)}
          </span>
          {message.isEdited && !isDeleted && (
            <span className="text-[10px] text-slate-400 italic">
              (edited)
            </span>
          )}
        </div>

        {/* Message Content / Edit View */}
        {isEditing ? (
          <div className="mt-1.5 space-y-2">
            <input
              type="text"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSaving}
              autoFocus
              className="w-full bg-slate-900 border border-indigo-500 rounded px-3 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            />
            <div className="flex items-center space-x-2 text-xs">
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editContent.trim()}
                className="flex items-center space-x-1 bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 rounded font-medium disabled:opacity-50 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setEditContent(message.content);
                }}
                disabled={isSaving}
                className="flex items-center space-x-1 bg-slate-700 hover:bg-slate-600 text-slate-300 px-2.5 py-1 rounded font-medium cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
              <span className="text-[11px] text-slate-400">
                press Escape to cancel, Enter to save
              </span>
            </div>
          </div>
        ) : (
          <div className="mt-1 text-sm text-slate-200 break-words whitespace-pre-wrap leading-relaxed">
            {isDeleted ? (
              <span className="text-slate-400 italic text-xs flex items-center gap-1">
                This message was deleted
              </span>
            ) : (
              message.content
            )}
          </div>
        )}

        {/* Attached Image */}
        {message.imageUrl && !isDeleted && (
          <div className="mt-2.5 max-w-sm">
            <div
              onClick={() => onImageClick(message.imageUrl!)}
              className="relative group/img overflow-hidden rounded-lg border border-slate-700/60 bg-slate-900 cursor-pointer shadow-md inline-block max-h-64"
            >
              <img
                src={message.imageUrl}
                alt="Chat attachment"
                className="max-h-64 w-auto object-cover rounded-lg group-hover/img:scale-105 transition-transform duration-200"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                <span className="bg-black/60 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
                  <ImageIcon className="w-3.5 h-3.5" /> Click to enlarge
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hover Actions Menu (Author only, and not while deleted/editing) */}
      {isAuthor && !isDeleted && !isEditing && (
        <div className="absolute top-2 right-4 hidden group-hover:flex items-center space-x-1 bg-slate-900/90 border border-slate-700 rounded-md p-1 shadow-lg backdrop-blur-sm z-10">
          <button
            onClick={() => {
              setIsEditing(true);
              setEditContent(message.content);
            }}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition cursor-pointer"
            title="Edit message"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded transition cursor-pointer"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
