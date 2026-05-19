import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Home, Calendar, History, Sparkles, ChevronLeft, ChevronRight, Droplets, Moon, CheckCircle2, Sprout, Info, Activity, Coffee, Utensils, Pill, Flame, Footprints, Hash, Smile, Frown, Meh, Cloudy, X, Edit2, Settings, Trash2, Plus, Users, Zap, Target, ArrowLeft } from "lucide-react";
import { doc, updateDoc, setDoc, serverTimestamp, writeBatch, collection, query, onSnapshot, deleteDoc, addDoc } from "firebase/firestore";
import { Socket } from "socket.io-client";
import { db, handleFirestoreError } from "../firebase/config";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { getCycleInfo, getTodayStr, getEmptyDailyLog, DEFAULT_HABITS, getDetailedCycleInfo, generateCycleDays, predictNextPeriods, getHealthScore, getCycleRegularity, getPartnerGuidance, getCycleStability, getIrregularityAwareness, getWellnessInsights, getSymptomPatterns, getPreparationAdvice, parseSafeDate } from "../utils/health";
import { DailyLog, CycleRecord, CustomHabit, CalendarEvent, DailyHealthLog, PeriodEntry, CycleDay } from "../types";
import { Celebration } from "../components/Celebration";
import { MonthlyHabitBoard } from "../components/MonthlyHabitBoard";

const PHASE_ADVICE: Record<string, string[]> = {
  "Menstrual": [
    "Sip on warm ginger tea to soothe cramps. 🍵",
    "Rest is your superpower today. Honor your body. 🛌",
    "Dark chocolate (70%+) can help with mood and magnesium. 🍫",
    "Stay hydrated—water helps reduce bloating! 💧"
  ],
  "Follicular": [
    "Energy is rising! Great time for a light workout. 🏃‍♀️",
    "Try something new today—your creativity is peaking. 🎨",
    "Focus on fresh, vibrant salads and proteins. 🥗",
    "Social battery is recharging—plan something fun! ✨"
  ],
  "Ovulation": [
    "You're at your most social—connect with friends! 📱",
    "Your skin is glowing! A perfect day for photos. ✨",
    "High energy today—tackle those big tasks. 💪",
    "Confidence is at a peak—it's a great day for that meeting. 🌟"
  ],
  "Luteal": [
    "Take it slow. Your body is preparing for rest. 🌙",
    "Healthy fats like avocado help with PMS symptoms. 🥑",
    "Journaling can help process these rising emotions. ✍️",
    "Cozy nights in are highly recommended. 🕯️"
  ]
};

interface SanctuaryProps {
  socket: Socket | null;
}

export function CareSanctuaryScreen({ socket }: SanctuaryProps) {
  const { user, view, setView, partner, addCoins, health, setHealth, roomId, theme } = useAppStore(useShallow(state => ({
    user: state.user,
    view: state.view,
    setView: state.setView,
    partner: state.partner,
    addCoins: state.addCoins,
    health: state.health,
    setHealth: state.setHealth,
    roomId: state.roomId,
    theme: state.theme
  })));
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const isHer = user?.perspective === "her";
  
  const tabs = [
    { id: "habits", label: "Habits" },
    { id: "period", label: "Period" },
    { id: "history", label: "History" }
  ];

  // Consolidated listeners moved to useAppSync.ts

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col w-full font-body bg-bg pb-40">
      <div className="flex flex-col w-full">
        {/* Tabs */}
        <div className="px-6 pt-2 pb-2 space-y-4 shrink-0">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
            {tabs.map(tab => {
              const isActive = view === tab.id || (tab.id === "period" && view === "calendar") || (tab.id === "habits" && view === "sanctuary");
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setView(tab.id as any);
                    sensory.tap();
                  }}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium border transition-all shrink-0 active:scale-95",
                    isActive 
                      ? "bg-primary/10 text-primary border-primary/30" 
                      : "border-border bg-card text-text/50 hover:text-text/70"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 pt-2 space-y-6">
          {(view === "habits" || view === "sanctuary") && (isHer ? <HabitTrackerView /> : <HisCareView socket={socket} />)}
          {(view === "period" || view === "calendar") && (isHer ? <PeriodTrackerView /> : <HisPeriodSummaryView />)}
          {view === "history" && <HistoryView />}
        </div>
      </div>
    </motion.div>
  );
}

// ━━ GIRLFRIEND: HABITS VIEW ━━
function HabitTrackerView() {
  const { roomId } = useAppStore();

  return (
    <div className="space-y-4">
      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm mt-4">
        <MonthlyHabitBoard pairId={roomId || ""} />
      </div>
    </div>
  );
}

// ━━ BOYFRIEND: CARE VIEW ━━
function HisCareView({ socket }: { socket: Socket | null }) {
  const { roomId, partner, health, user, theme } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const today = getTodayStr();
  const habitList = health?.customHabits?.length ? health.customHabits : DEFAULT_HABITS;
  const habitLogs = health?.habitLogs || {};
  const todayLogs = habitLogs[today] || {};
  const cycle = getDetailedCycleInfo(health?.periodEntries || [], health?.cycleLength, health?.periodLength, health?.lastPeriodStart);
  const pName = partner?.displayName || "Partner";
  
  const completedCount = habitList.filter(h => !!todayLogs[h.id]).length;

  const handleNudge = async (habitName: string) => {
    if (!roomId || !user) return;
    try {
      await addDoc(collection(db, "pairs", roomId, "habitNudges"), {
        senderId: user.uid,
        habitName,
        timestamp: serverTimestamp()
      });
      sensory.play('pop');
      sensory.tap();
    } catch (e) {}
  };

  const guidance = cycle ? getPartnerGuidance(cycle.phase) : [];

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex flex-col">
          <h2 className="font-display text-2xl text-text leading-tight">{pName}'s Health</h2>
          <div className="flex items-center gap-2 mt-1">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[10px] font-black uppercase tracking-widest text-text/30">Live Syncing</span>
          </div>
        </div>
        <div className="bg-primary/10 text-primary rounded-2xl px-4 py-2 border border-primary/20 flex flex-col items-center min-w-[70px]">
           <span className="text-sm font-black leading-none">{completedCount}/{habitList.length}</span>
           <span className="text-[7px] font-black uppercase tracking-tighter mt-0.5">Habits</span>
        </div>
      </div>



      {/* Monthly Habit Board (Partner Perspective) */}
      <div className="space-y-4">
         <div className="flex items-center gap-2 ml-1">
            <Calendar size={12} className="text-primary/40" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text/30">{pName}'s Habit Board</h3>
         </div>
         <div className="bg-card rounded-[32px] border border-border overflow-hidden shadow-sm">
            <MonthlyHabitBoard pairId={roomId || ""} />
         </div>
      </div>
    </div>
  );
}


