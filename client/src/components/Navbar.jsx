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
      <nav className="glass-nav rounded-2xl px-4 py-3 sm:px-6 flex items-center justify-between shadow-sm border border-[#D5E9DF] bg-white/95">
        {/* Logo and Brand */}
        <div
          onClick={() => handleNav('home')}
          className="flex items-center gap-3 cursor-pointer group select-none"
        >
          <div className="w-10 h-10 rounded-xl bg-[#16866A] p-[2px] shadow-md shadow-[#16866A]/20 group-hover:scale-105 transition-transform flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white group-hover:rotate-12 transition-transform" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight text-[#164E41]">
              SkillBridge
            </span>
            <p className="text-[10px] text-[#527568] font-medium hidden sm:block">
              Share Skills. Learn Together.
            </p>
          </div>
        </div>

        {/* Desktop Navigation Links — ONLY Home and Explore Skills */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => handleNav('home')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentView === 'home'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] shadow-xs font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <Home className="w-4 h-4 text-[#16866A]" />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNav('explore')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentView === 'explore'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] shadow-xs font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <Compass className="w-4 h-4 text-[#16866A]" />
            <span>Explore Skills</span>
          </button>

          <button
            onClick={() => handleNav('chat')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer ${
              currentView === 'chat'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] shadow-xs font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#16866A]" />
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
                className="relative p-2.5 rounded-xl bg-[#F1FAF5] hover:bg-[#E4F6EE] text-[#164E41] transition-colors border border-[#D5E9DF] cursor-pointer"
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
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] transition-colors cursor-pointer"
                >
                  <img
                    src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.bridgeAccount || user.name)}`}
                    alt={user.name}
                    className="w-7 h-7 rounded-lg object-cover border border-[#D5E9DF]"
                  />
                  <span className="text-xs font-semibold text-[#164E41] max-w-[100px] truncate hidden sm:inline">
                    {user.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-[#527568] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-2 shadow-xl border border-[#D5E9DF] animate-in fade-in zoom-in-95 duration-150 z-50">
                    <div className="px-3 py-2 border-b border-[#D5E9DF] mb-1">
                      <p className="text-xs font-bold text-[#164E41] truncate">{user.name}</p>
                      <p className="text-[11px] text-[#16866A] font-mono truncate">@{user.username || user.bridgeAccount}</p>
                      <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        user.profileCompleted
                          ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF]'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {user.profileCompleted ? 'Profile Complete' : 'Profile Incomplete'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleNav('profile')}
                      className="w-full px-3 py-2 text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <User className="w-4 h-4 text-[#16866A]" />
                      <span>Update Profile</span>
                    </button>

                    <button
                      onClick={() => handleNav('chat')}
                      className="w-full px-3 py-2 text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-[#16866A]" />
                      <span>Messages & Chat</span>
                    </button>

                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        onOpenNotifications();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center justify-between transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Bell className="w-4 h-4 text-[#16866A]" />
                        <span>Notifications</span>
                      </div>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white">
                          {unreadCount}
                        </span>
                      )}
                    </button>

                    <div className="border-t border-[#D5E9DF] my-1" />

                    <button
                      onClick={() => {
                        logout();
                        setDropdownOpen(false);
                        setCurrentView('home');
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer"
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
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#164E41] hover:text-[#16866A] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => openAuth('register')}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 transition-all cursor-pointer"
              >
                Register
              </button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-2 bg-white rounded-2xl p-4 shadow-xl border border-[#D5E9DF] space-y-2 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => handleNav('home')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
              currentView === 'home'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <Home className="w-4 h-4 text-[#16866A]" />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNav('explore')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
              currentView === 'explore'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <Compass className="w-4 h-4 text-[#16866A]" />
            <span>Explore Skills</span>
          </button>

          <button
            onClick={() => handleNav('chat')}
            className={`w-full px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-3 transition-colors cursor-pointer ${
              currentView === 'chat'
                ? 'bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] font-bold'
                : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5]'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-[#16866A]" />
            <span>Chat</span>
          </button>

          {isAuthenticated ? (
            <div className="pt-2 border-t border-[#D5E9DF] space-y-1">
              <button
                onClick={() => handleNav('profile')}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] flex items-center gap-3 cursor-pointer"
              >
                <User className="w-4 h-4 text-[#16866A]" />
                <span>Update Profile</span>
              </button>

              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenNotifications();
                }}
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] flex items-center justify-between cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-4 h-4 text-[#16866A]" />
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
                className="w-full px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 flex items-center gap-3 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t border-[#D5E9DF] flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('login');
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-center text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openAuth('register');
                }}
                className="flex-1 py-2.5 rounded-xl text-xs font-bold text-center text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 cursor-pointer"
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
