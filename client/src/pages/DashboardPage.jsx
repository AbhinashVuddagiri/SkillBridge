import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  LayoutDashboard,
  Coins,
  Flame,
  Award,
  Calendar,
  Clock,
  ArrowRight,
  CheckCircle,
  XCircle,
  Video,
  User,
  Compass,
  Repeat,
  PlusCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function DashboardPage({ setCurrentView }) {
  const { user, refreshUser, setActiveProposalUser } = useAuth();
  const [exchanges, setExchanges] = useState({ incoming: [], sent: [], active: [], completed: [] });
  const [sessions, setSessions] = useState({ upcoming: [], past: [] });
  const [creditHistory, setCreditHistory] = useState(null);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');

  const loadDashboardData = async () => {
    try {
      const [excRes, sesRes, credRes, matchRes] = await Promise.all([
        api.getExchanges().catch(() => ({ incoming: [], sent: [], active: [], completed: [] })),
        api.getSessions().catch(() => ({ upcoming: [], past: [] })),
        api.getCreditHistory().catch(() => null),
        api.getMatches().catch(() => ({ recommendations: [] }))
      ]);

      setExchanges(excRes);
      setSessions(sesRes);
      setCreditHistory(credRes);
      setMatches(matchRes.recommendations || []);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleUpdateStatus = async (exchangeId, status) => {
    try {
      await api.updateExchangeStatus(exchangeId, status);
      setActionMessage(`Exchange marked as ${status}!`);
      setTimeout(() => setActionMessage(''), 2500);
      await loadDashboardData();
      await refreshUser();
    } catch (err) {
      alert(err.message || 'Failed to update request');
    }
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto py-24 text-center space-y-4">
        <LayoutDashboard className="w-12 h-12 text-[#7657ff] mx-auto" />
        <h2 className="text-xl font-bold text-white">Sign In to View Dashboard</h2>
        <p className="text-xs text-slate-400">Access your skill exchanges, sessions, and matched partners.</p>
      </div>
    );
  }

  // Profile completion score
  const teachCount = user.skillsTeach?.length || 0;
  const learnCount = user.skillsLearn?.length || 0;
  const hasBio = !!user.bio;
  const hasCollege = !!user.college;
  const profileScore = Math.min(
    100,
    (teachCount > 0 ? 30 : 0) +
      (learnCount > 0 ? 30 : 0) +
      (hasBio ? 20 : 0) +
      (hasCollege ? 20 : 0)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Welcome & Stats Row */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/15 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <img
              src={user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.name}`}
              alt={user.name}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-[#7657ff]/40 shadow-xl"
            />
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                  Welcome back, {user.name.split(' ')[0]}!
                </h1>
                <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Flame className="w-3.5 h-3.5 fill-amber-400" />
                  <span>{user.streak || 1}d Streak</span>
                </span>
              </div>
              <p className="text-xs text-slate-300">
                {user.college || 'Active Student'} • {user.educationLevel || 'Undergraduate'}
              </p>
              <div className="flex items-center gap-2 pt-1 text-xs text-[#b7a4ff]">
                <span>Career Goal: {user.careerGoal || 'Full Stack Product Engineer'}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4 shrink-0">
            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
              <div className="flex items-center justify-center gap-1 text-amber-400 mb-0.5">
                <Coins className="w-4 h-4" />
                <span className="text-base sm:text-lg font-extrabold">{user.credits || 0}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Skill Credits</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
              <div className="flex items-center justify-center gap-1 text-[#39d5f6] mb-0.5">
                <Sparkles className="w-4 h-4" />
                <span className="text-base sm:text-lg font-extrabold">{user.xp || 100}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">XP Points</span>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[90px]">
              <div className="flex items-center justify-center gap-1 text-[#10b981] mb-0.5">
                <Repeat className="w-4 h-4" />
                <span className="text-base sm:text-lg font-extrabold">{user.completedExchanges || 0}</span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium">Completed</span>
            </div>
          </div>
        </div>

        {/* Profile Completion Bar */}
        {profileScore < 100 && (
          <div className="mt-6 pt-5 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-slate-300 font-medium">Profile Completion: {profileScore}%</span>
              <div className="w-36 h-2 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#7657ff] to-[#39d5f6] rounded-full"
                  style={{ width: `${profileScore}%` }}
                />
              </div>
            </div>
            <button
              onClick={() => setCurrentView('onboarding')}
              className="text-[#b7a4ff] hover:text-white font-bold flex items-center gap-1 text-xs"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Add more skills or schedule</span>
            </button>
          </div>
        )}
      </div>

      {actionMessage && (
        <div className="p-3.5 rounded-2xl bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4" />
          <span>{actionMessage}</span>
        </div>
      )}

      {/* Main Grid: Incoming/Sent Exchanges & Upcoming Sessions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Active & Incoming Requests (8 Cols) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Incoming Requests */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-[#7657ff]" />
                <h3 className="text-base font-bold text-white">Incoming Exchange Proposals</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#7657ff]/20 text-[#b7a4ff] font-bold">
                {exchanges.incoming.length} Pending
              </span>
            </div>

            {exchanges.incoming.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs rounded-2xl bg-white/5 border border-white/5">
                <Repeat className="w-8 h-8 mx-auto mb-2 opacity-30 text-[#7657ff]" />
                <p>No pending incoming requests right now.</p>
                <p className="text-[11px] text-slate-500 mt-1">
                  When other students propose an exchange for your skills, they will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {exchanges.incoming.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={exc.sender?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${exc.sender?.name}`}
                          alt={exc.sender?.name}
                          className="w-10 h-10 rounded-xl object-cover border border-white/20"
                        />
                        <div>
                          <h4 className="text-xs font-bold text-white">{exc.sender?.name}</h4>
                          <p className="text-[10px] text-slate-400">{exc.sender?.college}</p>
                        </div>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {new Date(exc.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/5 text-xs text-slate-200 space-y-1">
                      <div className="flex items-center gap-2 font-semibold">
                        <span className="text-[#39d5f6]">Offers: {exc.skillOffered}</span>
                        <span className="text-slate-500">⇄</span>
                        <span className="text-[#b7a4ff]">Wants: {exc.skillRequested}</span>
                      </div>
                      {exc.message && (
                        <p className="text-[11px] text-slate-400 italic">"{exc.message}"</p>
                      )}
                      <p className="text-[10px] text-slate-400 font-medium">
                        Schedule: {exc.proposedSchedule}
                      </p>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        onClick={() => handleUpdateStatus(exc.id, 'declined')}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Decline</span>
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(exc.id, 'accepted')}
                        className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md shadow-[#7657ff]/20 flex items-center gap-1"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Accept & Launch Workspace</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Active Exchanges & Learning Workspaces */}
          <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#39d5f6]" />
                <h3 className="text-base font-bold text-white">Active Exchanges & Workspaces</h3>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#39d5f6]/20 text-[#39d5f6] font-bold">
                {exchanges.active.length} In Progress
              </span>
            </div>

            {exchanges.active.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs rounded-2xl bg-white/5 border border-white/5">
                <p>No active exchanges yet. Explore peers and propose an exchange to get started!</p>
                <button
                  onClick={() => setCurrentView('explore')}
                  className="mt-3 px-4 py-2 rounded-xl text-xs font-bold text-white bg-[#7657ff] hover:bg-[#7657ff]/90"
                >
                  Explore Skill Partners
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {exchanges.active.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={exc.partner?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${exc.partner?.name}`}
                        alt={exc.partner?.name}
                        className="w-11 h-11 rounded-xl object-cover border border-white/20"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{exc.partner?.name}</span>
                          <span className="text-[10px] font-semibold text-[#10b981] px-1.5 py-0.2 rounded bg-[#10b981]/15">
                            Active
                          </span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          {exc.skillOffered} ⇄ {exc.skillRequested}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setCurrentView(`workspace_${exc.id}`)}
                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] shadow-md flex items-center gap-1.5"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sent Proposals Status */}
          {exchanges.sent.length > 0 && (
            <div className="glass-card rounded-3xl p-6 sm:p-7 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <h3 className="text-base font-bold text-white">Sent Proposals (Awaiting Response)</h3>
                </div>
                <span className="text-xs text-slate-400">{exchanges.sent.length} sent</span>
              </div>

              <div className="space-y-2.5">
                {exchanges.sent.map((exc) => (
                  <div
                    key={exc.id}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <img
                        src={exc.receiver?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${exc.receiver?.name}`}
                        alt={exc.receiver?.name}
                        className="w-9 h-9 rounded-xl object-cover"
                      />
                      <div>
                        <h5 className="text-xs font-bold text-white">To: {exc.receiver?.name}</h5>
                        <p className="text-[10px] text-slate-400">
                          {exc.skillOffered} for {exc.skillRequested}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-300 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25">
                      Pending Approval
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Upcoming Sessions & Recommended Matches (4 Cols) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Upcoming Sessions Card */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Upcoming Sessions</h3>
              </div>
            </div>

            {sessions.upcoming.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                <Clock className="w-6 h-6 mx-auto mb-2 opacity-30 text-amber-400" />
                <p>No upcoming sessions scheduled.</p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Plan a session from inside an active workspace.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.upcoming.map((ses) => (
                  <div
                    key={ses.id}
                    className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#b7a4ff] px-2 py-0.5 rounded-md bg-[#7657ff]/20">
                        {ses.skillTaught}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(ses.scheduledAt).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>

                    <h5 className="text-xs font-bold text-white line-clamp-1">{ses.title}</h5>

                    <div className="flex items-center justify-between text-[11px] text-slate-300 pt-1">
                      <span>With {ses.partner?.name}</span>
                      <a
                        href={ses.meetingLink || 'https://meet.jit.si'}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded-lg bg-[#10b981]/20 text-[#10b981] font-bold text-[10px] hover:bg-[#10b981]/30 flex items-center gap-1"
                      >
                        <Video className="w-3 h-3" />
                        <span>Join Call</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Matches */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#7657ff]" />
                <h3 className="text-sm font-bold text-white">Smart Match Recommendations</h3>
              </div>
              <button
                onClick={() => setCurrentView('explore')}
                className="text-[11px] text-[#39d5f6] font-bold hover:underline"
              >
                All
              </button>
            </div>

            <div className="space-y-3">
              {matches.slice(0, 3).map((partner) => (
                <div
                  key={partner.id}
                  className="p-3 rounded-2xl bg-white/5 border border-white/5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={partner.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${partner.name}`}
                        alt={partner.name}
                        className="w-8 h-8 rounded-lg object-cover"
                      />
                      <div>
                        <h5 className="text-xs font-bold text-white">{partner.name}</h5>
                        <p className="text-[10px] text-slate-400">{partner.college}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7657ff]/20 text-[#b7a4ff]">
                      {partner.matchDetails?.score || 85}% Match
                    </span>
                  </div>

                  <p className="text-[10px] text-slate-300 line-clamp-1">
                    Teaches: {partner.skillsTeach?.[0]?.name} • Wants: {partner.skillsLearn?.[0]?.name}
                  </p>

                  <div className="pt-1 flex gap-2">
                    <button
                      onClick={() => setCurrentView(`profile_${partner.id}`)}
                      className="flex-1 py-1 text-[10px] font-semibold rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                    >
                      View
                    </button>
                    <button
                      onClick={() => setActiveProposalUser(partner)}
                      className="flex-1 py-1 text-[10px] font-bold rounded-lg bg-[#7657ff] text-white hover:bg-[#7657ff]/90"
                    >
                      Propose
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Badges Gallery */}
          <div className="glass-card rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Your Achievements</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(user.badges || []).map((badge, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2.5"
                >
                  <div className="w-7 h-7 rounded-lg bg-[#7657ff]/20 text-[#b7a4ff] flex items-center justify-center shrink-0">
                    <Award className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="min-w-0">
                    <h6 className="text-[11px] font-bold text-white truncate">{badge.name}</h6>
                    <p className="text-[9px] text-slate-400 truncate">{badge.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
