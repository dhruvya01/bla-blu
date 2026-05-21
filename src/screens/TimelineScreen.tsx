import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  FileText,
  X,
  Loader2,
  Calendar,
  Heart,
  Camera,
  Star,
  Sparkles,
  Smile,
  Trash2,
  Maximize2,
  Clock,
  Pin,
  Award,
  Zap
} from "lucide-react";
import { useAppStore } from "../store";
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/config";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { TimelineEntry, TimelineSticker } from "../types";
import { STICKERS } from "../utils/stickers";
import { compressImage } from "../utils/imageUtils";
import { encryptData, decryptData } from "../utils/e2ee";

// --- Components ---

const WashiTape = ({ className }: { className?: string }) => (
  <div className={cn("washi-tape-accent", className)} />
);

const FloatingHeart = ({ delay = 0, x = "50%", size = 20 }) => (
  <motion.div
    initial={{ y: "110vh", opacity: 0, scale: 0.5 }}
    animate={{ 
      y: "-10vh", 
      opacity: [0, 0.4, 0.4, 0],
      x: ["20%", "-20%", "20%"],
      rotate: [0, 20, -20, 0]
    }}
    transition={{ 
      duration: 15 + Math.random() * 10, 
      repeat: Infinity, 
      delay,
      ease: "linear"
    }}
    style={{ left: x, position: "fixed", zIndex: 0 }}
    className="pointer-events-none"
  >
    <Heart size={size} className="text-primary/10 fill-primary/5" />
  </motion.div>
);

const MonthRecap = ({ entries, month }: { entries: TimelineEntry[], month: string }) => {
  const photosCount = entries.filter(e => e.type === 'photo').length;
  const notesCount = entries.filter(e => e.type === 'note').length;
  const milestonesCount = entries.filter(e => (e as any).type === 'milestone').length;

  const monthName = month.split(' ')[0].toLowerCase();
  
  const getSeasonInfo = () => {
    if (['december', 'january', 'february'].includes(monthName)) return { emoji: "❄️", label: "Winter Highlights", color: "border-indigo-200/30", pattern: "bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:16px_16px]" };
    if (['march', 'april', 'may'].includes(monthName)) return { emoji: "🌸", label: "Spring Bloom", color: "border-rose-200/30", pattern: "" };
    if (['june', 'july', 'august'].includes(monthName)) return { emoji: "☀️", label: "Summer Sun", color: "border-amber-200/30", pattern: "" };
    return { emoji: "🍂", label: "Autumn Leaves", color: "border-orange-200/30", pattern: "" };
  };

  const season = getSeasonInfo();

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className={cn(
        "bg-white/80 backdrop-blur-md border border-primary/10 rounded-2xl p-5 mb-10 shadow-squishy text-center space-y-2 relative overflow-hidden group max-w-[280px] mx-auto",
      )}
    >
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0" />
      
      <div className="flex justify-center -space-x-1.5 mb-1 relative z-10">
        <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-primary shadow-sm border border-primary/10 group-hover:scale-110 transition-transform"><Heart size={14} fill="currentColor" /></div>
        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-500 shadow-sm border border-primary/10 group-hover:scale-110 transition-transform delay-75"><Star size={14} fill="currentColor" /></div>
        <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 shadow-sm border border-primary/10 group-hover:scale-110 transition-transform delay-150"><Sparkles size={14} fill="currentColor" /></div>
      </div>
      
      <h3 className="text-lg font-handlee font-bold text-text italic tracking-tight relative z-10 leading-none pb-0.5">
        {month.split(' ')[0]}'s Memories board
      </h3>
      
      <div className="h-[1px] bg-primary/20 w-16 mx-auto mt-1 mb-2 rounded-full" />

      <p className="font-handlee text-base text-text/60 leading-tight max-w-[200px] mx-auto relative z-10">
        {photosCount} moments & {milestonesCount} events.
      </p>
    </motion.div>
  );
};

