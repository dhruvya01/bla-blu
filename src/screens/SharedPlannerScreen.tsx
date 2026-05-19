import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight,
  Plus, 
  X, 
  Bell, 
  Heart, 
  Activity, 
  User, 
  Star, 
  Trash2, 
  Clock,
  ArrowLeft,
  MoreVertical,
  CalendarDays
} from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { PlannerEvent, PlannerCategory } from "../types";
import { doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase/config";
import { sensory } from "../utils/sensory";
import { generateCycleDays } from "../utils/health";

const CATEGORIES: { id: PlannerCategory; label: string; color: string; icon: any }[] = [
  { id: "relationship", label: "Relationship", color: "bg-pink text-pink", icon: Heart },
  { id: "health", label: "Health", color: "bg-mint text-mint", icon: Activity },
  { id: "personal", label: "Personal", color: "bg-lavender text-lavender", icon: User },
  { id: "reminder", label: "Reminder", color: "bg-amber-400 text-amber-400", icon: Bell },
  { id: "important", label: "Important", color: "bg-rose text-rose", icon: Star },
];

export function SharedPlannerScreen(_props: {}) {
  const { roomId, user, calendarEvents, pair, partner, health, theme } = useAppStore(useShallow(state => ({
    roomId: state.roomId,
    user: state.user,
    calendarEvents: state.calendarEvents,
    pair: state.pair,
    partner: state.partner,
    health: state.health,
    theme: state.theme
  })));
  const isDark = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'].includes(theme);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PlannerEvent | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const events = (calendarEvents || []) as PlannerEvent[];

  // Form State
  const [formTitle, setFormTitle] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
  const [formCategory, setFormCategory] = useState<PlannerCategory>("reminder");
  const [formNotes, setFormNotes] = useState("");

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  const monthName = currentDate.toLocaleString('default', { month: 'long' });
  const year = currentDate.getFullYear();

  // Anniversary Calculations
  const anniversaryData = useMemo(() => {
    if (!pair?.anniversary) return null;
    const [annYear, annMonth, annDay] = pair.anniversary.split('-').map(Number);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let thisYearAnniv = new Date(today.getFullYear(), annMonth - 1, annDay);
    if (thisYearAnniv < today) {
      thisYearAnniv.setFullYear(today.getFullYear() + 1);
    }
    
    const daysUntil = Math.ceil((thisYearAnniv.getTime() - today.getTime()) / 86400000);
    return { daysUntil, month: annMonth - 1, day: annDay };
  }, [pair?.anniversary]);

  const isAnniversaryDay = (month: number, day: number) => {
    if (!anniversaryData) return false;
    return anniversaryData.month === month && anniversaryData.day === day;
  };

  // Next 7 Days Strip Data
  const nextSevenDays = useMemo(() => {
    const days = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  }, []);

  const handleSaveEvent = async () => {
    if (!roomId || !user || !formTitle) return;

    const newEvent: PlannerEvent = {
      id: editingEvent?.id || Date.now().toString(),
      title: formTitle,
      date: formDate,
      category: formCategory,
      notes: formNotes,
      createdBy: user.uid,
      createdAt: editingEvent ? editingEvent.createdAt : serverTimestamp(),
    };

    try {
      await setDoc(doc(db, "pairs", roomId, "calendarEvents", newEvent.id), newEvent);
      setShowAddModal(false);
      resetForm();
      sensory.play('ding');
      sensory.tap();
    } catch (err) {
      handleFirestoreError(err, 'write', `pairs/${roomId}/calendarEvents`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (confirmDeleteId !== eventId) { setConfirmDeleteId(eventId); return; }
    setConfirmDeleteId(null);
    if (!roomId) return;
    try {
      await deleteDoc(doc(db, "pairs", roomId, "calendarEvents", eventId));
      sensory.tap();
      if (events.filter(e => e.date === selectedDay).length <= 1) {
        setSelectedDay(null);
      }
    } catch (err) {
      handleFirestoreError(err, 'delete', `pairs/${roomId}/calendarEvents/${eventId}`);
    }
  };

  const resetForm = () => {
    setFormTitle("");
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormCategory("reminder");
    setFormNotes("");
    setEditingEvent(null);
  };

  const changeMonth = (offset: number) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + offset);
    setCurrentDate(next);
  };

  const cycleDays = useMemo(() => {
    return generateCycleDays(health?.periodEntries || [], health?.cycleLength, health?.periodLength);
  }, [health?.periodEntries, health?.cycleLength, health?.periodLength]);

  const todayObjLocal = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000));
  const todayStr = todayObjLocal.toISOString().split('T')[0];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col w-full font-body bg-bg pb-40"
    >
      {/* HEADER */}
      <header className="px-6 py-4 flex items-center justify-between z-20">
        <div className="flex flex-col">
          <h1 className="font-display text-2xl text-text">Our Plans</h1>
          <div className="flex items-center gap-1 mt-1 text-text/40">
            <button onClick={() => changeMonth(-1)} className="p-1 hover:bg-black/5 rounded-lg active:scale-90 transition-all">
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-semibold min-w-24 text-center">{monthName} {year}</span>
            <button onClick={() => changeMonth(1)} className="p-1 hover:bg-black/5 rounded-lg active:scale-90 transition-all">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowAddModal(true); }}
          className="w-10 h-10 bg-primary text-white rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-all"
        >
          <Plus size={20} />
        </button>
      </header>

      {anniversaryData && anniversaryData.daysUntil <= 7 && (
        <div className="mx-6 mb-4 bg-rose/10 border border-rose/20 rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💍</span>
            <div>
              <p className="font-display text-rose text-sm">
                Anniversary {anniversaryData.daysUntil === 0 ? "is today!" : `in ${anniversaryData.daysUntil} day${anniversaryData.daysUntil === 1 ? "" : "s"}!`}
              </p>
              <p className="text-[10px] text-rose/60 mt-0.5">Don't forget to make it special 💕</p>
            </div>
          </div>
        </div>
      )}

      <div className="px-6 space-y-6">
        {/* Anniversary Banner */}
        {anniversaryData && anniversaryData.daysUntil <= 30 && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-800 text-sm font-medium flex items-center gap-3 shadow-sm"
          >
            <span className="text-xl">💍</span>
            <span>
              {anniversaryData.daysUntil === 0 
                ? "Happy Anniversary! ❤️" 
                : `Anniversary in ${anniversaryData.daysUntil} days!`}
            </span>
          </motion.div>
        )}

        {/* CALENDAR GRID */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["S","M","T","W","T","F","S"].map((d, i) => (
              <span key={`${d}-${i}`} className="text-[10px] font-bold text-text/20 uppercase tracking-widest">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateObj = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
              const dateObjLocal = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000));
              const dateStr = dateObjLocal.toISOString().split('T')[0];
              const isToday = dateStr === todayStr;
              const hasEvents = events.some(e => e.date === dateStr);
              const isAnniv = isAnniversaryDay(currentDate.getMonth(), day);
              const isSelected = selectedDay === dateStr;
              const cDay = cycleDays.find(x => x.date === dateStr);

              let cycleBg = "";
              if (cDay?.type === "period") cycleBg = "bg-rose-400 text-white font-bold";
              else if (cDay?.type === "predicted_period") cycleBg = isDark ? "bg-rose-950/40 text-rose-300 border border-rose-800/30" : "bg-rose-100 text-rose-500 border border-rose-200";
              else if (cDay?.type === "ovulation") cycleBg = isDark ? "bg-amber-950/40 text-amber-300 border border-amber-800/30" : "bg-amber-300 text-white font-bold";
              else if (cDay?.type === "fertile") cycleBg = isDark ? "bg-emerald-950/40 text-emerald-300 border border-emerald-800/30" : "bg-emerald-100 text-emerald-600";
              else if (cDay?.type === "predicted_fertile") cycleBg = isDark ? "bg-emerald-950/20 text-emerald-400 border border-emerald-900/20" : "bg-emerald-50 text-emerald-400 border border-emerald-100";
              else if (isToday) cycleBg = "bg-primary/10 text-primary font-bold";
              else cycleBg = "text-text";

              return (
                <div 
                  key={day}
                  onClick={() => {
                    setSelectedDay(dateStr);
                    sensory.tap();
                  }}
                  className={cn(
                    "relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all cursor-pointer",
                    cycleBg,
                    isSelected ? (cDay ? "ring-2 ring-primary ring-offset-1" : "ring-2 ring-primary/40") : "",
                    !isToday && !isSelected && !cDay && "hover:bg-black/5"
                  )}
                >
                  <span className="text-sm">{day}</span>
                  <div className="absolute bottom-1.5 flex flex-col items-center gap-0.5">
                    {isAnniv && <span className="text-[8px] leading-none">💍</span>}
                    {hasEvents && <div className={cn("w-1 h-1 rounded-full", (isToday || cDay?.type === "period" || cDay?.type === "ovulation") ? (isDark ? "bg-white" : "bg-white") : "bg-primary/40")} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* THIS WEEK STRIP */}
        <div className="space-y-3">
          <h2 className="font-display text-base text-text">This Week</h2>
          <div className="flex gap-3 overflow-x-auto no-scrollbar py-1">
            {nextSevenDays.map(date => {
              const dateObjLocal = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
              const dStr = dateObjLocal.toISOString().split('T')[0];
              const isToday = dStr === todayStr;
              const dayName = date.toLocaleDateString(undefined, { weekday: 'short' });
              const dayNum = date.getDate();
              const hasEvents = events.some(e => e.date === dStr);
              const cDay = cycleDays.find(x => x.date === dStr);

              let cycleBgWeekly = "";
              if (cDay?.type === "period") cycleBgWeekly = "bg-rose-400 text-white border-rose-400";
              else if (cDay?.type === "predicted_period") cycleBgWeekly = isDark ? "bg-rose-950/40 text-rose-300 border-rose-800/30" : "bg-rose-100 text-rose-500 border-rose-200";
              else if (cDay?.type === "ovulation") cycleBgWeekly = isDark ? "bg-amber-950/40 text-amber-300 border-amber-800/30" : "bg-amber-300 text-white border-amber-300";
              else if (cDay?.type === "fertile") cycleBgWeekly = isDark ? "bg-emerald-950/40 text-emerald-300 border-emerald-800/30" : "bg-emerald-100 text-emerald-600 border-emerald-200";
              else if (cDay?.type === "predicted_fertile") cycleBgWeekly = isDark ? "bg-emerald-950/20 text-emerald-400 border-emerald-900/20" : "bg-emerald-50 text-emerald-400 border-emerald-100";
              else if (isToday) cycleBgWeekly = "bg-primary/5 text-text border-primary";
              else cycleBgWeekly = "bg-card text-text border-border shadow-sm";

              return (
                <button
                  key={dStr}
                  onClick={() => {
                    setSelectedDay(dStr);
                    sensory.tap();
                  }}
                  className={cn(
                    "shrink-0 w-16 border rounded-2xl p-3 text-center transition-all active:scale-95",
                    cycleBgWeekly
                  )}
                >
                  <div className={cn("text-[10px] font-medium opacity-60", cDay?.type === "period" || cDay?.type === "ovulation" ? "text-white" : "text-text/40")}>{dayName}</div>
                  <div className="text-lg font-display">{dayNum}</div>
                  {hasEvents && <div className={cn("w-1.5 h-1.5 rounded-full mx-auto mt-1", cDay?.type === "period" || cDay?.type === "ovulation" ? "bg-white" : "bg-primary")} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ALL EVENTS LIST (TIMELINE) */}
        <div className="space-y-4">
          <h2 className="font-display text-base text-text">Upcoming Timeline</h2>
          {events.length === 0 ? (
            <div className="p-10 text-center border border-dashed border-border rounded-2xl opacity-40">
              <Calendar className="mx-auto mb-2" size={32} />
              <p className="text-sm">Nothing planned yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {events
                .filter(e => e.date >= todayStr)
                .sort((a,b) => a.date.localeCompare(b.date))
                .slice(0, 10)
                .map(event => {
                  const category = CATEGORIES.find(c => c.id === event.category);
                  const Icon = category?.icon || Bell;
                  return (
                    <div key={event.id} className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center gap-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", category?.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-10 text-'))}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-text truncate">{event.title}</p>
                          <span className="text-[10px] text-text/40 font-medium whitespace-nowrap ml-2">
                            {(() => {
                              const d = new Date(event.date);
                              return isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                            })()}
                          </span>
                        </div>
                        {event.notes && <p className="text-xs text-text/50 truncate mt-0.5">{event.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={() => {
                            setEditingEvent(event);
                            setFormTitle(event.title);
                            setFormDate(event.date);
                            setFormCategory(event.category);
                            setFormNotes(event.notes || "");
                            setShowAddModal(true);
                          }}
                          className="p-2 bg-text/5 text-text/60 rounded-xl active:scale-90 transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        {confirmDeleteId === event.id ? (
                          <div className="flex items-center gap-1 ml-1 bg-rose/5 rounded-xl p-1">
                            <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-text/40 px-2 py-1">Cancel</button>
                            <button onClick={() => handleDeleteEvent(event.id)} className="text-[10px] bg-rose text-white rounded-lg px-2 py-1 font-medium">Delete</button>
                          </div>
                        ) : (
                          <button 
                            onClick={() => setConfirmDeleteId(event.id)}
                            className="p-2 bg-rose/5 text-rose/60 rounded-xl active:scale-90 transition-all ml-1"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* DAY DETAIL BOTTOM SHEET */}
      <AnimatePresence>
        {selectedDay && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDay(null)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30 }}
              className="fixed bottom-0 left-0 right-0 bg-card rounded-t-[2.5rem] z-50 p-6 max-h-[75vh] overflow-y-auto shadow-2xl pb-12"
            >
              <div className="w-12 h-1 bg-border rounded-full mx-auto mb-6" />
              
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-display text-xl text-text">
                    {selectedDay && (() => {
                      const d = new Date(selectedDay);
                      return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
                    })()}
                  </h3>
                  <p className="text-xs text-text/40">
                    {selectedDay && (() => {
                      const d = new Date(selectedDay);
                      return !isNaN(d.getTime()) && isAnniversaryDay(d.getMonth(), d.getDate()) ? "💍 Anniversary Day!" : "Daily Plans";
                    })()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setFormDate(selectedDay);
                      setShowAddModal(true);
                    }}
                    className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center active:scale-95 transition-all"
                  >
                    <Plus size={20} />
                  </button>
                  <button onClick={() => setSelectedDay(null)} className="p-2 text-text/20">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                {events.filter(e => e.date === selectedDay).length > 0 ? (
                  events.filter(e => e.date === selectedDay).map(event => {
                    const category = CATEGORIES.find(c => c.id === event.category);
                    const isMe = event.createdBy === user?.uid;
                    const Icon = category?.icon || Bell;

                    return (
                      <div key={event.id} className="bg-bg border border-border rounded-2xl p-4 flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", category?.color.replace('text-', 'bg-').replace('bg-', 'bg-opacity-10 text-'))}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-sm font-bold text-text truncate">{event.title}</p>
                            <span className={cn(
                              "text-[9px] px-2 py-0.5 rounded-full font-bold",
                              isMe ? "bg-primary/10 text-primary" : "bg-card border border-border text-text/40"
                            )}>
                              {isMe ? "You" : partner?.nickname || "Partner"}
                            </span>
                          </div>
                          {event.notes && <p className="text-xs text-text/50 truncate">{event.notes}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                           <button 
                             onClick={() => {
                               setEditingEvent(event);
                               setFormTitle(event.title);
                               setFormDate(event.date);
                               setFormCategory(event.category);
                               setFormNotes(event.notes || "");
                               setShowAddModal(true);
                             }}
                             className="p-2 text-text/20 hover:text-primary transition-colors"
                           >
                             <Edit2 size={16} />
                           </button>
                           {confirmDeleteId === event.id ? (
                             <div className="flex items-center gap-1">
                               <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] text-text/40 px-2 py-1">Cancel</button>
                               <button onClick={() => handleDeleteEvent(event.id)} className="text-[10px] bg-rose text-white rounded-lg px-2 py-1 font-medium">Delete</button>
                             </div>
                           ) : (
                             <button 
                               onClick={() => setConfirmDeleteId(event.id)}
                               className="p-2 bg-rose/5 text-rose/60 rounded-lg active:scale-90 transition-all"
                             >
                               <Trash2 size={16} />
                             </button>
                           )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-10 opacity-40">
                    <p className="text-sm">Nothing planned — add something! 🗓️</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ADD/EDIT MODAL */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl w-full max-w-sm p-6 shadow-xl border border-border space-y-6"
            >
              <div>
                <h3 className="font-display text-xl text-text">
                  {editingEvent ? "Edit Plan" : "New Plan"}
                </h3>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text/40 ml-1">Title</label>
                  <input 
                    type="text"
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="Date Night..."
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text/40 ml-1">Date</label>
                  <input 
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text/40 ml-1">Category</label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id)}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                          formCategory === cat.id 
                            ? "bg-primary text-white border-primary" 
                            : "bg-bg border-border text-text/40"
                        )}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text/40 ml-1">Notes</label>
                  <textarea 
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Any specific details?"
                    rows={3}
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="flex-1 py-3 text-sm font-bold text-text/40"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveEvent}
                  disabled={!formTitle.trim()}
                  className="flex-1 py-3 bg-primary text-white rounded-xl text-sm font-bold shadow-md active:scale-95 transition-all disabled:opacity-50"
                >
                  Save Plan
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const Edit2 = ({ size, className }: any) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);
