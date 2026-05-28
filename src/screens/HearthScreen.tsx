import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Heart, MessageCircle, Droplets, Mail, AlertTriangle,
  Send, X, Calendar, ChevronRight, History, MapPin, Zap, Lock, Compass, Smile, Sparkles, Navigation, Play, Palette, Battery, Video
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

  const [memoryOfTheMonth, setMemoryOfTheMonth] = useState<{ url: string; caption?: string } | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(collection(db, "pairs", roomId, "timeline"), async (snap) => {
      const photos = snap.docs.filter(d => d.data().type === "photo");
      if (photos.length > 0) {
        const currentDateStr = new Date().toISOString().slice(0, 7); // Use YYYY-MM to fix a random photo for the month
        let hash = 0;
        for (let i = 0; i < currentDateStr.length; i++) hash += currentDateStr.charCodeAt(i);
        const randIndex = hash % photos.length;
        const targetDoc = photos[randIndex].data();
        let decryptedUrl = targetDoc.content;
        let decryptedCaption = targetDoc.caption;
        if (decryptedUrl && decryptedUrl.startsWith("E2EE:")) {
          try {
             decryptedUrl = await decryptData(decryptedUrl);
          } catch(e) {}
        }
        if (decryptedCaption && decryptedCaption.startsWith("E2EE:")) {
          try {
             decryptedCaption = await decryptData(decryptedCaption);
          } catch(e) {}
        }
        setMemoryOfTheMonth({ url: decryptedUrl, caption: decryptedCaption });
      } else {
        setMemoryOfTheMonth(null);
      }
    });
    return () => unsub();
  }, [roomId]);

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
      className="flex-1 w-full bg-bg relative overflow-x-hidden pt-0 pb-6"
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
        {/* Modern Header Section */}
        <motion.div variants={itemVariant} className="flex flex-col items-center mt-3 mb-1">
          {/* Couple Avatar Bond with Infinite Pulse line */}
          <div className="flex items-center gap-4 bg-card/60 backdrop-blur-md px-5 py-2.5 rounded-full border border-white/50 dark:border-white/5 shadow-sm mb-4">
            <div className="relative flex items-center justify-center">
              <div id="user-avatar-dp" className="w-10 h-10 rounded-full bg-primary/20 text-primary border border-primary/35 flex items-center justify-center font-black text-sm shadow-inner uppercase overflow-hidden">
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt="Me" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  user?.nickname?.[0] || user?.name?.[0] || "U"
                )}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-card" />
            </div>
            
            <div className="flex items-center gap-1.5 opacity-60">
              <span className="w-1 h-1 rounded-full bg-rose-400 animate-ping" />
              <Heart size={14} className="text-rose-500 fill-rose-500/20 animate-pulse" />
              <span className="w-1 h-1 rounded-full bg-rose-400 animate-ping delay-500" />
            </div>

            <div className="relative flex items-center justify-center">
              <div id="partner-avatar-dp" className="w-10 h-10 rounded-full bg-rose-400/20 text-rose-500 border border-rose-400/35 flex items-center justify-center font-black text-sm shadow-inner uppercase overflow-hidden">
                {partner?.avatarUrl ? (
                  <img src={partner.avatarUrl} alt="Partner" className="w-full h-full object-cover rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  partner?.nickname?.[0] || partner?.name?.[0] || "P"
                )}
              </div>
              <div className={cn("absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card", isOnline ? "bg-emerald-500" : "bg-text/30")} />
            </div>
          </div>

          <div className="text-center">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-text/60 leading-none mb-2">
              {greeting}
            </p>
            <h1 
              id="anniversary-counter-h1"
              className="text-6xl xs:text-7xl font-bold text-text tracking-tighter flex items-center gap-3 justify-center mt-1"
            >
              <span className="drop-shadow-sm font-bold text-text">
                {(() => {
                  const startDate = pair?.anniversary || pair?.createdAt || user?.createdAt;
                  const start = parseSafeDate(startDate);
                  if (!start) return "0";
                  const diff = Date.now() - start.getTime();
                  return `${Math.floor(diff / (1000 * 60 * 60 * 24))}`;
                })()}
              </span>
              <span className="text-sm uppercase tracking-[0.2em] font-semibold text-text/50 relative top-2">
                Days
              </span>
            </h1>
          </div>
        </motion.div>

        {/* Bento Board: The Family Playroom */}
        <motion.div variants={itemVariant} className="bg-card rounded-[32px] p-2 flex flex-col relative overflow-hidden shadow-sm border border-border/80 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-rose-400/5 pointer-events-none" />
          <div className="flex items-center justify-between w-full px-4 pt-3.5 pb-2.5 relative z-10">
            <h3 className="text-xs font-black uppercase tracking-wider text-text/80 flex items-center gap-2">
              <Smile size={15} className="text-primary" /> Our Family
            </h3>
            <div className="flex gap-2.5 text-[9px] font-black uppercase tracking-widest text-text/40">
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />Pukku </span>
              <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />Ukku </span>
            </div>
          </div>
          <div className="w-full aspect-video rounded-[24px] overflow-hidden relative z-10 shadow-inner bg-bg/50">
            <InteractiveBabies showControls={false} />
          </div>
          <motion.button 
            whileTap={{ scale: 0.98 }} 
            onClick={() => { sensory.play('pop'); setView('babygame') }} 
            className="mx-2 mb-2 mt-2.5 bg-primary/10 text-primary py-3 rounded-[20px] font-black uppercase tracking-widest text-[10px] hover:bg-primary/20 transition-all flex items-center justify-center gap-2"
          >
            <span>Babies</span>
            <span>🍼</span>
          </motion.button>
        </motion.div>

        {/* Playable Grid Layout from the Sketch */}
        <div className="flex flex-col gap-3.5 w-full">
          {/* ROW 1: Our distance */}
          <motion.div
            variants={itemVariant}
            whileTap={{ scale: 0.98 }}
            onClick={() => { sensory.play('pop'); setView('journey') }}
            className="col-span-2 w-full bg-card rounded-[32px] p-6 border border-border/80 shadow-sm relative overflow-hidden group cursor-pointer"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-transparent to-transparent pointer-events-none" />
            <div className="absolute right-0 bottom-0 opacity-[0.05] text-rose-500 pointer-events-none translate-x-4 translate-y-4 group-hover:scale-105 transition-transform duration-700">
              <Compass size={160} />
            </div>
            <div className="flex items-center justify-between w-full relative z-10">
              <div className="flex flex-col gap-1.5">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-text/60 leading-none">Our distance</p>
                <p className="text-[2.2rem] font-bold tracking-tighter mt-1 leading-none text-text">
                  {distance ? formatDistance(distance) : "Searching..."}
                </p>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className={cn("px-3 py-1.5 rounded-full text-[10px] font-semibold uppercase tracking-widest flex items-center gap-2 shadow-sm border", isOnline ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : "bg-text/5 text-text/50 border-border")}>
                  <span className={cn("w-2 h-2 rounded-full", isOnline ? "bg-emerald-500" : "bg-text/30")} />
                  {isOnline ? "Live" : "Idle"}
                </div>
                {partner?.activity?.batteryLevel !== undefined && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg/50 rounded-full border border-border/50 shadow-sm">
                    <Battery size={12} className={cn((partner?.activity?.batteryLevel || 0) < 20 ? "text-rose-500 animate-pulse" : "text-text/60")} />
                    <span className="text-[11px] font-semibold text-text/70 leading-none">{partner.activity.batteryLevel}%</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* ROW 2: Songs, Reels (Stacked) + Doodles (Square) */}
          <div className="flex gap-3.5 h-[150px]">
            <div className="flex flex-col gap-3.5 flex-[1.4]">
              <motion.button
                variants={itemVariant}
                whileTap={{ scale: 0.98 }}
                onClick={() => { sensory.play('pop'); setView('spotify') }}
                className="flex-1 bg-card rounded-[24px] px-5 py-3 flex items-center gap-4 text-left border shadow-sm border-border/80 active:brightness-95 transition-all overflow-hidden relative group"
              >
                <div className="absolute right-0 bottom-0 opacity-[0.04] text-[#1db954] pointer-events-none translate-x-2 translate-y-2 group-hover:scale-110 transition-transform duration-500">
                  <Play size={80} />
                </div>
                <div className="w-10 h-10 rounded-full bg-[#1db954]/10 text-[#1db954] flex items-center justify-center shrink-0 shadow-inner z-10">
                  <Play size={16} className="fill-[#1db954]" />
                </div>
                <p className="text-[16px] font-semibold leading-none truncate text-text z-10 tracking-tight">Our Song</p>
              </motion.button>
              
              <motion.button
                variants={itemVariant}
                whileTap={{ scale: 0.98 }}
                onClick={() => { sensory.play('pop'); setView('reels') }}
                className="flex-1 bg-card rounded-[24px] px-5 py-3 flex items-center gap-4 text-left border shadow-sm border-border/80 active:brightness-95 transition-all overflow-hidden relative group"
              >
                <div className="absolute right-0 bottom-0 opacity-[0.04] text-violet-500 pointer-events-none translate-x-3 translate-y-2 group-hover:scale-110 transition-transform duration-500">
                  <Video size={70} />
                </div>
                <div className="w-10 h-10 rounded-full bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 shadow-inner z-10">
                  <Video size={16} />
                </div>
                <p className="text-[16px] font-semibold leading-none truncate text-text z-10 tracking-tight">Our Reels</p>
              </motion.button>
            </div>

            <motion.button
              variants={itemVariant}
              whileTap={{ scale: 0.98 }}
              onClick={() => { sensory.play('pop'); setView('doodle') }}
              className="flex-1 bg-card rounded-[32px] p-5 flex flex-col justify-center items-center text-center border shadow-sm border-border/80 active:brightness-95 transition-all relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-pink-500/5 to-transparent opacity-[0.5]" />
              <div className="absolute right-0 bottom-0 opacity-[0.04] text-pink-500 pointer-events-none translate-x-2 translate-y-2 group-hover:scale-110 transition-transform duration-500">
                <Palette size={110} />
              </div>
              <div className="w-12 h-12 rounded-[20px] bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shadow-inner mb-3 shrink-0 z-10">
                <Palette size={24} />
              </div>
              <p className="text-[16px] font-semibold leading-tight text-text z-10 tracking-tight">Doodles</p>
            </motion.button>
          </div>

          {/* ROW 3: Scrapbook & Calendar */}
          <div className="grid grid-cols-2 gap-3.5 h-[120px]">
             <motion.button
              variants={itemVariant}
              whileTap={{ scale: 0.98 }}
              onClick={() => { sensory.play('pop'); setView('timeline') }}
              className="bg-card rounded-[32px] p-5 flex flex-col justify-end items-start text-left border shadow-sm border-border/80 active:brightness-95 transition-all overflow-hidden h-full relative group"
            >
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-purple-500/5 to-transparent opacity-[0.5]" />
              <div className="absolute right-0 bottom-0 opacity-[0.04] text-purple-500 pointer-events-none translate-x-3 translate-y-3 group-hover:scale-110 transition-transform duration-500">
                <History size={100} />
              </div>
              <div className="w-9 h-9 rounded-full bg-purple-500/10 text-purple-500 flex items-center justify-center shadow-inner absolute top-4 left-4">
                <History size={16} />
              </div>
              <p className="text-[17px] font-semibold leading-tight text-text z-10 tracking-tight">Scrapbook</p>
            </motion.button>

            <motion.button
              variants={itemVariant}
              whileTap={{ scale: 0.98 }}
              onClick={() => { sensory.play('pop'); setView('planner') }}
              className="bg-card rounded-[32px] p-5 flex flex-col justify-end items-start text-left border shadow-sm border-border/80 active:brightness-95 transition-all overflow-hidden h-full relative group"
            >
              <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-emerald-500/5 to-transparent opacity-[0.5]" />
              <div className="absolute right-0 bottom-0 opacity-[0.04] text-emerald-500 pointer-events-none translate-x-3 translate-y-3 group-hover:scale-110 transition-transform duration-500">
                <Calendar size={100} />
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner absolute top-4 left-4">
                <Calendar size={16} />
              </div>
              <p className="text-[17px] font-semibold leading-tight text-text z-10 tracking-tight truncate">Our Calendar</p>
            </motion.button>
          </div>

          {/* ROW 4: Health HUB */}
          <motion.button
            variants={itemVariant}
            whileTap={{ scale: 0.98 }}
            onClick={() => { sensory.play('pop'); setView('period') }}
            className="w-full bg-card rounded-[32px] py-6 px-6 flex items-center justify-center border shadow-sm border-border/80 active:brightness-95 transition-all relative overflow-hidden group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-rose-500/5 via-transparent to-rose-500/5 pointer-events-none" />
            <div className="absolute left-6 opacity-[0.04] text-rose-500 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <Droplets size={70} />
            </div>
            <div className="absolute right-6 opacity-[0.04] text-rose-500 pointer-events-none group-hover:scale-110 transition-transform duration-500">
              <Droplets size={70} />
            </div>
            <p className="text-[14px] font-semibold tracking-widest uppercase text-text z-10 text-center flex items-center gap-2">
              <Heart size={16} className="text-rose-500 fill-rose-500/20" />
              LOVE
            </p>
          </motion.button>

          {/* ROW 5: Our Anniversary */}
          <motion.div
            variants={itemVariant}
            className="w-full bg-card rounded-[32px] p-6 shadow-sm border border-border/80 relative overflow-hidden flex flex-col items-center justify-center text-center group"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.02] text-amber-500 pointer-events-none group-hover:scale-105 transition-transform duration-700">
              <Heart size={160} className="fill-amber-500" />
            </div>
            <div className="relative z-10 w-full flex flex-col items-center">
              <p className="text-[11px] font-semibold tracking-widest text-text/60 uppercase mb-2">Our Anniversary</p>
              <CountdownWidget nearestEvent={nearestEvent} anniversary={pair?.anniversary} />
            </div>
          </motion.div>
          
          {/* Notes & Letters */}
          <div className="grid grid-cols-2 gap-3.5">
             <motion.button
                variants={itemVariant}
                whileTap={{ scale: 0.98 }}
                onClick={() => { sensory.play('pop'); setView('chat') }}
                className="bg-card/80 backdrop-blur-md rounded-[24px] py-4 px-4 flex items-center justify-center gap-3 border shadow-sm border-border/80 active:brightness-95 transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-blue-500/5 to-transparent rounded-bl-[40px] pointer-events-none" />
                <div className="absolute -left-2 -bottom-2 opacity-[0.04] text-blue-500 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                  <MessageCircle size={56} />
                </div>
                <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 shadow-inner z-10">
                  <MessageCircle size={14} className="text-blue-500" />
                </div>
                <span className="text-[13px] font-semibold text-text z-10 tracking-tight">Chat</span>
              </motion.button>
              <motion.button
                variants={itemVariant}
                whileTap={{ scale: 0.98 }}
                onClick={() => { sensory.play('pop'); setShowLoveEnvelopeComposer(true) }}
                className="bg-card/80 backdrop-blur-md rounded-[24px] py-4 px-4 flex items-center justify-center gap-3 border shadow-sm border-border/80 active:brightness-95 transition-all relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-amber-500/5 to-transparent rounded-bl-[40px] pointer-events-none" />
                 <div className="absolute -left-2 -bottom-2 opacity-[0.04] text-amber-500 pointer-events-none group-hover:scale-110 transition-transform duration-500">
                  <Mail size={56} />
                </div>
                <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0 shadow-inner z-10">
                  <Mail size={14} className="text-amber-500" />
                </div>
                <span className="text-[13px] font-semibold text-text z-10 tracking-tight">Love Letters</span>
                {availableEnvelopesCount > 0 && (
                  <span className="absolute max-w-[20px] max-h-[20px] top-3 right-3 bg-rose-500 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold z-10 shadow-lg">
                    {availableEnvelopesCount}
                  </span>
                )}
              </motion.button>
          </div>

          {/* ROW X: Memories (moved to bottom) */}
          <AnimatePresence>
            {memoryOfTheMonth && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.5 }}
                className="w-full relative h-[220px] rounded-[32px] overflow-hidden group cursor-pointer border border-white/20 dark:border-white/5 shadow-2xl bg-black"
                onClick={() => { sensory.play('pop'); setView('timeline') }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 pointer-events-none" />
                
                <motion.img 
                  src={memoryOfTheMonth.url} 
                  alt="Memories" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 blur-[10px] opacity-40 absolute inset-0 scale-110"
                />
                <motion.img 
                  src={memoryOfTheMonth.url} 
                  alt="Memories" 
                  className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 relative z-[5] mx-auto"
                />
                
                <div className="absolute top-4 left-4 z-20 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/20">
                  <Sparkles size={14} className="text-amber-300" />
                  <span className="text-[10px] font-semibold text-white uppercase tracking-widest leading-none">Memories</span>
                </div>

                {memoryOfTheMonth.caption && (
                  <div className="absolute bottom-4 left-4 right-4 z-20 group-hover:-translate-y-1 transition-transform duration-500">
                    <p className="text-white text-sm font-medium line-clamp-3 drop-shadow-md">
                      {memoryOfTheMonth.caption}
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

        </div>

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
       <div className="flex-1 flex flex-col items-center">
          <div className="flex items-center gap-1.5 mb-1 text-center justify-center">
            <p className="text-sm font-bold text-text leading-tight">{anniversary || "October 10"}</p>
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
