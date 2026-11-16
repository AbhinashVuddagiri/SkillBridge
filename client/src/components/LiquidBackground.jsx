import React from 'react';

export default function LiquidBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {/* Soft Ambient Mint Gradient Orbs */}
      <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full blur-[120px] blob-1 opacity-40 bg-[#A8E6CF]/30" />
      <div className="absolute top-1/3 -right-32 w-[32rem] h-[32rem] rounded-full blur-[140px] blob-2 opacity-35 bg-[#D5E9DF]/40" />
      <div className="absolute -bottom-32 left-1/4 w-[36rem] h-[36rem] rounded-full blur-[130px] blob-3 opacity-30 bg-[#A8E6CF]/25" />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, #16866A 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />
    </div>
  );
}
