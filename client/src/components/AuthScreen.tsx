import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { MessagesSquare, Lock, User, Mail, Sparkles, ArrowRight, Loader2 } from 'lucide-react';

export const AuthScreen: React.FC = () => {
  const { login, register, quickLogin, error, clearError } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [demoLoadingUser, setDemoLoadingUser] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await login(identifier, password);
      } else {
        await register({ username, email, password, displayName });
      }
    } catch {
      // Error handled in AuthContext
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickDemo = async (demoUsername: string) => {
    setDemoLoadingUser(demoUsername);
    try {
      await quickLogin(demoUsername);
    } catch {
      // Error handled
    } finally {
      setDemoLoadingUser(null);
    }
  };

  const switchMode = (newMode: 'login' | 'register') => {
    clearError();
    setMode(newMode);
  };

  const demoUsers = [
    {
      name: 'Alice Walker',
      username: 'alice',
      role: 'Senior Engineer',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Bob Vance',
      username: 'bob',
      role: 'Product Manager',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Charlie Brown',
      username: 'charlie',
      role: 'UI Designer',
      avatar: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Diana Prince',
      username: 'diana',
      role: 'DevOps Lead',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 shadow-xl shadow-indigo-500/25">
            <MessagesSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">PulseChat</h1>
          <p className="text-sm text-slate-400">
            Real-time chat with group channels, DMs, online status & instant sync
          </p>
        </div>

        {/* 1-Click Demo Accounts Card */}
        <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center space-x-1.5 text-xs font-semibold text-indigo-400 uppercase tracking-wider mb-2.5">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>1-Click Demo Accounts (Instant Test)</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            Open another incognito/browser window and click another user to test real-time chat, typing indicators, and unread counts immediately!
          </p>
          <div className="grid grid-cols-2 gap-2">
            {demoUsers.map((u) => (
              <button
                key={u.username}
                onClick={() => handleQuickDemo(u.username)}
                disabled={demoLoadingUser !== null || isSubmitting}
                className="p-2 rounded-xl bg-slate-800/80 hover:bg-indigo-600/20 border border-slate-700/80 hover:border-indigo-500/40 text-left transition flex items-center space-x-2 group cursor-pointer disabled:opacity-50"
              >
                <img
                  src={u.avatar}
                  alt={u.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-700"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                    {u.name.split(' ')[0]}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{u.role}</p>
                </div>
                {demoLoadingUser === u.username && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
          {/* Tab switchers */}
          <div className="grid grid-cols-2 p-1 bg-slate-950 rounded-xl mb-6">
            <button
              onClick={() => switchMode('login')}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('register')}
              className={`py-2 text-xs font-semibold rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error banner */}
          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-700/60 text-red-200 text-xs rounded-lg">
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <span className="text-slate-400 text-sm absolute left-3 top-1/2 -translate-y-1/2">
                      @
                    </span>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="johndoe"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="john@example.com"
                      required
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                    />
                  </div>
                </div>
              </>
            )}

            {mode === 'login' && (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username or Email
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="Enter username or email"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'At least 6 characters' : 'Enter password'}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center space-x-2 cursor-pointer mt-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
