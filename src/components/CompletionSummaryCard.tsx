import React from "react";
import { motion } from "framer-motion";
import { cn } from "../utils";

export const CompletionSummaryCard = ({ stats, partnerName, role }: { stats: any, partnerName: string, role: string | undefined }) => {
  const isMale = role === "boyfriend";
  return (
    <div className={cn(
      "p-8 rounded-[2.5rem] border backdrop-blur-xl transition-all",
      isMale ? "bg-card/40 border-border" : "bg-card/40 border-border"
    )}>
      <div className="flex items-center justify-between mb-6">
         <h3 className={cn("text-[10px] font-black uppercase tracking-[0.3em]", isMale ? "text-text/50" : "text-primary/60")}>
            {partnerName}'s Progress
         </h3>
         <div className={cn("px-3 py-1 rounded-full text-[10px] font-black", isMale ? "bg-bg text-text/80 border border-border" : "bg-primary/10 text-primary")}>
            {Math.round(stats.progressPct || 0)}% Today
         </div>
      </div>
      <div className="flex items-center gap-6">
         <div className="relative w-20 h-20">
            <svg className="w-full h-full -rotate-90">
               <circle cx="40" cy="40" r="36" fill="none" stroke={isMale ? "var(--border)" : "#fff1f5"} strokeWidth="8" />
               <motion.circle 
                 cx="40" cy="40" r="36" fill="none" 
                 stroke={isMale ? "currentColor" : "var(--color-primary)"} 
                 strokeWidth="8"
                 strokeDasharray={226}
                 initial={{ strokeDashoffset: 226 }}
                 animate={{ strokeDashoffset: 226 - (2.26 * stats.progressPct) }}
                 transition={{ duration: 1.5, ease: "easeOut" }}
                 strokeLinecap="round"
                 className={isMale ? "text-text" : ""}
               />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
               <span className={cn("text-lg font-black", isMale ? "text-text" : "text-text")}>{stats.maxStreak}d</span>
            </div>
         </div>
         <div className="flex-1">
            <p className={cn("text-sm font-bold", isMale ? "text-text/90" : "text-text/70")}>
               Keeping up the glow!
            </p>
            <p className={cn("text-[9px] font-black uppercase tracking-widest mt-1", isMale ? "text-text/50" : "text-text/20")}>
               Streak is looking healthy
            </p>
         </div>
      </div>
    </div>
  );
};
