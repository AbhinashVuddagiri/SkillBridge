import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  MessageSquare,
  ShieldCheck,
  GraduationCap,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ChatModal({ connectionId, isOpen, onClose }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [partner, setPartner] = useState(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  const fetchMessages = async () => {
    if (!connectionId) return;
    try {
      const res = await api.getMessages(connectionId);
      setMessages(res.messages || []);
      setPartner(res.partner || null);
      setError('');
    } catch (err) {
      setError(err.message || 'Chat is not available.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !connectionId) return;
    setLoading(true);
    fetchMessages();

    // Smooth real-time update polling while chat is open
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, connectionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await api.sendMessage(connectionId, trimmed);
      setText('');
      if (res?.message) {
        setMessages(prev => [...prev, res.message]);
      }
    } catch (err) {
      alert(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl h-[85vh] max-h-[700px] bg-white rounded-3xl border border-[#D5E9DF] shadow-2xl flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-[#D5E9DF] flex items-center justify-between bg-white shrink-0">
          <div className="flex items-center gap-3">
            {partner?.avatar ? (
              <img
                src={partner.avatar}
                alt={partner.name}
                className="w-10 h-10 rounded-xl object-cover border border-[#D5E9DF] shadow-xs"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-[#E4F6EE] text-[#16866A] flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            )}

            <div>
              <h3 className="text-sm font-bold text-[#164E41] flex items-center gap-1.5">
                <span>{partner?.name || 'Study Partner'}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Accepted Connection</span>
                </span>
              </h3>
              <p className="text-[11px] text-[#527568] flex items-center gap-1.5 mt-0.5">
                <GraduationCap className="w-3 h-3 text-[#16866A]" />
                <span>{partner?.instituteName || 'Independent Learner'}</span>
                {partner?.bridgeAccount && (
                  <span className="font-mono text-[#16866A]">@{partner.bridgeAccount}</span>
                )}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
            aria-label="Close Chat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chat Message Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#F1FAF5]/30">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-2">
              <Loader2 className="w-8 h-8 text-[#16866A] animate-spin" />
              <p className="text-xs text-[#527568]">Loading conversation...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#164E41]">Chat Inaccessible</h4>
              <p className="text-xs text-[#527568] max-w-sm">{error}</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-[#527568]">
              <div className="w-12 h-12 rounded-2xl bg-[#E4F6EE] border border-[#D5E9DF] flex items-center justify-center text-[#16866A]">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-[#164E41]">Connection Established!</h4>
              <p className="text-xs max-w-sm">
                Say hello to {partner?.name}! Coordinate your skill exchange schedule, meeting format, or learning resources.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === user?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs break-words ${
                      isMine
                        ? 'bg-[#16866A] text-white font-medium rounded-br-sm shadow-sm'
                        : 'bg-white border border-[#D5E9DF] text-[#164E41] rounded-bl-sm'
                    }`}
                  >
                    {msg.messageBody}
                  </div>
                  <span className="text-[10px] text-[#527568] mt-1 px-1">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Footer */}
        {!error && (
          <form
            onSubmit={handleSendMessage}
            className="p-4 border-t border-[#D5E9DF] bg-white flex items-center gap-2 shrink-0"
          >
            <input
              type="text"
              placeholder="Type your message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading || sending}
              className="flex-1 px-4 py-3 rounded-2xl bg-[#F1FAF5] border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:bg-white focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
            />
            <button
              type="submit"
              disabled={!text.trim() || sending}
              className="px-5 py-3 rounded-2xl font-bold text-xs text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin text-white" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
              <span className="hidden sm:inline">Send</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
