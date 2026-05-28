import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, Edit3, Plus, Trash2, Pin, Check, Search, 
  Tag, ListTodo, FileText, Heart, Sparkles, Flame, Lightbulb, 
  Trash, X, HelpCircle, FileHeart, Calendar, Plane, Compass
} from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { collection, doc, onSnapshot, setDoc, deleteDoc, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import { sensory } from "../utils/sensory";
import { cn } from "../utils";

const NOTE_COLORS = [
  { id: "default", class: "bg-card border-border/80 text-text" },
  { id: "rose", class: "bg-rose-500/10 border-rose-500/30 text-rose-500 dark:text-rose-400" },
  { id: "blue", class: "bg-blue-500/10 border-blue-500/30 text-blue-500 dark:text-blue-400" },
  { id: "emerald", class: "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 dark:text-emerald-400" },
  { id: "amber", class: "bg-amber-500/10 border-amber-500/30 text-amber-500 dark:text-amber-400" },
  { id: "purple", class: "bg-purple-500/10 border-purple-500/30 text-purple-500 dark:text-purple-400" },
];

const CATEGORIES = [
  { id: "General", label: "General", color: "text-slate-500 bg-slate-500/10" },
  { id: "Love Prompt", label: "💖 Love Prompt", color: "text-rose-500 bg-rose-500/10" },
  { id: "Bucket List", label: "✨ Bucket List", color: "text-pink-500 bg-pink-500/10" },
  { id: "Future Plans", label: "✈️ Future Plans", color: "text-amber-500 bg-amber-500/10" },
  { id: "Daily Log", label: "📅 Daily Log", color: "text-emerald-500 bg-emerald-500/10" },
  { id: "Idea", label: "💡 Idea", color: "text-indigo-500 bg-indigo-500/10" },
];

const REACTION_EMOJIS = [
  { char: "❤️", id: "heart" },
  { char: "✨", id: "sparkle" },
  { char: "🔥", id: "fire" },
  { char: "💡", id: "idea" },
  { char: "😢", id: "cry" },
  { char: "😂", id: "laugh" },
];

interface ChecklistItem {
  id: string;
  text: string;
  completed: boolean;
}

interface Note {
  id: string;
  title: string;
  content: string;
  colorId: string;
  pinned: boolean;
  isChecklist?: boolean;
  checklistItems?: ChecklistItem[];
  categoryTag?: string;
  reactions?: Record<string, string>; // userId -> emojiId
  updatedAt: number;
  updatedBy: string;
}

export function SharedNotesScreen() {
  const { setView, roomId, user, partner } = useAppStore(
    useShallow((state) => ({
      setView: state.setView,
      roomId: state.roomId,
      user: state.user,
      partner: state.partner,
    })),
  );

  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  
  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, "pairs", roomId, "notes"), orderBy("updatedAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() } as Note));
      setNotes(fetched);
    });
    return () => unsub();
  }, [roomId]);

  // Combined Search and Filters
  const filteredNotes = useMemo(() => {
    return notes.filter(note => {
      const matchesSearch = 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (note.checklistItems && note.checklistItems.some(item => item.text.toLowerCase().includes(searchQuery.toLowerCase())));
      
      const matchesTag = !selectedTag || note.categoryTag === selectedTag;
      const matchesColor = !selectedColor || note.colorId === selectedColor;

      return matchesSearch && matchesTag && matchesColor;
    });
  }, [notes, searchQuery, selectedTag, selectedColor]);

  const pinnedNotes = useMemo(() => filteredNotes.filter(n => n.pinned), [filteredNotes]);
  const otherNotes = useMemo(() => filteredNotes.filter(n => !n.pinned), [filteredNotes]);

  const createNewNote = async () => {
    if (!roomId) return;
    sensory.play("pop");
    try {
      const newNoteRef = doc(collection(db, "pairs", roomId, "notes"));
      const newNote = {
        title: "",
        content: "",
        colorId: "default",
        pinned: false,
        isChecklist: false,
        checklistItems: [],
        categoryTag: "General",
        reactions: {},
        updatedAt: Date.now(),
        updatedBy: user?.uid || ""
      };
      await setDoc(newNoteRef, newNote);
      setEditingNoteId(newNoteRef.id);
    } catch (err) {
      console.error("Failed to create note", err);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -15 }} 
      transition={{ type: "spring", duration: 0.55 }} 
      className="flex-1 flex flex-col bg-bg w-full max-w-2xl mx-auto h-full overflow-hidden relative"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-primary/5 pointer-events-none" />

      <AnimatePresence mode="wait">
        {!editingNoteId ? (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col pt-12 pb-24 px-4 overflow-y-auto no-scrollbar relative z-10"
          >
            {/* Header */}
            <div className="flex items-center gap-4 mb-6 pl-2">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => { sensory.play("pop"); setView("home"); }}
                className="w-12 h-12 rounded-2xl bg-card border border-border flex items-center justify-center text-text hover:bg-card/80 shadow-sm"
              >
                <ChevronLeft size={24} />
              </motion.button>
              <div>
                <h1 className="text-3xl font-display text-text drop-shadow-sm flex items-center gap-2">
                  Memories & Notes <Edit3 size={24} className="text-blue-500" />
                </h1>
                <p className="text-xs font-semibold uppercase tracking-widest text-text/40">Collaborative Love Notes</p>
              </div>
            </div>

            {/* Quick Search & Filters */}
            <div className="flex flex-col gap-3 mb-6">
              <div className="relative w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text/30" size={18} />
                <input
                  type="text"
                  placeholder="Search notes, checklists..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card/50 backdrop-blur-md rounded-2xl pl-11 pr-4 py-3 border border-border/80 focus:outline-none focus:ring-2 focus:ring-blue-500/40 text-text transition-all leading-none placeholder-text/30 text-sm"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text/40 hover:text-text"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Tag Filters */}
              <div className="flex gap-2 p-1 overflow-x-auto no-scrollbar pb-1">
                <button
                  onClick={() => { sensory.play("pop"); setSelectedTag(null); }}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border transition-all shrink-0 font-medium",
                    !selectedTag 
                      ? "bg-text/10 border-text/20 text-text" 
                      : "bg-card/50 border-border/60 text-text/60"
                  )}
                >
                  All Categories
                </button>
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => { sensory.play("pop"); setSelectedTag(cat.id); }}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-full border transition-all shrink-0 font-medium",
                      selectedTag === cat.id 
                        ? cat.color + " border-current" 
                        : "bg-card/50 border-border/60 text-text/60"
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Palette Filters */}
              <div className="flex gap-2 items-center pl-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-text/40 mr-1">Colors:</span>
                <button
                  onClick={() => { sensory.play("pop"); setSelectedColor(null); }}
                  className={cn(
                    "w-5 h-5 rounded-full border border-border/60 flex items-center justify-center text-[10px] text-text/40 font-bold",
                    !selectedColor ? "ring-2 ring-blue-500/50" : ""
                  )}
                >
                  ×
                </button>
                {NOTE_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => { sensory.play("pop"); setSelectedColor(color.id); }}
                    className={cn(
                      "w-5 h-5 rounded-full border border-border/50 transition-all",
                      color.id === "default" ? "bg-card" : color.class.split(" ")[0],
                      selectedColor === color.id ? "ring-2 ring-blue-500 scale-110" : "hover:scale-105"
                    )}
                  />
                ))}
              </div>
            </div>

            {filteredNotes.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-text/40 py-20 bg-card/20 rounded-3xl border border-dashed border-border/50">
                 <Edit3 size={48} className="mb-4 opacity-50" />
                 <p className="font-semibold text-text/60">No notes found</p>
                 <p className="text-sm">Try tweaking your search filters or add a new note!</p>
               </div>
            ) : (
              <div className="flex flex-col gap-6">
                {pinnedNotes.length > 0 && (
                  <div>
                    <h2 className="text-[11px] font-semibold uppercase tracking-widest text-text/40 mb-3 pl-2 flex items-center gap-1.5">
                      <Pin size={12} className="text-blue-500 fill-blue-500/20" /> Pinned Notes
                    </h2>
                    <div className="grid grid-cols-2 gap-3">
                      {pinnedNotes.map((note) => (
                        <NoteCard key={note.id} note={note} onClick={() => setEditingNoteId(note.id)} />
                      ))}
                    </div>
                  </div>
                )}
                
                {otherNotes.length > 0 && (
                  <div>
                    {pinnedNotes.length > 0 && (
                      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-text/40 mb-3 pl-2 pt-2">
                        Others
                      </h2>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {otherNotes.map((note) => (
                        <NoteCard key={note.id} note={note} onClick={() => setEditingNoteId(note.id)} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Quick Suggestions for LDR couples */}
            <div className="mt-8 bg-card/40 border border-border/60 rounded-3xl p-5 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-rose-500/5 to-transparent rounded-bl-full pointer-events-none" />
              <div className="flex items-center gap-2 mb-2 text-rose-500">
                <FileHeart size={18} />
                <span className="text-[11px] font-bold uppercase tracking-widest">LDR Interaction Suggestion</span>
              </div>
              <p className="text-sm font-semibold text-text leading-snug mb-2">
                Create checklists for travel packing, upcoming virtual movie nights, or make a collaborative bucket list!
              </p>
              <p className="text-xs text-text/60">
                Any changes made here sync instantly onto your partner's phone in real-time, even of status edits! Use note colors to categorize your plans.
              </p>
            </div>

            {/* Floating add button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={createNewNote}
              className="fixed bottom-24 right-6 w-14 h-14 bg-blue-500 rounded-full text-white shadow-lg shadow-blue-500/30 flex items-center justify-center z-50"
            >
              <Plus size={28} />
            </motion.button>
          </motion.div>
        ) : (
          <NoteEditor 
            key="editor" 
            noteId={editingNoteId} 
            onClose={() => setEditingNoteId(null)} 
            user={user}
            partner={partner}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// NOTE CARD COMPONENT
function NoteCard({ note, onClick }: { note: Note, onClick: () => void }) {
  const { user } = useAppStore(useShallow(s => ({ user: s.user })));
  const colorClass = NOTE_COLORS.find(c => c.id === note.colorId)?.class || NOTE_COLORS[0].class;
  const categoryInfo = CATEGORIES.find(c => c.id === note.categoryTag);

  // Parse reactions map to count reactions group
  const reactionCounts = useMemo(() => {
    if (!note.reactions) return [];
    const counts: Record<string, number> = {};
    Object.values(note.reactions).forEach(emojiId => {
      counts[emojiId] = (counts[emojiId] || 0) + 1;
    });
    return Object.entries(counts).map(([emojiId, count]) => {
      const char = REACTION_EMOJIS.find(e => e.id === emojiId)?.char || "❤️";
      return { id: emojiId, char, count };
    });
  }, [note.reactions]);

  const progress = useMemo(() => {
    if (!note.isChecklist || !note.checklistItems || note.checklistItems.length === 0) return null;
    const completed = note.checklistItems.filter(i => i.completed).length;
    return { completed, total: note.checklistItems.length, pct: (completed / note.checklistItems.length) * 100 };
  }, [note.isChecklist, note.checklistItems]);

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      onClick={() => { sensory.play("pop"); onClick(); }}
      className={cn(
        "rounded-2xl p-4 shadow-sm cursor-pointer relative group border transition-all hover:brightness-95 flex flex-col justify-between min-h-[140px]",
        colorClass
      )}
    >
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-2">
          {categoryInfo && (
            <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", categoryInfo.color)}>
              {categoryInfo.label}
            </span>
          )}
          {note.pinned && (
            <Pin size={12} className="fill-current text-blue-500" />
          )}
        </div>

        {note.title && <h3 className="font-bold text-text mb-1 pr-4 leading-tight line-clamp-2">{note.title}</h3>}

        {/* Note body or checklists layout */}
        {note.isChecklist ? (
          <div className="space-y-1 my-2">
            {note.checklistItems?.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center gap-1.5 min-w-0">
                <span className={cn(
                  "w-3 h-3 rounded-md flex-shrink-0 border flex items-center justify-center text-[8px]",
                  item.completed ? "bg-blue-500/20 border-blue-500 text-blue-500" : "border-text/30"
                )}>
                  {item.completed && <Check size={8} />}
                </span>
                <span className={cn(
                  "text-xs truncate text-text/80 leading-snug",
                  item.completed && "line-through text-text/40"
                )}>
                  {item.text || "Empty item"}
                </span>
              </div>
            ))}
            {note.checklistItems && note.checklistItems.length > 3 && (
              <p className="text-[10px] font-semibold text-text/40 pt-1">
                + {note.checklistItems.length - 3} more items
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-text/80 whitespace-pre-wrap line-clamp-4 leading-relaxed my-1">
            {note.content || (!note.title ? "Empty note" : "")}
          </p>
        )}
      </div>

      {/* Footer bar */}
      <div className="mt-3 pt-2 border-t border-border/10 flex flex-col gap-1.5">
        {progress && (
          <div className="w-full">
            <div className="flex justify-between items-center text-[10px] text-text/50 font-medium mb-1">
              <span>Progress</span>
              <span>{progress.completed}/{progress.total}</span>
            </div>
            <div className="w-full bg-black/10 dark:bg-white/10 h-1 rounded-full overflow-hidden">
              <div 
                className="bg-blue-500 h-full transition-all duration-300"
                style={{ width: `${progress.pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[9px] text-text/40 font-semibold tracking-wider">
            {note.updatedBy === user?.uid ? "You" : "Partner"} • {new Date(note.updatedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>

          {/* Quick Reaction display on card */}
          {reactionCounts.length > 0 && (
            <div className="flex gap-1 items-center bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded-full">
              {reactionCounts.slice(0, 3).map(react => (
                <span key={react.id} className="text-[10px]" title={`${react.count} reaction`}>
                  {react.char}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// NOTE EDITOR WITH REACTION SUPPORT & LDR TEMPLATE SUGGESTIONS
function NoteEditor({ noteId, onClose, user, partner }: { noteId: string, onClose: () => void, user: any, partner: any }) {
  const { roomId } = useAppStore(useShallow((state) => ({ roomId: state.roomId })));
  
  const [localTitle, setLocalTitle] = useState("");
  const [localContent, setLocalContent] = useState("");
  const [colorId, setColorId] = useState("default");
  const [pinned, setPinned] = useState(false);
  const [isChecklist, setIsChecklist] = useState(false);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [categoryTag, setCategoryTag] = useState("General");
  const [reactions, setReactions] = useState<Record<string, string>>({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Modal / Confirm state
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const titleTimer = useRef<any>(null);
  const contentTimer = useRef<any>(null);

  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "pairs", roomId, "notes", noteId), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as Note;
        if (!snap.metadata.hasPendingWrites) {
           setLocalTitle(data.title || "");
           setLocalContent(data.content || "");
           setColorId(data.colorId || "default");
           setPinned(data.pinned || false);
           setIsChecklist(data.isChecklist || false);
           setChecklistItems(data.checklistItems || []);
           setCategoryTag(data.categoryTag || "General");
           setReactions(data.reactions || {});
        }
        if (!isLoaded) {
           setLocalTitle(data.title || "");
           setLocalContent(data.content || "");
           setColorId(data.colorId || "default");
           setPinned(data.pinned || false);
           setIsChecklist(data.isChecklist || false);
           setChecklistItems(data.checklistItems || []);
           setCategoryTag(data.categoryTag || "General");
           setReactions(data.reactions || {});
           setIsLoaded(true);
        }
      } else {
         onClose();
      }
    });
    return () => unsub();
  }, [roomId, noteId, isLoaded, onClose]);

  const saveChanges = async (updates: Partial<Note>) => {
    if (!roomId) return;
    try {
      await setDoc(doc(db, "pairs", roomId, "notes", noteId), {
        ...updates,
        updatedAt: Date.now(),
        updatedBy: user?.uid || ""
      }, { merge: true });
    } catch (e) {
      console.error("Save error", e);
    }
  };

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalTitle(val);
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => saveChanges({ title: val }), 1500);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalContent(val);
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => saveChanges({ content: val }), 1500);
  };

  const handleColorSelect = (id: string) => {
    setColorId(id);
    sensory.play("pop");
    saveChanges({ colorId: id });
  };

  const togglePin = () => {
    setPinned(!pinned);
    sensory.play("pop");
    saveChanges({ pinned: !pinned });
  };

  const handleCategorySelect = (tagId: string) => {
    setCategoryTag(tagId);
    sensory.play("pop");
    saveChanges({ categoryTag: tagId });
  };

  // CHECKLIST LOGIC
  const toggleChecklistItem = (itemId: string) => {
    sensory.play("tick");
    const updated = checklistItems.map(item => 
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    setChecklistItems(updated);
    saveChanges({ checklistItems: updated });
  };

  const addChecklistItem = () => {
    sensory.play("pop");
    const newItem: ChecklistItem = {
      id: Math.random().toString(36).substr(2, 9),
      text: "",
      completed: false
    };
    const updated = [...checklistItems, newItem];
    setChecklistItems(updated);
    saveChanges({ checklistItems: updated });
  };

  const removeChecklistItem = (itemId: string) => {
    sensory.play("pop");
    const updated = checklistItems.filter(item => item.id !== itemId);
    setChecklistItems(updated);
    saveChanges({ checklistItems: updated });
  };

  const handleChecklistTextChange = (itemId: string, text: string) => {
    const updated = checklistItems.map(item => 
      item.id === itemId ? { ...item, text } : item
    );
    setChecklistItems(updated);
    if (contentTimer.current) clearTimeout(contentTimer.current);
    contentTimer.current = setTimeout(() => saveChanges({ checklistItems: updated }), 1500);
  };

  const toggleNoteMode = (checklistMode: boolean) => {
    sensory.play("pop");
    setIsChecklist(checklistMode);
    saveChanges({ isChecklist: checklistMode });
  };

  // REACTION EMISSION
  const toggleReaction = (emojiId: string) => {
    if (!user?.uid) return;
    sensory.play("sparkle");
    const currentEmoji = reactions[user.uid];
    const updatedReactions = { ...reactions };
    if (currentEmoji === emojiId) {
      delete updatedReactions[user.uid];
    } else {
      updatedReactions[user.uid] = emojiId;
    }
    setReactions(updatedReactions);
    saveChanges({ reactions: updatedReactions });
  };

  // DELETE NOTE WITHOUT WINDOW.CONFIRM HANG
  const executeDelete = async () => {
    if (!roomId) return;
    sensory.play("pop");
    setShowDeleteModal(false);
    onClose();
    await deleteDoc(doc(db, "pairs", roomId, "notes", noteId));
  };

  const flushSaves = () => {
    if (titleTimer.current) { clearTimeout(titleTimer.current); saveChanges({ title: localTitle }); }
    if (contentTimer.current) { clearTimeout(contentTimer.current); saveChanges({ content: localContent }); }
  };

  // LDR Preset Prefilling Templates for beautiful speed
  const applyLdrTemplate = (type: string) => {
    sensory.play("sparkle");
    let prefills: Partial<Note> = {};
    if (type === "visit") {
      prefills = {
        title: "✈️ Packing for our NEXT Visit!",
        isChecklist: true,
        categoryTag: "Future Plans",
        colorId: "amber",
        checklistItems: [
          { id: "v1", text: "Phone Chargers & Double Travel Adapters", completed: false },
          { id: "v2", text: "Physical Printed Flight / Train Tickets", completed: false },
          { id: "v3", text: "Comfy clothing for the travel journey", completed: false },
          { id: "v4", text: "A cute handwritten love letter", completed: false },
          { id: "v5", text: "Gifts / Surprise Treats we bought", completed: false },
          { id: "v6", text: "Lover's favorite perfume or cologne", completed: false },
        ]
      };
    } else if (type === "bucket") {
      prefills = {
        title: "✨ Our Virtual & Offline Bucket List",
        isChecklist: true,
        categoryTag: "Bucket List",
        colorId: "purple",
        checklistItems: [
          { id: "b1", text: "Watch Sunset together on raw FaceTime", completed: false },
          { id: "b2", text: "Cook the exact same pizza recipe online", completed: false },
          { id: "b3", text: "Take a romantic photo under the stars", completed: false },
          { id: "b4", text: "Go to a museum together in real life", completed: false },
          { id: "b5", text: "Build a cozy pillow fort on visit day", completed: false },
        ]
      };
    } else if (type === "appreciation") {
      prefills = {
        title: "💖 Things I Deeply Admire About You",
        isChecklist: false,
        categoryTag: "Love Prompt",
        colorId: "rose",
        content: "1. Your laugh instantly brightens up my whole week.\n2. How you support me during stressful work hours.\n3. The lovely late-night phone conversations we share.\n4. You have the kindest soul I've ever encountered.\n"
      };
    }

    setLocalTitle(prefills.title || "");
    if (prefills.content !== undefined) setLocalContent(prefills.content);
    if (prefills.isChecklist !== undefined) setIsChecklist(prefills.isChecklist);
    if (prefills.checklistItems !== undefined) setChecklistItems(prefills.checklistItems);
    if (prefills.categoryTag !== undefined) setCategoryTag(prefills.categoryTag);
    if (prefills.colorId !== undefined) setColorId(prefills.colorId);

    saveChanges(prefills);
  };

  const customBg = colorId === "default" 
    ? "bg-bg" 
    : NOTE_COLORS.find(c => c.id === colorId)?.class.split(" ")[0].replace("/10", "/30");

  const hasEmptyContent = !localTitle && !localContent && checklistItems.length === 0;

  return (
    <motion.div
       initial={{ opacity: 0, scale: 0.95 }}
       animate={{ opacity: 1, scale: 1 }}
       exit={{ opacity: 0, scale: 0.95 }}
       transition={{ duration: 0.2 }}
       className={cn("flex-1 flex flex-col h-full w-full absolute inset-0 z-20 transition-colors duration-500", customBg)}
    >
       {/* Top action bar */}
       <div className="flex items-center justify-between p-4 pt-12 relative z-10 bg-gradient-to-b from-black/5 to-transparent">
          <motion.button
             whileTap={{ scale: 0.95 }}
             onClick={() => { sensory.play("pop"); flushSaves(); onClose(); }}
             className="w-10 h-10 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center text-text"
          >
             <ChevronLeft size={24} />
          </motion.button>
          
          <div className="flex items-center gap-2">
             {/* Toggle List/Text */}
             <div className="flex bg-black/5 dark:bg-white/10 p-0.5 rounded-full mr-2">
               <button
                 onClick={() => toggleNoteMode(false)}
                 className={cn("p-1.5 rounded-full transition-all text-xs flex items-center gap-1", !isChecklist ? "bg-card text-text shadow-sm" : "text-text/55")}
               >
                 <FileText size={14} />
               </button>
               <button
                 onClick={() => toggleNoteMode(true)}
                 className={cn("p-1.5 rounded-full transition-all text-xs flex items-center gap-1", isChecklist ? "bg-card text-text shadow-sm" : "text-text/55")}
               >
                 <ListTodo size={14} />
               </button>
             </div>

             <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={togglePin}
               className={cn("w-10 h-10 rounded-full flex items-center justify-center", pinned ? "bg-blue-500 text-white shadow-md" : "text-text/60 hover:bg-black/5")}
             >
               <Pin size={20} className={pinned ? "fill-current" : ""} />
             </motion.button>
             <motion.button
               whileTap={{ scale: 0.9 }}
               onClick={() => { sensory.play("pop"); setShowDeleteModal(true); }}
               className="w-10 h-10 rounded-full flex items-center justify-center text-red-500 hover:bg-black/5"
             >
               <Trash2 size={20} />
             </motion.button>
          </div>
       </div>

       {/* Editor Scrollable */}
       <div className="flex-1 flex flex-col p-6 pt-2 overflow-y-auto no-scrollbar relative z-10">
           
           {/* Tag Pill Box selector inside notes */}
           <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 py-1">
             {CATEGORIES.map(t => (
               <button
                 key={t.id}
                 onClick={() => handleCategorySelect(t.id)}
                 className={cn(
                   "text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-full transition-all shrink-0",
                   categoryTag === t.id ? t.color + " border-current border" : "bg-card/40 text-text/50"
                 )}
               >
                 {t.label}
               </button>
             ))}
           </div>

           {/* LDR Templates Helper Carousel if Note has absolutely no text or checklists yet */}
           {hasEmptyContent && (
             <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-blue-500/10 border border-blue-500/20 rounded-3xl p-5 mb-6 text-left"
             >
               <h3 className="text-xs font-bold uppercase tracking-wider text-blue-500 mb-1 flex items-center gap-1.5">
                 <Sparkles size={12} /> Setup an Interactive LDR Template
               </h3>
               <p className="text-xs text-text/70 mb-3">
                 Start immediately with an interactive packing, virtual dates or love letters prompt!
               </p>
               <div className="flex flex-col gap-2">
                 <button
                   onClick={() => applyLdrTemplate("visit")}
                   className="w-full bg-card hover:bg-card/80 border border-border text-xs font-bold p-2.5 rounded-2xl flex items-center gap-2 text-text transition-all text-left"
                 >
                   <Plane size={14} className="text-amber-500" /> NEXT Visit Packing checklist
                 </button>
                 <button
                   onClick={() => applyLdrTemplate("bucket")}
                   className="w-full bg-card hover:bg-card/80 border border-border text-xs font-bold p-2.5 rounded-2xl flex items-center gap-2 text-text transition-all text-left"
                 >
                   <Compass size={14} className="text-purple-500" /> Shared LDR Bucket List
                 </button>
                 <button
                   onClick={() => applyLdrTemplate("appreciation")}
                   className="w-full bg-card hover:bg-card/80 border border-border text-xs font-bold p-2.5 rounded-2xl flex items-center gap-2 text-text transition-all text-left"
                 >
                   <Heart size={14} className="text-rose-500" /> Appreciation Affirmation Draft
                 </button>
               </div>
             </motion.div>
           )}

           <input
             type="text"
             value={localTitle}
             onChange={handleTitleChange}
             onBlur={() => saveChanges({ title: localTitle })}
             placeholder="Title"
             className="w-full text-2xl font-bold bg-transparent text-text border-none focus:outline-none focus:ring-0 placeholder-text/30 mb-4 font-display"
           />

           {/* Checklist Mode or Plain Text Mode */}
           {isChecklist ? (
             <div className="flex-1 flex flex-col gap-2">
               {checklistItems.map((item) => (
                 <motion.div 
                   key={item.id} 
                   layoutId={item.id}
                   className="flex items-center gap-3 bg-card/40 border border-border/40 p-2 rounded-2xl shadow-inner"
                 >
                   <button
                     onClick={() => toggleChecklistItem(item.id)}
                     className={cn(
                       "w-6 h-6 rounded-lg border flex items-center justify-center text-white transition-all",
                       item.completed ? "bg-blue-500 border-blue-500" : "border-text/30 bg-transparent hover:border-blue-500"
                     )}
                   >
                     {item.completed && <Check size={14} />}
                   </button>
                   <input
                     type="text"
                     placeholder="Item summary"
                     value={item.text}
                     onChange={(e) => handleChecklistTextChange(item.id, e.target.value)}
                     className={cn(
                       "flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-text leading-tight",
                       item.completed && "line-through text-text/40"
                     )}
                   />
                   <button
                     onClick={() => removeChecklistItem(item.id)}
                     className="text-text/30 hover:text-red-500 font-bold p-1 mr-1"
                   >
                     <X size={16} />
                   </button>
                 </motion.div>
               ))}
               <button
                 onClick={addChecklistItem}
                 className="flex items-center justify-center gap-2 border border-dashed border-border/80 text-xs font-bold p-3 text-text/60 hover:text-text rounded-2xl bg-card/20 transition-all mt-2"
               >
                 <Plus size={16} /> Add new checklist item
               </button>
             </div>
           ) : (
             <textarea
               value={localContent}
               onChange={handleContentChange}
               onBlur={() => saveChanges({ content: localContent })}
               placeholder="Write down some sweet notes, memories, logs..."
               className="w-full flex-1 text-lg leading-relaxed bg-transparent text-text/90 border-none focus:outline-none focus:ring-0 resize-none no-scrollbar placeholder-text/30 min-h-[250px]"
             />
           )}
       </div>

       {/* Emojis Reaction Quick bar */}
       <div className="px-6 py-2 bg-black/5 dark:bg-white/5 border-t border-border/10 flex flex-col justify-center items-center gap-1.5 relative z-10">
         <span className="text-[10px] font-bold uppercase tracking-widest text-text/40 mb-1">Send a Reaction</span>
         <div className="flex gap-4">
           {REACTION_EMOJIS.map(emoji => {
             const senderReaction = Object.entries(reactions).find(([uid, emojiId]) => uid === user?.uid && emojiId === emoji.id);
             return (
               <motion.button
                 key={emoji.id}
                 whileHover={{ scale: 1.2 }}
                 whileTap={{ scale: 0.9 }}
                 onClick={() => toggleReaction(emoji.id)}
                 className={cn(
                   "text-2xl p-1.5 rounded-full transition-all relative",
                   senderReaction ? "bg-blue-500/20 ring-2 ring-blue-500" : "hover:bg-black/5"
                 )}
               >
                 {emoji.char}
                 {/* Count Reacted */}
                 {Object.values(reactions).filter(v => v === emoji.id).length > 0 && (
                   <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black w-3.5 h-3.5 rounded-full flex items-center justify-center border border-white">
                     {Object.values(reactions).filter(v => v === emoji.id).length}
                   </span>
                 )}
               </motion.button>
             );
           })}
         </div>
       </div>

       {/* Color Select Footer */}
       <div className="p-4 pb-8 flex items-center justify-center gap-3 bg-black/10 dark:bg-white/10 backdrop-blur-md border-t border-border/10 relative z-10">
          {NOTE_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => handleColorSelect(c.id)}
              className={cn(
                "w-8 h-8 rounded-full border-2 flex items-center justify-center transition-transform",
                c.class,
                colorId === c.id ? "scale-125 border-text/50 shadow-md" : "border-transparent hover:scale-110"
              )}
            >
              {colorId === c.id && <Check size={14} className="text-text mix-blend-difference opacity-80" />}
            </button>
          ))}
       </div>

       {/* CUSTOM POPUP CONFIRM DELETE MODAL (no window.confirm block) */}
       <AnimatePresence>
         {showDeleteModal && (
           <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowDeleteModal(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 15 }}
                className="bg-card w-full max-w-sm rounded-[32px] p-6 border border-border text-center shadow-2xl relative z-10"
              >
                <div className="w-16 h-16 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center mx-auto mb-4">
                  <Trash size={28} />
                </div>
                <h3 className="text-xl font-bold text-text mb-2">Delete this Note?</h3>
                <p className="text-sm text-text/60 mb-6">
                  Are you absolutely sure you want to delete this note? This action is permanent and cannot be undone.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="flex-1 py-3 px-4 rounded-2xl bg-black/5 dark:bg-white/10 text-text/80 font-bold hover:bg-black/10 dark:hover:bg-white/20 transition-all text-xs"
                  >
                    Keep Note
                  </button>
                  <button
                    onClick={executeDelete}
                    className="flex-1 py-3 px-4 rounded-2xl bg-rose-500 text-white font-bold hover:bg-rose-600 shadow-md shadow-rose-500/30 transition-all text-xs"
                  >
                    Delete Forever
                  </button>
                </div>
              </motion.div>
           </div>
         )}
       </AnimatePresence>
    </motion.div>
  );
}
