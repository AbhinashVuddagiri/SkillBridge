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
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] text-xs font-bold">
          <Target className="w-4 h-4 text-[#16866A]" />
          <span>Curriculum Benchmark Engine</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-[#164E41] tracking-tight">
          Career Skill Gap Analyzer
        </h1>
        <p className="text-xs sm:text-sm text-[#527568] max-w-2xl leading-relaxed">
          Select your target career goal. We analyze your declared skills against industry benchmarks, identify your missing competencies, and pair you with peer mentors who can teach them.
        </p>
      </div>

      {/* Career Goal Selector */}
      <div className="bg-white rounded-3xl p-6 sm:p-7 border border-[#D5E9DF] shadow-xs space-y-4">
        <label className="block text-xs font-bold text-[#164E41] uppercase tracking-wider">
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
              className={`p-4 rounded-2xl text-left border transition-all cursor-pointer ${
                selectedGoal === goal
                  ? 'bg-[#E4F6EE] border-[#16866A] shadow-xs text-[#164E41]'
                  : 'bg-[#F1FAF5] border-[#D5E9DF] text-[#527568] hover:text-[#164E41] hover:bg-[#E4F6EE]'
              }`}
            >
              <h4 className="text-xs font-bold text-[#164E41]">{goal}</h4>
              <span className="text-[10px] text-[#527568] block mt-1">Benchmark Track</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 text-center">
          <div className="w-10 h-10 border-2 border-[#16866A] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-[#527568]">Analyzing skills against syllabus...</p>
        </div>
      ) : gapData ? (
        <div className="space-y-8">
          {/* Summary Progress Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-[#D5E9DF] shadow-xs">
            <div className="space-y-2 max-w-xl">
              <h3 className="text-xl font-bold text-[#164E41]">{gapData.careerGoal}</h3>
              <p className="text-xs text-[#527568] leading-relaxed">{gapData.description}</p>
              <div className="pt-2 flex items-center gap-4 text-xs">
                <span className="text-[#16866A] font-bold">
                  ✓ {gapData.mastered.length} Mastered Skills
                </span>
                <span className="text-[#527568]">•</span>
                <span className="text-[#164E41] font-bold">
                  ⚡ {gapData.missing.length} Skill Gaps to Learn
                </span>
              </div>
            </div>

            {/* Circular Progress Representation */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#F1FAF5] border border-[#D5E9DF] shrink-0">
              <div className="w-16 h-16 rounded-full bg-[#16866A] p-[3px] flex items-center justify-center shadow-xs">
                <div className="w-full h-full bg-white rounded-full flex items-center justify-center font-extrabold text-sm text-[#16866A]">
                  {gapData.completionPercentage}%
                </div>
              </div>
              <div>
                <span className="text-xs font-bold text-[#164E41] block">Curriculum Match</span>
                <span className="text-[11px] text-[#527568]">
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
              <AlertCircle className="w-5 h-5 text-[#16866A]" />
              <h3 className="text-lg font-bold text-[#164E41]">
                Identified Skill Gaps & Matched Mentors
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {gapData.missing.map((gap, i) => (
                <div
                  key={i}
                  className="bg-white rounded-3xl p-6 space-y-4 flex flex-col justify-between border border-[#D5E9DF] shadow-xs"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#164E41]">{gap.name}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          gap.priority === 'High'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {gap.priority} Priority
                      </span>
                    </div>
                    <p className="text-xs text-[#527568]">{gap.description}</p>
                  </div>

                  {/* Mentors available for this skill */}
                  <div className="pt-3 border-t border-[#D5E9DF] space-y-2">
                    <span className="text-[10px] font-bold text-[#527568] uppercase tracking-wider block">
                      Community Mentors Who Teach This:
                    </span>
                    {gap.potentialMentors?.length > 0 ? (
                      <div className="space-y-2">
                        {gap.potentialMentors.map((mentor) => (
                          <div
                            key={mentor.id}
                            className="p-2.5 rounded-xl bg-[#F1FAF5] border border-[#D5E9DF] flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5">
                              <img
                                src={
                                  mentor.avatar ||
                                  `https://api.dicebear.com/7.x/bottts/svg?seed=${mentor.name}`
                                }
                                alt={mentor.name}
                                className="w-8 h-8 rounded-lg object-cover border border-[#D5E9DF]"
                              />
                              <div>
                                <h5 className="text-xs font-bold text-[#164E41]">{mentor.name}</h5>
                                <p className="text-[10px] text-[#527568]">{mentor.college}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setActiveProposalUser(mentor)}
                              className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-[#16866A] hover:bg-[#0F7058] text-white shadow-xs cursor-pointer transition-all"
                            >
                              Propose Exchange
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-[#527568] italic">
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
            <div className="bg-white rounded-3xl p-6 space-y-4 border border-[#D5E9DF] shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-[#16866A]" />
                <h3 className="text-base font-bold text-[#164E41]">Your Mastered Skills for this Track</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {gapData.mastered.map((skill, idx) => (
                  <div
                    key={idx}
                    className="px-3 py-1.5 rounded-xl bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A] text-xs font-semibold flex items-center gap-1.5"
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
