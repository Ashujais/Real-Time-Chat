import React from 'react';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import {
  Menu,
  Hash,
  Lock,
  Users,
  MessageSquare,
  Circle,
} from 'lucide-react';

interface ChatAreaProps {
  onOpenMobileSidebar: () => void;
}

export const ChatArea: React.FC<ChatAreaProps> = ({ onOpenMobileSidebar }) => {
  const { activeRoom } = useChat();
  const { isConnected, onlineUsers } = useSocket();

  if (!activeRoom) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-slate-900 text-slate-400 p-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-indigo-400 mb-4 shadow-xl">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-200 mb-1">No Active Conversation</h2>
        <p className="text-sm text-slate-400 max-w-sm text-center mb-4">
          Select a channel or direct message from the sidebar, or create a new room to begin chatting in real-time.
        </p>
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium"
        >
          Open Conversations
        </button>
      </main>
    );
  }

  const isDirect = activeRoom.type === 'DIRECT';
  const otherUser = activeRoom.otherUser;
  const isOtherOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

  return (
    <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-900">
      {/* Room Header */}
      <header className="h-16 px-4 md:px-6 bg-slate-950/70 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
        <div className="flex items-center space-x-3 min-w-0">
          {/* Mobile Menu Button */}
          <button
            onClick={onOpenMobileSidebar}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Open channels"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Room Title & Status */}
          {isDirect ? (
            <div className="flex items-center space-x-3 min-w-0">
              <div className="relative flex-shrink-0">
                {otherUser?.avatarUrl ? (
                  <img
                    src={otherUser.avatarUrl}
                    alt={activeRoom.displayName}
                    className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-sm font-bold text-indigo-300">
                    {activeRoom.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <span
                  className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                    isOtherOnline ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}
                  title={isOtherOnline ? 'Online' : 'Offline'}
                />
              </div>

              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="font-bold text-slate-100 text-base truncate">
                    {activeRoom.displayName}
                  </h2>
                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      isOtherOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {isOtherOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
                {otherUser && (
                  <p className="text-xs text-slate-400 truncate">@{otherUser.username}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {activeRoom.isPrivate ? (
                  <Lock className="w-4 h-4 text-amber-400 flex-shrink-0" />
                ) : (
                  <Hash className="w-5 h-5 text-indigo-400 flex-shrink-0" />
                )}
                <h2 className="font-bold text-slate-100 text-base truncate">
                  {activeRoom.name}
                </h2>
                <span className="hidden sm:flex items-center space-x-1 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  <Users className="w-3 h-3" />
                  <span>{activeRoom.memberCount} members</span>
                </span>
              </div>
              {activeRoom.description && (
                <p className="text-xs text-slate-400 truncate max-w-lg">
                  {activeRoom.description}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Real-time Connection Indicator */}
        <div className="flex items-center space-x-2">
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              isConnected
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse'
            }`}
          >
            <Circle
              className={`w-2 h-2 fill-current ${
                isConnected ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span className="hidden sm:inline">
              {isConnected ? 'WebSocket Live' : 'Reconnecting...'}
            </span>
          </div>
        </div>
      </header>

      {/* Messages Feed */}
      <MessageList />

      {/* Message Input Box */}
      <MessageInput />
    </main>
  );
};