function PolaroidCard({ entry, deleteEntry, onExpand, onReact, index }: { entry: TimelineEntry; deleteEntry: (id: string, e: React.MouseEvent) => void; onExpand: (url: string, caption?: string) => void; onReact: (id: string, emoji: string) => void; index: number }) {
  const { user, partner } = useAppStore();
  const [decryptedContent, setDecryptedContent] = useState("");
  const [decryptedCaption, setDecryptedCaption] = useState("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (entry.content && entry.content.startsWith('E2EE:')) {
        decryptData(entry.content).then(v => active && setDecryptedContent(v));
      } else {
        setDecryptedContent(entry.content);
      }
      if (entry.caption && entry.caption.startsWith('E2EE:')) {
        decryptData(entry.caption).then(v => active && setDecryptedCaption(v));
      } else {
        setDecryptedCaption(entry.caption || '');
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { active = false; window.removeEventListener('e2ee-ready', attempt); };
  }, [entry.content, entry.caption]);

  const creator = entry.createdBy === user?.uid ? user : (entry.createdBy === 'System (Baby)' ? null : partner);
  const isSystem = entry.createdBy === 'System (Baby)';
  
  // Layout logic: alternate sides and slight random rotations
  const isLeft = index % 2 === 0;
  const rotation = (index % 3 === 0 ? -6 : index % 3 === 1 ? 7 : -3) + (Math.random() * 4 - 2);
  const xOffset = (index % 4 === 0 ? 4 : index % 4 === 1 ? -4 : 0);

  if (entry.type === 'milestone' as any) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className={cn(
          "relative z-10 mb-6 max-w-[150px]",
          isLeft ? "mr-auto ml-2" : "ml-auto mr-2"
        )}
        style={{ rotate: rotation, x: xOffset }}
      >
        <WashiTape className="-top-3 left-1/2 -ml-6 rotate-12 opacity-30" />
        <div className="bg-white p-4 rounded-xl border border-primary/10 shadow-squishy relative overflow-hidden text-center">
           <div className="absolute top-1 right-1 text-primary/5"><Sparkles size={40} /></div>
           <h3 className="text-base font-scrapbook font-bold text-primary italic uppercase tracking-tighter mb-1 leading-tight">
              {decryptedContent}
           </h3>
           <p className="font-handlee text-xs text-text/60 leading-tight">
              {decryptedCaption}
           </p>
           <div className="mt-2 pt-1 border-t border-primary/5 flex justify-between items-center">
             <span className="text-[7px] font-bold uppercase tracking-widest text-primary/30">
               {new Date(entry.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
             </span>
             <button onClick={(e) => deleteEntry(entry.id, e)} className="text-rose-200 hover:text-rose-500"><Trash2 size={10} /></button>
           </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ scale: 1.05, zIndex: 50, rotate: rotation * 0.5 }}
      className={cn(
        "relative group z-10 mb-6 max-w-[130px]",
        isLeft ? "mr-auto ml-2" : "ml-auto mr-2"
      )}
      style={{ rotate: rotation, x: xOffset }}
    >
      <WashiTape className={cn("-top-4", isLeft ? "right-1" : "left-1", index % 2 === 0 ? "rotate-6" : "-rotate-12")} />

      <div className={cn(
        "polaroid-frame flex flex-col gap-2 relative",
        entry.type === 'note' ? "sticky-note-bg !p-4 !pb-6 rounded-sm border-l-2 border-primary/10" : "bg-white"
      )}>
        {entry.type === "photo" ? (
          <div className="relative aspect-square bg-bg overflow-hidden cursor-zoom-in group/img" onClick={() => onExpand(decryptedContent, decryptedCaption)}>
            <motion.img
              src={decryptedContent}
              alt={decryptedCaption}
              onLoad={() => setIsLoaded(true)}
              initial={{ opacity: 0 }}
              animate={{ opacity: isLoaded ? 1 : 0 }}
              className="w-full h-full object-cover"
            />
            {entry.stickers?.map((sticker) => (
              <div
                key={sticker.id}
                className="absolute drop-shadow-[0_2px_5px_rgba(0,0,0,0.15)] pointer-events-none"
                style={{
                  left: `${sticker.x}%`,
                  top: `${sticker.y}%`,
                  transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                  width: "30px",
                  height: "30px",
                }}
              >
                <img src={sticker.emoji} className="w-full h-full object-contain" />
              </div>
            ))}
            <div className="absolute top-1 right-1 opacity-0 group-hover/img:opacity-100 transition-opacity">
               <button onClick={(e) => { e.stopPropagation(); onReact(entry.id, '❤️'); }} className="w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center text-primary border border-primary/10">
                  <Heart size={12} fill="currentColor" />
               </button>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center justify-center text-center py-2">
            <p className="text-sm font-scrapbook font-medium italic text-on-surface/80 leading-relaxed">
              {decryptedContent}
            </p>
          </div>
        )}

        <div className="space-y-1">
          {decryptedCaption && (
            <p className="font-scrapbook text-[9px] text-text/80 leading-tight text-center italic line-clamp-2">
              {decryptedCaption}
            </p>
          )}
          <div className="flex items-center justify-between pt-1 border-t border-black/5">
             <span className="text-[7px] font-medium text-text/30">
               {new Date(entry.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
             </span>
             <button onClick={(e) => deleteEntry(entry.id, e)} className="text-rose-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><Trash2 size={8} /></button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TimelineScreen(_props: {}) {
  const { setView, roomId, user, partner, pair, timelineEntries } = useAppStore();
  const [showComposer, setShowComposer] = useState(false);
  const [composerType, setComposerType] = useState<"photo" | "note" | "milestone">("photo");
  const [localBabyMemories, setLocalBabyMemories] = useState<TimelineEntry[]>([]);
  const [expandedPhoto, setExpandedPhoto] = useState<{url: string, caption: string} | null>(null);
  const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [composerStickers, setComposerStickers] = useState<TimelineSticker[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(collection(db, "pairs", roomId, "babyMemories"), snap => {
      const memories = snap.docs.map(doc => {
        const d = doc.data();
        return {
          id: doc.id,
          type: d.type || "photo",
          content: d.url,
          caption: d.caption,
          date: new Date(d.date).toISOString().split("T")[0],
          createdAt: d.date,
          createdBy: "System (Baby)",
          stickers: d.stickers,
        } as TimelineEntry;
      });
      setLocalBabyMemories(memories);
    });
    return () => unsub();
  }, [roomId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      sensory.play("swoosh");
    }
  };

  const handleUpload = async () => {
    if (!roomId || !user) return;
    if (composerType === "photo" && !file) return;
    if (composerType !== "photo" && !caption.trim()) return;

    setIsUploading(true);
    sensory.tap();

    try {
      let contentUrl = caption.trim();
      if (composerType === "photo" && file) {
        const rawDataUrl = await new Promise<string>(resolve => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        contentUrl = await compressImage(rawDataUrl, 1000, 0.7);
        if (contentUrl.length > 950_000) { alert("Photo is too big! ❤️"); setIsUploading(false); return; }
      }

      const entryData: any = {
        type: composerType,
        content: await encryptData(contentUrl),
        caption: (composerType === "photo" || composerType === "milestone") ? await encryptData(caption.trim()) : undefined,
        date,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        stickers: composerType === "photo" ? composerStickers : [],
      };

      if (composerType === "milestone") {
        const lines = caption.split('\n');
        entryData.content = await encryptData(lines[0].trim());
        entryData.caption = await encryptData(lines.slice(1).join('\n').trim() || "A special day in our story.");
      }

      await addDoc(collection(db, "pairs", roomId, "timeline"), entryData);
      sensory.play("sparkle");
      setShowComposer(false);
      setFile(null); setPreview(null); setCaption(""); setComposerStickers([]);
    } finally { setIsUploading(false); }
  };

  const deleteEntry = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation(); if (!roomId) return; sensory.play("pop");
    try { await deleteDoc(doc(db, "pairs", roomId, "timeline", id)); } catch (e) { console.error(e); }
  };

  const handleReact = (id: string, emoji: string) => { sensory.tap(); sensory.play("sparkle"); };

  const handleAddSticker = (emoji: string) => {
    sensory.tap();
    setComposerStickers(prev => [...prev, {
      id: Math.random().toString(), emoji, x: 40 + Math.random() * 20, y: 40 + Math.random() * 20,
      rotation: (Math.random() - 0.5) * 40, scale: 1 + Math.random() * 0.5
    }]);
  };

  const handleDragEnd = (id: string, info: any) => {
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const xPct = ((info.point.x - rect.left) / rect.width) * 100;
    const yPct = ((info.point.y - rect.top) / rect.height) * 100;
    setComposerStickers(prev => prev.map(s => s.id === id ? { ...s, x: xPct, y: yPct } : s));
  };

  const allEntries = [...(timelineEntries || []), ...localBabyMemories].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groupedEntries = allEntries.reduce((acc: Record<string, TimelineEntry[]>, entry) => {
    const key = new Date(entry.date).toLocaleString("default", { month: "long", year: "numeric" });
    if (!acc[key]) acc[key] = []; acc[key].push(entry); return acc;
  }, {});
  const sortedMonths = Object.keys(groupedEntries).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const daysTogether = pair?.createdAt ? Math.floor((Date.now() - pair.createdAt) / (1000 * 60 * 60 * 24)) : 0;

  const currentMonth = sortedMonths[currentMonthIndex];
  const currentEntries = currentMonth ? groupedEntries[currentMonth] : [];

  const goToNextMonth = () => {
    if (currentMonthIndex < sortedMonths.length - 1) {
      setCurrentMonthIndex(prev => prev + 1);
      sensory.play("swoosh");
    }
  };

  const goToPrevMonth = () => {
    if (currentMonthIndex > 0) {
      setCurrentMonthIndex(prev => prev - 1);
      sensory.play("swoosh");
    }
  };

  return (
    <div className="flex flex-col w-full bg-bg relative min-h-screen pt-safe pb-40 overflow-x-hidden transition-colors duration-500">
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-scrapbook-pattern opacity-40" />
        {[...Array(6)].map((_, i) => <FloatingHeart key={i} delay={i * 3} x={`${10 + i * 15}%`} size={12 + Math.random() * 15} />)}
      </div>

      <nav className="fixed top-0 inset-x-0 h-16 px-6 flex justify-between items-center z-50 bg-bg/80 backdrop-blur-md border-b border-primary/10">
        <button onClick={() => useAppStore.getState().setView("home")} className="text-secondary hover:scale-110 transition-transform"><Heart size={22} fill="currentColor" /></button>
        <h1 className="text-xl font-scrapbook font-extrabold text-secondary italic tracking-tight">Our Scrapbook</h1>
        <div className="flex flex-col gap-1 text-secondary pr-1 cursor-pointer">
          <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          <div className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
        </div>
      </nav>

      <main className="relative z-10 w-full max-w-lg mx-auto px-4 py-24 flex flex-col items-center">
        {allEntries.length === 0 ? (
          <div className="text-center py-20 opacity-30 flex flex-col items-center gap-6 mt-10">
             <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-squishy"><Camera size={32} className="text-primary" /></div>
             <p className="font-handlee text-xl">Waiting for our first memory...</p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center min-h-[600px]">
             <div className="text-center mb-8">
                <h2 className="text-lg font-scrapbook font-bold text-text mb-1 italic">Memories Board</h2>
                <div className="h-[2.5px] bg-secondary/40 w-32 rounded-full mx-auto" />
             </div>

             <AnimatePresence mode="wait">
                <motion.div
                  key={currentMonth}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="w-full max-w-[360px] bg-card rounded-[3rem] p-8 shadow-squishy relative min-h-[600px] border border-white/50"
                >
                   {/* Dashed Timeline Line inside the board */}
                   <div className="absolute left-1/2 top-10 bottom-10 w-[1.5px] border-l border-dashed border-secondary/20 z-0 -translate-x-1/2" />

                   {/* Layout the items for this month */}
                   <div className="relative z-10 space-y-2">
                      {currentEntries.map((entry, idx) => (
                        <PolaroidCard 
                          key={entry.id} 
                          entry={entry} 
                          deleteEntry={deleteEntry} 
                          index={idx}
                          onExpand={(url, cap) => setExpandedPhoto({ url, caption: cap || "" })} 
                          onReact={handleReact} 
                        />
                      ))}
                      
                      {/* Decorative Central Heart Icon along the timeline if board is empty-ish */}
                      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-secondary pointer-events-none">
                         <Heart size={16} fill="currentColor" className="opacity-15" />
                      </div>
                   </div>
                </motion.div>
             </AnimatePresence>
          </div>
        )}
      </main>

      {/* Footer Navigation */}
      {sortedMonths.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 h-40 flex flex-col items-center justify-end pb-12 pointer-events-none z-40 bg-gradient-to-t from-bg via-bg to-transparent">
          <div className="bg-white/90 backdrop-blur-xl px-8 py-4 rounded-full border border-primary/10 shadow-squishy flex items-center gap-8 pointer-events-auto">
            <button 
              onClick={goToNextMonth}
              disabled={currentMonthIndex === sortedMonths.length - 1}
              className="text-primary disabled:opacity-20 hover:scale-125 active:scale-95 transition-all"
            >
              <ArrowLeft size={24} />
            </button>
            <div className="flex flex-col items-center min-w-[120px]">
              <span className="text-[11px] font-handlee font-bold text-secondary uppercase tracking-[0.25em]">{currentMonth?.toUpperCase()}</span>
              <div className="flex gap-2 mt-2.5">
                {sortedMonths.map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-2 h-2 rounded-full transition-all duration-500", 
                      i === currentMonthIndex ? "bg-secondary scale-150 shadow-glow" : "bg-secondary/20"
                    )} 
                  />
                ))}
              </div>
            </div>
            <button 
              onClick={goToPrevMonth}
              disabled={currentMonthIndex === 0}
              className="text-primary disabled:opacity-20 hover:scale-125 active:scale-95 transition-all rotate-180"
            >
              <ArrowLeft size={24} />
            </button>
          </div>
        </div>
      )}

      <motion.button 
        whileHover={{ scale: 1.1 }} 
        whileTap={{ scale: 0.9 }} 
        onClick={() => { sensory.play("pop"); setShowComposer(true); }} 
        className="fixed bottom-10 right-6 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-lg z-50 overflow-hidden group border-2 border-white/50"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent pointer-events-none group-hover:rotate-45 transition-transform" />
        <Plus size={24} strokeWidth={3} />
      </motion.button>

      <AnimatePresence>
        {expandedPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setExpandedPhoto(null)} className="fixed inset-0 z-[200] bg-on-surface/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8" >
            <motion.div initial={{ scale: 0.85, rotate: -3 }} animate={{ scale: 1, rotate: 0 }} className="bg-white p-3 pb-12 shadow-2xl rounded-sm max-w-full max-h-[85vh] relative border border-black/5" onClick={e => e.stopPropagation()}>
              <WashiTape className="-top-3 left-1/2 -translate-x-1/2" />
              <img src={expandedPhoto.url} className="max-w-full max-h-[60vh] object-contain rounded-xs" />
              {expandedPhoto.caption && (
                <div className="mt-6 px-4 text-center">
                  <p className="font-scrapbook text-xl text-text leading-tight">{expandedPhoto.caption}</p>
                </div>
              )}
              <button onClick={() => setExpandedPhoto(null)} className="absolute -top-12 right-0 text-white/60 hover:text-white transition-colors">
                <X size={32} />
              </button>
            </motion.div>
          </motion.div>
        )}

        {showComposer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-on-surface/40 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => !isUploading && setShowComposer(false)}>
            <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 350 }} className="bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-2xl shadow-squishy max-h-[92vh] flex flex-col overflow-hidden border-t border-primary/10" onClick={e => e.stopPropagation()}>
              <header className="p-6 pb-2 flex justify-between items-center shrink-0">
                 <div><h2 className="text-2xl font-handlee font-bold text-text tracking-tighter">New Memory</h2><p className="text-[10px] font-bold text-text/30 uppercase tracking-[0.2em]">Add a page to our story</p></div>
                 <button onClick={() => setShowComposer(false)} className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center active:scale-90 transition-all hover:bg-primary/10"><X size={18} className="text-primary" /></button>
              </header>
              <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-8 pb-32 no-scrollbar">
                 <div className="grid grid-cols-3 gap-2 p-1.5 bg-primary/5 rounded-2xl">
                    <button onClick={() => setComposerType("photo")} className={cn("py-3 rounded-xl flex flex-col items-center gap-1 transition-all font-bold text-[9px] uppercase tracking-widest", composerType === "photo" ? "bg-white text-primary shadow-squishy" : "text-primary/30")}><ImageIcon size={18} /> Photo</button>
                    <button onClick={() => setComposerType("note")} className={cn("py-3 rounded-xl flex flex-col items-center gap-1 transition-all font-bold text-[9px] uppercase tracking-widest", composerType === "note" ? "bg-white text-primary shadow-squishy" : "text-primary/30")}><FileText size={18} /> Note</button>
                    <button onClick={() => setComposerType("milestone")} className={cn("py-3 rounded-xl flex flex-col items-center gap-1 transition-all font-bold text-[9px] uppercase tracking-widest", composerType === "milestone" ? "bg-white text-primary shadow-squishy" : "text-primary/30")}><Award size={18} /> Event</button>
                 </div>
                 {composerType === "photo" ? (
                    <div className="space-y-6">
                       <div ref={previewContainerRef} onClick={() => !preview && fileInputRef.current?.click()} className="w-full aspect-[4/5] bg-primary/[0.02] rounded-2xl border-2 border-dashed border-primary/10 shadow-inner flex flex-col items-center justify-center gap-4 cursor-pointer overflow-hidden relative group transition-all hover:border-primary/20">
                          {preview ? (<><img src={preview} className="w-full h-full object-cover" />{composerStickers.map(s => (<motion.div key={s.id} drag dragConstraints={previewContainerRef} dragElastic={0} dragMomentum={false} onDragEnd={(_, info) => handleDragEnd(s.id, info)} className="absolute drop-shadow-2xl cursor-grab active:cursor-grabbing w-16 h-16" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: `translate(-50%, -50%) rotate(${s.rotation}deg) scale(${s.scale})` }}><img src={s.emoji} className="w-full h-full object-contain pointer-events-none" /></motion.div>))}<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold uppercase tracking-[0.3em] pointer-events-none">Change Photo</div></>) : (<><div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-glow animate-pulse-slow"><Camera size={24} /></div><p className="text-[10px] font-bold text-primary/30 uppercase tracking-[0.2em]">Select a moment</p></>)}
                       </div>
                       <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                       {preview && (<div className="flex gap-3 overflow-x-auto no-scrollbar py-1">{STICKERS.map((s, i) => (<button key={i} onClick={() => handleAddSticker(s)} className="w-12 h-12 shrink-0 bg-white rounded-xl border border-primary/5 p-2 shadow-sm hover:scale-110 active:scale-95 transition-all"><img src={s} className="w-full h-full object-contain" /></button>))}</div>)}
                       <div className="space-y-2"><label className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-2"><Clock size={12} /> Caption</label><textarea placeholder="Write a short story..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full bg-primary/[0.02] border border-primary/10 rounded-2xl p-5 min-h-[100px] font-handlee text-lg text-text outline-none shadow-inner resize-none focus:border-primary/30 transition-all placeholder:text-primary/10" /></div>
                    </div>
                 ) : composerType === "note" ? (
                    <div className="space-y-2"><label className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-2"><FileText size={12} /> Love Note</label><textarea placeholder="What's on your mind?..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full sticky-note-bg border border-yellow-200/50 rounded-lg p-6 min-h-[250px] font-handlee text-xl text-on-surface/80 outline-none shadow-inner resize-none focus:rotate-1 transition-all placeholder:text-on-surface/10" /></div>
                 ) : (
                    <div className="space-y-2"><label className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-2"><Award size={12} /> Event Story</label><textarea placeholder="Title: Date Night\nDescription: We went to..." value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full bg-primary/[0.02] border border-primary/10 rounded-2xl p-5 min-h-[150px] font-handlee text-lg text-text outline-none shadow-inner resize-none focus:border-primary/30 transition-all placeholder:text-primary/10" /></div>
                 )}
                 <div className="space-y-2"><label className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-[0.3em] ml-2"><Calendar size={12} /> Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-primary/[0.02] border border-primary/10 rounded-xl p-4 text-sm font-bold uppercase tracking-widest text-primary outline-none shadow-inner focus:border-primary/30 transition-all" /></div>
              </div>
              <footer className="p-6 pt-4 border-t border-primary/5 bg-white/80 backdrop-blur-xl shrink-0"><button onClick={handleUpload} disabled={isUploading || (composerType === "photo" && !file) || (composerType !== "photo" && !caption.trim())} className="w-full bg-primary text-white py-4 rounded-xl font-bold uppercase tracking-[0.3em] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 text-[10px]">{isUploading ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />}{isUploading ? "Saving..." : "Pin to Scrapbook"}</button></footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
