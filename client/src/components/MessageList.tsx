import React, { useEffect, useRef, useState } from 'react';
import { useChat } from '../context/ChatContext';
import { MessageItem } from './MessageItem';
import { TypingIndicator } from './TypingIndicator';
import { ImageModal } from './ImageModal';
import { ArrowDown, Loader2, MessageSquare } from 'lucide-react';

export const MessageList: React.FC = () => {
  const {
    messages,
    activeRoom,
    hasMoreHistory,
    isLoadingMessages,
    isLoadingOlder,
    loadOlderMessages,
    typingUsers,
  } = useChat();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomSentinelRef = useRef<HTMLDivElement | null>(null);

  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState<boolean>(false);

  // Keep track of scroll height before loading older messages to preserve position
  const prevScrollHeightRef = useRef<number>(0);
  const isFetchingOlderRef = useRef<boolean>(false);

  // Check scroll position to determine if we should show "Scroll to bottom" button
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;

    // Detect if user scrolled near the top to load older messages
    if (el.scrollTop <= 60 && hasMoreHistory && !isLoadingOlder && !isFetchingOlderRef.current) {
      isFetchingOlderRef.current = true;
      prevScrollHeightRef.current = el.scrollHeight;
      loadOlderMessages().finally(() => {
        isFetchingOlderRef.current = false;
      });
    }

    // Detect if user is scrolled away from bottom
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceFromBottom > 150);
  };

  // Adjust scroll position after older messages are prepended
  useEffect(() => {
    const el = containerRef.current;
    if (el && prevScrollHeightRef.current > 0) {
      const newScrollHeight = el.scrollHeight;
      const heightDifference = newScrollHeight - prevScrollHeightRef.current;
      el.scrollTop += heightDifference;
      prevScrollHeightRef.current = 0;
    }
  }, [messages.length]);

  // Scroll to bottom on initial load or when user sends/receives a message and was near bottom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    // Auto-scroll if near bottom or if this is the initial load of messages
    if (distanceFromBottom < 160 || prevScrollHeightRef.current === 0) {
      bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUsers.length]);

  const scrollToBottom = () => {
    bottomSentinelRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  if (isLoadingMessages && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">Loading messages...</span>
      </div>
    );
  }

  return (
    <div className="relative flex-1 flex flex-col overflow-hidden bg-slate-900/60">
      {/* Scrollable message container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-2 md:px-6 py-4 space-y-1"
      >
        {/* Top Pagination Sentinel & Status */}
        <div className="py-2 text-center">
          {isLoadingOlder ? (
            <div className="flex items-center justify-center space-x-2 text-xs text-indigo-300 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Loading older messages...</span>
            </div>
          ) : hasMoreHistory ? (
            <button
              onClick={() => {
                const el = containerRef.current;
                if (el) prevScrollHeightRef.current = el.scrollHeight;
                loadOlderMessages();
              }}
              className="text-xs text-slate-400 hover:text-indigo-400 py-1 px-3 rounded-full hover:bg-slate-800 transition cursor-pointer"
            >
              ↑ Scroll up or click to load older messages
            </button>
          ) : (
            <div className="py-6 flex flex-col items-center text-slate-400 text-xs border-b border-slate-800/80 mb-4">
              <div className="w-12 h-12 rounded-full bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-2 text-indigo-400">
                <MessageSquare className="w-6 h-6" />
              </div>
              <span className="font-semibold text-slate-300 text-sm">
                This is the start of the #{activeRoom?.displayName || 'room'} conversation
              </span>
              <span className="text-slate-400 mt-0.5">
                {activeRoom?.type === 'DIRECT'
                  ? 'Direct messaging history begins here.'
                  : activeRoom?.description || 'No older messages.'}
              </span>
            </div>
          )}
        </div>

        {/* Messages List */}
        {messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            onImageClick={(url) => setSelectedImage(url)}
          />
        ))}

        {/* Typing indicator at bottom of messages */}
        <TypingIndicator users={typingUsers} />

        {/* Bottom anchor for scrolling */}
        <div ref={bottomSentinelRef} className="h-2" />
      </div>

      {/* Floating "Scroll to bottom" button */}
      {showScrollBottom && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-full shadow-lg border border-indigo-400/30 flex items-center gap-1.5 text-xs font-medium transition cursor-pointer hover:scale-105 active:scale-95 z-20"
        >
          <ArrowDown className="w-4 h-4" />
          <span>New messages</span>
        </button>
      )}

      {/* Fullscreen image modal */}
      <ImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
};
