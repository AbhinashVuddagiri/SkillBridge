import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { api } from './services/api';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LiquidBackground from './components/LiquidBackground';
import AuthModal from './components/AuthModal';
import NotificationDrawer from './components/NotificationDrawer';

// Pages
import LandingPage from './pages/LandingPage';
import ExploreSkillsPage from './pages/ExploreSkillsPage';
import ProfilePage from './pages/ProfilePage';
import ChatPage from './pages/ChatPage';

export default function App() {
  const { user, isAuthenticated, activeChatConnectionId, setActiveChatConnectionId } = useAuth();
  // Parse hash route helper (e.g., #/chat?connectionId=123)
  const parseLocationHash = () => {
    const rawHash = window.location.hash.replace(/^#\/?/, '');
    const [route, queryString] = rawHash.split('?');
    const params = new URLSearchParams(queryString || '');
    const validViews = ['home', 'explore', 'profile', 'chat'];
    const view = validViews.includes(route) ? route : 'home';
    const connId = params.get('connectionId') || null;
    return { view, connId };
  };

  const initialLoc = parseLocationHash();
  const [currentView, setCurrentViewState] = useState(initialLoc.view);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Poll notifications occasionally
  const fetchNotifications = async () => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    try {
      const res = await api.getNotifications();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Open notifications panel and persist viewed read status to Supabase
  const handleOpenNotifications = async () => {
    setNotifOpen(true);
    if (unreadCount > 0 || notifications.some(n => !n.read)) {
      // Optimistic update for instant badge clearing
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      try {
        const res = await api.markAllNotificationsRead();
        if (res && res.notifications) {
          setNotifications(res.notifications);
          setUnreadCount(res.unreadCount ?? 0);
        } else {
          await fetchNotifications();
        }
      } catch (err) {
        console.error('Error marking notifications as read on open:', err);
        fetchNotifications();
      }
    }
  };

  // Navigate with browser history support
  const navigateTo = (view, connId = null, push = true) => {
    let hashStr = `#/${view}`;
    if (view === 'chat' && (connId || activeChatConnectionId)) {
      const idToUse = connId || activeChatConnectionId;
      hashStr += `?connectionId=${encodeURIComponent(idToUse)}`;
    }
    if (push) {
      if (window.location.hash !== hashStr) {
        window.history.pushState({ view, connId }, '', hashStr);
      }
    } else {
      window.history.replaceState({ view, connId }, '', hashStr);
    }
    setCurrentViewState(view);
    if (connId !== undefined && connId !== null) {
      setActiveChatConnectionId(connId);
    }
  };

  const setCurrentView = (view) => {
    navigateTo(view, null, true);
  };

  const handleOpenChat = (connId) => {
    navigateTo('chat', connId, true);
  };

  // Sync with browser back / forward buttons and hash changes
  useEffect(() => {
    const onLocationChange = () => {
      const { view, connId } = parseLocationHash();
      setCurrentViewState(view);
      if (connId) {
        setActiveChatConnectionId(connId);
      }
    };

    window.addEventListener('popstate', onLocationChange);
    window.addEventListener('hashchange', onLocationChange);

    if (initialLoc.connId) {
      setActiveChatConnectionId(initialLoc.connId);
    }
    if (!window.location.hash) {
      window.history.replaceState({ view: initialLoc.view }, '', `#/${initialLoc.view}`);
    }

    return () => {
      window.removeEventListener('popstate', onLocationChange);
      window.removeEventListener('hashchange', onLocationChange);
    };
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'home':
        return <LandingPage setCurrentView={setCurrentView} />;
      case 'explore':
        return (
          <ExploreSkillsPage
            onOpenChat={handleOpenChat}
          />
        );
      case 'profile':
        return <ProfilePage setCurrentView={setCurrentView} />;
      case 'chat':
        return (
          <ChatPage
            selectedConnectionId={activeChatConnectionId}
            setSelectedConnectionId={setActiveChatConnectionId}
            setCurrentView={setCurrentView}
          />
        );
      default:
        return <LandingPage setCurrentView={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col relative selection:bg-[#7657ff]/30 selection:text-white">
      {/* Liquid Glass Background Orbs */}
      <LiquidBackground />

      {/* Floating Glass Navigation — Home and Explore Skills ONLY */}
      <Navbar
        currentView={currentView}
        setCurrentView={setCurrentView}
        onOpenNotifications={handleOpenNotifications}
        unreadCount={unreadCount}
      />

      {/* Main Page View */}
      <main className="flex-1 relative z-10">{renderView()}</main>

      {/* Minimal Glass Footer (Hidden on dedicated chat view for full height utilization) */}
      {currentView !== 'chat' && <Footer setCurrentView={setCurrentView} />}

      {/* Auth Modal (5 required fields, no email) */}
      <AuthModal onNavigateToProfile={() => setCurrentView('profile')} />

      {/* Notification Drawer with Accept / Reject Actions */}
      <NotificationDrawer
        isOpen={notifOpen}
        onClose={() => setNotifOpen(false)}
        notifications={notifications}
        onRefresh={fetchNotifications}
        onOpenChat={handleOpenChat}
      />
    </div>
  );
}
