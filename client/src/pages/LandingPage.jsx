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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#E4F6EE] border border-[#D5E9DF] text-[#16866A] text-xs font-semibold shadow-xs">
          <Sparkles className="w-4 h-4 text-[#16866A]" />
          <span>Peer-to-Peer Learning Platform</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-[#164E41] leading-tight">
          Share Skills.{' '}
          <span className="text-[#16866A]">
            Learn Together.
          </span>
        </h1>

        <p className="text-sm sm:text-base text-[#527568] leading-relaxed max-w-2xl mx-auto font-normal">
          SkillBridge is a community where people exchange skills without money.
          Teach what you know, learn what you want, and grow through direct 1-on-1 peer collaboration.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <button
            onClick={() => setCurrentView('explore')}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-md shadow-[#16866A]/20 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <Compass className="w-4 h-4 text-white group-hover:rotate-45 transition-transform" />
            <span>Explore Skills</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          {!isAuthenticated ? (
            <button
              onClick={() => openAuth('register')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-semibold text-[#164E41] bg-white hover:bg-[#F1FAF5] border border-[#D5E9DF] shadow-xs transition-all cursor-pointer"
            >
              Get Started Free
            </button>
          ) : (
            <button
              onClick={() => setCurrentView('profile')}
              className="w-full sm:w-auto px-8 py-3.5 rounded-2xl text-sm font-semibold text-[#164E41] bg-white hover:bg-[#F1FAF5] border border-[#D5E9DF] shadow-xs transition-all cursor-pointer"
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
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-amber-200 shadow-sm relative overflow-hidden">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#164E41]">Complete Your Profile to Get Discovered</h3>
                    <p className="text-xs text-[#527568] mt-1 leading-relaxed">
                      You are not yet visible in Explore Skills. Add at least one skill you can teach and one skill you want to learn.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('profile')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-sm shrink-0 w-full sm:w-auto text-center cursor-pointer"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D5E9DF] shadow-sm">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-2xl bg-[#E4F6EE] text-[#16866A] border border-[#D5E9DF] shrink-0">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-[#164E41]">Your Profile is Active & Public</h3>
                    <p className="text-xs text-[#527568] mt-1 leading-relaxed">
                      Learners can now find you in Explore Skills. Head over to discover people who can teach what you want to learn!
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setCurrentView('explore')}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#16866A] hover:bg-[#0F7058] shadow-sm shrink-0 w-full sm:w-auto text-center cursor-pointer"
                >
                  Browse Peers
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Feature Cards (Clean white background, soft mint borders, dark green headings) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto pt-4">
        <div className="bg-white rounded-3xl p-6 border border-[#D5E9DF] space-y-3 shadow-xs hover:border-[#A8E6CF] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#E4F6EE] text-[#16866A] flex items-center justify-center border border-[#D5E9DF]">
            <Coins className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#164E41]">Zero Financial Cost</h3>
          <p className="text-xs text-[#527568] leading-relaxed">
            Exchange skills fairly without currency or payments. Your knowledge is your sole currency.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D5E9DF] space-y-3 shadow-xs hover:border-[#A8E6CF] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#E4F6EE] text-[#16866A] flex items-center justify-center border border-[#D5E9DF]">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#164E41]">Direct Peer Matching</h3>
          <p className="text-xs text-[#527568] leading-relaxed">
            Find peers who can teach the skills you need and want to learn what you already know.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-[#D5E9DF] space-y-3 shadow-xs hover:border-[#A8E6CF] transition-colors">
          <div className="w-10 h-10 rounded-xl bg-[#E4F6EE] text-[#16866A] flex items-center justify-center border border-[#D5E9DF]">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-[#164E41]">Private & Secure</h3>
          <p className="text-xs text-[#527568] leading-relaxed">
            Unique username handles with protected private messaging once connections are accepted.
          </p>
        </div>
      </section>
    </div>
  );
}