// ━━ GIRLFRIEND: PERIOD OVERVIEW ━━
function PeriodTrackerView() {
  const { health, setHealth, roomId, theme } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const [showStartModal, setShowStartModal] = useState(false);
  const [showEndModal, setShowEndModal] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());
  const [flow, setFlow] = useState<"light"|"medium"|"heavy">("medium");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showPastModal, setShowPastModal] = useState(false);
  const [pastStart, setPastStart] = useState(getTodayStr());
  const [pastEnd, setPastEnd] = useState(getTodayStr());
  const [insightIndex, setInsightIndex] = useState(0);

  const periodEntries = health?.periodEntries || [];
  const activePeriod = periodEntries.find((e: any) => !e.endDate);


  const isOnPeriod = !!activePeriod;
  const todayStr = getTodayStr();
  const nextPredicted = React.useMemo(() => predictNextPeriods(periodEntries, health?.cycleLength || 28, 1)[0], [periodEntries, health?.cycleLength]);
  const cycleInfo = getDetailedCycleInfo(periodEntries, health?.cycleLength, health?.periodLength, health?.lastPeriodStart);

  // Memoize cycle days so we don't recalculate per calendar cell
  const cycleDaysData = React.useMemo(() => generateCycleDays(periodEntries, health?.cycleLength, health?.periodLength), [periodEntries, health?.cycleLength, health?.periodLength]);

  // Consolidated listeners moved to useAppSync.ts

  const validateCycle = (sDate: string, eDate?: string) => {
    return !periodEntries.some(e => {
       const entryStart = e.startDate;
       const entryEnd = e.endDate || '9999-12-31';
       const checkEnd = eDate || sDate;
       return (sDate >= entryStart && sDate <= entryEnd) || (checkEnd >= entryStart && checkEnd <= entryEnd);
    });
  };

  const handleStartPeriod = async () => {
    if (!roomId) return;
    if (startDate > todayStr) {
       alert("You cannot start a period in the future! 🕰️");
       return;
    }
    if (!validateCycle(startDate)) {
       alert("This date overlaps with an existing cycle!");
       return;
    }
    setSaving(true);
    try {
      const newEntry = {
        startDate,
        flow,
        createdAt: serverTimestamp()
      };
      await addDoc(collection(db, "pairs", roomId, "periodEntries"), newEntry);
      
      // Update lastPeriodStart if this is the newest
      const currentLast = health?.lastPeriodStart || "0000-00-00";
      if (startDate >= currentLast) {
        await setDoc(doc(db, "pairs", roomId, "health", "current"), {
          lastPeriodStart: startDate,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      setShowStartModal(false);
      sensory.play('pop');
    } catch(e) { console.error("Start period error:", e); }
    setSaving(false);
  };

  const handleEndPeriod = async () => {
    if (!roomId || !activePeriod?.id) return;
    if (endDate < activePeriod.startDate) {
       alert("End date cannot be before start date!");
       return;
    }
    setSaving(true);
    try {
      await updateDoc(doc(db, "pairs", roomId, "periodEntries", activePeriod.id), {
        endDate
      });
      setShowEndModal(false);
      sensory.play('sparkle');
    } catch(e) { console.error("End period error:", e); }
    setSaving(false);
  };

  const handleLogPastPeriod = () => {
    setShowPastModal(true);
  };

  const submitPastPeriod = async () => {
    if (!pastStart || !pastEnd) {
      alert("Please fill both dates");
      return;
    }
    
    if (pastEnd < pastStart) {
      alert("End date must be after start date!");
      return;
    }
    
    if (!validateCycle(pastStart, pastEnd)) {
       alert("Historical entry overlaps with existing data!");
       return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "pairs", roomId!, "periodEntries"), {
        startDate: pastStart,
        endDate: pastEnd,
        flow: "medium",
        createdAt: serverTimestamp()
      });

      // Update lastPeriodStart if this is the newest
      const currentLast = health?.lastPeriodStart || "0000-00-00";
      if (pastStart >= currentLast) {
        await setDoc(doc(db, "pairs", roomId!, "health", "current"), {
          lastPeriodStart: pastStart,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      sensory.play('pop');
      setShowPastModal(false);
    } catch(e) { console.error("Past period error:", e); }
    setSaving(false);
  };


  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, "pairs", roomId, "calendarEvents"));
    const unsub = onSnapshot(q, (snap) => {
      setCalendarEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as CalendarEvent)));
    });
    return unsub;
  }, [roomId]);

  // Smart Pattern Detection
  const awareness = getIrregularityAwareness(periodEntries);
  const prepAdvice = nextPredicted ? getPreparationAdvice(nextPredicted) : null;
  const insights = useMemo(() => {
    const base = getWellnessInsights(cycleInfo?.phase || "");
    if (prepAdvice) return [...prepAdvice.tips, ...base];
    return base;
  }, [cycleInfo?.phase, prepAdvice]);
  const patterns = getSymptomPatterns(health?.dailyHealthLogs || {}, periodEntries);

  // Calendar Integration: Overlap with Predicted Period


  const overlaps = useMemo(() => {
    if (!nextPredicted) return [];
    const predStart = new Date(nextPredicted);
    const predEnd = new Date(predStart);
    predEnd.setDate(predEnd.getDate() + (health?.periodLength || 5));
    
    return calendarEvents.filter(e => {
       const eventDate = new Date(e.date);
       return eventDate >= predStart && eventDate <= predEnd;
    });
  }, [nextPredicted, calendarEvents, health?.periodLength]);

  // Auto-cycle insights
  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % insights.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [insights.length]);

  return (
    <div className="space-y-6 pb-20">


      {/* CUTE INSIGHT CAROUSEL */}
      {insights.length > 0 && (
        <div className="relative h-24 overflow-hidden bg-card/30 border border-border rounded-[32px] p-6 shadow-sm flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={insightIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.6, ease: "circOut" }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-primary/60" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 mb-1">Wellness Insight</span>
                <p className="text-xs text-text/70 font-medium leading-relaxed">{insights[insightIndex]}</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 right-8 flex gap-1">
            {insights.map((_, idx) => (
              <div key={idx} className={cn("w-1 h-1 rounded-full transition-all duration-500", idx === insightIndex ? "bg-primary w-3" : "bg-border")} />
            ))}
          </div>
        </div>
      )}

      {/* Preparation Advice (Smart Readiness) */}
      {prepAdvice && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="bg-primary/5 border border-primary/20 rounded-[32px] p-6 space-y-4 shadow-sm"
        >
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles size={20} />
             </div>
             <div>
                <h3 className="font-display text-lg text-text leading-tight">{prepAdvice.title}</h3>
                <p className="text-[10px] text-text/40 font-black uppercase tracking-widest mt-0.5">Prepare for your next cycle</p>
             </div>
          </div>
          <div className="space-y-2">
             {prepAdvice.tips.map((tip, i) => (
               <div key={i} className="flex items-center gap-3 bg-card/50 p-3 rounded-2xl border border-border/50">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/30 shrink-0" />
                  <span className="text-xs text-text/60 font-medium">{tip}</span>
               </div>
             ))}
          </div>
        </motion.div>
      )}

      {/* Irregularity Awareness (Gentle) */}
      {awareness && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-amber-50/30 border border-amber-200/50 rounded-2xl p-4 flex items-start gap-3"
        >
          <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900/60 font-medium leading-relaxed">{awareness}</p>
        </motion.div>
      )}

      {/* Symptom Patterns (Smart Analysis) */}
      {patterns.length > 0 && (
        <div className="space-y-3">
           <div className="flex items-center gap-2 ml-1">
              <Activity size={14} className="text-text/30" />
              <h3 className="text-[10px] font-black uppercase tracking-widest text-text/30">Personalized Patterns</h3>
           </div>
           <div className="space-y-2">
              {patterns.map((pattern, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
                   <p className="text-xs text-text/60 font-medium leading-relaxed">{pattern}</p>
                </div>
              ))}
           </div>
        </div>
      )}



      {/* Calendar Awareness */}
      {overlaps.length > 0 && (

        <div className="bg-rose-50/30 border border-rose-200/50 rounded-[28px] p-5 space-y-3">
           <div className="flex items-center gap-2">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500/60">Cycle Overlap Alert</h4>
           </div>
           <div className="space-y-2">
              {overlaps.map(e => (
                 <div key={e.id} className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-900/50">{e.title}</span>
                    <span className="text-[10px] text-rose-400/60">
                       {e.date && (() => {
                         const d = new Date(e.date);
                         return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                       })()}
                    </span>
                 </div>
              ))}
              <p className="text-[10px] text-rose-900/40 italic pt-1 border-t border-rose-200/30">These events overlap with your next predicted period. Plan for extra rest.</p>
           </div>
        </div>
      )}

      {/* SECTION 2 - Main action button */}
      <div className="flex gap-3">
        {!isOnPeriod ? (
          <button onClick={() => setShowStartModal(true)} className="flex-1 bg-card border-2 border-border rounded-[28px] p-6 active:scale-95 transition-all text-center">
            <div className="text-3xl mb-2">🩸</div>
            <h3 className="text-sm font-black text-text uppercase tracking-widest">Start Period</h3>
          </button>
        ) : (
          <div className="flex-1 bg-card border-2 border-rose-300/30 rounded-[28px] p-5 cursor-pointer" onClick={() => setShowEndModal(true)}>
            <div className="flex justify-between items-start">
               <div>
                 <h3 className="text-sm font-black text-rose-500 uppercase tracking-widest">Day {cycleInfo?.periodDay || 1}</h3>
                 <p className="text-[10px] text-text/40 font-bold mt-1">
                    Started {activePeriod.startDate && (() => {
                      const d = new Date(activePeriod.startDate);
                      return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                    })()}
                  </p>
               </div>
               <button className="bg-rose-500 text-white text-[8px] font-black uppercase px-3 py-2 rounded-xl shadow-lg shadow-rose-500/20">End Now</button>
            </div>
          </div>
        )}

        <button 
          onClick={handleLogPastPeriod}
          className="w-16 bg-card border-2 border-border rounded-[28px] flex flex-col items-center justify-center active:scale-95 transition-all"
        >
          <History size={20} className="text-text/30" />
          <span className="text-[7px] font-black uppercase text-text/20 mt-1">Past</span>
        </button>
      </div>

      {/* SECTION 3 - Symptom Logging (Only if on period) */}
      {isOnPeriod && (
         <div className="space-y-3">
            <h3 className="font-display text-base text-text">How are you feeling?</h3>
            <div className="flex gap-2">
               {[
                 { id: 'cramps', icon: '😫', label: 'Cramps', field: 'cramps', value: 4 },
                 { id: 'tired', icon: '😴', label: 'Tired', field: 'energyLevel', value: 2 },
                 { id: 'moody', icon: '🥺', label: 'Moody', field: 'mood', value: 'anxious' },
                 { id: 'nausea', icon: '🤢', label: 'Nausea', field: 'nausea', value: true }
               ].map(item => (
                 <button 
                  key={item.id}
                  onClick={async () => {
                    if (!roomId) return;
                    sensory.play('pop');
                    try {
                      const docRef = doc(db, "pairs", roomId, "dailyHealthLogs", todayStr);
                      await setDoc(docRef, {
                        [item.field]: item.value,
                        date: todayStr,
                        updatedAt: serverTimestamp()
                      }, { merge: true });
                      sensory.success();
                    } catch (e) { console.error(e); }
                  }}
                  className="flex-1 bg-card border border-border rounded-2xl p-3 flex flex-col items-center active:scale-90 transition-all"
                 >
                    <span className="text-xl mb-1">{item.icon}</span>
                    <span className="text-[8px] font-black uppercase text-text/40">{item.label}</span>
                 </button>
               ))}
            </div>
         </div>
      )}

      {/* SECTION 4 - Cycle calendar */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => { const d=new Date(calMonth); d.setMonth(d.getMonth()-1); setCalMonth(d); }} className="p-2 active:scale-90 transition-all text-text/50 hover:text-text"><ChevronLeft size={20}/></button>
          <h3 className="font-display text-base text-text">{calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
          <button onClick={() => { const d=new Date(calMonth); d.setMonth(d.getMonth()+1); setCalMonth(d); }} className="p-2 active:scale-90 transition-all text-text/50 hover:text-text"><ChevronLeft size={20} className="rotate-180"/></button>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=><div key={i} className="text-[10px] text-text/30 font-medium">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {(() => {
            const year = calMonth.getFullYear();
            const month = calMonth.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Mon to Sun week
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const boxes = [];
            
            for (let i = 0; i < adjustedFirstDay; i++) { 
               boxes.push(<div key={`empty-${i}`} className="invisible aspect-square" />); 
            }
            
            for (let d = 1; d <= daysInMonth; d++) {
              const dateObj = new Date(year, month, d);
              const dateObjLocal = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
              const dateStr = dateObjLocal.toISOString().split('T')[0];
              const cDay = cycleDaysData.find(x => x.date === dateStr);
              const isToday = dateStr === todayStr;
              
              let bgClass = "text-text/60 hover:bg-bg transition-colors";
              let dotColor = "";

              if (cDay?.type === "period") {
                bgClass = "bg-rose-400 text-white font-bold shadow-[0_4px_12px_rgba(244,63,94,0.3)]";
              } else if (cDay?.type === "predicted_period") {
                bgClass = isDark ? "bg-rose-950/40 text-rose-300 border border-rose-800/30" : "bg-rose-50 text-rose-500 border border-rose-200/50";
              } else if (cDay?.type === "ovulation") {
                bgClass = isDark ? "bg-amber-950/40 text-amber-300 border border-amber-800/30" : "bg-amber-100 text-amber-700 font-black border-2 border-amber-300 shadow-sm";
              } else if (cDay?.type === "fertile") {
                bgClass = isDark ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/30 font-bold" : "bg-emerald-50 text-emerald-600 border border-emerald-100 font-bold";
                dotColor = "bg-emerald-400";
              }
              
              if (isToday) bgClass += " ring-2 ring-primary ring-offset-2";
              
              boxes.push(
                <motion.div 
                  key={d} 
                  onClick={() => {
                     sensory.play('tick');
                     setPastStart(dateStr);
                     setPastEnd(dateStr);
                     setShowPastModal(true);
                  }}
                  whileTap={{ scale: 0.9 }}
                  className={cn("w-full aspect-square rounded-[1rem] flex items-center justify-center relative text-[13px] cursor-pointer", bgClass)}
                >
                  <span className="relative z-10">{d}</span>
                  {cDay?.type === 'ovulation' && <Sparkles size={8} className="absolute top-1.5 right-1.5 text-amber-500" fill="currentColor" />}
                  {dotColor && <div className={cn("absolute bottom-1.5 w-1 h-1 rounded-full", dotColor)} />}
                </motion.div>
              );
            }
            return boxes;
          })()}
        </div>

        <div className="flex flex-wrap justify-center gap-4 mt-3">
          <div className="flex items-center gap-1 text-[10px] text-text/40"><span className="w-2 h-2 rounded-full inline-block bg-rose-400"/> Period</div>
          <div className="flex items-center gap-1 text-[10px] text-text/40"><span className={cn("w-2 h-2 rounded-full inline-block", isDark ? "bg-rose-900" : "bg-rose-100")}/> Predicted</div>
          <div className="flex items-center gap-1 text-[10px] text-text/40"><span className={cn("w-2 h-2 rounded-full inline-block", isDark ? "bg-amber-900" : "bg-amber-300")}/> Ovulation</div>
          <div className="flex items-center gap-1 text-[10px] text-text/40"><span className={cn("w-2 h-2 rounded-full inline-block", isDark ? "bg-emerald-900" : "bg-emerald-100")}/> Fertile</div>
        </div>
      </div>

      {/* Period History Button */}
      <button
        onClick={() => { sensory.play('pop'); useAppStore.getState().setView('history' as any); }}
        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center"><History size={20} /></div>
          <div>
            <h3 className="text-sm font-bold text-text">Period History</h3>
            <p className="text-[10px] text-text/40">{periodEntries.length} cycles logged</p>
          </div>
        </div>
        <ChevronLeft size={16} className="rotate-180 text-text/30" />
      </button>

      {/* SECTION 5 - Predictions */}
      <div className="space-y-3">
         <div className="flex items-center justify-between">
            <h3 className="font-display text-base text-text">Predictions</h3>
            <span className="text-[10px] bg-card text-emerald-600 px-2 py-0.5 rounded-full border border-border flex items-center gap-1 font-bold">
               ✨ {getCycleRegularity(periodEntries)}% Regular
            </span>
         </div>
         {predictNextPeriods(periodEntries, health?.cycleLength || 28, 3)
            .filter(dateStr => dateStr >= todayStr)
            .length > 0 ? (
            predictNextPeriods(periodEntries, health?.cycleLength || 28, 3)
              .filter(dateStr => dateStr >= todayStr)
              .map((dateStr, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 flex justify-between items-center shadow-sm">
                <div className="flex flex-col">
                  <span className="text-xs font-black uppercase tracking-widest text-text/30 mb-1">{i === 0 ? "Next Expected" : "Future Cycle"}</span>
                  <span className="text-sm font-bold text-text">{new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric'})}</span>
                </div>
                <div className="bg-card text-rose-500 rounded-xl px-3 py-1 text-xs font-bold border border-border">
                  in {Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000)}d
                </div>
              </div>
            ))
         ) : (
            <div className="text-sm text-text/40 italic p-4 bg-bg rounded-2xl border border-dashed border-border text-center">Log a period to start AI training.</div>
         )}
      </div>

      {/* START PERIOD MODAL */}
      <AnimatePresence>
        {showStartModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-xl">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="font-display text-xl text-text">🩸 Log Period Start</h2>
                 <button onClick={() => setShowStartModal(false)} className="text-text/40 hover:text-text"><X size={20}/></button>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-medium text-text/50 block mb-1">Period started on</label>
                   <input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-rose-300" />
                 </div>
                 
                 <div>
                   <label className="text-xs font-medium text-text/50 block mb-2 mt-4">Flow</label>
                   <div className="flex gap-2">
                     <button onClick={() => setFlow("light")} className={cn("px-4 py-2 text-sm rounded-full active:scale-95 transition-all", flow==="light" ? "bg-rose-100 border border-rose-300 text-rose-500 font-medium" : "bg-card border border-border text-text/50")}>Light 💧</button>
                     <button onClick={() => setFlow("medium")} className={cn("px-4 py-2 text-sm rounded-full active:scale-95 transition-all", flow==="medium" ? "bg-rose-100 border border-rose-300 text-rose-500 font-medium" : "bg-card border border-border text-text/50")}>Medium 💧💧</button>
                     <button onClick={() => setFlow("heavy")} className={cn("px-4 py-2 text-sm rounded-full active:scale-95 transition-all", flow==="heavy" ? "bg-rose-100 border border-rose-300 text-rose-500 font-medium" : "bg-card border border-border text-text/50")}>Heavy 💧💧💧</button>
                   </div>
                 </div>

                 <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
                   <button onClick={() => setShowStartModal(false)} className="flex-1 py-3 text-sm text-text/50 rounded-xl font-medium border border-border active:scale-95 transition-all">Cancel</button>
                   <button onClick={handleStartPeriod} disabled={saving} className="flex-1 py-3 bg-rose-400 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all shadow-md">
                     {saving ? "Saving..." : "Log Period"}
                   </button>
                 </div>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* END PERIOD MODAL */}
      <AnimatePresence>
        {showEndModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-xl">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="font-display text-xl text-text">Period ended? 🌸</h2>
                 <button onClick={() => setShowEndModal(false)} className="text-text/40 hover:text-text"><X size={20}/></button>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-medium text-text/50 block mb-1">Ended on</label>
                   <input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-rose-300" />
                 </div>
                 
                 <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
                   <button onClick={() => setShowEndModal(false)} className="flex-1 py-3 text-sm text-text/50 rounded-xl font-medium border border-border active:scale-95 transition-all">Cancel</button>
                   <button onClick={handleEndPeriod} className="flex-1 py-3 bg-rose-400 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all shadow-md">
                     Confirm
                   </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>

      {/* PAST PERIOD MODAL */}
      <AnimatePresence>
        {showPastModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm">
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 25, stiffness: 200 }} className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-6 shadow-xl">
               <div className="flex justify-between items-center mb-6">
                 <h2 className="font-display text-xl text-text">🕰️ Log Past Period</h2>
                 <button onClick={() => setShowPastModal(false)} className="text-text/40 hover:text-text"><X size={20}/></button>
               </div>
               
               <div className="space-y-4">
                 <div>
                   <label className="text-xs font-medium text-text/50 block mb-1">Started on</label>
                   <input type="date" value={pastStart} onChange={e=>setPastStart(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-rose-300" />
                 </div>
                 <div>
                   <label className="text-xs font-medium text-text/50 block mb-1">Ended on</label>
                   <input type="date" value={pastEnd} onChange={e=>setPastEnd(e.target.value)} className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-rose-300" />
                 </div>
                 
                 <div className="flex gap-3 mt-6 pt-4 border-t border-border/50">
                   <button onClick={() => setShowPastModal(false)} className="flex-1 py-3 text-sm text-text/50 rounded-xl font-medium border border-border active:scale-95 transition-all">Cancel</button>
                   <button onClick={submitPastPeriod} disabled={saving} className="flex-1 py-3 bg-rose-400 text-white rounded-xl text-sm font-semibold active:scale-[0.98] transition-all shadow-md">
                     {saving ? "Saving..." : "Save Log"}
                   </button>
                 </div>
               </div>
             </motion.div>
           </motion.div>
         )}
       </AnimatePresence>
    </div>
  );
}

