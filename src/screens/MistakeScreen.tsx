import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store";
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc, 
  serverTimestamp, 
  arrayUnion 
} from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase/config";
import { sensory } from "../utils/sensory";
import { cn } from "../utils";
import { 
  AlertCircle, 
  Heart, 
  Plus, 
  X, 
  ArrowLeft, 
  Trash2, 
  MessageCircle, 
  Flame, 
  Calendar, 
  Send, 
  CheckCircle2, 
  Scale, 
  Sparkles, 
  HeartCrack,
  Frown,
  Meh,
  Angry,
  Smile,
  AlertOctagon
} from "lucide-react";
import confetti from "canvas-confetti";

interface MistakeComment {
  id: string;
  userId: string;
  userName: string;
  avatarUrl?: string;
  text: string;
  createdAt: number;
}

interface Mistake {
  id: string;
  title: string;
  details: string;
  date: string;
  angerLevel: number; // 1 to 5
  loggedBy: string;
  loggedByName: string;
  status: "active" | "appeal" | "forgiven";
  appealText?: string;
  comments: MistakeComment[];
  createdAt: any;
}

const APOLOGIES_TEMPLATES = [
  "I promise to buy you a giant tub of gourmet chocolate ice cream! 🍨",
  "I will write you a 10-line heartfelt poem explaining my absolute regret! 📜",
  "I was highly distracted by how gorgeous you looked, my brain short-circuited! ⚡🥺",
  "I am doing a 20-minute dance of repentance right now! 🕺",
  "You can steal all my comfortable hoodies for the next two weeks! 🧥",
  "I am ready to surrender my phone's remote control of the living room TV! 📺",
  "I am presenting my sincere plea, please have mercy on my poor soul! 💀"
];

