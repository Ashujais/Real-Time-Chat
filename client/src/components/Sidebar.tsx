import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useSocket } from '../context/SocketContext';
import { CreateRoomModal } from './CreateRoomModal';
import { BrowseRoomsModal } from './BrowseRoomsModal';
import { NewDirectMessageModal } from './NewDirectMessageModal';
import {
  Hash,
  Lock,
  Plus,
  Compass,
  MessageSquarePlus,
  LogOut,
  X,
  MessagesSquare,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const { user, logout } = useAuth();
  const { rooms, activeRoomId, selectRoom } = useChat();
  const { onlineUsers } = useSocket();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBrowseModalOpen, setIsBrowseModalOpen] = useState(false);
  const [isNewDmModalOpen, setIsNewDmModalOpen] = useState(false);

  const groupRooms = rooms.filter((r) => r.type === 'GROUP');
  const directRooms = rooms.filter((r) => r.type === 'DIRECT');

  const handleRoomClick = (roomId: string) => {
    selectRoom(roomId);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-950 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Branding Header */}
        <div className="h-16 px-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <MessagesSquare className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-slate-100 text-base tracking-tight leading-none">
                PulseChat
              </h1>
              <span className="text-[10px] text-indigo-400 font-medium">Real-Time Chat</span>
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Room Lists */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* GROUP CHANNELS */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Channels ({groupRooms.length})
              </span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setIsBrowseModalOpen(true)}
                  className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition cursor-pointer"
                  title="Browse public channels"
                >
                  <Compass className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition cursor-pointer"
                  title="Create new channel"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-0.5">
              {groupRooms.map((room) => {
                const isActive = room.id === activeRoomId;
                const hasUnread = room.unreadCount > 0;

                return (
                  <button
                    key={room.id}
                    onClick={() => handleRoomClick(room.id)}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition group cursor-pointer ${
                      isActive
                        ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      {room.isPrivate ? (
                        <Lock className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      ) : (
                        <Hash className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                      )}
                      <span className="text-sm truncate">{room.name}</span>
                    </div>

                    {/* Unread count badge */}
                    {hasUnread && (
                      <span className="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                        {room.unreadCount > 99 ? '99+' : room.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DIRECT MESSAGES */}
          <div>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Direct Messages ({directRooms.length})
              </span>
              <button
                onClick={() => setIsNewDmModalOpen(true)}
                className="p-1 text-slate-400 hover:text-indigo-400 hover:bg-slate-900 rounded transition cursor-pointer"
                title="Start new direct message"
              >
                <MessageSquarePlus className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-0.5">
              {directRooms.length === 0 ? (
                <div className="px-2 py-3 text-xs text-slate-400 text-center">
                  No direct messages yet.
                  <button
                    onClick={() => setIsNewDmModalOpen(true)}
                    className="block text-indigo-400 hover:underline mx-auto mt-1 cursor-pointer"
                  >
                    Start a chat
                  </button>
                </div>
              ) : (
                directRooms.map((room) => {
                  const isActive = room.id === activeRoomId;
                  const hasUnread = room.unreadCount > 0;
                  const otherUser = room.otherUser;
                  const isOnline = otherUser ? onlineUsers.has(otherUser.id) : false;

                  return (
                    <button
                      key={room.id}
                      onClick={() => handleRoomClick(room.id)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition group cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-300 font-medium'
                          : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-2.5 truncate">
                        {/* Avatar with online dot */}
                        <div className="relative flex-shrink-0">
                          {otherUser?.avatarUrl ? (
                            <img
                              src={otherUser.avatarUrl}
                              alt={room.displayName}
                              className="w-6 h-6 rounded-full object-cover border border-slate-700 bg-slate-800"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] text-slate-300 font-semibold">
                              {room.displayName.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950 ${
                              isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                            }`}
                            title={isOnline ? 'Online' : 'Offline'}
                          />
                        </div>

                        <span className="text-sm truncate">{room.displayName}</span>
                      </div>

                      {/* Unread count badge */}
                      {hasUnread && (
                        <span className="bg-indigo-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                          {room.unreadCount > 99 ? '99+' : room.unreadCount}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Current User Profile Footer */}
        {user && (
          <div className="p-3 border-t border-slate-800/80 bg-slate-900/50 flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="relative flex-shrink-0">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.displayName}
                    className="w-8 h-8 rounded-full object-cover border border-slate-700 bg-slate-800"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {user.displayName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Current user is always online */}
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-950" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.displayName}</p>
                <p className="text-[11px] text-slate-400 truncate">@{user.username}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Modals */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
      <BrowseRoomsModal
        isOpen={isBrowseModalOpen}
        onClose={() => setIsBrowseModalOpen(false)}
      />
      <NewDirectMessageModal
        isOpen={isNewDmModalOpen}
        onClose={() => setIsNewDmModalOpen(false)}
      />
    </>
  );
};
