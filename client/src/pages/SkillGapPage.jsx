import React, { useState, useEffect } from 'react';
import {
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Users,
  ArrowRight,
  TrendingUp,
  BookOpen
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

export default function SkillGapPage({ setCurrentView }) {
  const { user, setActiveProposalUser } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState(
    user?.careerGoal || 'Full Stack Product Engineer'
  );
  const [gapData, setGapData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalysis() {
      setLoading(true);
      try {
        const res = await api.getSkillGapAnalysis(selectedGoal);
        setGapData(res);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalysis();
  }, [selectedGoal]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#7657ff]/20 text-[#b7a4ff] text-xs font-bold">
          <Target className="w-4 h-4 text-[#39d5f6]" />
          <span>Curriculum Benchmark Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
          Career Skill Gap Analyzer
        </h1>
        <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
          Select your target career goal. We analyze your declared skills against industry benchmarks, identify your missing competencies, and pair you with peer mentors who can teach them.
        </p>
      </div>

      {/* Career Goal Selector */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/15 shadow-xl space-y-4">
        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
          Target Career Track:
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            'Full Stack Product Engineer',
            'AI & Machine Learning Engineer',
            'UI/UX Product Designer',
            'Creative Media Technologist'
          ].map((goal) => (
            <button
              key={goal}
              onClick={() => setSelectedGoal(goal)}
              className={`p-4 rounded-2xl text-left border transition-all ${
                selectedGoal === goal
                  ? 'bg-[#7657ff]/20 border-[#7657ff]/50 shadow-md shadow-[#7657ff]/20 text-white'
                  : 'bg-white/5 border-white/5 text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <h4 className="text-xs font-bold">{goal}</h4>
              <span className="text-[10px] text-slate-400 block mt-1">Benchmark Track</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-[#7657ff] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Analyzing skills against syllabus...</p>
        </div>
      ) : gapData ? (
        <div className="space-y-8">
          {/* Summary Progress Card */}
          <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/15">
            <div className="space-y-2 max-w-xl">
              <h3 className="text-xl font-bold text-white">{gapData.careerGoal}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{gapData.description}</p>
              <div className="pt-2 flex items-center gap-4 text-xs">
                <span className="text-[#10b981] font-bold">
                  ✓ {gapData.mastered.length} Mastered Skills
                </span>
                <span>•</span>
                <span className="text-[#39d5f6] font-bold">
                  ⚡ {gapData.missing.length} Skill Gaps to Learn
                </span>
              </div>
            </div>

            {/* Circular Progress Representation */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10 shrink-0">
              <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-[#7657ff] to-[#39d5f6] p-[3px] flex items-center justify-center shadow-lg shadow-[#7657ff]/25">
                <div className="w-full h-full bg-[#0b1020] rounded-full flex items-center justify-center font-extrabold text-sm text-white">
                  {gapData.completionPercentage}%
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-white block">Curriculum Match</span>
                <span className="text-[11px] text-slate-400">
                  {gapData.completionPercentage >= 70
                    ? 'Almost career ready!'
                    : 'Targeted skill swap recommended'}
                </span>
              </div>
            </div>
          </div>

          {/* Missing Gap Skills & Recommended Peer Mentors */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#39d5f6]" />
              <h3 className="text-lg font-bold text-white">
                Identified Skill Gaps & Matched Mentors
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gapData.missing.map((gap, i) => (
                <div
                  key={i}
                  className="glass-card rounded-3xl p-6 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{gap.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          gap.priority === 'High'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {gap.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{gap.description}</p>
                  </div>

                  {/* Mentors available for this skill */}
                  <div className="pt-3 border-t border-white/10 space-y-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Community Mentors Who Teach This:
                    </span>
                    {gap.potentialMentors?.length > 0 ? (
                      <div className="space-y-2">
                        {gap.potentialMentors.map((mentor) => (
                          <div
                            key={mentor.id}
                            className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  mentor.avatar ||
                                  `https://api.dicebear.com/7.x/bottts/svg?seed=${mentor.name}`
                                }
                                alt={mentor.name}
                                className="w-8 h-8 rounded-lg object-cover"
                              />
                              <div>
                                <h5 className="text-xs font-bold text-white">{mentor.name}</h5>
                                <p className="text-[10px] text-slate-400">{mentor.college}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setActiveProposalUser(mentor)}
                              className="px-3 py-1 text-[11px] font-bold rounded-lg bg-[#7657ff] text-white hover:bg-[#7657ff]/90 shadow-sm"
                            >
                              Propose Exchange
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-slate-500 italic">
                        No peers teaching this skill right now. Be the first to request it!
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mastered Skills Showcase */}
          {gapData.mastered.length > 0 && (
            <div className="glass-card rounded-3xl p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                <h3 className="text-base font-bold text-white">Your Mastered Skills for this Track</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {gapData.mastered.map((skill, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-[#10b981]/15 border border-[#10b981]/25 text-[#10b981] text-xs font-semibold flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{skill.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
