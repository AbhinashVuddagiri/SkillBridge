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
      <div className="bg-white rounded-3xl h-[750px] max-h-[85vh] border border-[#D5E9DF] shadow-xs flex overflow-hidden">
        {/* Left Side: Conversations List */}
        <div className="w-full sm:w-80 md:w-96 border-r border-[#D5E9DF] flex flex-col shrink-0 bg-[#F1FAF5]">
          <div className="p-4 border-b border-[#D5E9DF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#16866A]" />
              <h2 className="text-base font-bold text-[#164E41]">Conversations</h2>
            </div>
            <span className="text-[11px] font-semibold text-[#527568]">
              {conversations.length} active
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#527568]">
                Loading messages...
              </div>
            ) : conversations.length === 0 ? (
              <div className="py-16 text-center text-xs text-[#527568] p-4">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-[#16866A]" />
                <p className="font-semibold text-[#164E41]">No conversations yet.</p>
                <p className="text-[11px] text-[#527568] mt-1">
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
                        ? 'bg-[#E4F6EE] border border-[#16866A]/30 text-[#164E41] shadow-xs'
                        : 'hover:bg-white border border-transparent'
                    }`}
                  >
                    <img
                      src={
                        conv.partner?.avatar ||
                        `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.partner?.name}`
                      }
                      alt={conv.partner?.name}
                      className="w-11 h-11 rounded-xl object-cover border border-[#D5E9DF] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#164E41] truncate">
                          {conv.partner?.name}
                        </h4>
                        {conv.unreadCount > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#16866A] text-white">
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#527568] truncate mt-0.5">
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
        <div className="flex-1 flex flex-col justify-between overflow-hidden bg-white">
          {partner ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-[#D5E9DF] flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-3">
                  <img
                    src={
                      partner.avatar ||
                      `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`
                    }
                    alt={partner.name}
                    className="w-10 h-10 rounded-xl object-cover border border-[#D5E9DF]"
                  />
                  <div>
                    <h3 className="text-xs font-bold text-[#164E41]">{partner.name}</h3>
                    <p className="text-[10px] text-[#527568]">{partner.college}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {activeConv.exchange && (
                    <button
                      onClick={() => setCurrentView(`workspace_${activeConv.exchange.id}`)}
                      className="px-3 py-1.5 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] text-xs font-bold text-[#16866A] hover:bg-[#E4F6EE] cursor-pointer transition-colors"
                    >
                      Open Workspace
                    </button>
                  )}
                  <a
                    href={`https://meet.jit.si/skillbridge-${activeConv.conversation.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-xl bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A] hover:bg-[#A8E6CF]/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Call</span>
                  </a>
                </div>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3.5 bg-[#F1FAF5]/30">
                {messages.length === 0 ? (
                  <div className="py-16 text-center text-xs text-[#527568]">
                    <p className="font-semibold text-[#164E41]">No messages yet in this exchange.</p>
                    <p className="text-[11px] text-[#527568] mt-1">
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
                              ? 'bg-[#16866A] text-white font-medium rounded-br-sm shadow-xs'
                              : 'bg-white text-[#164E41] rounded-bl-sm border border-[#D5E9DF] shadow-xs'
                          }`}
                        >
                          {msg.content}
                        </div>
                        <span className="text-[9px] text-[#527568] mt-1 px-1 flex items-center gap-1">
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                          {isMe && <CheckCheck className="w-3 h-3 text-[#16866A]" />}
                        </span>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Footer */}
              <form onSubmit={handleSendMessage} className="p-3 sm:p-4 border-t border-[#D5E9DF] flex gap-2 bg-white">
                <input
                  type="text"
                  placeholder={`Message ${partner.name}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-2xl bg-white border border-[#C8DFD3] text-xs text-[#164E41] placeholder-[#527568]/60 focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
                <button
                  type="submit"
                  disabled={sending || !newMessage.trim()}
                  className="px-5 py-2.5 rounded-2xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer transition-all"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send</span>
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-[#527568]">
              Select a conversation to start messaging
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
