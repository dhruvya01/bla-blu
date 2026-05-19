import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Edit2, Trash2, Target, CalendarDays, 
  ChevronLeft, ChevronRight, Maximize2, Minimize2, 
  Sparkles, TrendingUp, TrendingDown, Award, 
  Settings, CheckCircle2, X, Filter, BarChart3, 
  Calendar as CalendarIcon, MessageSquare, Info, 
  Zap, Crown, Flame, Star, Trophy, Activity
} from "lucide-react";
import { collection, onSnapshot, query, addDoc, doc, deleteDoc, setDoc, updateDoc } from "firebase/firestore";
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  AreaChart, Area, CartesianGrid 
} from "recharts";
import { db, handleFirestoreError } from "../firebase/config";
import { CustomHabit, HabitLog, User, HabitCategory } from "../types";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { getTodayStr } from "../utils/health";

const getLogId = (date: string, habitId: string) => `${date}_${habitId}`;

interface MonthlyHabitBoardProps {
  pairId: string;
}

const CATEGORIES: { id: HabitCategory; label: string; color: string; icon: string }[] = [
  { id: 'health', label: 'Health', color: 'text-blue-500', icon: '🏃' },
  { id: 'selfcare', label: 'Self Care', color: 'text-rose-500', icon: '🛁' },
  { id: 'study', label: 'Growth', color: 'text-amber-500', icon: '📚' },
  { id: 'routine', label: 'Routine', color: 'text-primary', icon: '⏰' },
  { id: 'emotional', label: 'Mindset', color: 'text-purple-500', icon: '🧘' },
  { id: 'custom', label: 'Other', color: 'text-gray-500', icon: '✨' },
];

const MISSED_REASONS = [
  "No time", "Feeling unwell", "Forgot", "Travel", "Burnout", "Crisis", "Rest day"
];

interface HabitRowProps {
  habit: CustomHabit;
  daysArray: number[];
  year: number;
  month: number;
  logsMap: Record<string, boolean>;
  habitStat?: any;
  onToggle: (day: number, habitId: string) => void;
  onDelete: (id: string) => void;
}

const HabitRow = React.memo(({ habit, daysArray, year, month, logsMap, habitStat, onToggle, onDelete }: HabitRowProps) => {
  const catColor = CATEGORIES.find(c => c.id === habit.category)?.color || 'text-primary';
  
  return (
    <tr className="hover:bg-primary/5 transition-all group">
      <td className="p-5">
        <div className="flex items-center gap-4">
          <div className={cn("w-12 h-12 bg-card rounded-2xl shadow-sm border border-text/5 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform duration-500")}>
            {habit.emoji}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="font-black text-text text-[13px] tracking-tight truncate leading-none mb-1.5">{habit.name}</p>
            <div className="flex items-center gap-2">
               <span className={cn("text-[8px] font-black uppercase tracking-widest font-sans", catColor)}>{habit.category}</span>
               <span className="w-1 h-1 rounded-full bg-text/10" />
               <span className="text-[8px] font-black uppercase tracking-widest text-text/20 font-sans">Goal {habit.goal}</span>
            </div>
          </div>
          <button onClick={() => onDelete(habit.id)} className="p-2 text-rose/40 hover:text-rose hover:scale-110 transition-all">
            <Trash2 size={16} />
          </button>
        </div>
      </td>
      {daysArray.map(day => {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isDone = logsMap[dateStr] === true;
        
        return (
          <td key={`${habit.id}-${day}`} className="p-1 px-[3px]">
            <button 
              onPointerDown={(e) => {
                e.preventDefault();
                onToggle(day, habit.id);
              }}
              className={cn(
                "w-10 h-10 rounded-xl border-2 transition-all mx-auto flex items-center justify-center group/btn relative active:scale-75 z-50",
                isDone 
                  ? "bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/20 text-white" 
                  : "bg-card border-border hover:border-primary/40"
              )}
            >
              {isDone ? <CheckCircle2 size={18} strokeWidth={3} /> : <div className="w-2 h-2 rounded-full bg-text/5 group-hover/btn:bg-primary/20" />}
            </button>
          </td>
        );
      })}
      <td className="p-5">
         <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
               <span className="text-[13px] font-black text-text tracking-tighter">{habitStat?.percent}%</span>
               {habitStat && habitStat.streak >= 3 && (
                 <div className="w-1.5 h-1.5 rounded-full bg-rose animate-pulse" />
               )}
            </div>
            <div className="w-16 h-1.5 bg-bg rounded-full overflow-hidden border border-white">
               <div 
                className="h-full bg-primary transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min(100, habitStat?.percent || 0)}%` }} 
               />
            </div>
         </div>
      </td>
    </tr>
  );
});

