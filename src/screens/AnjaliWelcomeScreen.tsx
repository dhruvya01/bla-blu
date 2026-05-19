import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Sparkles } from "lucide-react";
import { sensory } from "../utils/sensory";

interface AnjaliWelcomeScreenProps {
  onDismiss: () => void;
}

export function AnjaliWelcomeScreen({ onDismiss }: AnjaliWelcomeScreenProps) {
  const fullText = `welcome to our app, baby.

here is your surprise. i know it's not perfect and i'm still tweaking things, but it's finally yours. i spent the last two months working on this, and there were times it got so tough i almost lost hope. but i kept going because i just wanted to make something special for us. i hope it brings a smile to your face. i love you so much.

(haha, i know you already knew about it anyway)`;
  const [displayText, setDisplayText] = useState("");
  const [showButton, setShowButton] = useState(false);

  useEffect(() => {
    sensory.play("pop");
    let index = 0;

    // A rotating pool of Audio elements to ensure crisp, lag-free typewriter sounds on mobile
    const tickSoundUrl = "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3";
    const audioPool = [...Array(4)].map(() => {
      const a = new Audio(tickSoundUrl);
      a.volume = 0.12; // soft, premium, elegant volume
      return a;
    });
    let poolIndex = 0;

    const interval = setInterval(() => {
      if (index < fullText.length) {
        setDisplayText(fullText.substring(0, index + 1));
        
        // Play click sound on each typewriter letter (skip spaces for natural flow)
        const char = fullText[index];
        if (char !== " ") {
          const audio = audioPool[poolIndex];
          audio.currentTime = 0;
          audio.play().catch(() => {});
          poolIndex = (poolIndex + 1) % audioPool.length;
        }

        // Soft, occasional haptic tick
        if (index % 5 === 0) {
          sensory.tap();
        }

        index++;
      } else {
        clearInterval(interval);
        setShowButton(true);
        sensory.play("success");
      }
    }, 90);

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    sensory.play("pop");
    onDismiss();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1 }}
      className="fixed inset-0 z-[99999] flex flex-col items-center justify-between p-8 bg-[#0b0709] overflow-hidden select-none"
    >
      {/* Aesthetic glowing background blobs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-rose-500/10 blur-[80px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-primary/10 blur-[90px] pointer-events-none animate-pulse" style={{ animationDelay: "2s" }} />

      {/* Floating Sparkles & Hearts */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ y: "110%", x: `${Math.random() * 100}%`, opacity: 0, scale: 0.5 + Math.random() * 0.5 }}
            animate={{
              y: "-10%",
              opacity: [0, 0.7, 0.7, 0],
              x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`],
              rotate: [0, 360],
            }}
            transition={{
              duration: 8 + Math.random() * 10,
              repeat: Infinity,
              delay: i * 1.5,
              ease: "easeInOut",
            }}
            className="absolute text-rose-300/30"
          >
            {i % 2 === 0 ? <Heart size={16} className="fill-rose-300/10" /> : <Sparkles size={14} />}
          </motion.div>
        ))}
      </div>

      {/* Top Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 0.4 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-1.5 mt-8 z-10"
      >
        <Sparkles size={14} className="text-rose-400" />
        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-300">our littel home</span>
        <Sparkles size={14} className="text-rose-400" />
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center max-w-sm text-center px-4 z-10">
        
        {/* Animated Heart Icon */}
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ repeat: Infinity, duration: 1.4, ease: "easeInOut" }}
          className="w-20 h-20 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center shadow-2xl shadow-rose-500/15 mb-10"
        >
          <Heart size={36} className="text-rose-400 fill-rose-400" />
        </motion.div>

        {/* Dynamic Typewriter Text */}
        <div className="min-h-[260px] flex items-center justify-center py-2">
          <p className="text-sm font-bold text-rose-100 tracking-normal leading-relaxed font-display whitespace-pre-wrap text-left">
            {displayText}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ repeat: Infinity, duration: 0.6 }}
              className="inline-block w-1 h-3.5 bg-rose-400 ml-0.5 rounded-full align-middle"
            />
          </p>
        </div>
      </div>

      {/* Action Button */}
      <div className="mb-12 h-16 flex items-center justify-center z-10">
        <AnimatePresence>
          {showButton && (
            <motion.button
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              onClick={handleDismiss}
              className="px-8 py-3.5 bg-gradient-to-r from-rose-500 to-primary text-white text-[11px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-rose-500/30 border border-white/10 active:scale-95 transition-transform flex items-center gap-2"
            >
              enter our space ❤️
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
