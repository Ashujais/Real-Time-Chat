import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ChatProvider } from './context/ChatContext';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { ConnectionBanner } from './components/ConnectionBanner';
import { Loader2 } from 'lucide-react';

const MainLayout: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
        <span className="text-sm font-medium">Connecting to PulseChat...</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  return (
    <SocketProvider>
      <ChatProvider>
        <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-950 select-none">
          {/* Top Offline / Reconnecting Banner */}
          <ConnectionBanner />

          {/* Main Chat Interface */}
          <div className="flex-1 flex overflow-hidden">
            <Sidebar
              isMobileOpen={isMobileMenuOpen}
              onCloseMobile={() => setIsMobileMenuOpen(false)}
            />
            <ChatArea onOpenMobileSidebar={() => setIsMobileMenuOpen(true)} />
          </div>
        </div>
      </ChatProvider>
    </SocketProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