export function MistakeScreen() {
  const { setView, roomId, user, partner } = useAppStore();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tab handling
  const [activeTab, setActiveTab ] = useState<"all" | "active" | "appeal" | "forgiven">("all");
  
  // Form modal
  const [showFormModal, setShowFormModal] = useState(false);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [angerLevel, setAngerLevel] = useState<number>(3);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Appeal Modal
  const [appealMistake, setAppealMistake] = useState<Mistake | null>(null);
  const [appealText, setAppealText] = useState("");
  const [isAppealing, setIsAppealing] = useState(false);

  // Comments temporary text storage per mistake id
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!roomId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Realtime listener for relationship mistakes list
    const path = `pairs/${roomId}/mistakes`;
    const mistakesRef = collection(db, "pairs", roomId, "mistakes");

    const unsubscribe = onSnapshot(
      mistakesRef,
      (snapshot) => {
        const list: Mistake[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            title: data.title || "",
            details: data.details || "",
            date: data.date || "",
            angerLevel: data.angerLevel || 1,
            loggedBy: data.loggedBy || "",
            loggedByName: data.loggedByName || "Wife/Girlfriend",
            status: data.status || "active",
            appealText: data.appealText || "",
            comments: data.comments || [],
            createdAt: data.createdAt,
          });
        });

        // Sort by date desc, then by createdAt desc
        list.sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          const timeA = a.createdAt?.seconds || 0;
          const timeB = b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

        setMistakes(list);
        setLoading(false);
      },
      (error) => {
        console.error("Failed to fetch mistakes in real time", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [roomId]);

  const handleCreateMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomId || !user) return;
    if (!title.trim()) return;

    setIsSubmitting(true);
    try {
      const path = `pairs/${roomId}/mistakes`;
      await addDoc(collection(db, "pairs", roomId, "mistakes"), {
        title: title.trim(),
        details: details.trim(),
        date: date,
        angerLevel: angerLevel,
        loggedBy: user.uid,
        loggedByName: user.nickname || user.name || "Wife/GF",
        status: "active",
        comments: [],
        createdAt: serverTimestamp(),
      });

      sensory.play("urgent");
      sensory.important();
      
      // Reset form
      setTitle("");
      setDetails("");
      setDate(new Date().toISOString().split("T")[0]);
      setAngerLevel(3);
      setShowFormModal(false);
    } catch (err) {
      console.error(err);
      handleFirestoreError(err, "write" as any, `pairs/${roomId}/mistakes`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileAppeal = async () => {
    if (!roomId || !appealMistake || !appealText.trim()) return;
    setIsAppealing(true);
    try {
      const docRef = doc(db, "pairs", roomId, "mistakes", appealMistake.id);
      await updateDoc(docRef, {
        status: "appeal",
        appealText: appealText.trim()
      });
      sensory.play("pop");
      setAppealText("");
      setAppealMistake(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAppealing(false);
    }
  };

  const handleResolveMistake = async (mistakeId: string, fullyForgiven: boolean) => {
    if (!roomId) return;
    try {
      const docRef = doc(db, "pairs", roomId, "mistakes", mistakeId);
      
      if (fullyForgiven) {
        await updateDoc(docRef, {
          status: "forgiven"
        });
        sensory.success();
        confetti({
          particleCount: 120,
          spread: 70,
          origin: { y: 0.6 }
        });
      } else {
        // Demands chocolates or soft rejection (stay active, delete appeal text)
        await updateDoc(docRef, {
          status: "active",
          appealText: "" // reset appeal so he has to appeal again with chocolate coupon!
        });
        sensory.play("pop");
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteMistake = async (mistakeId: string) => {
    if (!roomId || !window.confirm("Are you sure you want to erase this memory? 🧹")) return;
    try {
      await deleteDoc(doc(db, "pairs", roomId, "mistakes", mistakeId));
      sensory.play("tick");
    } catch (error) {
      console.error(error);
    }
  };

  const handleAddComment = async (mistakeId: string) => {
    if (!roomId || !user) return;
    const text = commentInputs[mistakeId]?.trim();
    if (!text) return;

    try {
      const docRef = doc(db, "pairs", roomId, "mistakes", mistakeId);
      const newComment: MistakeComment = {
        id: Math.random().toString(36).substring(2, 9),
        userId: user.uid,
        userName: user.nickname || user.name || "Partner",
        avatarUrl: user.avatarUrl || "",
        text: text,
        createdAt: Date.now()
      };

      await updateDoc(docRef, {
        comments: arrayUnion(newComment)
      });

      sensory.play("pop");
      setCommentInputs(prev => ({ ...prev, [mistakeId]: "" }));
    } catch (error) {
      console.error(error);
    }
  };

  // Helper labels & styles based on Anger Levels
  const getAngerSpecs = (level: number) => {
    switch(level) {
      case 1:
        return {
          icon: <Meh className="text-yellow-400" size={24} />,
          title: "Slight Pout 🤨",
          badgeColor: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
          cardBorder: "border-yellow-200 dark:border-yellow-900/30",
          cardBg: "from-yellow-50/40 to-amber-50/10 dark:from-yellow-950/10 dark:to-transparent",
          actionAdvice: "Easily bought over with a giant, cozy back-hug. 🤗"
        };
      case 2:
        return {
          icon: <Frown className="text-orange-400" size={24} />,
          title: "Folded Arms 😤",
          badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/20",
          cardBorder: "border-orange-200 dark:border-orange-950/30",
          cardBg: "from-orange-50/40 to-amber-50/10 dark:from-orange-950/10 dark:to-transparent",
          actionAdvice: "Needs a genuine apology and maybe a hot coffee. ☕"
        };
      case 3:
        return {
          icon: <Angry className="text-pink-500 animate-bounce" size={24} />,
          title: "Steam Ears 🌋",
          badgeColor: "bg-pink-500/10 text-pink-500 border-pink-500/20",
          cardBorder: "border-pink-200 dark:border-pink-950/30",
          cardBg: "from-pink-50/40 to-rose-50/10 dark:from-pink-950/10 dark:to-transparent",
          actionAdvice: "Danger! Threatening to steal all of his comfortable oversized hoodies! 🧥😱"
        };
      case 4:
        return {
          icon: <HeartCrack className="text-rose-500 animate-pulse" size={24} />,
          title: "Silent Treatment 🤐",
          badgeColor: "bg-rose-500/10 text-rose-500 border-rose-500/20",
          cardBorder: "border-rose-300 dark:border-rose-950/50",
          cardBg: "from-rose-50/60 to-rose-100/10 dark:from-rose-950/15 dark:to-transparent",
          actionAdvice: "Code Red! Send cute kitten videos, long apologies, and order her favorite cheesecake. 🍰"
        };
      case 5:
      default:
        return {
          icon: <Flame className="text-red-500 animate-pulse" size={26} />,
          title: "GODZILLA RAGE 🦖🔥",
          badgeColor: "bg-red-505/20 text-red-600 dark:text-red-400 border-red-500/30 font-black tracking-widest",
          cardBorder: "border-red-400 dark:border-red-900/60 ring-2 ring-red-500/20 animate-pulse",
          cardBg: "from-red-100/50 to-orange-100/15 dark:from-red-950/20 dark:to-transparent bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-red-200/20 via-transparent to-transparent",
          actionAdvice: "ULTIMATE WARNING! Rent out a sweet store parlor, beg for mercy, and write a 1000-word essay! 🍫📝"
        };
    }
  };

  const filteredMistakes = mistakes.filter(m => {
    if (activeTab === "all") return true;
    return m.status === activeTab;
  });

  return (
    <div className="min-h-screen bg-bg text-text pb-12 flex flex-col font-sans select-none relative overflow-x-hidden">
      
      {/* Visual Top Decorative Banner */}
      <div className="absolute top-0 inset-x-0 h-40 bg-gradient-to-b from-primary/10 via-amber-500/5 to-transparent pointer-events-none" />

      {/* Hero Header */}
      <div className="max-w-4xl w-full mx-auto px-6 pt-8 flex items-center justify-between relative z-10 shrink-0">
        <div className="flex items-center gap-4">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => { sensory.play("pop"); setView("home"); }}
            className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center shadow-xs text-text/70"
          >
            <ArrowLeft size={20} />
          </motion.button>
          <div>
            <h1 className="text-2xl font-black font-display tracking-tight flex items-center gap-2 text-text">
              The Mistake List ⚖️
            </h1>
            <p className="text-xs text-text/40 font-bold uppercase tracking-wider">
              relationship court of justice & forgiveness 🌸
            </p>
          </div>
        </div>

        {/* Create Mistake Button */}
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => { sensory.play("pop"); setShowFormModal(true); }}
          className="px-4 py-3 bg-gradient-to-r from-amber-500 to-rose-400 hover:from-amber-600 hover:to-rose-500 text-white rounded-2xl shadow-lg shadow-rose-400/10 font-black text-xs flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus size={16} />
          <span>Report a Crime</span>
        </motion.button>
      </div>

      {/* Main Container */}
      <div className="max-w-xl w-full mx-auto px-6 mt-8 flex-1 flex flex-col relative z-10">
        
        {/* Cute statistics indicator */}
        <div className="grid grid-cols-3 gap-3 bg-card/60 backdrop-blur-xl border border-border p-4 rounded-[2rem] shadow-sm mb-6 shrink-0">
          <div className="text-center p-2.5 bg-rose-500/5 rounded-2xl border border-rose-500/10">
            <span className="text-[9px] uppercase font-black text-rose-500 block leading-none mb-1">Total Crimes</span>
            <span className="text-2xl font-black font-display text-rose-500">{mistakes.length}</span>
          </div>
          <div className="text-center p-2.5 bg-amber-500/5 rounded-2xl border border-amber-500/10">
            <span className="text-[9px] uppercase font-black text-amber-500 block leading-none mb-1">Open Disputes</span>
            <span className="text-2xl font-black font-display text-amber-500">
              {mistakes.filter(m => m.status === 'active' || m.status === 'appeal').length}
            </span>
          </div>
          <div className="text-center p-2.5 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
            <span className="text-[9px] uppercase font-black text-emerald-500 block leading-none mb-1">Forgiven & Warm</span>
            <span className="text-2xl font-black font-display text-emerald-500">
              {mistakes.filter(m => m.status === 'forgiven').length}
            </span>
          </div>
        </div>

        {/* Filters and Search Bar tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-card border border-border rounded-xl mb-6 shrink-0 shadow-xs max-w-full overflow-x-auto no-scrollbar">
          {(["all", "active", "appeal", "forgiven"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => { sensory.play("pop"); setActiveTab(tab); }}
              className={cn(
                "py-2 px-3 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all text-ellipsis whitespace-nowrap flex-1 text-center shrink-0",
                activeTab === tab
                  ? "bg-primary text-white shadow-sm font-black"
                  : "text-text/50 hover:text-text hover:bg-neutral-500/5"
              )}
            >
              {tab === "all" ? "📂 All Cases" : tab === "active" ? "👮 Arrested" : tab === "appeal" ? "⚖️ Appeals" : "💖 Pardoned"}
            </button>
          ))}
        </div>

        {/* Mistakes Feed List */}
        <div className="flex-1 space-y-6">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <p className="text-xs font-black text-text/40 uppercase tracking-widest">Studying evidence...</p>
            </div>
          ) : filteredMistakes.length === 0 ? (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="py-16 text-center border-2 border-dashed border-border/60 bg-card/20 rounded-[2.5rem] p-8 flex flex-col items-center justify-center gap-4"
            >
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 animate-pulse">
                <Smile size={32} />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-text font-display">No Mistakes Registered! ✨</h3>
                <p className="text-xs text-text/55 max-w-xs mt-1.5 leading-relaxed">
                  Such angelic compliance! Either there are no crimes, or someone is keeping quiet. Cute excuses await the next drop!
                </p>
              </div>
              {activeTab !== "all" && (
                <button
                  onClick={() => setActiveTab("all")}
                  className="px-4 py-2 bg-text/5 hover:bg-text/10 text-[10px] font-black uppercase tracking-wider text-text rounded-lg transition-colors border border-border"
                >
                  Clear filter
                </button>
              )}
            </motion.div>
          ) : (
            <div className="space-y-6">
              {filteredMistakes.map((mistake, idx) => {
                const specs = getAngerSpecs(mistake.angerLevel);
                const isAccused = user?.uid !== mistake.loggedBy; // Usually if loggedBy is her, he is the accused
                
                return (
                  <motion.div
                    key={mistake.id}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.3) }}
                    className={cn(
                      "w-full bg-card border rounded-[2.5rem] shadow-sm flex flex-col overflow-hidden relative transition-all duration-300",
                      specs.cardBorder,
                      mistake.status === "forgiven" && "border-emerald-200 dark:border-emerald-900/30 opacity-80"
                    )}
                  >
                    {/* Background Pattern top-mesh */}
                    <div className={cn("absolute inset-x-0 top-0 h-28 bg-gradient-to-b opacity-80 pointer-events-none z-0", specs.cardBg)} />

                    {/* Card Header Content */}
                    <div className="p-6 pb-2 relative z-10">
                      
                      {/* Top Actionable Header row */}
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "px-2.5 py-1 text-[9px] font-black tracking-widest uppercase rounded-full border border-current",
                            specs.badgeColor
                          )}>
                            Level {mistake.angerLevel} • {specs.title}
                          </span>
                          
                          {/* Case status indicator */}
                          {mistake.status === "active" && (
                            <span className="px-2 py-0.5 text-[8px] font-black bg-amber-500 text-white rounded-full uppercase tracking-wider">
                              👮 Under Arrest
                            </span>
                          )}
                          {mistake.status === "appeal" && (
                            <span className="px-2 py-0.5 text-[8px] font-black bg-violet-600 text-white rounded-full uppercase tracking-wider animate-pulse flex items-center gap-1">
                              <Scale size={8} /> On Appeal
                            </span>
                          )}
                          {mistake.status === "forgiven" && (
                            <span className="px-2 py-0.5 text-[8px] font-black bg-emerald-500 text-white rounded-full uppercase tracking-wider flex items-center gap-1">
                              <Sparkles size={8} /> Forgiven
                            </span>
                          )}
                        </div>

                        {/* Delete Button (only allowed for the creator of mistake log) */}
                        {user?.uid === mistake.loggedBy && (
                          <button
                            onClick={() => handleDeleteMistake(mistake.id)}
                            className="p-1 px-2 text-[10px] bg-red-500/10 hover:bg-red-500/20 text-red-500 hover:text-red-600 rounded-lg transition-all"
                            title="Delete case log"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>

                      {/* Title & Date */}
                      <p className="text-[10px] text-text/40 font-bold uppercase tracking-widest flex items-center gap-1">
                        <Calendar size={11} /> {mistake.date}
                      </p>
                      <h3 className="text-lg font-black font-display tracking-tight text-text mt-1">
                        {mistake.title}
                      </h3>

                      {mistake.details && (
                        <p className="text-xs text-text/70 bg-bg/40 dark:bg-bg/25 border border-border/50 p-3 rounded-2xl mt-2 leading-relaxed font-sans italic">
                          "{mistake.details}"
                        </p>
                      )}

                      {/* Logged user text info trail */}
                      <p className="text-[10px] text-text/30 font-black uppercase mt-3 tracking-widest">
                        Logged by <span className="text-primary font-extrabold">{mistake.loggedByName}</span>
                      </p>
                    </div>

                    {/* Center Advice or Appeal Presentation Panel */}
                    <div className="px-6 pb-4 relative z-10 flex flex-col gap-3">
                      
                      {/* Godzilla/Silence advice segment if unresolved */}
                      {mistake.status === "active" && (
                        <div className="p-3.5 rounded-2xl bg-bg border border-border/60 text-[11px] leading-relaxed text-text/60 font-sans flex items-start gap-2.5">
                          <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-extrabold text-amber-500 block uppercase text-[9px] tracking-wider mb-0.5">Repentance Advice:</span>
                            {specs.actionAdvice}
                          </div>
                        </div>
                      )}

                      {/* If there is an appeal current state */}
                      {mistake.appealText && (
                        <div className="p-4 bg-violet-500/5 dark:bg-violet-950/10 border border-violet-500/20 rounded-3xl flex flex-col gap-2 relative overflow-hidden">
                          {/* absolute banner */}
                          <div className="absolute top-0 right-0 py-0.5 px-2.5 bg-violet-500 text-white font-black text-[7px] uppercase tracking-widest rounded-bl-xl flex items-center gap-1">
                            <Scale size={7} /> Repentance appeal letter
                          </div>
                          
                          <p className="text-[10px] text-violet-500 uppercase tracking-widest font-black flex items-center gap-1">
                            ⚖️ Defender's Excuse:
                          </p>
                          <p className="text-xs italic text-text/80 leading-relaxed pl-1">
                            "{mistake.appealText}"
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Control Buttons for state adjustments */}
                    <div className="px-6 pb-5 border-t border-border/50 pt-4 flex flex-wrap gap-2.5 select-none z-10 relative">
                      
                      {/* Case creator (usually Girlfriend) can dismiss/forgive active or appealed cases */}
                      {user?.uid === mistake.loggedBy && (
                        <>
                          {(mistake.status === "active" || mistake.status === "appeal") && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => handleResolveMistake(mistake.id, true)}
                              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <CheckCircle2 size={14} />
                              Forgive completely 💖
                            </motion.button>
                          )}
                          
                          {/* If case is appealed, creator can reject appeal and demand chocolates! */}
                          {mistake.status === "appeal" && (
                            <motion.button
                              whileTap={{ scale: 0.95 }}
                              onClick={() => { sensory.play("urgent"); handleResolveMistake(mistake.id, false); }}
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <Frown size={14} />
                              Reject! Demand Chocolates 🍫
                            </motion.button>
                          )}
                        </>
                      )}

                      {/* Accused side (not loggedBy, e.g. the active user who committed the mistake) can appeal */}
                      {user?.uid !== mistake.loggedBy && mistake.status === "active" && (
                        <motion.button
                          whileTap={{ scale: 0.95 }}
                          onClick={() => { sensory.play("pop"); setAppealMistake(mistake); }}
                          className="px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-1.5 shadow-md shadow-violet-500/10 transition-all flex-1 justify-center"
                        >
                          <Scale size={14} />
                          File Repentance Appeal 📜
                        </motion.button>
                      )}

                      {mistake.status === "forgiven" && (
                        <div className="w-full flex items-center gap-2 text-emerald-500 font-extrabold text-xs bg-emerald-500/5 border border-emerald-500/10 py-2.5 px-4 rounded-xl">
                          <CheckCircle2 size={16} />
                          <span>Case forgiven. Love restored to 100%! All is well. 🥰</span>
                        </div>
                      )}
                    </div>

                    {/* Cute Micro Threaded Comments Panel */}
                    <div className="bg-bg/40 dark:bg-bg/20 border-t border-border/60 p-5 font-sans z-10 relative">
                      <div className="flex items-center gap-2 text-[10px] text-text/40 font-black uppercase tracking-wider mb-3">
                        <MessageCircle size={12} />
                        <span>Cute Comment Thread ({mistake.comments.length})</span>
                      </div>

                      {/* Display comments chronologically */}
                      {mistake.comments.length > 0 && (
                        <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 mb-4 custom-scrollbar">
                          {mistake.comments.map((comm) => (
                            <div key={comm.id} className="text-xs flex items-start gap-2.5 bg-card/65 p-2 px-3 border border-border/40 rounded-2xl relative">
                              {comm.avatarUrl ? (
                                <img 
                                  src={comm.avatarUrl} 
                                  alt="" 
                                  referrerPolicy="no-referrer"
                                  className="w-5 h-5 rounded-full object-cover border border-primary/20 mt-0.5 shrink-0" 
                                />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[7px] text-primary mt-0.5 shrink-0">
                                   <User size={10} />
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="font-extrabold text-primary text-[10px]">{comm.userName}</span>
                                  <span className="text-[8px] text-text/30 font-bold">
                                    {new Date(comm.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-text/80 text-[11px] leading-relaxed break-words">{comm.text}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Add comment quick form */}
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={commentInputs[mistake.id] || ""}
                          onChange={(e) => setCommentInputs(prev => ({ ...prev, [mistake.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleAddComment(mistake.id);
                            }
                          }}
                          placeholder={isAccused ? "Beg for help, promise ice cream, explain side..." : "Taunt him, write a cute reaction..."}
                          className="flex-1 bg-card/90 border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none placeholder-text/30"
                        />
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleAddComment(mistake.id)}
                          className="w-8 h-8 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary-600 transition-colors"
                        >
                          <Send size={12} />
                        </motion.button>
                      </div>
                    </div>

                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Model: CREATE NEW CRIME REPORT DIALOG */}
      <AnimatePresence>
        {showFormModal && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-[32px] border border-border p-6 shadow-2xl relative my-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-lg text-text font-display flex items-center gap-2">
                    Report a Crime 🚨
                  </h3>
                  <span className="text-[10px] text-text/40 uppercase tracking-widest font-black">
                     Formal relationship listing
                  </span>
                </div>
                <button
                  onClick={() => setShowFormModal(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-500/10 text-text/50 hover:text-text transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateMistake} className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase font-black text-text/45 block mb-1.5">What did they do? *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="E.g., Slept during the movies again 🥱"
                    className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-text/45 block mb-1.5">Extra details / Accusation Evidence</label>
                  <textarea
                    value={details}
                    onChange={(e) => setDetails(e.target.value)}
                    placeholder="E.g., Left me hang on single tick for three hours and didn't even notice I sent my OOTD pic! Unacceptable!"
                    className="w-full h-18 bg-bg border border-border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase font-black text-text/45 block mb-1.5">Crime incident date</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] uppercase font-black text-text/45 block mb-1.5">Anger Level (How mad?)</label>
                    <select
                      value={angerLevel}
                      onChange={(e) => setAngerLevel(parseInt(e.target.value))}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-primary focus:outline-none"
                    >
                      <option value="1">1 - Slight Pout 🤨</option>
                      <option value="2">2 - Folded Arms 😤</option>
                      <option value="3">3 - Steam Ears 🌋</option>
                      <option value="4">4 - Silent treatment 🤐</option>
                      <option value="5">5 - Godzilla Rage 🦖🔥</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-rose-500/5 border border-rose-500/10 rounded-2xl flex items-start gap-2.5 text-[11px] text-text/60 font-sans mt-2">
                  <AlertOctagon size={14} className="text-rose-400 shrink-0 mt-0.5" />
                  <span>By submitting this, you formalize the accusation and permit the partner to make desperate cute excuses! 📜</span>
                </div>

                <div className="flex gap-2.5 pt-2 select-none">
                  <button
                    type="button"
                    onClick={() => setShowFormModal(false)}
                    className="flex-1 py-3 bg-neutral-500/10 hover:bg-neutral-500/20 text-text/80 rounded-2xl text-xs font-black transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white rounded-2xl text-xs font-black shadow-md shadow-rose-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    File Accusation 📢
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mode: APOLOGIES / FILE COUPLING REPENTANCE APPEAL */}
      <AnimatePresence>
        {appealMistake && (
          <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-[32px] border border-border p-6 shadow-2xl relative my-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-base text-text font-display flex items-center gap-2">
                    Appeal Relationship Dispute ⚖️
                  </h3>
                  <span className="text-[10px] text-text/40 uppercase tracking-widest font-black">
                     Write your heartfelt plea
                  </span>
                </div>
                <button
                  onClick={() => setAppealMistake(null)}
                  className="p-1.5 rounded-full hover:bg-neutral-500/10 text-text/50 hover:text-text transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 font-sans">
                {/* Repentance guidelines */}
                <div className="p-3.5 bg-violet-500/5 border border-violet-500/10 rounded-2xl text-[11px] leading-relaxed text-text/60">
                  <p className="font-extrabold text-violet-500 uppercase tracking-wider text-[9px] mb-1">Guilty Charge:</p>
                  <p className="italic text-text">"{appealMistake.title}"</p>
                </div>

                <div>
                  <label className="text-[10px] uppercase font-black text-text/45 block mb-1">Your Excuse / Repentance speech *</label>
                  <textarea
                    required
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    placeholder="Enter why we should dismiss this or how you'll make it up... 🥺"
                    className="w-full h-24 bg-bg border border-border rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-primary focus:outline-none resize-none"
                  />
                </div>

                {/* Funny quick copy templates */}
                <div>
                  <span className="text-[9px] uppercase font-black text-text/45 block mb-2 font-display">Funny defense templates (click to copy):</span>
                  <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1 no-scrollbar">
                    {APOLOGIES_TEMPLATES.map((temp, tIdx) => (
                      <button
                        key={tIdx}
                        type="button"
                        onClick={() => { sensory.play("tick"); setAppealText(temp); }}
                        className="w-full text-left p-2 bg-bg hover:bg-primary/5 active:bg-primary/10 border border-border/60 rounded-xl text-[10px] text-text/70 hover:text-primary transition-color truncate font-medium"
                      >
                        {temp}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-2 select-none">
                  <button
                    type="button"
                    onClick={() => setAppealMistake(null)}
                    className="flex-1 py-3 bg-neutral-500/10 hover:bg-neutral-500/20 text-text/80 rounded-2xl text-xs font-black transition-all"
                  >
                    Discard Plea
                  </button>
                  <button
                    type="button"
                    onClick={handleFileAppeal}
                    disabled={isAppealing || !appealText.trim()}
                    className="flex-1 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-2xl text-xs font-black shadow-md shadow-violet-500/10 transition-all flex items-center justify-center gap-1.5"
                  >
                    Submit Case Appeal ⚖️
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
