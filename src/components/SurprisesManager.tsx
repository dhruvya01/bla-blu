import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mail, X, Heart, Lock, Sparkles } from "lucide-react";
import { useAppStore } from "../store";
import { doc, setDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase/config";
import { sensory } from "../utils/sensory";
import { cn } from "../utils";

export function SurprisesManager() {
  const roomId = useAppStore(state => state.roomId);
  const user = useAppStore(state => state.user);
  const partner = useAppStore(state => state.partner);
  const allEnvelopes = useAppStore(state => state.envelopes);
  
  const partnerName = partner?.nickname || "Partner";
  
  const [activeEnvelope, setActiveEnvelope] = useState<any | null>(null);

  const now = Date.now();
  
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("blablu_dismissed_envelopes") || "[]");
    } catch { return []; }
  });

  const dismissEnvelope = async (id: string) => {
    const newDismissed = [...dismissedIds, id];
    setDismissedIds(newDismissed);
    localStorage.setItem("blablu_dismissed_envelopes", JSON.stringify(newDismissed));
    sensory.tap();
    
    // Also mark as opened in Firestore so it doesn't reappear
    if (roomId) {
      try {
        await setDoc(doc(db, "pairs", roomId, "envelopes", id), { opened: true }, { merge: true });
      } catch (e) {
        handleFirestoreError(e, 'write', 'pairs/' + roomId + '/envelopes/' + id);
      }
    }
  };

  // Envelopes for me that are not opened yet
  const envelopes = allEnvelopes.filter((d: any) => {
    if (d.recipientId !== user?.uid || d.opened) return false;

    const isLocked = d.scheduledFor && now < d.scheduledFor;
    const wasDismissed = dismissedIds.includes(d.id);
    
    // Love Letter logic: ONLY show when the day arrives
    if (d.type === 'letter') {
      return !isLocked; // Hide if locked
    }
    
    // Quick Surprise Envelope logic: Show for a moment then hide
    if (d.type === 'quick' || !d.type) {
      if (wasDismissed) return false;
      return true;
    }

    return true;
  });

  // Auto-dismiss quick envelopes after 15 seconds
  useEffect(() => {
    const first = envelopes[0];
    if (first && (first.type === 'quick' || !first.type)) {
      const timer = setTimeout(() => {
        dismissEnvelope(first.id);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [envelopes]);

  const openEnvelope = async (env: any) => {
    sensory.play('swoosh');
    sensory.tap();
    setActiveEnvelope(env);
    
    if (!roomId || !env?.id) return;
    try {
      await setDoc(doc(db, "pairs", roomId, "envelopes", env.id), { opened: true }, { merge: true });
    } catch (e) {
      handleFirestoreError(e, 'write', 'pairs/' + roomId + '/envelopes/' + env.id);
    }
  };

  return (
    <>
      <AnimatePresence>
        {envelopes.length > 0 && !activeEnvelope && (
          <div className="fixed inset-x-0 bottom-32 z-50 pointer-events-none flex flex-col items-center justify-center gap-3">
            {envelopes.slice(0, 2).map((env: any) => {
              const isLetter = env.type === 'letter';
              return (
                <motion.div
                  key={env.id}
                  initial={{ opacity: 0, y: 50, scale: 0.9 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0, 
                    scale: 1,
                  }}
                  transition={{ type: "spring", damping: 20, stiffness: 300 }}
                  exit={{ opacity: 0, scale: 0.8, y: 20 }}
                  className="pointer-events-auto relative group px-6"
                >
                   {/* Minimalist Surprise Notification */}
                   <div 
                     onClick={() => openEnvelope(env)}
                     className={cn(
                       "flex items-center gap-4 bg-card backdrop-blur-md border border-border rounded-3xl p-3 pl-4 shadow-xl cursor-pointer hover:scale-105 active:scale-95 transition-all ring-4 ring-primary/5",
                       isLetter ? "bg-amber-50/90 border-amber-100 ring-amber-50" : ""
                     )}
                   >
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center shadow-inner",
                        isLetter ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-500"
                      )}>
                        {isLetter ? <Mail size={24} /> : <Heart size={24} fill="currentColor" />}
                      </div>
                      <div className="flex flex-col">
                        <p className="text-[10px] font-black uppercase tracking-widest text-text/40 leading-none mb-1">
                          {isLetter ? "Love Letter Arrived!" : "Quick Surprise!"}
                        </p>
                        <p className="text-sm font-bold text-text">Tap to read from {partnerName}</p>
                      </div>
                      <div className="ml-2 w-8 h-8 rounded-full bg-bg flex items-center justify-center text-rose-300">
                        <X size={14} onClick={(e) => { e.stopPropagation(); dismissEnvelope(env.id); }} />
                      </div>
                   </div>
                </motion.div>
              );
            })}
          </div>
        )}
        {activeEnvelope && (
          <EnvelopeOpeningModal 
            envelope={activeEnvelope} 
            partnerName={partnerName}
            onClose={() => setActiveEnvelope(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

function EnvelopeOpeningModal({ envelope, partnerName, onClose }: { envelope: any, partnerName: string, onClose: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setIsOpen(true);
      sensory.play('pop');
      setShowConfetti(true);
      sensory.important();
    }, 400);
    return () => clearTimeout(t);
  }, []);

  const themeStyles: Record<string, string> = {
    classic: "bg-[#FFFAF0] border-amber-100 font-serif",
    romantic: "bg-rose-50 border-rose-100 font-serif",
    minimal: "bg-card border-border font-sans",
    night: "bg-slate-900 border-indigo-900 text-indigo-50 font-serif"
  };

  const style = themeStyles[envelope.theme || "classic"] || themeStyles.classic;

  return (
    <motion.div
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {showConfetti && <ConfettiBurst />}

      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className={cn("relative w-full max-w-sm rounded-[2rem] p-10 shadow-2xl border-4 flex flex-col items-center text-center", style)}
        onClick={e => e.stopPropagation()}
      >
         <div className="absolute top-6 right-6">
            <button onClick={onClose} className="opacity-20 hover:opacity-100 transition-opacity">
               <X size={20} />
            </button>
         </div>

         <div className="mb-6">
            <Sparkles size={32} className={cn("opacity-40", envelope.theme === 'night' ? 'text-indigo-400' : 'text-primary')} />
         </div>
         
         <p className="text-xl font-medium leading-relaxed italic mb-8">
           "{envelope.text}"
         </p>

         <div className="mt-auto">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 mb-1">With all my love,</p>
            <p className="text-xl font-bold">{partnerName}</p>
         </div>

         <button 
            onClick={onClose}
            className="mt-10 px-10 py-3 bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg active:scale-95 transition-all"
         >
            Keep Forever
         </button>
      </motion.div>
    </motion.div>
  );
}

function ConfettiBurst() {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      {[...Array(24)].map((_, i) => (
        <motion.div
           key={i}
           initial={{ scale: 0, x: 0, y: 0 }}
           animate={{ 
             scale: [0, 1.2, 0.8, 0], 
             x: (Math.random() - 0.5) * 400, 
             y: (Math.random() - 0.5) * 400 - 100,
             rotate: Math.random() * 720
           }}
           transition={{ duration: 1.5, ease: "easeOut", delay: 0.1 }}
           className={cn("absolute", i % 3 === 0 ? "text-rose-400" : i % 3 === 1 ? "text-primary" : "text-yellow-400")}
        >
          {i % 2 === 0 ? <Heart size={16} fill="currentColor" /> : <Sparkles size={14} />}
        </motion.div>
      ))}
    </div>
  );
}
