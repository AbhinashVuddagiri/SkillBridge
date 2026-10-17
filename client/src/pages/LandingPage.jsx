import React from 'react';
import {
  Sparkles,
  Compass,
  ArrowRight,
  ShieldCheck,
  Coins,
  Users,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage({ setCurrentView }) {
  const { user, isAuthenticated, openAuth } = useAuth();

  return (
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-16">
      {/* Hero Section */}
      <section className="text-center max-w-3xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#7657ff]/15 border border-[#7657ff]/30 text-[#b7a4ff] text-xs font-semibold backdrop-blur-md shadow-sm">
          <Sparkles className="w-4 h-4 text-[#39d5f6]" />
          <span>Peer-to-Peer Learning Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-white leading-tight">
          Share Skills.{' '}
          <span className="bg-gradient-to-r from-[#7657ff] via-[#b7a4ff] to-[#39d5f6] bg-clip-text text-transparent">
            Learn Together.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-2xl mx-auto font-normal">
          SkillBridge is a community where people exchange skills without money.
          Teach what you know, learn what you want, and grow through direct 1-on-1 peer collaboration.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setCurrentView('explore')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-xl shadow-[#7657ff]/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Compass className="w-4 h-4 text-white group-hover:rotate-45 transition-transform" />
            <span>Explore Skills</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {!isAuthenticated ? (
            <button
              onClick={() => openAuth('register')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-semibold text-slate-200 glass-panel hover:bg-white/10 hover:text-white border border-white/15 transition-all"
            >
              Get Started Free
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('profile')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-semibold text-slate-200 glass-panel hover:bg-white/10 hover:text-white border border-white/15 transition-all"
            >
              Update Profile
            </button>
          )}
        </div>
      </section>

      {/* Profile Completion Call to Action */}
      {isAuthenticated && (
        <section className="max-w-3xl mx-auto">
          {!user?.profileCompleted ? (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/30 bg-amber-500/5 relative overflow-hidden shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Complete Your Profile to Get Discovered</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      You are not yet visible in Explore Skills. Add at least one skill you can teach and one skill you want to learn.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('profile')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7657ff] to-[#39d5f6] hover:opacity-95 shadow-md shadow-[#7657ff]/20 shrink-0 w-full sm:w-auto text-center"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-emerald-500/30 bg-emerald-500/5 shadow-xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Your Profile is Active & Public</h3>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                      Learners can now find you in Explore Skills. Head over to discover people who can teach what you want to learn!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('explore')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 shrink-0 w-full sm:w-auto text-center"
                >
                  Browse Peers
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Minimal Feature Cards (Simple, beautiful, minimal text) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-4">
        <div className="glass-panel rounded-3xl p-6 border border-white/15 space-y-3 hover:border-[#7657ff]/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#7657ff]/20 text-[#39d5f6] flex items-center justify-center border border-[#7657ff]/30">
            <Coins className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Zero Financial Cost</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Exchange skills fairly without currency or payments. Your knowledge is your sole currency.
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-white/15 space-y-3 hover:border-[#7657ff]/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#39d5f6]/20 text-[#39d5f6] flex items-center justify-center border border-[#39d5f6]/30">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Direct Peer Matching</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Find peers who can teach the skills you need and want to learn what you already know.
          </p>
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-white/15 space-y-3 hover:border-[#7657ff]/40 transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#b7a4ff]/20 text-[#b7a4ff] flex items-center justify-center border border-[#b7a4ff]/30">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-white">Private & Secure</h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unique username handles with protected private messaging once connections are accepted.
          </p>
        </div>
      </section>
    </div>
  );
}
