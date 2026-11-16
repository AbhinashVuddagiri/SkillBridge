import React, { useState } from 'react';
import { X, Send, Sparkles, Calendar, BookOpen, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ExchangeProposalModal({ onExchangeSent }) {
  const { user, activeProposalUser, setActiveProposalUser, openAuth } = useAuth();

  const partner = activeProposalUser;
  const [skillRequested, setSkillRequested] = useState('');
  const [skillOffered, setSkillOffered] = useState('');
  const [proposedSchedule, setProposedSchedule] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  if (!partner) return null;

  // Initialize defaults if available
  const partnerTeaches = partner.skillsTeach || [];
  const userTeaches = user?.skillsTeach || [];

  const handleSend = async (e) => {
    e.preventDefault();
    if (!user) {
      openAuth('login');
      return;
    }

    if (!skillRequested) {
      setError('Please select or specify which skill you want to learn.');
      return;
    }
    if (!skillOffered) {
      setError('Please select or specify which skill you can teach in return.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.createExchange({
        receiverId: partner.id,
        skillRequested,
        skillOffered,
        proposedSchedule: proposedSchedule || partner.availability?.[0] || 'Flexible Weekday Evenings',
        message: message || `Hi ${partner.name}! I would love to learn ${skillRequested} from you and teach you ${skillOffered} in return.`
      });

      setSuccess(true);
      if (onExchangeSent) onExchangeSent();
      setTimeout(() => {
        setSuccess(false);
        setActiveProposalUser(null);
      }, 1600);
    } catch (err) {
      setError(err.message || 'Failed to send proposal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#164E41]/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-[#D5E9DF]">
        <button
          onClick={() => setActiveProposalUser(null)}
          className="absolute top-5 right-5 p-2 rounded-full text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {success ? (
          <div className="py-12 text-center space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-[#E4F6EE] border border-[#A8E6CF] flex items-center justify-center text-[#16866A]">
              <CheckCircle className="w-10 h-10 animate-bounce text-[#16866A]" />
            </div>
            <h3 className="text-xl font-bold text-[#164E41]">Proposal Sent! 🎉</h3>
            <p className="text-xs text-[#527568]">
              {partner.name} has been notified. You can track this in your Dashboard and Chat.
            </p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#D5E9DF]">
              <img
                src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`}
                alt={partner.name}
                className="w-12 h-12 rounded-2xl object-cover border border-[#D5E9DF]"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-[#164E41]">{partner.name}</h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF]">
                    {partner.college || 'Peer Partner'}
                  </span>
                </div>
                <p className="text-xs text-[#527568]">Propose a mutual skill exchange</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSend} className="space-y-4">
              {/* Skill You Want to Learn */}
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-[#16866A]" />
                  <span>Skill you want to learn from {partner.name.split(' ')[0]}:</span>
                </label>
                {partnerTeaches.length > 0 ? (
                  <select
                    value={skillRequested}
                    onChange={(e) => setSkillRequested(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  >
                    <option value="">Select a skill they teach...</option>
                    {partnerTeaches.map((st, i) => (
                      <option key={i} value={st.name}>
                        {st.name} ({st.proficiency || 'Proficient'})
                      </option>
                    ))}
                    <option value="custom">Other (specify in message)</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. Python, UI Design, French"
                    value={skillRequested}
                    onChange={(e) => setSkillRequested(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  />
                )}
              </div>

              {/* Skill You Offer in Return */}
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#16866A]" />
                  <span>Skill you offer to teach in return:</span>
                </label>
                {userTeaches.length > 0 ? (
                  <select
                    value={skillOffered}
                    onChange={(e) => setSkillOffered(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  >
                    <option value="">Select a skill you teach...</option>
                    {userTeaches.map((st, i) => (
                      <option key={i} value={st.name}>
                        {st.name} ({st.proficiency || 'Proficient'})
                      </option>
                    ))}
                    <option value="custom">Other skill not on profile</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    required
                    placeholder="e.g. React, Video Editing, Math"
                    value={skillOffered}
                    onChange={(e) => setSkillOffered(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                  />
                )}
              </div>

              {/* Proposed Schedule */}
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#16866A]" />
                  <span>Proposed Schedule / Availability:</span>
                </label>
                <input
                  type="text"
                  placeholder={partner.availability?.[0] || 'e.g. Tuesday Evenings 7:00 PM EST'}
                  value={proposedSchedule}
                  onChange={(e) => setProposedSchedule(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-semibold text-[#164E41] mb-1">Personalized Message</label>
                <textarea
                  rows={3}
                  placeholder={`Hi ${partner.name}! I really like your background and would love to exchange knowledge together.`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#C8DFD3] text-[#164E41] placeholder-[#527568]/60 text-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveProposalUser(null)}
                  className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-[#527568] hover:text-[#164E41] hover:bg-[#F1FAF5] border border-[#D5E9DF] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  {loading ? (
                    <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Send Proposal</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
