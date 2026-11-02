import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { Room, Message, TypingEvent } from '../types';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';

interface ChatContextType {
  rooms: Room[];
  activeRoomId: string | null;
  activeRoom: Room | null;
  messages: Message[];
  hasMoreHistory: boolean;
  isLoadingMessages: boolean;
  isLoadingOlder: boolean;
  typingUsers: { id: string; username: string; displayName: string }[];
  selectRoom: (roomId: string) => void;
  loadOlderMessages: () => Promise<void>;
  sendMessage: (content: string, imageUrl?: string | null) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  startTyping: () => void;
  stopTyping: () => void;
  createRoom: (name: string, description?: string, isPrivate?: boolean) => Promise<Room>;
  startDirectMessage: (recipientId: string) => Promise<Room>;
  joinRoom: (roomId: string) => Promise<void>;
  refreshRooms: () => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [roomMessages, setRoomMessages] = useState<Record<string, Message[]>>({});
  const [hasMoreMap, setHasMoreMap] = useState<Record<string, boolean>>({});
  const [cursorMap, setCursorMap] = useState<Record<string, string | null>>({});
  const [isLoadingMessages, setIsLoadingMessages] = useState<boolean>(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState<boolean>(false);
  const [typingMap, setTypingMap] = useState<Record<string, TypingEvent['user'][]>>({});

  // Typing timer reference for current user
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef<boolean>(false);

  // Keep a ref to activeRoomId for socket callbacks
  const activeRoomIdRef = useRef<string | null>(activeRoomId);
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // Fetch user's rooms
  const refreshRooms = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
      }
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      refreshRooms();
    } else {
      setRooms([]);
      setActiveRoomId(null);
      setRoomMessages({});
    }
  }, [token, refreshRooms]);

  // Initial room selection (select first room if none selected)
  useEffect(() => {
    if (rooms.length > 0 && !activeRoomId) {
      selectRoom(rooms[0].id);
    }
  }, [rooms, activeRoomId]);

  // Fetch initial messages when selecting a room
  const fetchInitialMessages = useCallback(
    async (roomId: string) => {
      if (!token) return;
      setIsLoadingMessages(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/messages?limit=30`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setRoomMessages((prev) => ({
            ...prev,
            [roomId]: data.messages || [],
          }));
          setHasMoreMap((prev) => ({
            ...prev,
            [roomId]: !!data.hasMore,
          }));
          setCursorMap((prev) => ({
            ...prev,
            [roomId]: data.nextCursor || null,
          }));
        }
      } catch (err) {
        console.error('Failed to fetch messages for room:', err);
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [token]
  );

  // Select a room & mark as read
  const selectRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);

      // Join socket channel explicitly if connected
      if (socket && isConnected) {
        socket.emit('join_room_socket', { roomId });
        socket.emit('mark_read', { roomId });
      }

      // Mark as read in local rooms list
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
      );

      // Mark read via HTTP
      if (token) {
        fetch(`/api/rooms/${roomId}/read`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }

      // Fetch messages if not cached yet
      if (!roomMessages[roomId]) {
        fetchInitialMessages(roomId);
      }
    },
    [socket, isConnected, token, roomMessages, fetchInitialMessages]
  );

  // Load older messages (infinite scroll up)
  const loadOlderMessages = useCallback(async () => {
    if (!activeRoomId || !token || isLoadingOlder) return;
    const hasMore = hasMoreMap[activeRoomId];
    const cursor = cursorMap[activeRoomId];

    if (!hasMore || !cursor) return;

    setIsLoadingOlder(true);
    try {
      const res = await fetch(`/api/rooms/${activeRoomId}/messages?limit=30&cursor=${cursor}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const olderMessages: Message[] = data.messages || [];

        setRoomMessages((prev) => {
          const current = prev[activeRoomId] || [];
          // Deduplicate by message ID
          const existingIds = new Set(current.map((m) => m.id));
          const filteredOlder = olderMessages.filter((m) => !existingIds.has(m.id));
          return {
            ...prev,
            [activeRoomId]: [...filteredOlder, ...current],
          };
        });

        setHasMoreMap((prev) => ({
          ...prev,
          [activeRoomId]: !!data.hasMore,
        }));
        setCursorMap((prev) => ({
          ...prev,
          [activeRoomId]: data.nextCursor || null,
        }));
      }
    } catch (err) {
      console.error('Failed to load older messages:', err);
    } finally {
      setIsLoadingOlder(false);
    }
  }, [activeRoomId, token, isLoadingOlder, hasMoreMap, cursorMap]);

  // Send message with optimistic update & server confirmation
  const sendMessage = useCallback(
    async (content: string, imageUrl?: string | null) => {
      if (!activeRoomId || !user) return;
      const clientTempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // Create optimistic message
      const optimisticMessage: Message = {
        id: clientTempId,
        roomId: activeRoomId,
        senderId: user.id,
        content: content.trim(),
        imageUrl: imageUrl || null,
        isEdited: false,
        isDeleted: false,
        clientTempId,
        createdAt: new Date().toISOString(),
        sender: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      };

      // Optimistically append
      setRoomMessages((prev) => ({
        ...prev,
        [activeRoomId]: [...(prev[activeRoomId] || []), optimisticMessage],
      }));

      // Stop typing immediately when sending
      if (isTypingRef.current && socket) {
        socket.emit('typing_stop', { roomId: activeRoomId });
        isTypingRef.current = false;
        if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      }

      // Send via WebSocket if connected
      if (socket && isConnected) {
        socket.emit(
          'send_message',
          {
            roomId: activeRoomId,
            content: content.trim(),
            imageUrl: imageUrl || null,
            clientTempId,
          },
          (response: any) => {
            if (response?.success && response.message) {
              const confirmed: Message = response.message;
              setRoomMessages((prev) => {
                const current = prev[activeRoomId] || [];
                return {
                  ...prev,
                  [activeRoomId]: current.map((m) =>
                    m.clientTempId === clientTempId || m.id === clientTempId ? confirmed : m
                  ),
                };
              });
            } else if (response?.error) {
              console.error('Failed to send message via socket:', response.error);
              alert(response.error);
            }
          }
        );
      } else {
        // Fallback or offline send
        console.warn('Socket not connected while sending message.');
      }
    },
    [activeRoomId, user, socket, isConnected]
  );

  // Edit message
  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!token || !activeRoomId) return;
      try {
        const res = await fetch(`/api/messages/${messageId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ content: newContent }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to edit message');
        }

        // Locally update
        setRoomMessages((prev) => {
          const current = prev[activeRoomId] || [];
          return {
            ...prev,
            [activeRoomId]: current.map((m) => (m.id === messageId ? data.message : m)),
          };
        });
      } catch (err: any) {
        console.error('Edit error:', err);
        alert(err.message || 'Failed to edit message');
      }
    },
    [token, activeRoomId]
  );

  // Delete message
  const deleteMessage = useCallback(
    async (messageId: string) => {
      if (!token || !activeRoomId) return;
      try {
        const res = await fetch(`/api/messages/${messageId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to delete message');
        }

        // Locally update
        setRoomMessages((prev) => {
          const current = prev[activeRoomId] || [];
          return {
            ...prev,
            [activeRoomId]: current.map((m) =>
              m.id === messageId
                ? { ...m, content: 'This message was deleted', imageUrl: null, isDeleted: true }
                : m
            ),
          };
        });
      } catch (err: any) {
        console.error('Delete error:', err);
        alert(err.message || 'Failed to delete message');
      }
    },
    [token, activeRoomId]
  );

  // Typing debounce indicators
  const startTyping = useCallback(() => {
    if (!socket || !activeRoomId) return;

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit('typing_start', { roomId: activeRoomId });
    }

    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        socket.emit('typing_stop', { roomId: activeRoomId });
        isTypingRef.current = false;
      }
    }, 2000);
  }, [socket, activeRoomId]);

  const stopTyping = useCallback(() => {
    if (!socket || !activeRoomId || !isTypingRef.current) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit('typing_stop', { roomId: activeRoomId });
    isTypingRef.current = false;
  }, [socket, activeRoomId]);

  // Create group room
  const createRoom = useCallback(
    async (name: string, description?: string, isPrivate?: boolean): Promise<Room> => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description, isPrivate }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create room');
      }

      const created = data.room;
      setRooms((prev) => [created, ...prev]);
      selectRoom(created.id);
      return created;
    },
    [token, selectRoom]
  );

  // Start Direct Message
  const startDirectMessage = useCallback(
    async (recipientId: string): Promise<Room> => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch('/api/rooms/direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ recipientId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to start direct message');
      }

      const room = data.room;
      setRooms((prev) => {
        const exists = prev.find((r) => r.id === room.id);
        if (exists) return prev;
        return [room, ...prev];
      });
      selectRoom(room.id);
      return room;
    },
    [token, selectRoom]
  );

  // Join public room
  const joinRoom = useCallback(
    async (roomId: string) => {
      if (!token) throw new Error('Not authenticated');
      const res = await fetch(`/api/rooms/${roomId}/join`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to join room');
      }

      await refreshRooms();
      selectRoom(roomId);
    },
    [token, refreshRooms, selectRoom]
  );

  // Handle Socket Events & Reconnection Sync
  useEffect(() => {
    if (!socket) return;

    // Listen for new messages
    const handleNewMessage = (msg: Message) => {
      const targetRoomId = msg.roomId;
      const isCurrentActive = targetRoomId === activeRoomIdRef.current;

      setRoomMessages((prev) => {
        const currentList = prev[targetRoomId] || [];
        // Prevent duplicate messages if already present
        const alreadyExists = currentList.some(
          (m) => m.id === msg.id || (msg.clientTempId && m.clientTempId === msg.clientTempId)
        );

        if (alreadyExists) {
          return {
            ...prev,
            [targetRoomId]: currentList.map((m) =>
              m.id === msg.id || (msg.clientTempId && m.clientTempId === msg.clientTempId) ? msg : m
            ),
          };
        }

        return {
          ...prev,
          [targetRoomId]: [...currentList, msg],
        };
      });

      // Update room preview & unread count
      setRooms((prev) => {
        return prev
          .map((r) => {
            if (r.id === targetRoomId) {
              const shouldIncrement = !isCurrentActive && msg.senderId !== user?.id;
              return {
                ...r,
                lastMessage: {
                  id: msg.id,
                  content: msg.isDeleted ? 'This message was deleted' : msg.content,
                  imageUrl: msg.imageUrl,
                  createdAt: msg.createdAt,
                  sender: msg.sender,
                },
                unreadCount: shouldIncrement ? r.unreadCount + 1 : 0,
                updatedAt: msg.createdAt,
              };
            }
            return r;
          })
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      });

      // If viewing this room, mark as read immediately
      if (isCurrentActive && msg.senderId !== user?.id) {
        socket.emit('mark_read', { roomId: targetRoomId });
      }
    };

    // Listen for edited messages
    const handleMessageEdited = (msg: Message) => {
      setRoomMessages((prev) => {
        const currentList = prev[msg.roomId] || [];
        return {
          ...prev,
          [msg.roomId]: currentList.map((m) => (m.id === msg.id ? msg : m)),
        };
      });
    };

    // Listen for deleted messages
    const handleMessageDeleted = ({ id, roomId }: { id: string; roomId: string }) => {
      setRoomMessages((prev) => {
        const currentList = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: currentList.map((m) =>
            m.id === id
              ? { ...m, content: 'This message was deleted', imageUrl: null, isDeleted: true }
              : m
          ),
        };
      });
    };

    // Listen for typing events
    const handleUserTyping = (event: TypingEvent) => {
      setTypingMap((prev) => {
        const current = prev[event.roomId] || [];
        if (current.some((u) => u.id === event.user.id)) return prev;
        return {
          ...prev,
          [event.roomId]: [...current, event.user],
        };
      });
    };

    const handleUserStopTyping = ({ roomId, userId }: { roomId: string; userId: string }) => {
      setTypingMap((prev) => {
        const current = prev[roomId] || [];
        return {
          ...prev,
          [roomId]: current.filter((u) => u.id !== userId),
        };
      });
    };

    // Multi-tab unread sync
    const handleRoomReadAck = ({ roomId }: { roomId: string }) => {
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unreadCount: 0 } : r))
      );
    };

    socket.on('new_message', handleNewMessage);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);
    socket.on('room_read_ack', handleRoomReadAck);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
      socket.off('room_read_ack', handleRoomReadAck);
    };
  }, [socket, user?.id]);

  // Sync missed messages upon reconnect (prevents losing messages during dropped connection)
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Collect rooms and their latest cached message timestamps
    const roomSyncList = rooms.map((r) => {
      const msgs = roomMessages[r.id];
      const latestMsg = msgs && msgs.length > 0 ? msgs[msgs.length - 1] : null;
      return {
        roomId: r.id,
        since: latestMsg ? latestMsg.createdAt : r.updatedAt,
      };
    });

    if (roomSyncList.length === 0) return;

    socket.emit('sync_missed', { roomSyncList }, (response: any) => {
      if (response?.success && response.missedMessages) {
        const missed: Record<string, Message[]> = response.missedMessages;

        setRoomMessages((prev) => {
          const next = { ...prev };
          for (const [rId, newMsgs] of Object.entries(missed)) {
            if (newMsgs.length > 0) {
              const current = next[rId] || [];
              const currentIds = new Set(current.map((m) => m.id));
              const deduplicated = newMsgs.filter((m) => !currentIds.has(m.id));
              next[rId] = [...current, ...deduplicated];
            }
          }
          return next;
        });

        // Refresh rooms to update unread counts accurately
        refreshRooms();
      }
    });
  }, [isConnected, socket, rooms.length]); // fires on reconnect when isConnected becomes true

  const activeRoom = rooms.find((r) => r.id === activeRoomId) || null;
  const currentMessages = activeRoomId ? roomMessages[activeRoomId] || [] : [];
  const hasMoreHistory = activeRoomId ? !!hasMoreMap[activeRoomId] : false;
  const currentTyping = activeRoomId ? typingMap[activeRoomId] || [] : [];

  return (
    <ChatContext.Provider
      value={{
        rooms,
        activeRoomId,
        activeRoom,
        messages: currentMessages,
        hasMoreHistory,
        isLoadingMessages,
        isLoadingOlder,
        typingUsers: currentTyping,
        selectRoom,
        loadOlderMessages,
        sendMessage,
        editMessage,
        deleteMessage,
        startTyping,
        stopTyping,
        createRoom,
        startDirectMessage,
        joinRoom,
        refreshRooms,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};
