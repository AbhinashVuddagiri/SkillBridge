import React, { useState, useEffect } from 'react';
import {
  Search,
  Sparkles,
  BookOpen,
  GraduationCap,
  MessageSquare,
  Clock,
  UserCheck,
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
          <span className="text-xs font-bold uppercase tracking-wider text-[#39d5f6]">
            Skill Discovery
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight mt-1">
            Explore Skills
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
            Find peers who can teach what you want to learn, and share what you already know.
          </p>
        </div>

        {/* Functional Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by skill name (e.g. Python, UI Design, React, Guitar)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl glass-panel text-xs sm:text-sm text-white placeholder-slate-400 border border-white/15 focus:outline-none focus:border-[#7657ff] focus:ring-1 focus:ring-[#7657ff]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
          {errorMsg}
        </div>
      )}

      {/* Grid of User Cards */}
      {loading ? (
        <div className="py-24 text-center space-y-3">
          <div className="w-10 h-10 border-2 border-[#7657ff] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-400">Loading completed learner profiles...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center max-w-lg mx-auto border border-white/15 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-white">No Profiles Found</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            {searchQuery
              ? `No registered learners matched the skill query "${searchQuery}". Try a different skill name or clear the search.`
              : 'There are no other learners with completed profiles yet. Register a second account to test skill exchanges, or invite fellow learners!'}
          </p>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-white/10 hover:bg-white/20 border border-white/10"
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
                className="glass-panel rounded-3xl p-6 border border-white/15 flex flex-col justify-between space-y-5 shadow-xl group skill-card-hover cursor-default focus:outline-none"
              >
                {/* 1. Profile Picture & 2. Full Name & 3. Institute Name */}
                <div className="flex items-start gap-4">
                  <img
                    src={targetUser.avatar}
                    alt={targetUser.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#7657ff]/30 shadow-md shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-white truncate group-hover:text-[#39d5f6] transition-colors">
                      {targetUser.name}
                    </h3>
                    <p className="text-xs text-slate-300 flex items-center gap-1.5 mt-0.5 truncate">
                      <GraduationCap className="w-3.5 h-3.5 text-[#39d5f6] shrink-0" />
                      <span className="truncate">{targetUser.instituteName || 'Independent Learner'}</span>
                    </p>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                      @{targetUser.username || targetUser.bridgeAccount}
                    </p>
                  </div>
                </div>

                {/* 4. Skills They Can Teach */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#39d5f6] uppercase tracking-wider">
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
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#39d5f6]/15 border border-[#39d5f6]/30 text-[#39d5f6]"
                          >
                            {name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500">None listed</span>
                    )}
                  </div>
                </div>

                {/* 5. Skills They Want to Learn */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#b7a4ff] uppercase tracking-wider">
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Wants to Learn</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {(targetUser.skillsLearn || []).length > 0 ? (
                      targetUser.skillsLearn.map((skill, idx) => {
                        const name = typeof skill === 'string' ? skill : skill.name;
                        return (
                          <span
                            key={idx}
                            className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#7657ff]/20 border border-[#7657ff]/35 text-[#b7a4ff]"
                          >
                            {name}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-500">None listed</span>
                    )}
                  </div>
                </div>

                {/* 6. Connect Button or Connection Status */}
                <div className="pt-2 border-t border-white/10">
                  {status === 'none' ? (
                    <button
                      onClick={() => handleConnect(targetUser)}
                      disabled={isConnecting}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md shadow-[#7657ff]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {isConnecting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Connect</span>
                    </button>
                  ) : status === 'pending' ? (
                    targetUser.isRequester ? (
                      <button
                        disabled
                        className="w-full py-2.5 rounded-xl text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 flex items-center justify-center gap-2 cursor-not-allowed select-none"
                      >
                        <Clock className="w-3.5 h-3.5" />
                        <span>Pending</span>
                      </button>
                    ) : (
                      <div className="w-full py-2 rounded-xl text-xs font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 text-center">
                        Request Received (Check Notifications)
                      </div>
                    )
                  ) : status === 'accepted' ? (
                    <button
                      onClick={() => onOpenChat && onOpenChat(targetUser.connectionId)}
                      className="w-full py-2.5 rounded-xl text-xs font-bold text-emerald-300 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/35 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Connected • Open Chat</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleConnect(targetUser)}
                      className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-300 bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center gap-2 transition-colors"
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
