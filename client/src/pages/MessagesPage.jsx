import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  User,
  Sparkles,
  Link2,
  Calendar,
  Clock,
  Video,
  CheckCheck
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function MessagesPage({ initialConvId, setCurrentView }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(initialConvId || null);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const fetchConversations = async () => {
    try {
      const res = await api.getConversations();
      const list = res.conversations || [];
      setConversations(list);

      if (!activeConvId && list.length > 0) {
        setActiveConvId(list[0].id);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    async function loadActiveConversation() {
      if (!activeConvId) return;
      try {
        const res = await api.getConversation(activeConvId);
        if (res?.conversation) {
          setActiveConv(res);
          setMessages(res.conversation.messages || []);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadActiveConversation();
  }, [activeConvId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConvId) return;

    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');

    try {
      const res = await api.sendMessage(activeConvId, { content });
      setMessages(prev => [...prev, res.message]);
      fetchConversations();
    } catch (err) {
      alert(err.message || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const partner = activeConv?.partner;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="glass-panel rounded-3xl h-[750px] max-h-[85vh] border border-white/15 shadow-2xl flex overflow-hidden">
        {/* Left Side: Conversations List */}
        <div className="w-full sm:w-80 md:w-96 border-r border-white/10 flex flex-col shrink-0 bg-slate-950/20">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#39d5f6]" />
              <h2 className="text-base font-bold text-white">Conversations</h2>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">
              {conversations.length} active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-slate-400">
                Loading messages...
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-16 text-center text-xs text-slate-400 p-4">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#7657ff]" />
                <p>No conversations yet.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Accept an exchange proposal or propose an exchange to begin chatting.
                </p>
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = conv.id === activeConvId;
                return (
                  <div
                    key={conv.id}
                    onClick={() => setActiveConvId(conv.id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center gap-3 ${
                      isActive
                        ? 'bg-[#7657ff]/20 border border-[#7657ff]/30 shadow-sm'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <img
                      src={
                        conv.partner?.avatar ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.partner?.name}`
                      }
                      alt={conv.partner?.name}
                      className="w-11 h-11 rounded-xl object-cover border border-white/20 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-white truncate">
                          {conv.partner?.name}
                        </h4>
                        {conv.unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#39d5f6] text-slate-900">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {conv.lastMessage?.content || 'Started conversation'}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Active Chat Window */}
        <div className="flex-1 flex flex-col justify-between overflow-hidden bg-slate-950/10">
          {partner ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5 backdrop-blur-md">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      partner.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`
                    }
                    alt={partner.name}
                    className="w-10 h-10 rounded-xl object-cover border border-white/20"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-white">{partner.name}</h3>
                    <p className="text-[10px] text-slate-400">{partner.college}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeConv.exchange && (
                    <button
                      onClick={() => setCurrentView(`workspace_${activeConv.exchange.id}`)}
                      className="px-3 py-1.5 rounded-xl glass-card text-xs font-bold text-[#b7a4ff] hover:text-white"
                    >
                      Open Workspace
                    </button>
                  )}
                  <a
                    href={`https://meet.jit.si/skillbridge-${activeConv.conversation.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#10b981]/20 text-[#10b981] hover:bg-[#10b981]/30 text-xs font-bold flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5">
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-slate-400">
                    <p>No messages yet in this exchange.</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Say hi to {partner.name} and coordinate your first learning session!
                    </p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.senderId === user.id;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-md p-3.5 rounded-2xl text-xs leading-relaxed ${
                            isMe
                              ? 'bg-gradient-to-r from-[#7657ff] to-[#6042ef] text-white rounded-br-sm shadow-md shadow-[#7657ff]/20'
                              : 'bg-white/10 text-slate-100 rounded-bl-sm border border-white/10'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-slate-500 mt-1 px-1 flex items-center gap-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {isMe && <CheckCheck className="w-3 h-3 text-[#39d5f6]" />}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-white/10 flex gap-2">
                <input
                  type="text"
                  placeholder={`Message ${partner.name}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-[#7657ff]"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-slate-400">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
