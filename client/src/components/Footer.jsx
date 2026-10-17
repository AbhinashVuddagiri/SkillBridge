import React from 'react';
import { Sparkles, Heart } from 'lucide-react';

export default function Footer({ setCurrentView }) {
  return (
    <footer className="relative mt-20 border-t border-white/10 bg-slate-950/40 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#7657ff] to-[#39d5f6] p-[2px]">
              <div className="w-full h-full bg-[#0b1020] rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-[#39d5f6]" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base text-white tracking-tight">
                SkillBridge
              </span>
              <p className="text-[10px] text-slate-400">Share Skills. Learn Together.</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-6 text-xs text-slate-400">
            <button
              onClick={() => setCurrentView('home')}
              className="hover:text-white transition-colors"
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView('explore')}
              className="hover:text-white transition-colors"
            >
              Explore Skills
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className="hover:text-white transition-colors"
            >
              Update Profile
            </button>
          </div>

          {/* Copyright */}
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <span>© 2026 SkillBridge. No money required.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
