import React, { useState } from 'react';
import { useChat } from '../context/ChatContext';
import { X, Hash, Lock, Globe, Loader2 } from 'lucide-react';

interface CreateRoomModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({ isOpen, onClose }) => {
  const { createRoom } = useChat();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmed = name.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed.length < 2) {
      setError('Room name must be at least 2 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      await createRoom(trimmed, description, isPrivate);
      setName('');
      setDescription('');
      setIsPrivate(false);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create room.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">Create Channel</h3>
              <p className="text-xs text-slate-400">Channels are where members chat by topic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-900/50 border border-red-700/60 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Channel Name
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">
                #
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="new-channel"
                disabled={isSubmitting}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-7 pr-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              />
            </div>
            <p className="text-[11px] text-slate-400 mt-1">Letters, numbers, hyphens and underscores.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel about?"
              disabled={isSubmitting}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
            />
          </div>

          {/* Public / Private Toggle */}
          <div className="pt-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Privacy Setting
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsPrivate(false)}
                className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition cursor-pointer ${
                  !isPrivate
                    ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-medium text-xs">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Public</span>
                </div>
                <span className="text-[11px] text-slate-400">Anyone in workspace can join and read.</span>
              </button>

              <button
                type="button"
                onClick={() => setIsPrivate(true)}
                className={`p-3 rounded-xl border text-left flex flex-col space-y-1 transition cursor-pointer ${
                  isPrivate
                    ? 'border-indigo-500 bg-indigo-500/10 text-slate-100'
                    : 'border-slate-800 bg-slate-800/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-1.5 font-medium text-xs">
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Private</span>
                </div>
                <span className="text-[11px] text-slate-400">Only invited members can access.</span>
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm text-slate-300 hover:text-white rounded-lg transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow-md transition flex items-center space-x-2 cursor-pointer"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Create Channel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
