import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  Compass,
  Home,
  MessageSquare,
  Bell,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ currentView, setCurrentView, onOpenNotifications, unreadCount = 0 }) {
  const { user, isAuthenticated, logout, openAuth } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNav = (viewId) => {
    setCurrentView(viewId);
    setMobileMenuOpen(false);
    setDropdownOpen(false);
  };

  return (
    <header className="sticky top-4 z-40 px-4 max-w-7xl mx-auto w-full transition-all duration-300">
      <nav className="glass-nav rounded-2xl px-4 py-3 sm:px-6 flex items-center justify-between shadow-xl border border-white/15">
        {/* Logo and Brand */}
        <div
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#7657ff] to-[#39d5f6] p-[2px] shadow-lg shadow-[#7657ff]/25 group-hover:scale-105 transition-transform">
            <div className="w-full h-full bg-[#0b1020] rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#39d5f6] group-hover:rotate-12 transition-transform" />
            </div>
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-[#b7a4ff] to-[#39d5f6] bg-clip-text text-transparent">
              SkillBridge
            </span>
            <p className="text-[10px] text-slate-400 font-medium hidden sm:block">
              Share Skills. Learn Together.
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links — ONLY Home and Explore Skills */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => handleNav('home')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              currentView === 'home'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4 text-[#39d5f6]" />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNav('explore')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              currentView === 'explore'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-4 h-4 text-[#39d5f6]" />
            <span>Explore Skills</span>
          </button>

          <button
            onClick={() => handleNav('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
              currentView === 'chat'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40 shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#39d5f6]" />
            <span>Chat</span>
          </button>
        </div>

        {/* Right Section: Notification & User Menu / Sign In */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Notification Icon Button with Badge */}
              <button
                onClick={onOpenNotifications}
                className="relative p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors border border-white/10"
                aria-label="Notifications"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse leading-none shadow-sm">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Compact Profile Menu Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-colors"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.bridgeAccount || user.name)}`}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-[#7657ff]/40"
                  />
                  <span className="text-xs font-semibold text-white max-w-[100px] truncate hidden sm:inline">
                    {user.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl glass-panel p-2 shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="px-3 py-2 border-b border-white/10 mb-1">
                      <p className="text-xs font-bold text-white truncate">{user.name}</p>
                      <p className="text-[11px] text-[#39d5f6] font-mono truncate">@{user.username || user.bridgeAccount}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        user.profileCompleted
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}>
                        {user.profileCompleted ? 'Profile Complete' : 'Profile Incomplete'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleNav('profile')}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <User className="w-4 h-4 text-[#7657ff]" />
                      <span>Update Profile</span>
                    </button>

                    <button
                      onClick={() => handleNav('chat')}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4 text-[#39d5f6]" />
                      <span>Messages & Chat</span>
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenNotifications();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl flex items-center justify-between transition-colors"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bell className="w-4 h-4 text-[#39d5f6]" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <div className="border-t border-white/10 my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                        setCurrentView('home');
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl flex items-center gap-2.5 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth('login')}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md shadow-[#7657ff]/20 transition-all"
              >
                Register
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-slate-300 hover:text-white bg-white/5 border border-white/10"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 glass-panel rounded-2xl p-4 shadow-2xl border border-white/15 space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => handleNav('home')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors ${
              currentView === 'home'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Home className="w-4 h-4 text-[#39d5f6]" />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNav('explore')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors ${
              currentView === 'explore'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <Compass className="w-4 h-4 text-[#39d5f6]" />
            <span>Explore Skills</span>
          </button>

          <button
            onClick={() => handleNav('chat')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors ${
              currentView === 'chat'
                ? 'bg-[#7657ff]/25 text-white border border-[#7657ff]/40'
                : 'text-slate-300 hover:text-white hover:bg-white/5'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#39d5f6]" />
            <span>Chat</span>
          </button>

          {isAuthenticated ? (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <button
                onClick={() => handleNav('profile')}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 flex items-center gap-3"
              >
                <User className="w-4 h-4 text-[#7657ff]" />
                <span>Update Profile</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenNotifications();
                }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-[#39d5f6]" />
                  <span>Notifications</span>
                </div>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500 text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  logout();
                  setMobileMenuOpen(false);
                  setCurrentView('home');
                }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 flex items-center gap-3"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-white/10 flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('login');
                }}
                className="flex-1 py-2 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 border border-white/10"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('register');
                }}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6]"
              >
                Register
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
