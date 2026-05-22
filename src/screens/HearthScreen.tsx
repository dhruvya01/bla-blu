import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, MessageCircle, Droplets, Mail, AlertTriangle,
  Send, X, Calendar, ChevronRight, History, MapPin, Zap, Lock, Compass, Smile, Sparkles, Navigation, Play, Palette, Battery
} from "lucide-react";
import { getDistance, formatDistance } from "../utils/geo";
import { Socket } from "socket.io-client";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { getCycleInfo, parseSafeDate } from "../utils/health";
import { ImportantAlertsCard } from "../components/ImportantAlertsCard";
import { sensory } from "../utils/sensory";
import { InteractiveBabies } from "../components/InteractiveBabies";
import { collection, addDoc, serverTimestamp, doc, deleteDoc, updateDoc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useNow } from '../hooks/useNow';

import { encryptData, decryptData } from "../utils/e2ee";
import defaultSongUrl from "../assets/our-song.mp3";

const isUserOnline = (u: any, now: number) => {
  if (!u?.lastActive) return false;
  return (now - u.lastActive) < 1000 * 60 * 5;
};

const FloatingHearts = React.memo(() => {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className={cn("absolute mix-blend-screen", i % 2 === 0 ? "text-primary/20" : "text-rose-400/20")}
          initial={{ 
            y: "110%", 
            x: `${Math.random() * 100}%`,
            scale: Math.random() * 0.5 + 0.5,
            rotate: Math.random() * 360
          }}
          animate={{ 
            y: "-10%",
            opacity: [0, 0.5, 0],
            rotate: Math.random() * 360 + 180,
            x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`]
          }}
          transition={{ 
            duration: Math.random() * 10 + 15,
            repeat: Infinity,
            ease: "linear",
            delay: Math.random() * 5
          }}
        >
           <Sparkles size={16} fill="currentColor" />
        </motion.div>
      ))}
    </div>
  );
});

interface HearthProps {
  socket: Socket | null;
}

function EnvelopeItem({ env, userId, isDark }: { env: any, userId: string, isDark: boolean }) {
  const [decrypted, setDecrypted] = useState("");
  const isMine = env.from === userId;

  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (env.text && env.text.startsWith('E2EE:')) {
        decryptData(env.text).then(v => active && setDecrypted(v));
      } else {
        setDecrypted(env.text);
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { active = false; window.removeEventListener('e2ee-ready', attempt); };
  }, [env.text]);

  const now = Date.now();
  const isLocked = !env.opened && env.unlockAt > now;

  return (
    <div className={cn("p-4 rounded-2xl border transition-all", isDark ? "bg-white/5 border-white/10" : "bg-bg border-border")}>
      <div className="flex items-center gap-3 mb-2">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", isMine ? "bg-primary/10 text-primary" : "bg-rose-500/10 text-rose-500")}>
          <Mail size={14} />
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-text/40">{isMine ? "Written by you" : "From your partner"}</p>
          <p className="text-[10px] font-medium text-text/60">
            {isLocked ? `Unlocks ${new Date(env.unlockAt).toLocaleDateString()}` : "Ready to read"}
          </p>
        </div>
      </div>
      
      {isLocked ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 opacity-30">
          <Lock size={20} />
          <p className="text-[10px] font-bold uppercase tracking-tighter">Locked Heart</p>
        </div>
      ) : (
        <p className="text-sm font-serif italic text-text/80 line-clamp-3">"{decrypted}"</p>
      )}
    </div>
  );
}

export function HearthScreen({ socket }: HearthProps) {
  const { user, partner, setView, roomId, alerts, calendarEvents, addCoins, messages, envelopes, pair, userLoc, partnerLoc, theme, speedingHistory, safeArrivals } = useAppStore(useShallow(state => ({
    user: state.user,
    partner: state.partner,
    setView: state.setView,
    roomId: state.roomId,
    alerts: state.alerts,
    calendarEvents: state.calendarEvents,
    addCoins: state.addCoins,
    messages: state.messages,
    envelopes: state.envelopes,
    pair: state.pair,
    userLoc: state.userLoc,
    partnerLoc: state.partnerLoc,
    theme: state.theme,
    speedingHistory: state.speedingHistory,
    safeArrivals: state.safeArrivals
  })));

  const [showLoveEnvelopeComposer, setShowLoveEnvelopeComposer] = useState(false);
  const [loveEnvelopeText, setLoveEnvelopeText] = useState("");
  const [scheduledDate, setScheduledDate] = useState<string>("");
  const [envError, setEnvError] = useState("");
  const [composerTab, setComposerTab] = useState<"write" | "history">("write");
  const [selectedTheme, setSelectedTheme] = useState("classic");
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [dismissedArrivals, setDismissedArrivals] = useState<string[]>([]);

  const now = useNow();
  const isOnline = isUserOnline(partner, now);

  const dToday = new Date();
  const greetingEmoji = dToday.getHours() >= 5 && dToday.getHours() < 12 ? "✨" : (dToday.getHours() >= 12 && dToday.getHours() < 17 ? "☀️" : (dToday.getHours() >= 17 && dToday.getHours() < 21 ? "🌙" : "😴"));
  const greeting = `${greetingEmoji} ${dToday.getHours() >= 5 && dToday.getHours() < 12 ? "morning good" : (dToday.getHours() >= 12 && dToday.getHours() < 17 ? "afternoon good" : (dToday.getHours() >= 17 && dToday.getHours() < 21 ? "evening good" : "night good"))}`;
  
  const containerVariant = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } }
  };
  
  const itemVariant = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 280, damping: 22, mass: 0.8 } }
  };

  const nowMs = Date.now();
  const myEnvelopes = (envelopes || []).filter((env: any) => env.recipientId === user?.uid && !env.opened);
  const availableEnvelopesCount = (myEnvelopes || []).filter((env: any) => !env.scheduledFor || nowMs >= env.scheduledFor).length;
  const lockedEnvelopesCount = (myEnvelopes || []).filter((env: any) => env.scheduledFor && nowMs < env.scheduledFor).length;

  const handleSendLoveEnvelope = async () => {
    if (!roomId || !partner?.uid || !loveEnvelopeText.trim()) return;
    try {
      let scheduledFor = scheduledDate ? new Date(scheduledDate).getTime() : null;
      if (scheduledFor && isNaN(scheduledFor)) scheduledFor = null;
      const isLetter = !!scheduledFor;
      
      const payload = {
        text: await encryptData(loveEnvelopeText.trim()),
        opened: false,
        senderId: user?.uid,
        recipientId: partner.uid,
        updatedAt: serverTimestamp(),
        scheduledFor,
        theme: selectedTheme,
        type: isLetter ? "letter" : "quick"
      };

      if (editingEnvId) {
        await updateDoc(doc(db, "pairs", roomId, "envelopes", editingEnvId), payload);
      } else {
        await addDoc(collection(db, "pairs", roomId, "envelopes"), {
          ...payload,
          createdAt: serverTimestamp()
        });
        addCoins(isLetter ? 5 : 2); // Gain coins for sending!
      }
      
      setEditingEnvId(null);
      setLoveEnvelopeText("");
      setScheduledDate("");
      setComposerTab("write");
      setShowLoveEnvelopeComposer(false);
      sensory.play('swoosh');
      sensory.tap();
    } catch (e) {
      setEnvError("Failed to save. Try again 💔");
      setTimeout(() => setEnvError(""), 3000);
    }
  };

  const distance = useMemo(() => {
    if (!partnerLoc || !userLoc) return null;
    return getDistance(userLoc.lat, userLoc.lng, partnerLoc.lat, partnerLoc.lng);
  }, [partnerLoc, userLoc]);

  const activeSpeeding = useMemo(() => {
    if (!speedingHistory || speedingHistory.length === 0) return null;
    const latest = speedingHistory[0];
    const isRecent = (Date.now() - new Date(latest.startTime).getTime()) < 1000 * 60 * 60; // within last hour
    return isRecent ? latest : null;
  }, [speedingHistory]);

  const nearestEvent = useMemo(() => {
    if (!calendarEvents || !Array.isArray(calendarEvents)) return null;
    return [...calendarEvents]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .find(e => new Date(e.date) >= new Date().setHours(0, 0, 0, 0));
  }, [calendarEvents]);
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="flex-1 w-full bg-bg relative overflow-x-hidden pt-0 pb-32"
    >
      <FloatingHearts />

      {/* Soft gradient bg for modern cute look */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[80px] pointer-events-none z-0 translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-20 left-0 w-[300px] h-[300px] rounded-full bg-rose-400/5 blur-[80px] pointer-events-none z-0 -translate-x-1/3" />

      {/* Dynamic Slow Down Alert Pill */}
      <AnimatePresence>
        {activeSpeeding && (
          <motion.div 
            initial={{ y: -100, opacity: 0, scale: 0.8 }}
            animate={{ y: 25, opacity: 1, scale: 1 }}
            exit={{ y: -100, opacity: 0, scale: 0.8 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[110] pointer-events-none w-full px-5"
          >
            <div className="bg-rose-500/90 border border-white/20 backdrop-blur-xl rounded-[2rem] shadow-2xl p-4 flex items-center gap-4 pointer-events-auto">
              <div className="bg-white/20 p-2 rounded-full">
                <Zap size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-white">{activeSpeeding.userName} is speeding!</p>
                <p className="text-[10px] text-white/70">Please slow down, my love 💜</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Partner Low Battery Popup */}
      <AnimatePresence>
        {partner?.activity?.batteryLevel !== undefined && partner.activity.batteryLevel < 15 && (
          <motion.div 
            initial={{ y: 100, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 100, opacity: 0, scale: 0.9 }}
            className="fixed bottom-28 left-5 right-5 z-[120] pointer-events-none"
          >
            <div className={cn(
              "p-5 rounded-[2rem] shadow-2xl border flex items-center gap-4 pointer-events-auto backdrop-blur-xl",
              isDark ? "bg-[#1a0505]/95 border-rose-500/20" : "bg-white/95 border-rose-100"
            )}>
              <div className="w-12 h-12 rounded-[1.2rem] bg-rose-500 flex items-center justify-center text-white shadow-lg animate-pulse shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <h4 className="text-[11px] font-black text-rose-500 uppercase tracking-widest">Low Battery Alert</h4>
                <p className={cn("text-xs font-bold mt-0.5", isDark ? "text-white/80" : "text-text")}>
                  {partner?.nickname || "Partner"}'s phone is at {partner.activity.batteryLevel}%!
                </p>
                <button 
                  onClick={() => { setView('chat'); sensory.tap(); }}
                  className="mt-2.5 px-4 py-2 bg-rose-500 text-white text-[10px] font-bold rounded-xl shadow-sm active:scale-95 transition-transform"
                >
                  Nudge Them
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        variants={containerVariant} 
        initial="hidden" 
        animate="show" 
        className="px-5 space-y-4 relative z-10"
      >
        {/* Cute Milestone Header */}
        <motion.div variants={itemVariant} className="text-center relative flex flex-col items-center mt-2">
          <div className="inline-block mb-1">
             <h4 className="text-[11px] font-bold uppercase tracking-widest text-text/60 leading-none">{greeting} {user?.nickname || user?.name || "Lover"}</h4>
          </div>
          <h1 className="text-5xl font-display text-text font-bold tracking-tight">
             {(() => {
               const startDate = pair?.anniversary || pair?.createdAt || user?.createdAt;
               const start = parseSafeDate(startDate);
               if (!start) return "Love Story";
               const diff = Date.now() - start.getTime();
               return `${Math.floor(diff / (1000 * 60 * 60 * 24))} Days`;
             })()}
          </h1>
        </motion.div>

        {/* 3D Interactive Babies */}
        <motion.div variants={itemVariant} className="bg-card rounded-[32px] p-2 flex flex-col relative overflow-hidden shadow-sm border border-white/50 dark:border-white/5">
          <div className="absolute inset-0 bg-primary/5 pointer-events-none" />
          <div className="flex items-center justify-between w-full px-4 pt-3 pb-2 relative z-10">
            <h3 className="text-[13px] font-bold text-text flex items-center gap-2">
              <Smile size={16} className="text-primary" /> Our Family
            </h3>
            <div className="flex gap-2 text-[10px] font-bold text-text/40">
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-400" />Pukku </span>
              <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-400" />Ukku </span>
            </div>
          </div>
          <div className="w-full aspect-video rounded-[24px] overflow-hidden relative z-10 shadow-inner bg-bg/50">
            <InteractiveBabies showControls={false} />
          </div>
          <motion.button whileTap={{ scale: 0.98 }} onClick={() => { sensory.play('pop'); setView('babygame') }} className="mx-2 mb-2 mt-2 bg-primary/10 text-primary py-3.5 rounded-[20px] font-bold text-xs hover:bg-primary/20 transition-colors">
            Play with Babies 🍼
          </motion.button>
        </motion.div>

        {/* Soft Proximity Widget */}
        <motion.div variants={itemVariant} className="bg-gradient-to-r from-rose-400 to-primary rounded-[32px] p-[2px] shadow-sm shadow-primary/20 relative">
          <div className="bg-card rounded-[30px] p-5 flex items-center gap-5 justify-between w-full h-full relative z-10">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-[18px] bg-primary/10 flex items-center justify-center text-primary relative">
                 {isOnline && <div className="absolute inset-0 rounded-[18px] border border-primary animate-ping opacity-50" />}
                 <Compass size={22} className="relative z-10" />
               </div>
               <div className="flex-1">
                 <p className="text-[10px] font-bold uppercase tracking-widest text-text/40">Distance</p>
                 <p className="text-xl font-bold text-text tracking-tight mt-0.5">
                   {distance ? formatDistance(distance) : "Unknown"} <span className="text-[11px] font-bold text-primary">away</span>
                 </p>
               </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className={cn("px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5", isOnline ? "bg-emerald-500/10 text-emerald-500" : "bg-text/5 text-text/40")}>
                 <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-emerald-500" : "bg-text/30")} />
                 {isOnline ? "Live" : "Idle"}
              </div>
              {partner?.activity?.batteryLevel !== undefined && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-bg/50 rounded-full border border-border/50">
                  <Battery
                    size={10}
                    className={cn(
                      (partner?.activity?.batteryLevel || 0) < 20
                        ? "text-rose-500 animate-pulse"
                        : "text-text/60",
                    )}
                  />
                  <span className="text-[10px] font-bold text-text/60">
                    {partner.activity.batteryLevel}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Playful Actions Grid */}
        <motion.div variants={itemVariant} className="grid grid-cols-2 gap-3">
             {[
               { id: 'chat', label: 'Notes', sub: 'Shared Space', icon: <MessageCircle size={22} className="text-blue-500" />, view: 'chat', bg: "bg-blue-500/10", border: 'border-blue-500/20' },
               { id: 'planner', label: 'Dates', sub: 'Our Plans', icon: <Calendar size={22} className="text-emerald-500" />, view: 'planner', bg: "bg-emerald-500/10", border: 'border-emerald-500/20' },
               { id: 'journey', label: 'Map', sub: 'Location bg', icon: <Navigation size={22} className="text-amber-500" />, view: 'journey', bg: "bg-amber-500/10", border: 'border-amber-500/20' },
               { id: 'period', label: 'Cycle', sub: 'Health Hub', icon: <Droplets size={22} className="text-rose-500" />, view: 'period', bg: "bg-rose-500/10", border: 'border-rose-500/20' },
               { id: 'doodle', label: 'Doodle Canvas', sub: '', icon: <Palette size={22} className="text-pink-500" />, view: 'doodle', bg: "bg-pink-500/10", border: 'border-pink-500/20', className: "col-span-2 flex flex-row gap-4 items-center justify-start text-left p-4.5 pr-6" }
             ].map(item => (
               <motion.button 
                 key={item.id} 
                 whileTap={{ scale: 0.98 }} 
                 onClick={() => { sensory.play('pop'); setView(item.view as any) }} 
                 className={cn(
                   "bg-card rounded-[32px] border shadow-sm border-white/50 dark:border-white/5 active:brightness-95 transition-all relative overflow-hidden group",
                   (item as any).className || "p-5 flex flex-col items-center gap-3 text-center"
                 )}
               >
                  <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className={cn("w-14 h-14 rounded-[22px] flex items-center justify-center shadow-sm border shrink-0", item.bg, item.border)}>
                     {item.icon}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-text mb-0.5">{item.label}</p>
                    {item.sub && <p className="text-[9px] font-bold uppercase tracking-widest text-text/40">{item.sub}</p>}
                  </div>
               </motion.button>
             ))}
        </motion.div>

        {/* Letters Button */}
        <motion.button 
          variants={itemVariant}
          whileTap={{ scale: 0.98 }} 
          onClick={() => { sensory.play('pop'); setShowLoveEnvelopeComposer(true) }} 
          className="w-full bg-card rounded-[32px] p-5 flex items-center gap-4 shadow-sm border border-white/50 dark:border-white/5"
        >
            <div className="w-12 h-12 rounded-[18px] bg-amber-400/10 border border-amber-400/20 text-amber-500 flex items-center justify-center relative">
               <Mail size={22} />
               {availableEnvelopesCount > 0 && (
                 <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-card">
                   {availableEnvelopesCount}
                 </div>
               )}
               {lockedEnvelopesCount > 0 && (
                 <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-card border border-amber-200 text-amber-500/50 rounded-full flex items-center justify-center">
                   <Lock size={10} />
                 </div>
               )}
            </div>
            <div className="flex-1 text-left">
               <p className="text-sm font-bold text-text">Love Letters</p>
               <p className="text-[10px] font-semibold text-text/40 mt-0.5">
                 {availableEnvelopesCount > 0 ? `${availableEnvelopesCount} waiting to open` : lockedEnvelopesCount > 0 ? `${lockedEnvelopesCount} locked for future` : "Send a love note"}
               </p>
            </div>
            <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-text/30">
               <ChevronRight size={16} />
            </div>
        </motion.button>

        {/* Memories Button */}
        <motion.button 
          variants={itemVariant}
          whileTap={{ scale: 0.98 }} 
          onClick={() => { sensory.play('pop'); setView('timeline') }} 
          className="w-full bg-card rounded-[32px] p-5 flex items-center gap-4 shadow-sm border border-white/50 dark:border-white/5"
        >
            <div className="w-12 h-12 rounded-[18px] bg-purple-400/10 border border-purple-400/20 text-purple-500 flex items-center justify-center relative">
               <History size={22} />
            </div>
            <div className="flex-1 text-left">
               <p className="text-sm font-bold text-text">Our Scrapbook</p>
               <p className="text-[10px] font-semibold text-text/40 mt-0.5">Relive our precious moments</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-bg border border-border flex items-center justify-center text-text/30">
               <ChevronRight size={16} />
            </div>
        </motion.button>

        {/* Countdown */}
        <motion.div variants={itemVariant} className="bg-card rounded-[32px] p-5 shadow-sm border border-white/50 dark:border-white/5 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none text-text">
             <Calendar size={120} />
          </div>
          <CountdownWidget nearestEvent={nearestEvent} anniversary={pair?.anniversary} />
        </motion.div>

        {/* Dashboard Speeding Alert */}
        {speedingHistory && speedingHistory.length > 0 && (
          <motion.div variants={itemVariant} className="bg-rose-50 rounded-[32px] p-4 shadow-sm border border-rose-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-[24px] bg-rose-500 text-white flex items-center justify-center shadow-md shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1">
               <h3 className="text-[13px] font-bold text-rose-600">{speedingHistory[0].userName} was speeding</h3>
               <p className="text-[10px] font-bold text-rose-500/70 mt-0.5">Max Speed: {speedingHistory[0].maxSpeed} km/h • {new Date(speedingHistory[0].startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</p>
            </div>
          </motion.div>
        )}

        {alerts.length > 0 && <motion.div variants={itemVariant}><ImportantAlertsCard alerts={alerts} /></motion.div>}
      </motion.div>

      {/* Love Note Modal */}
      <AnimatePresence>
        {showLoveEnvelopeComposer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-5 bg-bg/80 backdrop-blur-md" onClick={() => setShowLoveEnvelopeComposer(false)}>
            <motion.div initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} className="w-full max-w-[360px] bg-card rounded-[32px] p-6 shadow-2xl border border-border" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                   <div className="flex bg-bg p-1 rounded-xl border border-border/50">
                     <button onClick={() => setComposerTab("write")} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", composerTab === "write" ? "bg-card text-text shadow-sm" : "text-text/40")}>Write</button>
                     <button onClick={() => setComposerTab("history")} className={cn("px-4 py-1.5 text-xs font-bold rounded-lg transition-all", composerTab === "history" ? "bg-card text-text shadow-sm" : "text-text/40")}>History</button>
                   </div>
                   <button onClick={() => setShowLoveEnvelopeComposer(false)} className="text-text/30 hover:text-text/60 bg-bg p-2 rounded-full border border-border"><X size={16} /></button>
                </div>
                {composerTab === "write" ? (
                  <div className="space-y-4">
                     <div>
                       <textarea 
                         autoFocus 
                         value={loveEnvelopeText} 
                         onChange={e => setLoveEnvelopeText(e.target.value)} 
                         className="w-full bg-bg border border-border rounded-2xl p-4 min-h-[140px] outline-none text-sm text-text focus:border-text/30 transition-colors" 
                         placeholder="Write a sweet note..." 
                       />
                     </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-bold text-text/50 ml-1">Deliver On (Optional)</label>
                       <input 
                         type="date" 
                         value={scheduledDate}
                         onChange={e => setScheduledDate(e.target.value)}
                         className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm outline-none text-text focus:border-text/30 transition-colors"
                       />
                       <p className="text-[10px] text-text/40 ml-1">Lock this letter until a specific date ✨</p>
                    </div>
                    <button onClick={handleSendLoveEnvelope} className="w-full mt-2 bg-text text-bg py-3.5 rounded-xl font-bold text-[13px] active:scale-95 transition-transform shadow-md">Send Love Letter</button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto no-scrollbar">
                    {(envelopes || []).filter(e => e.senderId === user?.uid).length === 0 && (
                      <p className="text-center text-sm text-text/40 py-8">No letters sent yet.</p>
                    )}
                    {(envelopes || []).filter(e => e.senderId === user?.uid).map(env => (
                      <EnvelopeItem key={env.id} env={env} userId={user?.uid || ""} isDark={isDark} />
                    ))}
                  </div>
                )}
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CountdownWidget({ nearestEvent, anniversary }: { nearestEvent: any, anniversary: string | undefined }) {
  const [timeLeft, setTimeLeft] = useState<{ days: number, hours: number, mins: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date();
      let nextAnn = new Date(now.getFullYear(), 9, 10); // Oct 10
      
      // If today is past October 10th, aim for next year
      // Add 86400000 to keep it at 0 for the entire day of Oct 10
      if (now.getTime() >= nextAnn.getTime() + 86400000) {
        nextAnn.setFullYear(now.getFullYear() + 1);
      }

      const diff = nextAnn.getTime() - now.getTime();
      if (diff <= 0) {
        // It is October 10th currently!
        setTimeLeft({ days: 0, hours: 0, mins: 0 });
      } else {
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        setTimeLeft({ days: d, hours: h, mins: m });
      }
    };
    
    update();
    const int = setInterval(update, 60000);
    return () => clearInterval(int);
  }, [nearestEvent]);

  useEffect(() => {
    // Preload audio
    audioRef.current = new Audio(defaultSongUrl);
    audioRef.current.loop = true;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    }
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  if (!timeLeft) return <div className="text-center py-2"><p className="text-sm text-text/40">Calculating...</p></div>;

  return (
    <div className="w-full flex justify-between items-center relative z-10">
       <div className="flex-1">
          <p className="text-[10px] font-bold tracking-widest text-text/40 mb-1 uppercase">Our Anniversary</p>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-bold text-text leading-tight">October 10</p>
            <Heart size={14} className="fill-primary text-primary" />
          </div>
          
          <button 
            onClick={togglePlay}
            className={cn(
              "mt-3 flex items-center gap-1.5 px-2 py-1 rounded-full text-[8.5px] font-bold tracking-wider uppercase transition-all shadow-inner w-fit",
              isPlaying ? "bg-primary/20 text-primary border border-primary/30" : "bg-bg text-text/60 border border-border hover:bg-black/5"
            )}
          >
            {isPlaying ? (
              <>
                <div className="w-2.5 h-2.5 flex items-end gap-[1px]">
                  <motion.div animate={{ height: ["2px", "6px", "2px"] }} transition={{ repeat: Infinity, duration: 1 }} className="w-[2px] bg-primary rounded-t-[1px]" />
                  <motion.div animate={{ height: ["4px", "2px", "4px"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-[2px] bg-primary rounded-t-[1px]" />
                  <motion.div animate={{ height: ["2px", "5px", "2px"] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-[2px] bg-primary rounded-t-[1px]" />
                </div>
                <span>Playing: Our Song</span>
              </>
            ) : (
              <>
                <Play size={8} className="fill-current" />
                <span>Play our song</span>
              </>
            )}
          </button>
       </div>
       
       <div className="flex gap-2">
         <div className="flex flex-col items-center">
            <div className="w-10 h-10 bg-bg rounded-xl border border-border flex items-center justify-center text-base font-bold text-text shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)]">{timeLeft.days}</div>
            <span className="text-[9px] font-bold uppercase text-text/40 mt-1">Days Left</span>
         </div>
       </div>
    </div>
  );
}
