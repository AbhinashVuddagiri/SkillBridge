import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Search,
  Bell,
  BellOff,
  UserMinus,
  ArrowLeft,
  Sparkles,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Loader2,
  X,
  ShieldCheck,
  GraduationCap,
  Clock,
  MoreVertical,
  CornerUpLeft,
  Edit3,
  Trash2,
  Undo2
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { supabase, isSupabaseConfigured } from '../services/supabase';

export default function ChatPage({ selectedConnectionId, setSelectedConnectionId, setCurrentView }) {
  const { user, openAuth } = useAuth();

  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [activeConnId, setActiveConnId] = useState(selectedConnectionId || null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messageError, setMessageError] = useState('');

  // Header 3-dot dropdown menu
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef(null);

  // Message 3-dot dropdown menu
  const [activeMsgMenuId, setActiveMsgMenuId] = useState(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState(null);

  // Edit state
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Unsend confirmation modal
  const [unsendModalMessage, setUnsendModalMessage] = useState(null);
  const [unsending, setUnsending] = useState(false);

  // Clear chat confirmation modal
  const [clearChatModalOpen, setClearChatModalOpen] = useState(false);
  const [clearingChat, setClearingChat] = useState(false);

  // Profile modal & Remove connection modal
  const [profileModalPartner, setProfileModalPartner] = useState(null);
  const [removeModalConn, setRemoveModalConn] = useState(null);
  const [removingConnection, setRemovingConnection] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Temporarily highlighted message (when scrolling from reply snippet)
  const [highlightedMsgId, setHighlightedMsgId] = useState(null);

  const messagesEndRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target)) {
        setHeaderMenuOpen(false);
      }
      if (!e.target.closest('.msg-menu-container')) {
        setActiveMsgMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Sync prop changes into activeConnId
  useEffect(() => {
    if (selectedConnectionId) {
      setActiveConnId(selectedConnectionId);
    }
  }, [selectedConnectionId]);

  // Sync activeConnId to URL hash
  useEffect(() => {
    if (activeConnId) {
      const targetHash = `#/chat?connectionId=${encodeURIComponent(activeConnId)}`;
      if (window.location.hash !== targetHash) {
        window.history.replaceState({ view: 'chat', connId: activeConnId }, '', targetHash);
      }
    } else if (window.location.hash.startsWith('#/chat')) {
      if (window.location.hash !== '#/chat') {
        window.history.replaceState({ view: 'chat', connId: null }, '', '#/chat');
      }
    }
  }, [activeConnId]);

  // Load connected users (accepted connections only)
  const fetchConnections = async () => {
    if (!user) return;
    try {
      const res = await api.getConnections();
      const raw = res.connections || [];
      // STRICT FILTER: only accepted connections can chat
      const accepted = raw.filter(c => c.status === 'accepted');
      setConnections(accepted);

      // Auto-select first connection on desktop if none selected
      if (!activeConnId && accepted.length > 0 && window.innerWidth >= 768) {
        setActiveConnId(accepted[0].id);
        if (setSelectedConnectionId) setSelectedConnectionId(accepted[0].id);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
    } finally {
      setLoadingConnections(false);
    }
  };

  useEffect(() => {
    fetchConnections();
  }, [user]);

  // Active Connection object
  const activeConnection = useMemo(() => {
    return connections.find(c => c.id === activeConnId) || null;
  }, [connections, activeConnId]);

  // Fetch messages for active connection
  const fetchMessages = async (showLoading = false) => {
    if (!activeConnId) {
      setMessages([]);
      return;
    }
    if (showLoading) setLoadingMessages(true);
    try {
      const res = await api.getMessages(activeConnId);
      setMessages(res.messages || []);
      setMessageError('');
    } catch (err) {
      setMessageError(err.message || 'Failed to load conversation history.');
    } finally {
      if (showLoading) setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!activeConnId) return;
    fetchMessages(true);
    setReplyingTo(null);
    setEditingMessageId(null);

    // Polling fallback every 3s
    const pollInterval = setInterval(() => {
      fetchMessages(false);
    }, 3000);

    // Supabase Realtime channel subscription if configured
    let channel = null;
    if (isSupabaseConfigured()) {
      try {
        channel = supabase
          .channel(`messages_conn_${activeConnId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'messages',
              filter: `connection_id=eq.${activeConnId}`
            },
            (payload) => {
              if (payload.eventType === 'INSERT') {
                const newMsg = payload.new;
                if (newMsg.is_unsent) return;
                if (Array.isArray(newMsg.deleted_by) && newMsg.deleted_by.includes(user.id)) return;
                setMessages(prev => {
                  if (prev.some(m => m.id === newMsg.id)) return prev;
                  return [...prev, {
                    id: newMsg.id,
                    connectionId: newMsg.connection_id,
                    senderId: newMsg.sender_id,
                    messageBody: newMsg.message_body,
                    createdAt: newMsg.created_at,
                    isEdited: Boolean(newMsg.is_edited),
                    replyToId: newMsg.reply_to_id || null
                  }];
                });
              } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new;
                if (updated.is_unsent) {
                  setMessages(prev => prev.filter(m => m.id !== updated.id));
                } else if (Array.isArray(updated.deleted_by) && updated.deleted_by.includes(user.id)) {
                  setMessages(prev => prev.filter(m => m.id !== updated.id));
                } else {
                  setMessages(prev => prev.map(m => m.id === updated.id ? {
                    ...m,
                    messageBody: updated.message_body,
                    isEdited: Boolean(updated.is_edited)
                  } : m));
                }
              } else if (payload.eventType === 'DELETE') {
                const oldMsg = payload.old;
                setMessages(prev => prev.filter(m => m.id !== oldMsg.id));
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Realtime channel error:', err);
      }
    }

    return () => {
      clearInterval(pollInterval);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [activeConnId]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message (with optional replyToId)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed || sendingMessage || !activeConnId) return;

    setSendingMessage(true);
    const replyTarget = replyingTo;
    setMessageText('');
    setReplyingTo(null);

    try {
      const res = await api.sendMessage(activeConnId, trimmed, replyTarget?.id || null);
      if (res?.message) {
        setMessages(prev => {
          if (prev.some(m => m.id === res.message.id)) return prev;
          return [...prev, res.message];
        });
      }
      fetchConnections();
    } catch (err) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setSendingMessage(false);
    }
  };

  // 1B. Toggle Mute
  const handleToggleMute = async () => {
    if (!activeConnId) return;
    try {
      const res = await api.toggleMuteConnection(activeConnId);
      setConnections(prev =>
        prev.map(c => (c.id === activeConnId ? { ...c, isMuted: res.isMuted } : c))
      );
    } catch (err) {
      alert(err.message || 'Failed to update mute settings.');
    }
  };

  // 1D. Confirm Remove Connection
  const handleConfirmRemove = async () => {
    if (!removeModalConn) return;
    setRemovingConnection(true);
    setRemoveError('');
    try {
      await api.removeConnection(removeModalConn.id);
      setConnections(prev => prev.filter(c => c.id !== removeModalConn.id));
      if (activeConnId === removeModalConn.id) {
        setActiveConnId(null);
        if (setSelectedConnectionId) setSelectedConnectionId(null);
      }
      setRemoveModalConn(null);
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove connection.');
    } finally {
      setRemovingConnection(false);
    }
  };

  // 1E. Confirm Clear Chat (current user only)
  const handleConfirmClearChat = async () => {
    if (!activeConnId) return;
    setClearingChat(true);
    try {
      await api.clearChat(activeConnId);
      setMessages([]);
      setClearChatModalOpen(false);
    } catch (err) {
      alert(err.message || 'Failed to clear chat.');
    } finally {
      setClearingChat(false);
    }
  };

  // 1H. Save Edited Message
  const handleSaveEdit = async (messageId) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    try {
      const res = await api.editMessage(messageId, trimmed);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, messageBody: trimmed, isEdited: true } : m))
      );
      setEditingMessageId(null);
      setEditingText('');
    } catch (err) {
      alert(err.message || 'Failed to edit message.');
    }
  };

  // 1I. Confirm Unsend Message (both participants)
  const handleConfirmUnsend = async () => {
    if (!unsendModalMessage) return;
    setUnsending(true);
    try {
      await api.unsendMessage(unsendModalMessage.id);
      setMessages(prev => prev.filter(m => m.id !== unsendModalMessage.id));
      setUnsendModalMessage(null);
    } catch (err) {
      alert(err.message || 'Failed to unsend message.');
    } finally {
      setUnsending(false);
    }
  };

  // 1J. Delete from me (current user only)
  const handleDeleteForMe = async (messageId) => {
    try {
      await api.deleteMessageForMe(messageId);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      setActiveMsgMenuId(null);
    } catch (err) {
      alert(err.message || 'Failed to delete message from your view.');
    }
  };

  // Scroll to original message when clicking reply snippet
  const scrollToMessage = (targetId) => {
    if (!targetId) return;
    const el = document.getElementById(`msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMsgId(targetId);
      setTimeout(() => setHighlightedMsgId(null), 2000);
    }
  };

  // Filtered contacts list by search query
  const filteredConnections = useMemo(() => {
    if (!searchQuery.trim()) return connections;
    const q = searchQuery.toLowerCase().trim();
    return connections.filter(c => {
      const name = c.partner?.name || '';
      const account = c.partner?.bridgeAccount || '';
      const inst = c.partner?.instituteName || '';
      return (
        name.toLowerCase().includes(q) ||
        account.toLowerCase().includes(q) ||
        inst.toLowerCase().includes(q)
      );
    });
  }, [connections, searchQuery]);

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-24 px-4 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-[#A8E6CF]/15 text-[#A8E6CF] flex items-center justify-center mx-auto mb-2">
          <MessageSquare className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#164E41]">Sign In to Chat</h2>
        <p className="text-xs text-[#527568]">
          Chat is available exclusively for accepted connections. Sign in to collaborate with your study partners.
        </p>
        <button
          onClick={() => openAuth('login')}
          className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 cursor-pointer"
        >
          Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-2 sm:px-6 py-3 md:py-6 h-[calc(100vh-80px)] flex flex-col">
      <div className="bg-white rounded-3xl border border-[#D5E9DF] shadow-md flex-1 flex overflow-hidden">
        {/* =================================================================== */}
        {/* LEFT PANEL — CONNECTED USERS LIST                                   */}
        {/* =================================================================== */}
        <div
          className={`w-full md:w-80 lg:w-96 border-r border-[#D5E9DF] flex flex-col shrink-0 bg-[#F1FAF5] ${
            activeConnId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {/* Left Panel Header */}
          <div className="p-4 border-b border-[#D5E9DF] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#E4F6EE] text-[#16866A]">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-[#164E41]">Messages</h2>
                  <p className="text-[11px] text-[#527568]">Accepted Connections</p>
                </div>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E4F6EE] text-[#16866A] font-semibold border border-[#D5E9DF]">
                {connections.length} {connections.length === 1 ? 'partner' : 'partners'}
              </span>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#527568] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search connected partners..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
              />
            </div>
          </div>

          {/* Connected Users List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loadingConnections ? (
              <div className="flex items-center justify-center py-16 text-[#527568] text-xs gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-[#16866A]" />
                <span>Loading connections...</span>
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="text-center py-16 px-4 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#D5E9DF] flex items-center justify-center mx-auto text-[#527568]">
                  <User className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#164E41] font-semibold">
                    {searchQuery ? 'No matching partners' : 'No accepted connections yet'}
                  </p>
                  <p className="text-[11px] text-[#527568] leading-relaxed">
                    {searchQuery
                      ? 'Try searching with another name or bridge handle.'
                      : 'Connect with other learners in Explore Skills to start chatting and sharing skills!'}
                  </p>
                </div>
                {!searchQuery && (
                  <button
                    onClick={() => setCurrentView('explore')}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-xs cursor-pointer"
                  >
                    Explore Skills
                  </button>
                )}
              </div>
            ) : (
              filteredConnections.map((conn) => {
                const partner = conn.partner;
                const isSelected = conn.id === activeConnId;
                const lastMsg = conn.lastMessage;

                return (
                  <button
                    key={conn.id}
                    onClick={() => {
                      setActiveConnId(conn.id);
                      if (setSelectedConnectionId) setSelectedConnectionId(conn.id);
                    }}
                    className={`w-full p-3 rounded-2xl text-left flex items-start gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#E4F6EE] border border-[#16866A]/30 shadow-xs'
                        : 'hover:bg-white/80 border border-transparent'
                    }`}
                  >
                    {/* Partner Avatar */}
                    <div className="relative shrink-0">
                      <img
                        src={partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(partner?.bridgeAccount || 'user')}`}
                        alt={partner?.name || 'Partner'}
                        className="w-11 h-11 rounded-xl object-cover border border-[#D5E9DF]"
                      />
                      {conn.isMuted && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white border border-[#D5E9DF] text-[#527568] flex items-center justify-center shadow-xs">
                          <BellOff className="w-2.5 h-2.5" />
                        </div>
                      )}
                    </div>

                    {/* Name, Handle, & Last Message */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-[#164E41] truncate">
                          {partner?.name || 'Study Partner'}
                        </span>
                        {lastMsg && (
                          <span className="text-[10px] text-[#527568] shrink-0">
                            {new Date(lastMsg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-[#16866A] font-mono truncate">
                        @{partner?.bridgeAccount || 'bridge_user'}
                      </p>

                      <p className="text-xs text-[#527568] truncate mt-1">
                        {lastMsg ? (
                          <span>
                            {lastMsg.senderId === user.id && <span className="text-[#527568]/80">You: </span>}
                            {lastMsg.body}
                          </span>
                        ) : (
                          <span className="text-[#527568]/60 italic">No messages yet</span>
                        )}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* =================================================================== */}
        {/* RIGHT PANEL — CONVERSATION VIEW                                     */}
        {/* =================================================================== */}
        <div
          className={`flex-1 flex flex-col bg-white min-w-0 ${
            !activeConnId ? 'hidden md:flex' : 'flex'
          }`}
        >
          {activeConnection ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 sm:px-6 border-b border-[#D5E9DF] flex items-center justify-between bg-white shrink-0 relative z-30">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Back button on mobile */}
                  <button
                    onClick={() => {
                      setActiveConnId(null);
                      if (setSelectedConnectionId) setSelectedConnectionId(null);
                    }}
                    className="md:hidden p-1.5 rounded-xl text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
                    aria-label="Back to contacts"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <img
                    src={activeConnection.partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(activeConnection.partner?.bridgeAccount || 'user')}`}
                    alt={activeConnection.partner?.name || 'Partner'}
                    className="w-10 h-10 rounded-xl object-cover border border-[#D5E9DF] shrink-0"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#164E41] truncate">
                        {activeConnection.partner?.name || 'Study Partner'}
                      </h3>
                      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF]">
                        <ShieldCheck className="w-3 h-3" />
                        <span>Connected</span>
                      </span>
                      {activeConnection.isMuted && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <BellOff className="w-3 h-3" />
                          <span>Muted</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#527568] flex items-center gap-1 truncate">
                      <GraduationCap className="w-3 h-3 text-[#16866A] shrink-0" />
                      <span className="truncate">{activeConnection.partner?.instituteName || 'Independent Learner'}</span>
                      <span className="font-mono text-[#16866A]">@{activeConnection.partner?.bridgeAccount}</span>
                    </p>
                  </div>
                </div>

                {/* 1A. Chat Header Three-Dot Menu */}
                <div className="relative shrink-0" ref={headerMenuRef}>
                  <button
                    onClick={() => setHeaderMenuOpen(prev => !prev)}
                    className="p-2 rounded-xl text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
                    title="Chat menu options"
                    aria-label="Chat menu options"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {headerMenuOpen && (
                    <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white p-1.5 shadow-2xl border border-[#D5E9DF] animate-in fade-in zoom-in-95 duration-150 z-50">
                      {/* 1B. Mute notifications / Unmute notifications */}
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          handleToggleMute();
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                      >
                        {activeConnection.isMuted ? (
                          <>
                            <Bell className="w-4 h-4 text-[#16866A]" />
                            <span>Unmute notifications</span>
                          </>
                        ) : (
                          <>
                            <BellOff className="w-4 h-4 text-amber-600" />
                            <span>Mute notifications</span>
                          </>
                        )}
                      </button>

                      {/* 1C. Show profile */}
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setProfileModalPartner(activeConnection.partner);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                      >
                        <User className="w-4 h-4 text-[#16866A]" />
                        <span>Show profile</span>
                      </button>

                      {/* 1E. Clear chat */}
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setClearChatModalOpen(true);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                      >
                        <Trash2 className="w-4 h-4 text-amber-600" />
                        <span>Clear chat</span>
                      </button>

                      <div className="border-t border-[#D5E9DF] my-1" />

                      {/* 1D. Remove connection */}
                      <button
                        onClick={() => {
                          setHeaderMenuOpen(false);
                          setRemoveError('');
                          setRemoveModalConn(activeConnection);
                        }}
                        className="w-full px-3 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 transition-colors cursor-pointer text-left"
                      >
                        <UserMinus className="w-4 h-4 text-rose-600" />
                        <span>Remove connection</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Message History Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-[#F1FAF5]/30">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-24 text-[#527568] text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#16866A]" />
                    <span>Loading conversation history...</span>
                  </div>
                ) : messageError ? (
                  <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs text-center">
                    {messageError}
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-24 px-4 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] flex items-center justify-center mx-auto mb-2">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-[#164E41] font-semibold">Start your conversation!</p>
                    <p className="text-[11px] text-[#527568] max-w-sm mx-auto">
                      You and {activeConnection.partner?.name || 'your partner'} are connected. Say hello and coordinate your skill exchange session!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOwn = msg.senderId === user.id;
                    const isHighlighted = highlightedMsgId === msg.id;
                    const isEditing = editingMessageId === msg.id;

                    return (
                      <div
                        id={`msg-${msg.id}`}
                        key={msg.id}
                        className={`flex flex-col group relative transition-all duration-300 ${
                          isOwn ? 'items-end' : 'items-start'
                        } ${isHighlighted ? 'scale-[1.02]' : ''}`}
                      >
                        <div className={`flex items-center gap-1.5 max-w-[88%] sm:max-w-[75%] ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                          {/* Message Bubble Container */}
                          <div
                            className={`px-4 py-2.5 rounded-2xl text-xs leading-relaxed break-words whitespace-pre-wrap shadow-xs transition-all ${
                              isHighlighted ? 'ring-2 ring-[#16866A] ring-offset-2 ring-offset-white' : ''
                            } ${
                              isOwn
                                ? 'bg-[#16866A] text-white font-medium rounded-tr-xs shadow-sm'
                                : 'bg-white border border-[#D5E9DF] text-[#164E41] rounded-tl-xs shadow-xs'
                            }`}
                          >
                            {/* 1G. Quoted Replied-to Message Snippet inside Bubble */}
                            {msg.replyTo && (
                              <div
                                onClick={() => scrollToMessage(msg.replyToId)}
                                className={`mb-2 p-2 rounded-xl border-l-2 text-[11px] cursor-pointer transition-colors select-none ${
                                  isOwn
                                    ? 'bg-white/20 border-white text-white'
                                    : 'bg-[#F1FAF5] border-[#16866A] text-[#164E41]'
                                }`}
                                title="Click to view original message"
                              >
                                <p className={`font-bold text-[10px] flex items-center gap-1 ${isOwn ? 'text-white' : 'text-[#16866A]'}`}>
                                  <CornerUpLeft className="w-2.5 h-2.5" />
                                  <span>
                                    {msg.replyTo.senderId === user.id
                                      ? 'You'
                                      : (msg.replyTo.senderName || activeConnection.partner?.name || 'Partner')}
                                  </span>
                                </p>
                                <p className={`truncate italic mt-0.5 opacity-90 max-w-xs ${isOwn ? 'text-white/90' : 'text-[#527568]'}`}>
                                  {msg.replyTo.messageBody}
                                </p>
                              </div>
                            )}

                            {/* 1H. Inline Message Edit or Normal Display */}
                            {isEditing ? (
                              <div className="space-y-2 py-0.5 min-w-[200px] sm:min-w-[260px]">
                                <textarea
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="w-full p-2.5 rounded-xl bg-white border border-[#16866A] text-[#164E41] text-xs resize-none focus:outline-none"
                                  rows={2}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSaveEdit(msg.id);
                                    } else if (e.key === 'Escape') {
                                      setEditingMessageId(null);
                                    }
                                  }}
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingMessageId(null)}
                                    className="px-2.5 py-1 text-[11px] text-[#527568] hover:text-[#164E41] bg-[#F1FAF5] border border-[#D5E9DF] rounded-lg cursor-pointer transition-colors"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEdit(msg.id)}
                                    disabled={!editingText.trim()}
                                    className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#16866A] hover:bg-[#0F7058] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div>{msg.messageBody}</div>
                            )}
                          </div>

                          {/* Quick Message Actions (Hover on desktop, always visible and tap-friendly on mobile) */}
                          {!isEditing && (
                            <div className={`flex items-center gap-0.5 transition-opacity shrink-0 ${
                              activeMsgMenuId === msg.id
                                ? 'opacity-100'
                                : 'opacity-85 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
                            }`}>
                              {/* 1G. Quick Reply Button (Left arrow) for EVERY message */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setReplyingTo(msg);
                                }}
                                className="p-2 sm:p-1.5 rounded-xl text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] active:bg-[#E4F6EE] transition-colors cursor-pointer touch-manipulation"
                                title="Reply to message"
                                aria-label="Reply to message"
                              >
                                <CornerUpLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                              </button>

                              {/* 1F. Individual Message Three-Dot Menu */}
                              <div className="relative msg-menu-container">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMsgMenuId(activeMsgMenuId === msg.id ? null : msg.id);
                                  }}
                                  className={`p-2 sm:p-1.5 rounded-xl transition-colors cursor-pointer touch-manipulation ${
                                    activeMsgMenuId === msg.id
                                      ? 'text-[#16866A] bg-[#E4F6EE]'
                                      : 'text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] active:bg-[#E4F6EE]'
                                  }`}
                                  title="More message actions"
                                  aria-label="More message actions"
                                >
                                  <MoreVertical className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                </button>

                                {activeMsgMenuId === msg.id && (
                                  <>
                                    {/* Mobile Action Sheet (Fixed overlay, always inside screen, never clipped) */}
                                    <div
                                      className="fixed inset-0 z-50 bg-[#164E41]/40 backdrop-blur-xs flex flex-col justify-end p-4 animate-in fade-in duration-150 sm:hidden"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMsgMenuId(null);
                                      }}
                                    >
                                      <div
                                        className="w-full max-w-sm mx-auto bg-white rounded-2xl p-2.5 shadow-2xl border border-[#D5E9DF] space-y-1 animate-in slide-in-from-bottom-4 duration-200"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="px-3 py-2 border-b border-[#D5E9DF] flex items-center justify-between">
                                          <span className="text-xs font-bold text-[#164E41]">Message Actions</span>
                                          <span className="text-[10px] text-[#527568]">
                                            {isOwn ? 'Your message' : (activeConnection.partner?.name || 'Partner')}
                                          </span>
                                        </div>

                                        {/* Reply */}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveMsgMenuId(null);
                                            setReplyingTo(msg);
                                          }}
                                          className="w-full px-3 py-2.5 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] active:bg-[#E4F6EE] rounded-xl flex items-center gap-3 transition-colors cursor-pointer text-left"
                                        >
                                          <CornerUpLeft className="w-4 h-4 text-[#16866A]" />
                                          <span>Reply</span>
                                        </button>

                                        {isOwn ? (
                                          <>
                                            {/* Edit */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMsgMenuId(null);
                                                setEditingMessageId(msg.id);
                                                setEditingText(msg.messageBody);
                                              }}
                                              className="w-full px-3 py-2.5 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] active:bg-[#E4F6EE] rounded-xl flex items-center gap-3 transition-colors cursor-pointer text-left"
                                            >
                                              <Edit3 className="w-4 h-4 text-amber-600" />
                                              <span>Edit</span>
                                            </button>

                                            {/* Unsend */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveMsgMenuId(null);
                                                setUnsendModalMessage(msg);
                                              }}
                                              className="w-full px-3 py-2.5 text-xs font-semibold text-rose-600 hover:text-rose-700 active:bg-rose-50 rounded-xl flex items-center gap-3 transition-colors cursor-pointer text-left"
                                            >
                                              <Undo2 className="w-4 h-4" />
                                              <span>Unsend</span>
                                            </button>

                                            {/* Delete from me */}
                                            <button
                                              type="button"
                                              onClick={() => handleDeleteForMe(msg.id)}
                                              className="w-full px-3 py-2.5 text-xs font-semibold text-[#527568] hover:text-[#164E41] active:bg-[#F1FAF5] rounded-xl flex items-center gap-3 transition-colors cursor-pointer text-left"
                                            >
                                              <Trash2 className="w-4 h-4 text-[#527568]" />
                                              <span>Delete from me</span>
                                            </button>
                                          </>
                                        ) : (
                                          /* Delete from me (received message) */
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteForMe(msg.id)}
                                            className="w-full px-3 py-2.5 text-xs font-semibold text-[#527568] hover:text-[#164E41] active:bg-[#F1FAF5] rounded-xl flex items-center gap-3 transition-colors cursor-pointer text-left"
                                          >
                                            <Trash2 className="w-4 h-4 text-[#527568]" />
                                            <span>Delete from me</span>
                                          </button>
                                        )}

                                        {/* Cancel button on mobile */}
                                        <div className="pt-1 border-t border-[#D5E9DF]">
                                          <button
                                            type="button"
                                            onClick={() => setActiveMsgMenuId(null)}
                                            className="w-full py-2 text-xs font-medium text-[#527568] hover:text-[#164E41] active:bg-[#F1FAF5] rounded-xl text-center transition-colors"
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Desktop Dropdown Menu (Positioned relative to 3-dot button) */}
                                    <div className={`hidden sm:block absolute ${isOwn ? 'right-0' : 'left-0'} mt-1 w-44 rounded-2xl bg-white p-1.5 shadow-2xl border border-[#D5E9DF] animate-in fade-in zoom-in-95 duration-100 z-40`}>
                                      {/* 1G. Reply */}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMsgMenuId(null);
                                          setReplyingTo(msg);
                                        }}
                                        className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                                      >
                                        <CornerUpLeft className="w-3.5 h-3.5 text-[#16866A]" />
                                        <span>Reply</span>
                                      </button>

                                      {isOwn ? (
                                        <>
                                          {/* 1H. Edit */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMsgMenuId(null);
                                              setEditingMessageId(msg.id);
                                              setEditingText(msg.messageBody);
                                            }}
                                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                                          >
                                            <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Edit</span>
                                          </button>

                                          {/* 1I. Unsend */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveMsgMenuId(null);
                                              setUnsendModalMessage(msg);
                                            }}
                                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                                          >
                                            <Undo2 className="w-3.5 h-3.5" />
                                            <span>Unsend</span>
                                          </button>

                                          {/* 1J. Delete from me */}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteForMe(msg.id)}
                                            className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-[#527568]" />
                                            <span>Delete from me</span>
                                          </button>
                                        </>
                                      ) : (
                                        /* Received from partner options */
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteForMe(msg.id)}
                                          className="w-full px-2.5 py-1.5 text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] rounded-xl flex items-center gap-2 transition-colors cursor-pointer text-left"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 text-[#527568]" />
                                          <span>Delete from me</span>
                                        </button>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Timestamp & Edited Indicator */}
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mt-1 px-1">
                          <span>
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {msg.isEdited && (
                            <span className="italic text-slate-400">• edited</span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* 1G. Reply Preview Above Input */}
              {replyingTo && (
                <div className="px-4 py-2.5 bg-[#E4F6EE] border-t border-[#D5E9DF] flex items-center justify-between gap-3 text-xs shrink-0 animate-in fade-in slide-in-from-bottom-2 duration-150">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CornerUpLeft className="w-4 h-4 text-[#16866A] shrink-0" />
                    <div className="min-w-0">
                      <span className="font-bold text-[#16866A] text-[11px]">
                        Replying to {replyingTo.senderId === user.id ? 'yourself' : (activeConnection.partner?.name || 'Partner')}
                      </span>
                      <p className="text-[11px] text-[#527568] truncate max-w-sm sm:max-w-md">
                        {replyingTo.messageBody}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReplyingTo(null)}
                    className="p-1 rounded-lg text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] shrink-0 cursor-pointer"
                    title="Cancel reply"
                    aria-label="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Message Input Footer */}
              <form
                onSubmit={handleSendMessage}
                className="p-3 sm:p-4 border-t border-[#D5E9DF] bg-white flex items-center gap-2 shrink-0"
              >
                <textarea
                  rows="1"
                  placeholder={replyingTo ? "Type your reply... (Press Enter to send)" : "Type a message... (Press Enter to send, Shift+Enter for new line)"}
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage();
                    }
                  }}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-[#F1FAF5] border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:bg-white focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A] resize-none max-h-32"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sendingMessage}
                  className="w-10 h-10 rounded-2xl bg-[#16866A] hover:bg-[#0F7058] text-white flex items-center justify-center transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md shadow-[#16866A]/20 cursor-pointer"
                  aria-label="Send message"
                >
                  {sendingMessage ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                  ) : (
                    <Send className="w-4 h-4 text-white" />
                  )}
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A] flex items-center justify-center mb-1">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-[#164E41]">Select a Conversation</h3>
              <p className="text-xs text-[#527568] max-w-sm">
                Choose a connected partner from the left panel to view message history and send messages.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 1C. SHOW PROFILE MODAL                                              */}
      {/* =================================================================== */}
      {profileModalPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-[#D5E9DF] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setProfileModalPartner(null)}
              className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              aria-label="Close Profile"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Profile Avatar & Names */}
            <div className="text-center pb-5 border-b border-[#D5E9DF] mb-5">
              <img
                src={profileModalPartner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profileModalPartner.bridgeAccount || 'user')}`}
                alt={profileModalPartner.name}
                className="w-20 h-20 rounded-3xl object-cover border-2 border-[#16866A]/30 shadow-md mx-auto mb-3"
              />
              <h3 className="text-lg font-bold text-[#164E41]">{profileModalPartner.name}</h3>
              <p className="text-xs text-[#16866A] font-mono mt-0.5">@{profileModalPartner.bridgeAccount}</p>
              <p className="text-xs text-[#527568] mt-1 flex items-center justify-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-[#527568]" />
                <span>{profileModalPartner.instituteName || 'Independent Learner'}</span>
              </p>
            </div>

            {/* Skills Taught */}
            <div className="space-y-2 mb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#16866A] uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Skills Offered (Can Teach)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(profileModalPartner.skillsTeach || []).length > 0 ? (
                  profileModalPartner.skillsTeach.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A]"
                    >
                      {typeof skill === 'string' ? skill : skill.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#527568]/60 italic">No skills listed</span>
                )}
              </div>
            </div>

            {/* Skills Wanted to Learn */}
            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#164E41] uppercase tracking-wider">
                <BookOpen className="w-3.5 h-3.5" />
                <span>Skills Wanted (Wants to Learn)</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(profileModalPartner.skillsLearn || []).length > 0 ? (
                  profileModalPartner.skillsLearn.map((skill, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-[#F1FAF5] border border-[#D5E9DF] text-[#164E41]"
                    >
                      {typeof skill === 'string' ? skill : skill.name}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#527568]/60 italic">No skills listed</span>
                )}
              </div>
            </div>

            <button
              onClick={() => setProfileModalPartner(null)}
              className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1D. REMOVE CONNECTION CONFIRMATION MODAL                            */}
      {/* =================================================================== */}
      {removeModalConn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-200">
            <button
              onClick={() => {
                if (!removingConnection) {
                  setRemoveModalConn(null);
                  setRemoveError('');
                }
              }}
              disabled={removingConnection}
              className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#164E41]">Remove Connection</h3>
                <p className="text-xs text-rose-600">
                  {removeModalConn.partner?.name || 'This user'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#527568] leading-relaxed mb-4">
              Are you sure you want to remove this connection? The chat between you and this user will be closed immediately.
            </p>

            {removeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs mb-4">
                {removeError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRemoveModalConn(null);
                  setRemoveError('');
                }}
                disabled={removingConnection}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removingConnection}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {removingConnection ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <UserMinus className="w-3.5 h-3.5" />
                )}
                <span>Remove Connection</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1E. CLEAR CHAT CONFIRMATION MODAL                                   */}
      {/* =================================================================== */}
      {clearChatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-amber-200">
            <button
              onClick={() => {
                if (!clearingChat) setClearChatModalOpen(false);
              }}
              disabled={clearingChat}
              className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#164E41]">Clear Chat</h3>
                <p className="text-xs text-amber-700">
                  {activeConnection?.partner?.name || 'This conversation'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#527568] leading-relaxed mb-4">
              Are you sure you want to clear this chat? This will remove all messages from your view only. Your connected partner will still keep their copy of the conversation.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setClearChatModalOpen(false)}
                disabled={clearingChat}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmClearChat}
                disabled={clearingChat}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {clearingChat ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Clear Chat</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 1I. UNSEND MESSAGE CONFIRMATION MODAL                               */}
      {/* =================================================================== */}
      {unsendModalMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-rose-200">
            <button
              onClick={() => {
                if (!unsending) setUnsendModalMessage(null);
              }}
              disabled={unsending}
              className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0">
                <Undo2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-[#164E41]">Unsend Message</h3>
                <p className="text-xs text-rose-600">Remove for everyone</p>
              </div>
            </div>

            <p className="text-xs text-[#527568] leading-relaxed mb-2">
              Are you sure you want to unsend this message? It will be permanently removed for both participants in this chat.
            </p>

            <div className="p-3 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] text-xs text-[#164E41] italic mb-4 max-h-24 overflow-y-auto">
              "{unsendModalMessage.messageBody}"
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setUnsendModalMessage(null)}
                disabled={unsending}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmUnsend}
                disabled={unsending}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {unsending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <Undo2 className="w-3.5 h-3.5" />
                )}
                <span>Unsend</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