function HisPeriodSummaryView() {
  const { health, partner, roomId, theme, pair } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const [calMonth, setCalMonth] = useState(new Date());
  const todayStr = getTodayStr();
  const periodEntries = health?.periodEntries || [];
  const activePeriod = periodEntries.find(e => !e.endDate);
  const cycle = getDetailedCycleInfo(periodEntries, health?.cycleLength, health?.periodLength, health?.lastPeriodStart);
  const isOnPeriod = !!activePeriod;
  const pName = partner?.displayName || "Partner";

  const nextPredicted = predictNextPeriods(periodEntries, health?.cycleLength || 28, 1)[0];
  const prepAdvice = nextPredicted ? getPreparationAdvice(nextPredicted) : null;
  const guidance = cycle ? getPartnerGuidance(cycle.phase) : [];
  const insights = getWellnessInsights(cycle?.phase || "");
  const [insightIndex, setInsightIndex] = useState(0);

  useEffect(() => {
    if (insights.length <= 1) return;
    const interval = setInterval(() => {
      setInsightIndex(prev => (prev + 1) % insights.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [insights.length]);

  return (
    <div className="space-y-6 pb-20">
      {/* INSIGHT CAROUSEL (Partner Perspective) */}
      {insights.length > 0 && (
        <div className="relative h-24 overflow-hidden bg-primary/5 border border-primary/10 rounded-[32px] p-6 shadow-sm flex items-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={insightIndex}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ duration: 0.6, ease: "circOut" }}
              className="flex items-start gap-4"
            >
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <Sparkles size={18} className="text-primary/60" />
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-primary/40 mb-1">Support Suggestion</span>
                <p className="text-xs text-text/70 font-medium leading-relaxed">{insights[insightIndex]}</p>
              </div>
            </motion.div>
          </AnimatePresence>
          <div className="absolute bottom-3 right-8 flex gap-1">
            {insights.map((_, idx) => (
              <div key={idx} className={cn("w-1 h-1 rounded-full transition-all duration-500", idx === insightIndex ? "bg-primary w-3" : "bg-border")} />
            ))}
          </div>
        </div>
      )}

      {/* CARD 1 - Phase Hero Card (Partner Perspective) */}
      {cycle ? (
        <div className="relative overflow-hidden rounded-[32px] p-8 border border-border shadow-xl bg-gradient-to-br from-card to-bg/50">
          <div className="flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-bg border border-border shadow-inner flex items-center justify-center text-4xl mb-4">
              {cycle.phaseEmoji}
            </div>
            <h2 className="font-display text-3xl text-text tracking-tight">{cycle.phase}</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-text/20 mt-1 mb-3">{pName}'s {cycle.season} Season</p>
            <p className="text-xs text-text/50 font-medium leading-relaxed px-4">
              {cycle.phaseDesc}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-8 pt-6 border-t border-border/50">
             <div className="flex flex-col items-center text-center">
                <span className="text-[8px] font-black uppercase tracking-widest text-text/20 mb-1">Cycle Day</span>
                <span className="text-xs font-bold text-text/60">{cycle.dayInCycle}</span>
             </div>
             <div className="flex flex-col items-center text-center border-l border-border/50">
                <span className="text-[8px] font-black uppercase tracking-widest text-text/20 mb-1">Next Cycle</span>
                <span className="text-xs font-bold text-text/60">in {cycle.nextPeriodIn}d</span>
             </div>
          </div>
        </div>
      ) : (
        <div className="bg-card p-10 rounded-[32px] border border-border shadow-sm text-center">
          <p className="text-sm text-text/40 italic">Waiting for cycle data... 🌸</p>
        </div>
      )}

      {/* Preparation Awareness (Partner Perspective) */}
      {prepAdvice && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className={cn("border rounded-[32px] p-6 space-y-4 shadow-sm", isDark ? "bg-rose-950/20 border-rose-900/30" : "bg-rose-50/50 border-rose-100")}
        >
          <div className="flex items-center gap-3">
             <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center", isDark ? "bg-rose-900/40 text-rose-300" : "bg-rose-100 text-rose-500")}>
                <Heart size={20} />
             </div>
             <div>
                <h3 className="font-display text-lg text-text leading-tight">Preparation Mode</h3>
                <p className="text-[10px] text-text/40 font-black uppercase tracking-widest mt-0.5">{pName}'s cycle is approaching</p>
             </div>
          </div>
          <div className="space-y-2">
             <p className="text-[11px] text-text/60 italic px-1 capitalize">How you can prepare {pair?.houseName || "bondu's house"}:</p>
             {prepAdvice.tips.map((tip, i) => (
               <div key={i} className={cn("flex items-center gap-3 p-3 rounded-2xl border", isDark ? "bg-white/5 border-white/10" : "bg-white/60 border-rose-100/50")}>
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-300 shrink-0" />
                  <span className="text-xs text-text/60 font-medium">{tip}</span>
               </div>
             ))}
          </div>
        </motion.div>
      )}

      {/* Guardian Guidance (Ways to show up) */}
      <div className="space-y-4">
         <div className="flex items-center gap-2 ml-1">
            <Heart size={14} className="text-rose-400" />
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text/30">Guardian Guidance</h3>
         </div>
         <div className="grid grid-cols-1 gap-2">
            {guidance.length > 0 ? guidance.map((tip, i) => (
              <div key={i} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3">
                 <div className="w-1.5 h-1.5 rounded-full bg-rose-200 shrink-0 mt-1.5" />
                 <p className="text-xs text-text/60 font-medium leading-relaxed">{tip}</p>
              </div>
            )) : (
              <div className="p-4 bg-bg rounded-2xl border border-dashed border-border text-center">
                 <p className="text-[10px] text-text/40">Log a period to unlock guidance.</p>
              </div>
            )}
         </div>
      </div>

      {/* Active Period Alert */}
      {isOnPeriod && (
        <div className={cn("border rounded-[32px] p-6 shadow-sm space-y-4", isDark ? "bg-rose-950/20 border-rose-900/30" : "bg-rose-50/50 border-rose-200/50")}>
          <div className="flex justify-between items-start">
             <div>
               <h3 className="font-display text-lg text-rose-500">🩸 Active Period</h3>
               <p className="text-sm text-text/50">Day {cycle?.periodDay || 1} · Be extra gentle today 🤍</p>
             </div>
             <div className="w-12 h-12 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500">
                <Sparkles size={24} />
             </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
             <button 
              onClick={async () => {
                if (!roomId || !user) return;
                sensory.play('sparkle');
                await addDoc(collection(db, "pairs", roomId, "chatMessages"), {
                  senderId: user.uid,
                  text: `Sending you some virtual chocolate and comfort! 🍫✨`,
                  timestamp: serverTimestamp(),
                  isCareBtn: true,
                  careType: "eat"
                });
                alert("Sent chocolate comfort! 🍫");
              }}
              className={cn("border rounded-2xl py-3 px-4 flex flex-col items-center active:scale-95 transition-all shadow-sm", isDark ? "bg-white/5 border-white/10" : "bg-white border-rose-100")}
             >
                <span className="text-xl">🍫</span>
                <span className={cn("text-[8px] font-black uppercase mt-1", isDark ? "text-rose-300" : "text-rose-400")}>Send Chocolate</span>
             </button>
             <button 
              onClick={async () => {
                if (!roomId || !user) return;
                sensory.play('sparkle');
                await addDoc(collection(db, "pairs", roomId, "chatMessages"), {
                  senderId: user.uid,
                  text: `Sending you a huge magic hug for extra strength! 🫂✨`,
                  timestamp: serverTimestamp(),
                  isCareBtn: true,
                  careType: "hug"
                });
                alert("Sent a magic hug! 🫂");
              }}
              className={cn("border rounded-2xl py-3 px-4 flex flex-col items-center active:scale-95 transition-all shadow-sm", isDark ? "bg-white/5 border-white/10" : "bg-white border-rose-100")}
             >
                <span className="text-xl">✨</span>
                <span className={cn("text-[8px] font-black uppercase mt-1", isDark ? "text-rose-300" : "text-rose-400")}>Send Magic Hug</span>
             </button>
          </div>
        </div>
      )}

      {/* Cycle Calendar (Partner Perspective) */}
      <div className="bg-card border border-border rounded-[32px] p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
           <div className="flex flex-col">
              <h3 className="text-sm font-black text-text uppercase tracking-widest">{calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h3>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-text/20 mt-0.5">{pName}'s Cycle Map</p>
           </div>
           <div className="flex gap-2">
             <button onClick={() => { const d=new Date(calMonth); d.setMonth(d.getMonth()-1); setCalMonth(d); }} className="p-2 bg-bg border border-border rounded-xl active:scale-90 transition-all text-text/50"><ChevronLeft size={16}/></button>
             <button onClick={() => { const d=new Date(calMonth); d.setMonth(d.getMonth()+1); setCalMonth(d); }} className="p-2 bg-bg border border-border rounded-xl active:scale-90 transition-all text-text/50"><ChevronLeft size={16} className="rotate-180"/></button>
           </div>
        </div>
        
        <div className="grid grid-cols-7 gap-1 text-center">
          {['M','T','W','T','F','S','S'].map((d,i)=><div key={i} className="text-[9px] text-text/20 font-black">{d}</div>)}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {(() => {
            const year = calMonth.getFullYear();
            const month = calMonth.getMonth();
            const firstDay = new Date(year, month, 1).getDay();
            const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const boxes = [];
            const cycleDaysData = generateCycleDays(periodEntries, health?.cycleLength, health?.periodLength);
            
            for (let i = 0; i < adjustedFirstDay; i++) boxes.push(<div key={`empty-${i}`} className="invisible aspect-square" />);
            
            for (let d = 1; d <= daysInMonth; d++) {
              const dateObj = new Date(year, month, d);
              const dateObjLocal = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
              const dateStr = dateObjLocal.toISOString().split('T')[0];
              const cDay = cycleDaysData.find(x => x.date === dateStr);
              const isToday = dateStr === todayStr;
              
              let bgClass = "text-text/40";
              if (cDay?.type === "period") bgClass = "bg-rose-400 text-white font-bold";
              else if (cDay?.type === "predicted_period") bgClass = isDark ? "bg-rose-950/40 text-rose-300 border border-rose-800/20" : "bg-rose-50 text-rose-300";
              else if (cDay?.type === "ovulation") bgClass = isDark ? "bg-amber-950/40 text-amber-300 border border-amber-800/20" : "bg-amber-100 text-amber-600";
              else if (cDay?.type === "fertile") bgClass = isDark ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/20" : "bg-emerald-50 text-emerald-500";
              
              if (isToday) bgClass += " ring-2 ring-primary ring-offset-2";
              
              boxes.push(
                <div key={d} className={cn("aspect-square rounded-xl flex items-center justify-center text-[11px] font-bold", bgClass)}>
                  {d}
                </div>
              );
            }
            return boxes;
          })()}
        </div>

        {/* Phase Legend */}
        <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t border-border/30">
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text/40">
             <span className="w-2 h-2 rounded-full bg-rose-400 shadow-sm shadow-rose-400/30"/> Period
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text/40">
             <span className={cn("w-2 h-2 rounded-full border", isDark ? "bg-rose-950 border-rose-800" : "bg-rose-50 border-rose-100")}/> Predicted
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text/40">
             <span className={cn("w-2 h-2 rounded-full border", isDark ? "bg-amber-950 border-amber-800" : "bg-amber-100 border-amber-300")}/> Ovulation
          </div>
          <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-text/40">
             <span className={cn("w-2 h-2 rounded-full border", isDark ? "bg-emerald-950 border-emerald-800" : "bg-emerald-50 border-emerald-200")}/> Fertile
          </div>
        </div>
      </div>

      {/* History & Predictions (Partner Perspective) */}
      <div className="space-y-4">
         <button
           onClick={() => { sensory.play('pop'); useAppStore.getState().setView('history' as any); }}
           className="w-full bg-card border border-border rounded-[28px] p-5 flex items-center justify-between shadow-sm active:scale-[0.98] transition-all"
         >
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><History size={20} /></div>
             <div className="text-left">
               <h3 className="text-sm font-bold text-text">Past Cycles</h3>
               <p className="text-[10px] text-text/40">{pName} has {periodEntries.length} cycles logged</p>
             </div>
           </div>
           <ChevronRight size={16} className="text-text/30" />
         </button>

         <div className="bg-card border border-border rounded-[32px] p-6 space-y-4 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-text/30">Future Cycles</h3>
            <div className="space-y-3">
               {predictNextPeriods(periodEntries, health?.cycleLength || 28, 2)
                 .filter(dateStr => dateStr >= todayStr)
                 .map((dateStr, i) => (
                   <div key={i} className="flex justify-between items-center p-3 bg-bg/50 rounded-2xl border border-border/50">
                      <span className="text-xs font-bold text-text/70">{new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short'})}</span>
                      <span className="text-[10px] bg-rose-50 text-rose-500 px-3 py-1 rounded-full font-black">IN {Math.ceil((new Date(dateStr).getTime() - new Date(todayStr).getTime()) / 86400000)}D</span>
                   </div>
               ))}
            </div>
         </div>
      </div>
    </div>
  );
}

function HistoryView() {
  const { health, roomId, setHealth, user, healthIssues, theme, pair } = useAppStore();
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);
  const [activeSubTab, setActiveSubTab] = useState<'cycles' | 'health'>('health');
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [issueText, setIssueText] = useState("");
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [saving, setSaving] = useState(false);
  
  const periodEntries = [...(health?.periodEntries || [])].filter(e => e && e.startDate).sort((a,b) => b.startDate.localeCompare(a.startDate));
  const isHer = user?.perspective === 'her';

  const handleAddIssue = async () => {
    if (!roomId || !issueText.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, "pairs", roomId, "healthIssues"), {
        date: logDate,
        issue: issueText.trim(),
        severity,
        status: 'active',
        createdAt: serverTimestamp(),
      });
      setIssueText("");
      setLogDate(new Date().toISOString().split('T')[0]);
      setShowIssueModal(false);
      sensory.success();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSendSuggestion = async (issueId: string) => {
    const suggestion = prompt("Enter your supportive suggestion (will be shown as AI Suggestion to her):");
    if (!suggestion || !roomId) return;
    try {
      await updateDoc(doc(db, "pairs", roomId, "healthIssues", issueId), {
        suggestion,
        updatedAt: serverTimestamp()
      });
      sensory.play('pop');
    } catch (e) { console.error(e); }
  };

  const handleResolveIssue = async (issueId: string) => {
    if (!roomId) return;
    try {
      await updateDoc(doc(db, "pairs", roomId, "healthIssues", issueId), {
        status: 'recovered',
        updatedAt: serverTimestamp()
      });
    } catch (e) { console.error(e); }
  };

  // Group periods by year
  const grouped = periodEntries.reduce((acc, entry) => {
    const sDate = parseSafeDate(entry.startDate);
    const year = sDate ? sDate.getFullYear() : new Date().getFullYear();
    if (!acc[year]) acc[year] = [];
    acc[year].push(entry);
    return acc;
  }, {} as Record<number, any[]>);

  const years = Object.keys(grouped).sort((a,b) => b.localeCompare(a));

  const handleDeletePeriod = async (entryId: string) => {
    if (!roomId || !window.confirm("Permanent delete? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, "pairs", roomId, "periodEntries", entryId));
      const remaining = periodEntries.filter(e => e.id !== entryId);
      const newest = remaining.sort((a,b) => b.startDate.localeCompare(a.startDate))[0];
      await setDoc(doc(db, "pairs", roomId, "health", "current"), {
        lastPeriodStart: newest?.startDate || null,
        updatedAt: serverTimestamp()
      }, { merge: true });
      setHealth({ ...health, periodEntries: remaining });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col">
        <h2 className="font-display text-2xl text-text capitalize">{pair?.houseName || "bondu's house"}</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-text/30 mt-1">Care History & Health Logs</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 bg-card/40 p-1 rounded-2xl border border-border w-fit">
        <button 
          onClick={() => setActiveSubTab('health')}
          className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeSubTab === 'health' ? "bg-primary text-white shadow-lg" : "text-text/30")}
        >
          Health Logs
        </button>
        <button 
          onClick={() => setActiveSubTab('cycles')}
          className={cn("px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all", activeSubTab === 'cycles' ? "bg-primary text-white shadow-lg" : "text-text/30")}
        >
          Cycle History
        </button>
      </div>

      {activeSubTab === 'health' && (
        <div className="space-y-6">
          {isHer && (
            <motion.button 
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowIssueModal(true)}
              className="w-full bg-primary/5 border border-primary/20 rounded-[32px] p-6 flex items-center justify-between shadow-sm group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Zap size={24} />
                </div>
                <div className="text-left">
                  <h3 className="text-sm font-black text-text uppercase tracking-widest">Report Issue</h3>
                  <p className="text-[10px] text-text/40 font-medium mt-0.5">Record illness, pain, or discomfort</p>
                </div>
              </div>
              <div className="w-10 h-10 rounded-full bg-bg border border-border flex items-center justify-center">
                <Plus size={20} className="text-primary" />
              </div>
            </motion.button>
          )}

          <div className="space-y-4">
            {healthIssues.length > 0 ? healthIssues.map((issue: any) => (
              <motion.div 
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-[32px] p-6 shadow-sm relative overflow-hidden"
              >
                {issue.status === 'recovered' && <div className="absolute inset-0 bg-bg/60 backdrop-blur-[1px] z-10 flex items-center justify-center font-black text-[10px] uppercase tracking-[0.3em] text-emerald-500">Recovered ✨</div>}
                
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="text-[10px] font-black text-text/30 uppercase tracking-widest block mb-1">
                      {issue.date && (() => {
                        const d = new Date(issue.date);
                        return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                      })()}
                    </span>
                    <h3 className="text-base font-bold text-text leading-tight">{issue.issue}</h3>
                  </div>
                  <div className={cn("px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border", 
                    issue.severity === 'high' ? "bg-rose-50 border-rose-200 text-rose-500" : 
                    issue.severity === 'medium' ? "bg-amber-50 border-amber-200 text-amber-500" : 
                    "bg-blue-50 border-blue-200 text-blue-500"
                  )}>
                    {issue.severity} priority
                  </div>
                </div>

                {issue.suggestion && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-2xl border border-primary/10">
                     <div className="flex items-center gap-2 mb-2">
                        <div className="w-1 h-3 bg-primary/40 rounded-full" />
                        <span className="text-[9px] font-black uppercase tracking-widest text-primary/60">AI Suggestion ✨</span>
                     </div>
                     <p className="text-xs text-text/70 italic leading-relaxed">"{issue.suggestion}"</p>
                  </div>
                )}

                {!isHer && !issue.suggestion && (
                  <button 
                    onClick={() => handleSendSuggestion(issue.id)}
                    className="mt-4 w-full bg-primary text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20"
                  >
                    Send Care Suggestion
                  </button>
                )}

                {isHer && issue.status === 'active' && (
                  <button 
                    onClick={() => handleResolveIssue(issue.id)}
                    className="mt-4 w-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 py-3 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em]"
                  >
                    Mark as Recovered
                  </button>
                )}
              </motion.div>
            )) : (
              <div className="text-center py-20 opacity-20">
                <History size={48} className="mx-auto mb-4" />
                <p className="font-bold uppercase tracking-widest text-[10px]">No health records yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'cycles' && (
        <div className="space-y-8">
          {years.map(year => (
            <div key={year} className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-black text-primary/40 tracking-widest">{year}</span>
                <div className="flex-1 h-[1px] bg-border/50" />
              </div>
              <div className="space-y-4">
                {grouped[parseInt(year)].map((entry: any) => {
                  const start = parseSafeDate(entry.startDate);
                  const end = parseSafeDate(entry.endDate);
                  if (!start) return null;
                  const duration = end ? Math.round((end.getTime() - start.getTime()) / 86400000) + 1 : null;
                  const prevEntry = periodEntries[periodEntries.indexOf(entry) + 1];
                  const prevStart = prevEntry ? parseSafeDate(prevEntry.startDate) : null;
                  const cycleLen = prevStart ? Math.round((start.getTime() - prevStart.getTime()) / 86400000) : null;
                  return (
                    <div key={entry.id} className="bg-card/40 backdrop-blur-xl border border-border rounded-[32px] p-6">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                            <Droplets size={24} />
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-text">
                              {start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — {end ? end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Active'}
                            </h3>
                            <p className="text-[10px] font-black text-text/30 uppercase tracking-widest mt-0.5">{entry.flow || 'Medium'} Intensity</p>
                          </div>
                        </div>
                        {isHer && <button onClick={() => handleDeletePeriod(entry.id!)} className="p-2 text-text/20 hover:text-rose-500"><Trash2 size={16} /></button>}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-bg/40 rounded-2xl p-3 border border-border/50">
                          <span className="text-[8px] font-black text-text/30 uppercase block mb-1">Duration</span>
                          <span className="text-xl font-black text-text">{duration || '--'} <span className="text-[10px] opacity-40">Days</span></span>
                        </div>
                        <div className="bg-bg/40 rounded-2xl p-3 border border-border/50">
                          <span className="text-[8px] font-black text-text/30 uppercase block mb-1">Cycle Gap</span>
                          <span className="text-xl font-black text-emerald-500">{cycleLen || '--'} <span className="text-[10px] opacity-40">Days</span></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Issue Logging Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowIssueModal(false)}>
             <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="w-full max-w-[400px] bg-bg border border-border rounded-[40px] p-8 shadow-2xl space-y-6 mb-20" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-display text-text">Health Record</h2>
                  <button onClick={() => setShowIssueModal(false)} className="w-10 h-10 rounded-full bg-card border border-border flex items-center justify-center text-text/40"><X size={20} /></button>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/40 ml-2">What happened? (Illness, Pain, etc)</label>
                    <textarea 
                      value={issueText}
                      onChange={e => setIssueText(e.target.value)}
                      className="w-full bg-card border border-border rounded-[24px] p-5 min-h-[120px] outline-none text-sm font-medium"
                      placeholder="e.g. Sharp stomach pain, mild fever, headache..."
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/40 ml-2">When did it happen?</label>
                    <input 
                      type="date"
                      value={logDate}
                      onChange={e => setLogDate(e.target.value)}
                      className="w-full bg-card border border-border rounded-[20px] px-5 py-4 outline-none text-sm font-medium"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-text/40 ml-2">Severity</label>
                    <div className="flex gap-2">
                       {(['low', 'medium', 'high'] as const).map(s => (
                         <button 
                           key={s}
                           onClick={() => setSeverity(s)}
                           className={cn("flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all", 
                             severity === s ? "bg-primary text-white border-primary shadow-lg" : "bg-card border-border text-text/40"
                           )}
                         >
                           {s}
                         </button>
                       ))}
                    </div>
                  </div>
                </div>

                <button 
                  disabled={saving || !issueText.trim()}
                  onClick={handleAddIssue}
                  className="w-full bg-primary text-white py-4 rounded-[24px] font-black text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-primary/20 disabled:opacity-50"
                >
                  {saving ? "Logging..." : "Log Health Issue"}
                </button>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