export function MonthlyHabitBoard({ pairId }: MonthlyHabitBoardProps) {
  const { user, partner, habits, logs, storeRoomId } = useAppStore(useShallow(state => ({ 
    user: state.user, 
    partner: state.partner,
    habits: state.habits,
    logs: state.habitLogs,
    storeRoomId: state.roomId
  })));

  const effectivePairId = pairId || storeRoomId || "";
  const safeHabits = habits || [];
  const safeLogs = logs || [];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory | 'all'>('all');
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeLogDetail, setActiveLogDetail] = useState<{ day: number; habitId: string; log?: HabitLog } | null>(null);

  // Form State
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitEmoji, setNewHabitEmoji] = useState("✨");
  const [newHabitGoal, setNewHabitGoal] = useState(20);
  const [newHabitCategory, setNewHabitCategory] = useState<HabitCategory>("routine");

  // Log Detail Form
  const [logNotes, setLogNotes] = useState("");
  const [logMissedReason, setLogMissedReason] = useState("");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const toggleQuickHabit = React.useCallback(async (day: number, habitId: string) => {
    if (!effectivePairId) return;
    
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logId = `${dateStr}_${habitId}`;
    const existingLog = safeLogs.find(l => l.id === logId);

    // Optimistic UI Update
    const newLogs = existingLog 
      ? safeLogs.filter(l => l.id !== logId)
      : [...safeLogs, { id: logId, date: dateStr, habitId, completed: true, timestamp: Date.now() }];
    
    useAppStore.getState().setHabitLogs(newLogs as any);
    sensory.tap();

    try {
      if (existingLog) {
        await deleteDoc(doc(db, "pairs", effectivePairId, "habitLogs", logId));
      } else {
        await setDoc(doc(db, "pairs", effectivePairId, "habitLogs", logId), {
          id: logId,
          date: dateStr,
          habitId,
          completed: true,
          timestamp: Date.now()
        });
        // Reward 10 coins for completing a habit
        useAppStore.getState().addCoins(10);
        await useAppStore.getState().addPairXp(10);
      }
    } catch (err: any) {
      // Revert on error
      useAppStore.getState().setHabitLogs(safeLogs);
      console.error("Habit toggle error:", err);
    }
  }, [effectivePairId, year, month, safeLogs]);

  const handleDetailedLog = async (completed: boolean) => {
    if (!pairId || !activeLogDetail) return;
    const { day, habitId } = activeLogDetail;
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const logId = getLogId(dateStr, habitId);

    try {
      if (completed) {
        await setDoc(doc(db, "pairs", pairId, "habitLogs", logId), {
          id: logId,
          date: dateStr,
          habitId,
          completed: true,
          notes: logNotes,
          missedReason: null,
          timestamp: Date.now()
        });
        sensory.play('ding');
        // Reward 10 coins for completing a habit
        useAppStore.getState().addCoins(10);
        await useAppStore.getState().addPairXp(10);
      } else {
        await setDoc(doc(db, "pairs", pairId, "habitLogs", logId), {
          id: logId,
          date: dateStr,
          habitId,
          completed: false,
          notes: logNotes,
          missedReason: logMissedReason,
          timestamp: Date.now()
        });
      }
      setActiveLogDetail(null);
      setLogNotes("");
      setLogMissedReason("");
    } catch (err) {
      handleFirestoreError(err, "write", `pairs/${pairId}/habitLogs`);
      useAppStore.getState().setError("Failed to save habit log details.");
    }
  };

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pairId || !newHabitName) return;
    try {
      await addDoc(collection(db, "pairs", pairId, "customHabits"), {
        name: newHabitName,
        emoji: newHabitEmoji,
        goal: newHabitGoal,
        category: newHabitCategory,
        createdAt: Date.now()
      });
      setNewHabitName("");
      setShowAddModal(false);
    } catch (err) {
      handleFirestoreError(err, "write", `pairs/${pairId}/customHabits`);
      useAppStore.getState().setError("Failed to add new habit.");
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (!pairId || !id || !window.confirm("Delete this habit and all its history?")) return;
    try {
      await deleteDoc(doc(db, "pairs", pairId, "customHabits", id));
    } catch (err) {
      handleFirestoreError(err, "delete", `pairs/${pairId}/customHabits/${id}`);
      useAppStore.getState().setError("Failed to delete habit.");
    }
  };

  // Advanced Analytics
  const stats = useMemo(() => {
    const today = getTodayStr();
    
    const habitStats = safeHabits.map(h => {
      const habitLogs = safeLogs.filter(l => l.habitId === h.id);
      const monthlyLogs = habitLogs.filter(l => l.date && l.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && l.completed);
      
      let streak = 0;
      for (let i = 0; i < 365; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const hasLog = habitLogs.some(l => l.date === dStr && l.completed);
        if (hasLog) streak++;
        else if (i > 0) break;
      }

      const successRate = daysArray.length === 0 ? 0 : Math.round((monthlyLogs.length / daysArray.length) * 100);

      return {
        ...h,
        completed: monthlyLogs.length,
        streak,
        successRate,
        allLogs: habitLogs,
        percent: Math.round((monthlyLogs.length / (h.goal || 1)) * 100)
      };
    }).sort((a, b) => b.percent - a.percent);

    const weeklyChartData = Array.from({ length: 7 }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const completedCount = safeLogs.filter(l => l.date === dStr && l.completed).length;
      return { 
        name: d.toLocaleDateString(undefined, { weekday: 'short' }),
        count: completedCount,
        pct: safeHabits.length > 0 ? Math.round((completedCount / safeHabits.length) * 100) : 0
      };
    });

    const monthlyChartData = daysArray.map(day => {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const count = safeLogs.filter(l => l.date === dateStr && l.completed).length;
      return { day, count };
    });

    const totalGoal = safeHabits.reduce((acc, h) => acc + (h.goal || 0), 0);
    const totalDone = habitStats.reduce((acc, h) => acc + h.completed, 0);
    const disciplineScore = totalGoal === 0 ? 0 : Math.min(100, Math.round((totalDone / totalGoal) * 100));

    const bestConsistency = habitStats.reduce((prev, current) => (prev.successRate > current.successRate) ? prev : current, habitStats[0] || null);

    const insights = [];
    if (disciplineScore > 80) insights.push("Absolute legend. Your discipline is an inspiration.");
    else if (disciplineScore > 50) insights.push("Solid foundation. You're building lasting change.");
    else insights.push("Every small win counts. Keep showing up for yourself.");

    if (bestConsistency && bestConsistency.successRate > 0) {
      insights.push(`Mastery detected in '${bestConsistency.name}' — maintain that integrity.`);
    }

    return {
      habitStats,
      weeklyChartData,
      monthlyChartData,
      disciplineScore,
      bestConsistency,
      insights
    };
  }, [safeHabits, safeLogs, year, month, daysArray]);

  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

  const filteredHabits = safeHabits.filter(h => selectedCategory === 'all' || h.category === selectedCategory);

  return (
    <div className="space-y-6">
      
      {/* A. Top Header: Title, Month %, Streak */}
      <div className="flex items-center justify-between mb-8 mt-2">
         <div>
            <h2 className="text-3xl font-black text-text tracking-tighter leading-tight">
              Discipline Tracker
            </h2>
            <div className="flex items-center gap-2 text-primary/60 mt-1.5">
               <Flame size={14} fill="currentColor" />
               <span className="text-[10px] font-black uppercase tracking-widest font-sans">
                 {stats.disciplineScore || 0}% Monthly • {stats.habitStats[0]?.streak || 0} Day Streak
               </span>
            </div>
         </div>
         {/* B. Simple Elegant Add Button */}
         <button 
           onClick={() => setShowAddModal(true)} 
           className="w-12 h-12 bg-card rounded-full flex items-center justify-center text-primary shadow-xl shadow-primary/10 active:scale-90 transition-all hover:bg-primary hover:text-white border border-border"
         >
           <Plus size={24} />
         </button>
      </div>

      {/* C. Habit Matrix (Clean & Breathable) */}
      <div className={cn(
        "bg-card rounded-2xl shadow-sm border border-border relative transition-all duration-500",
        isMaximized ? "fixed inset-4 z-[100] flex flex-col pb-safe shadow-2xl" : ""
      )}>
        <div className="p-4 flex items-center justify-between bg-card border-b border-border z-20">
          <div className="flex items-center gap-2">
            <button onClick={() => setCurrentDate(new Date(year, month - 1))} className="w-8 h-8 flex items-center justify-center hover:bg-bg rounded-lg text-text/30 transition-all active:scale-95"><ChevronLeft size={16} /></button>
            <h4 className="font-display font-medium text-text tracking-tight text-sm w-32 text-center truncate">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h4>
            <button onClick={() => setCurrentDate(new Date(year, month + 1))} className="w-8 h-8 flex items-center justify-center hover:bg-bg rounded-lg text-text/30 transition-all active:scale-95"><ChevronRight size={16} /></button>
          </div>
          <button onClick={() => setIsMaximized(!isMaximized)} className="w-8 h-8 bg-bg text-text/30 rounded-lg flex items-center justify-center hover:text-primary transition-all active:scale-95">
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>

        <div className={cn("overflow-auto hide-scrollbar", isMaximized ? "flex-1" : "max-h-[500px]")}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-card z-10 border-b border-border">
              <tr>
                <th className="p-4 text-left min-w-[180px] sticky left-0 bg-card z-20 shadow-[10px_0_20px_-10px_rgba(0,0,0,0.02)]">
                   <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text/30 font-sans">Habits</span>
                </th>
                {daysArray.map(day => (
                  <th key={day} className="px-1 py-4 min-w-[44px] text-center">
                    <div className={cn(
                      "w-8 h-8 mx-auto flex items-center justify-center rounded-full text-[10px] transition-all",
                      new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year
                        ? "bg-primary text-white shadow-md font-black" 
                        : "text-text/40 font-bold"
                    )}>
                      {day}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredHabits.map(habit => {
                // Pre-calculate logs for THIS habit for O(1) lookup in Row
                const habitLogsMap: Record<string, boolean> = {};
                safeLogs.filter(l => l.habitId === habit.id).forEach(l => {
                   habitLogsMap[l.date] = l.completed;
                });

                return (
                  <HabitRow 
                    key={habit.id}
                    habit={habit}
                    daysArray={daysArray}
                    year={year}
                    month={month}
                    logsMap={habitLogsMap}
                    habitStat={stats.habitStats.find(s => s.id === habit.id)}
                    onToggle={toggleQuickHabit}
                    onDelete={handleDeleteHabit}
                  />
                );
              })}
            </tbody>
          </table>
          {safeHabits.length === 0 && (
            <div className="py-24 text-center space-y-6">
               <div className="w-20 h-20 bg-primary/5 rounded-[2rem] flex items-center justify-center mx-auto text-primary/30 shrink-0">
                 <Target size={32} />
               </div>
               <div>
                  <p className="text-sm font-black text-text uppercase tracking-widest font-sans">No Habits Found</p>
                  <p className="text-[10px] font-medium text-text/30 uppercase tracking-widest mt-1">Start building discipline</p>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* E. Collapsible Analytics Section */}
      <div className="bg-card rounded-[2.5rem] shadow-xl shadow-black/5 border border-border overflow-hidden mt-6">
        <button 
          onClick={() => setIsAnalyticsOpen(!isAnalyticsOpen)}
          className="w-full p-6 flex items-center justify-between hover:bg-bg/50 transition-colors"
        >
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
               <BarChart3 size={18} />
             </div>
             <div className="text-left">
               <h3 className="font-black text-text tracking-tighter text-lg">Analytics Summary</h3>
               <p className="text-[10px] font-black uppercase text-primary tracking-widest font-sans mt-0.5">Performance Intelligence</p>
             </div>
          </div>
          <ChevronRight size={20} className={cn("text-text/30 transition-transform duration-300", isAnalyticsOpen && "rotate-90")} />
        </button>

        <AnimatePresence>
          {isAnalyticsOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-text/5">
                 
                 {/* This Week vs Last Week Chart */}
                 <div className="bg-card p-5 rounded-[1.5rem] shadow-sm border border-border">
                   <h4 className="text-[10px] font-black uppercase text-text/30 tracking-widest font-sans mb-4">Weekly Pulse</h4>
                   <div className="h-24 flex items-end gap-1.5">
                      {(stats?.weeklyChartData || []).map((d, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                          <div className="w-full relative bg-bg rounded-t-lg h-full flex items-end overflow-hidden group-hover:bg-primary/5 transition-colors">
                            <motion.div 
                              initial={{ height: 0 }}
                              animate={{ height: `${Math.max(5, d.pct || 0)}%` }}
                              className={cn("w-full rounded-t-lg transition-colors duration-500", (d.pct || 0) > 0 ? "bg-primary" : "bg-primary/20")}
                            />
                          </div>
                          <span className="text-[8px] font-black uppercase text-text/30 font-sans">{d.name?.[0]}</span>
                        </div>
                      ))}
                   </div>
                 </div>

                 {/* Best Habit / Weakest Habit / Score */}
                 <div className="space-y-3">
                   <div className="bg-card p-4 rounded-[1.5rem] shadow-sm flex items-center justify-between border border-border">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><Trophy size={14} /></div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-text/30 tracking-widest font-sans">Best Habit</p>
                            <p className="text-sm font-black text-text capitalize">{stats.bestConsistency?.name || "None"}</p>
                         </div>
                      </div>
                      <span className="text-emerald-500 font-black text-sm">{stats.bestConsistency?.successRate || 0}%</span>
                   </div>
                   <div className="bg-card p-4 rounded-[1.5rem] shadow-sm flex items-center justify-between border border-border">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center"><Target size={14} /></div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-text/30 tracking-widest font-sans">Focus Area</p>
                            <p className="text-sm font-black text-text capitalize">{stats.habitStats[stats.habitStats.length-1]?.name || "None"}</p>
                         </div>
                      </div>
                      <span className="text-rose-500 font-black text-sm">{stats.habitStats[stats.habitStats.length-1]?.percent || 0}%</span>
                   </div>
                   <div className="bg-card p-4 rounded-[1.5rem] shadow-sm flex items-center justify-between border border-border">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center"><Activity size={14} /></div>
                         <div>
                            <p className="text-[9px] font-black uppercase text-text/30 tracking-widest font-sans">Overall Discipline</p>
                            <p className="text-[10px] text-text/40 leading-tight">Total completion score</p>
                         </div>
                      </div>
                      <span className="text-primary font-black text-xl">{stats.disciplineScore}%</span>
                   </div>
                 </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Log Detail Modal */}
      <AnimatePresence>
        {activeLogDetail && (
           <div className="fixed inset-0 z-[2100] flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setActiveLogDetail(null)}
                className="absolute inset-0 bg-text/60 backdrop-blur-md"
              />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
                className="w-full max-w-sm bg-card rounded-[2.5rem] p-8 shadow-2xl relative z-10 space-y-6"
              >
                <div>
                   <div className="flex items-center justify-between mb-1">
                      <h3 className="text-2xl font-black tracking-tighter text-text">Review Protocol</h3>
                      <div className="text-[10px] font-black text-primary px-3 py-1 bg-primary/5 rounded-full uppercase tracking-widest font-sans">
                        Day {activeLogDetail.day}
                      </div>
                   </div>
                   <p className="text-xs font-medium text-text/40">{safeHabits.find(h => h.id === activeLogDetail.habitId)?.name}</p>
                </div>

                <div className="space-y-5">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-text/30 tracking-widest ml-1 font-sans">Notes / Reflections</label>
                      <textarea 
                        value={logNotes} 
                        onChange={e => setLogNotes(e.target.value)}
                        placeholder="How did it go? Any thoughts?"
                        className="w-full h-24 bg-bg rounded-[1.5rem] border-2 border-transparent focus:border-primary/40 p-4 font-medium outline-none transition-all text-sm resize-none"
                      />
                   </div>

                   <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-text/30 tracking-widest ml-1 font-sans">If Missed: Reason</label>
                      <div className="flex flex-wrap gap-2">
                         {MISSED_REASONS.map(r => (
                            <button 
                              key={r} onClick={() => setLogMissedReason(r)}
                              className={cn("px-3 py-2 rounded-xl text-[10px] font-black uppercase border transition-all font-sans", logMissedReason === r ? "bg-rose text-white border-rose" : "bg-bg text-text/40 border-transparent hover:bg-card hover:border-text/5")}
                            >{r}</button>
                         ))}
                      </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-4">
                   <button 
                     onClick={() => handleDetailedLog(false)}
                     className="py-4 rounded-full border-2 border-rose/10 text-rose font-black text-sm uppercase tracking-widest hover:bg-rose/5 active:scale-95 transition-all font-sans"
                   >Mark Missed</button>
                   <button 
                     onClick={() => handleDetailedLog(true)}
                     className="py-4 rounded-full bg-primary text-white font-black text-sm shadow-glow active:scale-95 transition-all uppercase tracking-widest font-sans"
                   >Save Success</button>
                </div>
              </motion.div>
           </div>
        )}
      </AnimatePresence>

      {/* Add Habit Modal Overhaul */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="absolute inset-0 bg-text/40 backdrop-blur-sm"
            />
            <motion.form 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onSubmit={handleAddHabit}
              className="w-full max-w-sm bg-card rounded-[2.5rem] p-8 shadow-2xl relative z-10 space-y-6"
            >
              <div className="text-center">
                <h3 className="text-2xl font-black text-text tracking-tighter leading-none mb-1">New Discipline</h3>
                <p className="text-[10px] font-black text-text/20 uppercase tracking-[0.2em] font-sans">Configuring habit protocol</p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-4 gap-4">
                  <div className="space-y-1.5 col-span-1 text-center">
                    <label className="text-[9px] font-black uppercase text-text/30 tracking-widest font-sans">Icon</label>
                    <input 
                      value={newHabitEmoji} onChange={e => setNewHabitEmoji(e.target.value)}
                      className="w-full h-14 bg-bg rounded-2xl border-2 border-transparent focus:border-primary text-center text-2xl outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5 col-span-3">
                    <label className="text-[9px] font-black uppercase text-text/30 tracking-widest ml-1 font-sans">Habit Name</label>
                    <input 
                      autoFocus value={newHabitName} onChange={e => setNewHabitName(e.target.value)}
                      className="w-full h-14 bg-bg rounded-2xl border-2 border-transparent focus:border-primary px-5 font-black outline-none transition-all text-sm"
                      placeholder="Protocol Name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] font-black uppercase text-text/30 tracking-widest ml-1 font-sans">Category Mapping</label>
                   <div className="grid grid-cols-3 gap-2">
                      {CATEGORIES.map(cat => (
                         <button 
                           key={cat.id} type="button" onClick={() => setNewHabitCategory(cat.id)}
                           className={cn("p-2 rounded-xl text-[9px] font-black uppercase border transition-all text-center flex flex-col items-center gap-1 font-sans", newHabitCategory === cat.id ? "bg-primary text-white border-primary shadow-sm" : "bg-bg text-text/30 border-transparent hover:border-text/5")}
                         >
                            <span>{cat.icon}</span>
                            <span className="truncate w-full">{cat.label}</span>
                         </button>
                      ))}
                   </div>
                </div>

                <div className="space-y-1.5">
                   <label className="text-[9px] font-black uppercase text-text/30 tracking-widest ml-1 font-sans">Monthly Target (Days)</label>
                   <div className="flex gap-2">
                      {[15, 20, 25, 30].map(val => (
                         <button 
                           key={val} type="button" onClick={() => setNewHabitGoal(val)}
                           className={cn("flex-1 py-3 rounded-xl text-xs font-black border transition-all font-sans", newHabitGoal === val ? "bg-text text-white border-text shadow-md" : "bg-bg text-text/30 border-transparent")}
                         >{val}</button>
                      ))}
                   </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 text-text/40 font-black text-[10px] uppercase tracking-widest font-sans"
                >Abort</button>
                <button 
                  type="submit"
                  className="flex-[2] py-4 bg-primary text-white rounded-full font-black shadow-glow active:scale-95 transition-all text-sm uppercase tracking-widest font-sans"
                >Finalize Habit</button>
              </div>
            </motion.form>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
