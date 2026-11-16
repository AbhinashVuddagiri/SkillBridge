import React from 'react';
import { Sparkles } from 'lucide-react';

export default function Footer({ setCurrentView }) {
  return (
    <footer className="relative mt-20 border-t border-[#D5E9DF] bg-white/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white border border-[#D5E9DF] p-0.5 flex items-center justify-center shadow-xs overflow-hidden shrink-0">
              <img
                src="/logo.png"
                alt="SkillBridge Logo"
                className="w-full h-full object-contain rounded-lg"
              />
            </div>
            <div>
              <span className="font-extrabold text-base text-[#164E41] tracking-tight">
                SkillBridge
              </span>
              <p className="text-[10px] text-[#527568]">Share Skills. Learn Together.</p>
            </div>
          </div>

          {/* Quick Links */}
          <div className="flex items-center gap-6 text-xs text-[#527568]">
            <button
              onClick={() => setCurrentView('home')}
              className="hover:text-[#16866A] transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              onClick={() => setCurrentView('explore')}
              className="hover:text-[#16866A] transition-colors cursor-pointer"
            >
              Explore Skills
            </button>
            <button
              onClick={() => setCurrentView('profile')}
              className="hover:text-[#16866A] transition-colors cursor-pointer"
            >
              Update Profile
            </button>
          </div>

          {/* Copyright */}
          <div className="text-xs text-[#527568]/80 flex items-center gap-1.5">
            <span>© 2026 SkillBridge. No money required.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
