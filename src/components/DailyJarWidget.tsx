import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { sensory } from '../utils/sensory';
import { Heart, Plus, Sparkles, X } from 'lucide-react';
import { cn } from '../utils';

interface JarData {
  reasons: string[];
  unlockedCount: number;
  lastUnlockedAt: number;
}

export function DailyJarWidget() {
  const { roomId, user, partner, pair, theme } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const [jarData, setJarData] = useState<JarData | null>(null);
  const [showJarModal, setShowJarModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [revealedReason, setRevealedReason] = useState<string | null>(null);

  // We are looking at OUR jar (reasons written by partner for us)
  const myJarRef = roomId && user ? doc(db, 'pairs', roomId, 'jars', user.uid) : null;
  // We write to PARTNER'S jar
  const partnerId = pair?.partnerIds?.find((id: string) => id !== user?.uid) || partner?.uid;
  const partnerJarRef = roomId && partnerId ? doc(db, 'pairs', roomId, 'jars', partnerId) : null;

  useEffect(() => {
    if (!myJarRef) return;
    const unsub = onSnapshot(myJarRef, (snap) => {
      if (snap.exists()) {
        setJarData(snap.data() as JarData);
      } else {
        setJarData({ reasons: [], unlockedCount: 0, lastUnlockedAt: 0 });
      }
    });
    return unsub;
  }, [roomId, user?.uid]);

  const canUnlockToday = jarData && jarData.unlockedCount < jarData.reasons.length;

  const handleTapJar = async () => {
    if (!jarData) return;
    sensory.play('swoosh');
    
    if (canUnlockToday) {
      // Unlock new reason
      const newCount = jarData.unlockedCount + 1;
      const reasonToReveal = jarData.reasons[newCount - 1];
      
      setRevealedReason(reasonToReveal);
      setShowJarModal(true);
      sensory.play('pop');
      sensory.important();

      if (myJarRef) {
        try {
          await updateDoc(myJarRef, {
            unlockedCount: newCount,
            lastUnlockedAt: Date.now()
          });
        } catch (e) {
          handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${user?.uid}`);
        }
      }
    } else {
      // Just show modal with previously unlocked reasons
      setShowJarModal(true);
      setRevealedReason(null);
    }
  };

  const handleAddReason = async () => {
    if (!newReason.trim() || !partnerJarRef) return;
    sensory.tap();
    try {
      const { getDoc } = await import('firebase/firestore');
      const partnerSnap = await getDoc(partnerJarRef);
      let existingReasons: string[] = [];
      
      if (partnerSnap.exists()) {
        existingReasons = (partnerSnap.data() as JarData).reasons || [];
      }
      
      await setDoc(partnerJarRef, {
        reasons: [...existingReasons, newReason.trim()],
        unlockedCount: partnerSnap.exists() ? (partnerSnap.data().unlockedCount ?? 0) : 0,
        lastUnlockedAt: partnerSnap.exists() ? (partnerSnap.data().lastUnlockedAt ?? 0) : 0
      }, { merge: true });

      setNewReason("");
      setShowAddModal(false);
      sensory.play('pop');
    } catch (e) {
      handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${partnerId}`);
    }
  };

  return (
    <>
      <div className="w-full relative mt-4 mb-2 flex justify-center">
         
         <div className="relative group cursor-pointer" onClick={handleTapJar}>
            
            {/* The 3D Jar Container */}
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={canUnlockToday ? {
                y: [0, -8, 0],
                rotate: [-2, 2, -2, 2, 0]
              } : {}}
              transition={canUnlockToday ? { duration: 2, repeat: Infinity } : {}}
              className="relative w-32 h-40"
            >
               {/* 3D Glass Jar Body */}
               <div className={cn("absolute inset-0 backdrop-blur-md rounded-b-[40px] rounded-t-2xl shadow-[inset_0_-10px_20px_rgba(255,255,255,0.1),0_15px_35px_rgba(0,0,0,0.2)] border overflow-hidden z-10", isDark ? "bg-white/5 border-white/10" : "bg-white/20 border-white/50")}>
                  {/* Jar Highlights (3D effect) */}
                  <div className="absolute top-0 left-4 w-4 h-[80%] bg-white/40 rounded-full blur-[2px] rotate-[-5deg]" />
                  <div className="absolute top-10 right-3 w-2 h-[40%] bg-white/30 rounded-full blur-[1px] rotate-[2deg]" />
                  
                  {/* Paper Notes inside Jar */}
                  <div className="absolute bottom-2 inset-x-2 h-1/2 flex flex-wrap-reverse justify-center items-end gap-1 overflow-hidden opacity-80">
                     {Array.from({ length: Math.min(20, (jarData?.reasons.length || 0) - (jarData?.unlockedCount || 0) + 2) }).map((_, i) => (
                       <div key={i} className="w-8 h-6 bg-pink-100 rounded-sm shadow-sm border border-pink-200" style={{ transform: `rotate(${(i * 47) % 60 - 30}deg)` }} />
                     ))}
                  </div>

                  {canUnlockToday && (
                    <div className="absolute inset-0 bg-yellow-300/20 animate-pulse mix-blend-overlay" />
                  )}
               </div>

               {/* Jar Cork/Lid */}
               <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-16 h-8 bg-[#D4A373] rounded-t-lg rounded-b-sm shadow-[inset_0_-4px_8px_rgba(0,0,0,0.2)] z-0 border border-[#BC8A5F]">
                 <div className="absolute top-0 inset-x-0 h-2 bg-[#E6CCB2] rounded-t-lg opacity-50" />
               </div>
               
               {/* Jar Neck Ring */}
               <div className={cn("absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 backdrop-blur-md rounded-full border shadow-sm z-20", isDark ? "bg-white/10 border-white/10" : "bg-white/40 border-white/60")} />

               {/* Heart Label */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 drop-shadow-md">
                 <div className={cn("w-12 h-12 rounded-full flex items-center justify-center shadow-md", isDark ? "bg-card border border-white/10" : "bg-white")}>
                   <Heart size={24} className={canUnlockToday ? "text-primary fill-primary animate-ping-slow" : "text-rose-300 fill-rose-100"} />
                 </div>
               </div>

            </motion.div>

            {/* Sparkle badge */}
            <div className={cn(
              "absolute -right-8 -top-8 pointer-events-none transition-all duration-500",
              canUnlockToday ? "opacity-100 scale-100" : "opacity-0 scale-50"
            )}>
               <Sparkles size={32} className="text-yellow-400 animate-spin-slow" />
            </div>

            <p className="text-center mt-3 text-[10px] font-black uppercase tracking-widest text-text/40">
              {canUnlockToday ? "Open Daily Note!" : "Jar of Reasons"}
            </p>
         </div>

         {/* Mini button to add reasons for partner */}
         <button 
           onClick={() => setShowAddModal(true)}
           className="absolute right-6 top-1/2 -translate-y-1/2 w-10 h-10 bg-card border border-border shadow-sm rounded-full flex items-center justify-center text-text/50 hover:text-primary hover:scale-110 active:scale-95 transition-all"
         >
           <Plus size={18} />
         </button>
      </div>

      {/* Jar Reading Modal */}
      <AnimatePresence>
        {showJarModal && jarData && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowJarModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-sm rounded-[2rem] shadow-2xl p-6 relative flex flex-col max-h-[80vh]"
              onClick={e => e.stopPropagation()}
            >
               <button onClick={() => setShowJarModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-text/5 rounded-full text-text/40 hover:text-text">
                 <X size={16} />
               </button>

               <div className="flex flex-col items-center mb-6">
                 <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                   <Heart size={32} className="text-primary fill-primary" />
                 </div>
                 <h2 className="text-xl font-display font-bold text-text">100 Reasons Why</h2>
                 <p className="text-xs font-semibold text-text/40 uppercase tracking-widest mt-1">
                   Unlocked: {jarData.unlockedCount} / {jarData.reasons.length}
                 </p>
               </div>

               {revealedReason && (
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: 1, scale: 1 }}
                   transition={{ type: "spring", bounce: 0.5 }}
                   className="mb-8 p-6 bg-primary/5 border border-primary/20 rounded-2xl text-center relative overflow-hidden"
                 >
                   <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 to-primary" />
                   <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-3">Today's Reason</p>
                   <p className="text-lg font-serif italic text-text font-medium leading-relaxed">"{revealedReason}"</p>
                 </motion.div>
               )}

               <div className="flex-1 overflow-y-auto no-scrollbar space-y-3 pb-4">
                 <p className="text-[10px] font-black uppercase text-text/30 tracking-widest pl-2 mb-2">Past Reasons</p>
                 {jarData.reasons.slice(0, revealedReason ? jarData.unlockedCount - 1 : jarData.unlockedCount).reverse().map((reason, i) => (
                   <div key={i} className="p-4 bg-bg border border-border rounded-xl">
                     <p className="text-sm font-medium text-text">"{reason}"</p>
                   </div>
                 ))}
                 {jarData.unlockedCount === 0 && !revealedReason && (
                   <p className="text-center text-sm text-text/40 italic py-8">Open the jar to read your first reason! 💖</p>
                 )}
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Reason Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-sm rounded-[2rem] shadow-2xl p-6 relative"
              onClick={e => e.stopPropagation()}
            >
               <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-text/5 rounded-full text-text/40 hover:text-text">
                 <X size={16} />
               </button>

               <div className="mb-6">
                 <h2 className="text-xl font-display font-bold text-text mb-1">Add a Reason</h2>
                 <p className="text-xs text-text/50 font-medium">Write a new reason why you love them. It will go inside their jar!</p>
               </div>

               <textarea 
                 value={newReason}
                 onChange={e => setNewReason(e.target.value)}
                 placeholder="I love the way you laugh at my terrible jokes..."
                 className="w-full bg-bg border border-border rounded-xl p-4 min-h-[120px] text-text outline-none resize-none focus:border-primary/50 transition-colors mb-6 font-medium"
               />

               <button 
                 onClick={handleAddReason}
                 disabled={!newReason.trim()}
                 className="w-full bg-primary text-white py-3.5 rounded-xl font-bold shadow-md active:scale-95 transition-all disabled:opacity-50"
               >
                 Put in Jar 🫙
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
