import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';

export const ConnectionBanner: React.FC = () => {
  const { isConnected, isReconnecting, manualReconnect } = useSocket();

  if (isConnected) return null;

  return (
    <div className="bg-amber-600/90 text-white px-4 py-2 flex items-center justify-between text-sm shadow-md transition-all">
      <div className="flex items-center space-x-2">
        <WifiOff className="w-4 h-4 animate-pulse text-amber-200" />
        <span>
          {isReconnecting
            ? 'Connection lost. Reconnecting to chat server...'
            : 'Disconnected from chat server.'}
        </span>
      </div>
      <button
        onClick={manualReconnect}
        className="flex items-center space-x-1 bg-amber-700 hover:bg-amber-800 text-xs px-2.5 py-1 rounded font-medium transition cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Retry Now</span>
      </button>
    </div>
  );
};
