import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  isReconnecting: boolean;
  onlineUsers: Set<string>;
  manualReconnect: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
      return;
    }

    // Initialize Socket.io connection with auth token
    const s = io({
      auth: { token },
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = s;
    setSocket(s);

    s.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);

      // Fetch currently online users list
      s.emit('get_online_users', (userIds: string[]) => {
        if (Array.isArray(userIds)) {
          setOnlineUsers(new Set(userIds));
        }
      });
    });

    s.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Disconnected by server explicitly (e.g. auth failed)
        s.connect();
      } else {
        setIsReconnecting(true);
      }
    });

    s.on('reconnect_attempt', () => {
      setIsReconnecting(true);
    });

    s.on('reconnect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      // Re-fetch online users on reconnect
      s.emit('get_online_users', (userIds: string[]) => {
        if (Array.isArray(userIds)) {
          setOnlineUsers(new Set(userIds));
        }
      });
    });

    s.on('user_presence', (data: { userId: string; status: 'online' | 'offline' }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        if (data.status === 'online') {
          next.add(data.userId);
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  const manualReconnect = () => {
    if (socketRef.current) {
      socketRef.current.connect();
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        isConnected,
        isReconnecting,
        onlineUsers,
        manualReconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
