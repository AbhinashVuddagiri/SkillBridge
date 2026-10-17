import React from 'react';
import { useTheme } from '../context/ThemeContext';

export default function LiquidBackground() {
  const { isDark } = useTheme();

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Liquid Gradient Orbs */}
      <div
        className={`absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] blob-1 opacity-40 ${
          isDark ? 'bg-[#7657ff]' : 'bg-[#7657ff]/30'
        }`}
      />
      <div
        className={`absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full blur-[140px] blob-2 opacity-35 ${
          isDark ? 'bg-[#39d5f6]' : 'bg-[#39d5f6]/25'
        }`}
      />
      <div
        className={`absolute -bottom-32 left-1/4 w-[36rem] h-[36rem] rounded-full blur-[130px] blob-3 opacity-30 ${
          isDark ? 'bg-[#b7a4ff]' : 'bg-[#b7a4ff]/25'
        }`}
      />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
}
