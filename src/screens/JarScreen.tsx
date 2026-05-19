import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { doc, onSnapshot, setDoc, updateDoc, getDoc } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { sensory } from '../utils/sensory';
import { Heart, Plus, Sparkles, X, ArrowLeft, Edit3, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import confetti from 'canvas-confetti';

import { encryptData, decryptData } from "../utils/e2ee";

interface JarData {
  reasons: string[];
  unlockedCount: number;
  lastUnlockedAt: number;
}

function ReasonCard({ reason, isMe, onEdit, onDelete }: { reason: string, isMe?: boolean, onEdit?: () => void, onDelete?: () => void }) {
  const [decrypted, setDecrypted] = useState("");

  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (reason && reason.startsWith('E2EE:')) {
        decryptData(reason).then(v => active && setDecrypted(v));
      } else {
        setDecrypted(reason);
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { active = false; window.removeEventListener('e2ee-ready', attempt); };
  }, [reason]);

  if (isMe) {
    return (
      <div className="p-5 bg-card/80 backdrop-blur-md border border-border rounded-[2rem] shadow-sm hover:shadow-md transition-all flex flex-col gap-3 group relative overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center shrink-0">
              <Heart size={16} className="text-rose-400 fill-rose-400/20" />
            </div>
            <p className="text-sm font-medium text-text/80 leading-relaxed italic pt-1">"{decrypted}"</p>
          </div>
          
          <div className="flex items-center gap-1.5 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded-lg bg-text/5 hover:bg-primary/10 hover:text-primary flex items-center justify-center text-text/40 transition-colors"
            >
              <Edit3 size={14} />
            </button>
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded-lg bg-text/5 hover:bg-rose-500/15 hover:text-rose-500 flex items-center justify-center text-text/40 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 bg-card/80 backdrop-blur-md border border-border rounded-[2rem] shadow-sm hover:shadow-md transition-all flex items-start gap-4 group">
      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
        <Heart size={16} className="text-primary fill-primary/20" />
      </div>
      <p className="text-sm font-medium text-text/80 leading-relaxed italic pt-1">"{decrypted}"</p>
    </div>
  );
}

export function JarScreen(_props: {}) {
  const { setView, roomId, user, partner, pair, addCoins, theme } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const [jarData, setJarData] = useState<JarData | null>(null);
  const [partnerJarData, setPartnerJarData] = useState<JarData | null>(null);
  const [listTab, setListTab] = useState<'received' | 'sent'>('received');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [envelopeOpened, setEnvelopeOpened] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newReason, setNewReason] = useState("");
  const [revealedReason, setRevealedReason] = useState<string | null>(null);
  const [decryptedRevealedReason, setDecryptedRevealedReason] = useState("");
  const [showRevealAnim, setShowRevealAnim] = useState(false);

  useEffect(() => {
    let active = true;
    if (revealedReason && revealedReason.startsWith('E2EE:')) {
      decryptData(revealedReason).then(v => active && setDecryptedRevealedReason(v));
    } else {
      setDecryptedRevealedReason(revealedReason || "");
    }
    return () => { active = false; };
  }, [revealedReason]);

  // Animation States
  const [isAnimatingAdding, setIsAnimatingAdding] = useState(false);
  const [animatingText, setAnimatingText] = useState("");
  const jarRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!partnerJarRef) return;
    const unsub = onSnapshot(partnerJarRef, (snap) => {
      if (snap.exists()) {
        setPartnerJarData(snap.data() as JarData);
      } else {
        setPartnerJarData({ reasons: [], unlockedCount: 0, lastUnlockedAt: 0 });
      }
    });
    return unsub;
  }, [roomId, partnerId]);

  useEffect(() => {
    if (revealedReason) {
      setEnvelopeOpened(false);
      const t = setTimeout(() => {
        setEnvelopeOpened(true);
        sensory.play('swoosh');
      }, 800);
      return () => clearTimeout(t);
    }
  }, [revealedReason]);

  const canUnlockToday = jarData && jarData.unlockedCount < jarData.reasons.length;

  const triggerConfetti = () => {
    if (!jarRef.current) return;
    const rect = jarRef.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;
    
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { x, y },
      colors: ['#FF7EB3', '#9C89FF', '#FFFFFF', '#FFD700'],
      zIndex: 1000,
      disableForReducedMotion: true
    });
  };

  const handleUnlock = async () => {
    if (!jarData || !canUnlockToday || !myJarRef) return;
    
    sensory.play('swoosh');
    setShowRevealAnim(true);
    
    const newCount = jarData.unlockedCount + 1;
    const reasonToReveal = jarData.reasons[newCount - 1];
    
    setTimeout(async () => {
      setRevealedReason(reasonToReveal);
      setShowRevealAnim(false);
      triggerConfetti();
      sensory.play('pop');
      sensory.important();

      try {
        await updateDoc(myJarRef, {
          unlockedCount: newCount,
          lastUnlockedAt: Date.now()
        });
      } catch (e) {
        handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${user?.uid}`);
      }
    }, 2000);
  };

  const handleAddReason = async () => {
    if (!newReason.trim() || !partnerJarRef) return;
    const textToSend = await encryptData(newReason.trim());
    sensory.tap();
    
    // Start "Crazy" 3D Animation
    setAnimatingText(textToSend);
    setIsAnimatingAdding(true);
    setShowAddModal(false);
    sensory.play('swoosh');

    // Save to DB INSTANTLY so the partner's device gets it immediately
    try {
      const partnerSnap = await getDoc(partnerJarRef);
      let existingReasons: string[] = [];
      
      if (partnerSnap.exists()) {
        existingReasons = (partnerSnap.data() as JarData).reasons || [];
      }
      
      await setDoc(partnerJarRef, {
        reasons: [...existingReasons, textToSend],
        unlockedCount: partnerSnap.exists() ? (partnerSnap.data().unlockedCount ?? 0) : 0,
        lastUnlockedAt: partnerSnap.exists() ? (partnerSnap.data().lastUnlockedAt ?? 0) : 0
      }, { merge: true });

      addCoins(1); // Gain 1 coin for adding a reason!
      useAppStore.getState().addPairXp(50); // XP per reason!
    } catch (e) {
      handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${partnerId}`);
    }

    // Wait for the local animation to finish to reset UI states
    setTimeout(() => {
      triggerConfetti();
      sensory.play('pop');
      sensory.important();
      setIsAnimatingAdding(false);
      setNewReason("");
    }, 2500);
  };

  const handleDeleteReason = async (indexToDelete: number) => {
    if (!partnerJarRef || !partnerJarData) return;
    sensory.play('swoosh');
    const updatedReasons = partnerJarData.reasons.filter((_, idx) => idx !== indexToDelete);
    
    // Adjust unlockedCount if needed so it doesn't exceed new reasons array length
    const currentUnlocked = partnerJarData.unlockedCount;
    const newUnlocked = Math.min(currentUnlocked, updatedReasons.length);
    
    try {
      await updateDoc(partnerJarRef, {
        reasons: updatedReasons,
        unlockedCount: newUnlocked
      });
      sensory.play('pop');
      sensory.tap();
    } catch (e) {
      handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${partnerId}`);
    }
  };

  const handleSaveEdit = async () => {
    if (!partnerJarRef || !partnerJarData || editingIndex === null || !editText.trim()) return;
    sensory.tap();
    
    const updatedReasons = [...partnerJarData.reasons];
    updatedReasons[editingIndex] = await encryptData(editText.trim());
    
    try {
      await updateDoc(partnerJarRef, {
        reasons: updatedReasons
      });
      setShowEditModal(false);
      setEditingIndex(null);
      setEditText("");
      sensory.play('success');
    } catch (e) {
      handleFirestoreError(e, 'write', `pairs/${roomId}/jars/${partnerId}`);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 w-full min-h-screen bg-bg relative overflow-x-hidden flex flex-col pt-4 pb-32"
    >
      {/* Floating Header Buttons */}
      <button 
        onClick={() => setView('home')}
        className="absolute top-6 left-6 w-10 h-10 rounded-xl bg-text/5 hover:bg-text/10 flex items-center justify-center active:scale-95 transition-all z-50"
      >
        <ArrowLeft size={20} className="text-text" />
      </button>
      <button 
        onClick={() => setShowAddModal(true)}
        className="absolute top-6 right-6 w-10 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center active:scale-95 transition-all z-50"
      >
        <Plus size={20} />
      </button>

      {/* 3D Paper Animation Overlay */}
      <AnimatePresence>
        {isAnimatingAdding && (
          <div className="fixed inset-0 pointer-events-none z-[200] flex items-center justify-center">
            {/* The Paper that folds and flies */}
            <motion.div
              initial={{ scale: 0, opacity: 0, rotateX: 0, rotateY: 0, y: 100 }}
              animate={{ 
                scale: [0, 1.2, 1, 0.5, 0.2, 0], // Appear, hold, fold smaller, disappear
                opacity: [0, 1, 1, 1, 1, 0],
                rotateX: [0, 0, 180, 360, 540], // Folding effect
                rotateY: [0, 0, 90, 180, 360],
                y: [100, 0, -50, -150, 0], // Arc upwards then down
                x: [0, 0, 20, 0, 0] // Slight horizontal arc
              }}
              transition={{ 
                duration: 2.5, 
                times: [0, 0.2, 0.5, 0.7, 0.9, 1],
                ease: "easeInOut"
              }}
              className={cn("absolute backdrop-blur-sm p-6 rounded-lg shadow-2xl border flex items-center justify-center text-center overflow-hidden w-64 h-40", isDark ? "bg-white/5 border-white/10" : "bg-white/90 border-primary/20")}
              style={{ transformStyle: "preserve-3d" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
              <p className="text-text/80 font-serif italic text-lg leading-relaxed relative z-10 line-clamp-4">
                "{animatingText}"
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center px-6">
        
        {/* Beautiful bold romantic heading with mt-20 to completely clear the floating buttons */}
        <div className="text-center max-w-sm mt-20 mb-6 z-10 px-4">
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-2xl font-display font-black text-text tracking-tight leading-tight mb-2"
          >
            writting reasons why i love you untill forver
          </motion.h1>
          <p className="text-[9px] font-black uppercase text-primary tracking-[0.25em]">
            written by us, kept in our hearts
          </p>
        </div>

        {/* Magical Minimalist Heart Key (Replaces the Jar) */}
        <div className="relative mb-10 mt-6 flex items-center justify-center h-48 w-full" ref={jarRef}>
          {/* Subtle slow pulsing background aura */}
          {canUnlockToday && (
            <motion.div 
              animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.35, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute w-40 h-40 rounded-full bg-primary/20 blur-2xl pointer-events-none"
            />
          )}

          <AnimatePresence>
            {showRevealAnim && (
              <motion.div 
                initial={{ scale: 0.5, opacity: 0, y: 50 }}
                animate={{ scale: [1, 1.3, 1.1], opacity: 1, y: -30 }}
                exit={{ scale: 0.8, opacity: 0, y: -80 }}
                transition={{ duration: 1.5, type: "spring" }}
                className="absolute z-20 w-24 h-16 bg-[#FFF9F2] rounded shadow-2xl border border-primary/20 flex items-center justify-center overflow-hidden"
              >
                <Heart size={32} className="text-primary fill-primary animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/40" />
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={canUnlockToday && !isAnimatingAdding ? { scale: 1.08 } : {}}
            whileTap={canUnlockToday && !isAnimatingAdding ? { scale: 0.95 } : {}}
            onClick={handleUnlock}
            disabled={!canUnlockToday || showRevealAnim || isAnimatingAdding}
            className={cn(
              "w-28 h-28 rounded-full flex flex-col items-center justify-center shadow-2xl border-4 transition-all relative overflow-hidden z-10",
              canUnlockToday && !isAnimatingAdding
                ? (isDark ? "bg-primary/25 border-primary text-primary shadow-[0_0_45px_rgba(255,108,180,0.45)] cursor-pointer" : "bg-white/95 border-primary text-primary shadow-[0_0_45px_rgba(255,108,180,0.65)] cursor-pointer")
                : (isDark ? "bg-white/5 border-white/10 text-text/10 cursor-not-allowed" : "bg-white/40 border-white/50 text-text/30 cursor-not-allowed")
            )}
          >
            {/* Beating Heart Icon */}
            <Heart 
              size={44} 
              fill={canUnlockToday && !isAnimatingAdding ? "currentColor" : "none"} 
              className={cn(canUnlockToday && !isAnimatingAdding && "animate-pulse")} 
            />
            {canUnlockToday && !isAnimatingAdding && (
              <span className="text-[7px] font-black uppercase tracking-widest mt-1">Tap to open</span>
            )}
          </motion.button>

          {/* Sparkles around heart */}
          <div className={cn(
            "absolute inset-0 pointer-events-none transition-all duration-500",
            (canUnlockToday && !isAnimatingAdding) ? "opacity-100 scale-100" : "opacity-0 scale-75"
          )}>
            <div className="absolute right-12 top-6 text-yellow-400 animate-sparkle">
              <Sparkles size={24} />
            </div>
            <div className="absolute left-12 bottom-6 text-primary animate-sparkle" style={{ animationDelay: '1.2s' }}>
              <Sparkles size={20} />
            </div>
          </div>
        </div>

        <div className="text-center mb-8 relative z-10">
           <p className="text-sm text-text/50 font-medium">
             {jarData?.unlockedCount || 0} reasons unlocked so far
           </p>
        </div>

        {/* REVEALED REASON (Interactive Vector Envelope Opening Animation) */}
        <AnimatePresence>
          {revealedReason && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 50 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -50 }}
              transition={{ type: "spring", damping: 18 }}
              className="w-full max-w-sm flex flex-col items-center mb-24 z-10 px-2 mt-4"
            >
              {/* Immersive Vector Envelope Container */}
              <div className="relative w-72 h-48 rounded-2xl shadow-2xl flex items-center justify-center bg-transparent">
                
                {/* 1. Letter Paper (Slides out upwards) */}
                <motion.div
                  initial={{ y: 0, scale: 0.95, opacity: 0 }}
                  animate={envelopeOpened ? { y: -88, scale: 1, opacity: 1 } : { y: 0, scale: 0.95, opacity: 0 }}
                  transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                  className={cn(
                    "absolute w-[270px] h-[180px] rounded-xl p-5 shadow-2xl border-2 flex flex-col items-center justify-center text-center overflow-hidden z-20",
                    isDark ? "bg-[#09090E] border-primary/50 text-[#FFE5EC] shadow-[0_0_25px_rgba(255,108,180,0.15)]" : "bg-[#FFF9F2] border-primary/20 text-[#4E1A2B]"
                  )}
                >
                  {/* Paper cream texture (Only for light theme!) */}
                  {!isDark && (
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url('https://www.transparenttextures.com/patterns/cream-paper.png')" }} />
                  )}
                  <Sparkles size={16} className="text-yellow-500 absolute top-4 right-4 animate-pulse" />
                  
                  <p className={cn(
                    "text-[8px] font-black uppercase tracking-[0.3em] mb-2 relative z-10",
                    isDark ? "text-primary" : "text-primary/70"
                  )}>Today's Reason</p>
                  <p className={cn(
                    "text-base font-serif italic font-bold leading-relaxed px-2 overflow-y-auto max-h-[120px] relative z-10",
                    isDark ? "text-[#FFF0F5] drop-shadow-md" : "text-[#4E1A2B]"
                  )}>
                    "{decryptedRevealedReason}"
                  </p>
                </motion.div>

                {/* 2. Envelope Front Pocket Body */}
                <div className="absolute inset-0 z-30 pointer-events-none">
                  <svg className="w-full h-full drop-shadow-[0_-5px_15px_rgba(0,0,0,0.12)]" viewBox="0 0 288 192" fill="none" xmlns="http://www.w3.org/2000/svg">
                    {/* Left Fold */}
                    <path d="M0 0 L144 96 L0 192 Z" fill={isDark ? "#232333" : "#FCE1E7"} stroke={isDark ? "#35354F" : "#FFC2D1"} strokeWidth="1.5" />
                    {/* Right Fold */}
                    <path d="M288 0 L144 96 L288 192 Z" fill={isDark ? "#232333" : "#FCE1E7"} stroke={isDark ? "#35354F" : "#FFC2D1"} strokeWidth="1.5" />
                    {/* Bottom Fold */}
                    <path d="M0 192 L144 96 L288 192 Z" fill={isDark ? "#2A2A3D" : "#FFEBEF"} stroke={isDark ? "#3F3F5A" : "#FFC2D1"} strokeWidth="1.5" />
                  </svg>
                </div>

                {/* 3. Envelope Top Flap (Rotates on X-axis) */}
                <motion.div
                  initial={{ rotateX: 0 }}
                  animate={envelopeOpened ? { rotateX: 180 } : { rotateX: 0 }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="absolute top-0 inset-x-0 h-24 origin-top z-40"
                  style={{ 
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden'
                  }}
                >
                  <svg className="w-full h-full" viewBox="0 0 288 96" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0 0 L144 96 L288 0 Z" fill={isDark ? "#303046" : "#FFAFD8"} stroke={isDark ? "#484865" : "#FF99CF"} strokeWidth="1.5" />
                  </svg>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toggle Tabs */}
        <div className="w-full max-w-md flex bg-card/65 backdrop-blur-md border border-border rounded-full p-1 mb-8 relative z-10">
          <button 
            onClick={() => { setListTab('received'); sensory.play('pop'); }}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-300",
              listTab === 'received' 
                ? "bg-primary text-white shadow-md shadow-primary/20" 
                : "text-text/45 hover:text-text/80"
            )}
          >
            Received ({jarData?.reasons.slice(0, revealedReason ? jarData.unlockedCount - 1 : jarData.unlockedCount).length || 0})
          </button>
          <button 
            onClick={() => { setListTab('sent'); sensory.play('pop'); }}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-wider rounded-full transition-all duration-300",
              listTab === 'sent' 
                ? "bg-primary text-white shadow-md shadow-primary/20" 
                : "text-text/45 hover:text-text/80"
            )}
          >
            Sent By Me ({partnerJarData?.reasons.length || 0})
          </button>
        </div>

        {/* REASONS LIST */}
        <div className="w-full max-w-md pb-20 relative z-10">
          {listTab === 'received' && (
            <div className="space-y-4">
              {jarData?.reasons.slice(0, revealedReason ? jarData.unlockedCount - 1 : jarData.unlockedCount).reverse().map((reason, i) => (
                <ReasonCard key={i} reason={reason} />
              ))}

              {(jarData?.unlockedCount === 0 || jarData?.reasons.length === 0) && !revealedReason && (
                <div className="py-16 text-center opacity-40">
                  <Heart size={44} className="mx-auto mb-4 text-text/20 animate-pulse" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-text/60">No unlocked secrets yet</p>
                </div>
              )}
            </div>
          )}

          {listTab === 'sent' && (
            <div className="space-y-4">
              {partnerJarData?.reasons.slice().reverse().map((reason, reverseIdx) => {
                const originalIdx = (partnerJarData.reasons.length - 1) - reverseIdx;
                
                return (
                  <ReasonCard 
                    key={reverseIdx} 
                    reason={reason} 
                    isMe={true} 
                    onEdit={() => {
                      setEditingIndex(originalIdx);
                      decryptData(reason).then(setEditText);
                      setShowEditModal(true);
                      sensory.play('pop');
                    }}
                    onDelete={() => handleDeleteReason(originalIdx)}
                  />
                );
              })}

              {(partnerJarData?.reasons.length === 0 || !partnerJarData) && (
                <div className="py-16 text-center opacity-40">
                  <Sparkles size={44} className="mx-auto mb-4 text-text/20 animate-spin-slow" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-text/60">You haven't written any reasons yet</p>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Add Reason Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 relative border border-border"
              onClick={e => e.stopPropagation()}
            >
               <button onClick={() => setShowAddModal(false)} className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-text/5 rounded-full text-text/40 hover:text-text transition-colors">
                 <X size={20} />
               </button>

               <div className="mb-8 mt-2">
                 <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                   <Plus size={24} className="text-primary" />
                 </div>
                 <h2 className="text-2xl font-display font-bold text-text mb-2">Write a Reason</h2>
                 <p className="text-sm text-text/50 font-medium leading-relaxed">
                   Fold a little note for {partner?.nickname || "your partner"}. It will magically fly into their jar!
                 </p>
               </div>

               <textarea 
                 value={newReason}
                 onChange={e => setNewReason(e.target.value)}
                 autoFocus
                 placeholder="I love the way your eyes light up when you talk about your passions..."
                 className="w-full bg-bg border-2 border-border rounded-2xl p-6 min-h-[160px] text-text outline-none resize-none focus:border-primary/50 transition-all mb-8 font-serif italic text-lg placeholder:text-text/20 shadow-inner"
               />

               <button 
                 onClick={handleAddReason}
                 disabled={!newReason.trim()}
                 className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(255,108,180,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
               >
                 <Sparkles size={18} />
                 Fold & Send 🫙
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Reason Modal */}
      <AnimatePresence>
        {showEditModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md"
            onClick={() => { setShowEditModal(false); setEditingIndex(null); }}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-card w-full max-w-sm rounded-[2.5rem] shadow-2xl p-8 relative border border-border"
              onClick={e => e.stopPropagation()}
            >
               <button 
                 onClick={() => { setShowEditModal(false); setEditingIndex(null); }} 
                 className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center bg-text/5 rounded-full text-text/40 hover:text-text transition-colors"
               >
                 <X size={20} />
               </button>

               <div className="mb-8 mt-2">
                 <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
                   <Edit3 size={24} className="text-primary" />
                 </div>
                 <h2 className="text-2xl font-display font-bold text-text mb-2">Edit Reason</h2>
                 <p className="text-sm text-text/50 font-medium leading-relaxed">
                   Make your little note even more perfect! It will instantly update in their jar.
                 </p>
               </div>

               <textarea 
                 value={editText}
                 onChange={e => setEditText(e.target.value)}
                 autoFocus
                 placeholder="I love the way your eyes light up when you talk about your passions..."
                 className="w-full bg-bg border-2 border-border rounded-2xl p-6 min-h-[160px] text-text outline-none resize-none focus:border-primary/50 transition-all mb-8 font-serif italic text-lg placeholder:text-text/20 shadow-inner"
               />

               <button 
                 onClick={handleSaveEdit}
                 disabled={!editText.trim()}
                 className="w-full bg-primary text-white py-5 rounded-2xl font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(255,108,180,0.3)] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2"
               >
                 <Sparkles size={18} />
                 Save Changes ✨
               </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
