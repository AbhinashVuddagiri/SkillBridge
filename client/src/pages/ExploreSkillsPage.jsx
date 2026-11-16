import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Clock,
  Send,
  Loader2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function ExploreSkillsPage({ onOpenChat }) {
  const { user, isAuthenticated, openAuth } = useAuth();
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectingId, setConnectingId] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchUsers = async (query = searchQuery) => {
    setLoading(true);
    try {
      const res = await api.getUsers(query ? { q: query } : {});
      setUsers(res.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setErrorMsg('Failed to load learner profiles.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery);
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleConnect = async (targetUser) => {
    if (!isAuthenticated) {
      openAuth('login');
      return;
    }

    setConnectingId(targetUser.id);
    try {
      await api.sendConnection(targetUser.id);
      // Immediately reflect pending status on card
      setUsers(prev => prev.map(u => {
        if (u.id === targetUser.id) {
          return { ...u, connectionStatus: 'pending', isRequester: true };
        }
        return u;
      }));
    } catch (err) {
      alert(err.message || 'Failed to send connection request.');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header and Search */}
      <div className="space-y-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-[#16866A]">
            Skill Discovery
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#164E41] tracking-tight mt-1">
            Explore Skills
          </h1>
          <p className="text-xs sm:text-sm text-[#527568] mt-1 max-w-2xl">
            Find peers who can teach what you want to learn, and share what you already know.
          </p>
        </div>

        {/* Functional Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-[#527568] absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by skill name (e.g. Python, UI Design, React, Guitar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl bg-white text-xs sm:text-sm text-[#164E41] placeholder-[#527568]/60 border border-[#C8DFD3] shadow-xs focus:outline-none focus:border-[#16866A] focus:ring-1 focus:ring-[#16866A]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#527568] hover:text-[#164E41] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Grid of User Cards */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#16866A] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-[#527568]">Loading completed learner profiles...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center max-w-lg mx-auto border border-[#D5E9DF] shadow-xs space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] flex items-center justify-center mx-auto text-[#527568]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-[#164E41]">No Profiles Found</h3>
          <p className="text-xs text-[#527568] leading-relaxed">
            {searchQuery
              ? `No registered learners matched the skill query "${searchQuery}". Try a different skill name or clear the search.`
              : 'There are no other learners with completed profiles yet. Register a second account to test skill exchanges, or invite fellow learners!'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-[#164E41] bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] cursor-pointer"
            >
              Clear Search Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((targetUser) => {
            const isConnecting = connectingId === targetUser.id;
            const status = targetUser.connectionStatus || 'none';

            return (
              <div
                key={targetUser.id}
                tabIndex={0}
                className="bg-white rounded-3xl p-6 border border-[#D5E9DF] flex flex-col justify-between space-y-5 shadow-xs hover:border-[#A8E6CF] transition-all group skill-card-hover cursor-default focus:outline-none"
              >
                {/* 1. Profile Picture & 2. Full Name & 3. Institute Name */}
                <div className="flex items-start gap-4">
                  <img
                    src={targetUser.avatar}
                    alt={targetUser.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#D5E9DF] shadow-xs shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#164E41] truncate group-hover:text-[#16866A] transition-colors">
                      {targetUser.name}
                    </h3>
                    <p className="text-xs text-[#527568] flex items-center gap-1.5 mt-0.5 truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-[#16866A] shrink-0" />
                      <span className="truncate">{targetUser.instituteName || 'Independent Learner'}</span>
                    </p>
                    <p className="text-[11px] font-mono text-[#527568]/80 mt-0.5">
                      @{targetUser.username || targetUser.bridgeAccount}
                    </p>
                  </div>
                </div>

                {/* 4. Skills They Can Teach */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#16866A] uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Can Teach</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {(targetUser.skillsTeach || []).length > 0 ? (
                      targetUser.skillsTeach.map((skill, idx) => {
                        const name = typeof skill === 'string' ? skill : skill.name;
                        return (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A]"
                          >
                            {name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-[#527568]/70">None listed</span>
                    )}
                  </div>
                </div>

                {/* 5. Skills They Want to Learn */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#164E41] uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5 text-[#527568]" />
                    <span>Wants to Learn</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {(targetUser.skillsLearn || []).length > 0 ? (
                      targetUser.skillsLearn.map((skill, idx) => {
                        const name = typeof skill === 'string' ? skill : skill.name;
                        return (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#F1FAF5] border border-[#D5E9DF] text-[#527568]"
                          >
                            {name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-[#527568]/70">None listed</span>
                    )}
                  </div>
                </div>

                {/* 6. Connect Button or Connection Status */}
                <div className="pt-2 border-t border-[#D5E9DF]">
                  {status === 'none' ? (
                    <button
                      onClick={() => handleConnect(targetUser)}
                      disabled={isConnecting}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-sm shadow-[#16866A]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Connect</span>
                    </button>
                  ) : status === 'pending' ? (
                    targetUser.isRequester ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 flex items-center justify-center gap-2 cursor-not-allowed select-none"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending</span>
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl text-xs font-bold text-[#16866A] bg-[#E4F6EE] border border-[#D5E9DF] text-center">
                        Request Received (Check Notifications)
                      </div>
                    )
                  ) : status === 'accepted' ? (
                    <button
                      onClick={() => onOpenChat && onOpenChat(targetUser.connectionId)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-[#16866A] bg-[#E4F6EE] hover:bg-[#D5E9DF] border border-[#D5E9DF] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Connected • Open Chat</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(targetUser)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-[#527568] bg-[#F1FAF5] hover:bg-[#E4F6EE] border border-[#D5E9DF] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <span>Declined • Connect Again</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
