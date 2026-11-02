import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import type { User } from '../types';
import { X, Search, MessageSquarePlus, Loader2 } from 'lucide-react';

interface NewDirectMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewDirectMessageModal: React.FC<NewDirectMessageModalProps> = ({ isOpen, onClose }) => {
  const { startDirectMessage } = useChat();
  const { token } = useAuth();
  const { onlineUsers } = useSocket();

  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchUsers = async () => {
      setIsLoading(true);
      try {
        const query = searchTerm.trim() ? `?search=${encodeURIComponent(searchTerm.trim())}` : '';
        const res = await fetch(`/api/auth/users${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.users || []);
        }
      } catch (err) {
        console.error('Failed to search users:', err);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchUsers, 200);
    return () => clearTimeout(timer);
  }, [isOpen, searchTerm, token]);

  if (!isOpen) return null;

  const handleSelectUser = async (targetUserId: string) => {
    setIsStarting(true);
    try {
      await startDirectMessage(targetUserId);
      onClose();
    } catch (err) {
      console.error('Failed to start DM:', err);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <MessageSquarePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">New Direct Message</h3>
              <p className="text-xs text-slate-400">Start a private 1-on-1 conversation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name or username..."
              autoFocus
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>
        </div>

        {/* Users list */}
        <div className="p-4 overflow-y-auto space-y-1.5 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-xs">Searching users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <p>No matching users found.</p>
            </div>
          ) : (
            users.map((u) => {
              const isOnline = onlineUsers.has(u.id);

              return (
                <button
                  key={u.id}
                  onClick={() => handleSelectUser(u.id)}
                  disabled={isStarting}
                  className="w-full p-2.5 rounded-xl flex items-center justify-between hover:bg-slate-800 transition group text-left cursor-pointer"
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {u.avatarUrl ? (
                        <img
                          src={u.avatarUrl}
                          alt={u.displayName}
                          className="w-10 h-10 rounded-full object-cover border border-slate-700 bg-slate-800"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-sm font-semibold text-indigo-300">
                          {u.displayName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      {/* Real-time online presence dot */}
                      <span
                        className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${
                          isOnline ? 'bg-emerald-500' : 'bg-slate-500'
                        }`}
                        title={isOnline ? 'Online' : 'Offline'}
                      />
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-100 text-sm group-hover:text-indigo-300 transition">
                        {u.displayName}
                      </h4>
                      <p className="text-xs text-slate-400">@{u.username}</p>
                    </div>
                  </div>

                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      isOnline
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
