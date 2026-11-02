import React, { useState, useEffect } from 'react';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { X, Hash, Users, Compass, Loader2 } from 'lucide-react';

interface BrowseRoomsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PublicRoom {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt: string;
}

export const BrowseRoomsModal: React.FC<BrowseRoomsModalProps> = ({ isOpen, onClose }) => {
  const { joinRoom } = useChat();
  const { token } = useAuth();

  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !token) return;

    const fetchPublicRooms = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/rooms/public', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setPublicRooms(data.rooms || []);
        }
      } catch (err) {
        console.error('Failed to fetch public rooms:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPublicRooms();
  }, [isOpen, token]);

  if (!isOpen) return null;

  const handleJoin = async (roomId: string) => {
    setJoiningId(roomId);
    try {
      await joinRoom(roomId);
      onClose();
    } catch (err) {
      console.error('Failed to join:', err);
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">Browse Public Channels</h3>
              <p className="text-xs text-slate-400">Discover and join channels in your workspace</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List of Public Channels */}
        <div className="p-6 overflow-y-auto space-y-3 flex-1">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
              <span className="text-sm">Finding available channels...</span>
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <p>You have joined all public channels!</p>
              <p className="text-xs text-slate-400 mt-1">Or create a new channel using the "+ Create" button.</p>
            </div>
          ) : (
            publicRooms.map((room) => (
              <div
                key={room.id}
                className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl flex items-center justify-between hover:border-slate-600 transition"
              >
                <div className="space-y-1 pr-4">
                  <div className="flex items-center space-x-2">
                    <Hash className="w-4 h-4 text-indigo-400" />
                    <span className="font-semibold text-slate-100 text-sm">{room.name}</span>
                    <span className="flex items-center space-x-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                      <Users className="w-3 h-3" />
                      <span>{room.memberCount} members</span>
                    </span>
                  </div>
                  {room.description && (
                    <p className="text-xs text-slate-400 line-clamp-1">{room.description}</p>
                  )}
                </div>

                <button
                  onClick={() => handleJoin(room.id)}
                  disabled={joiningId === room.id}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg shadow transition flex items-center space-x-1.5 cursor-pointer flex-shrink-0"
                >
                  {joiningId === room.id && <Loader2 className="w-3 h-3 animate-spin" />}
                  <span>Join</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
