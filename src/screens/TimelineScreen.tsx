import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Image as ImageIcon,
  FileText,
  Upload,
  X,
  Loader2,
  Calendar,
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

function TimelineCard({ entry, month, deleteEntry }: { entry: TimelineEntry, month: string, deleteEntry: any }) {
  const [decryptedContent, setDecryptedContent] = useState(entry.type === 'photo' ? '' : entry.content);
  const [decryptedCaption, setDecryptedCaption] = useState(entry.caption || '');

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

  return (
    <div className="flex gap-4 pl-12 relative group">
      {/* Timeline Node */}
      <div className="absolute left-[15px] top-8 w-2 h-2 rounded-full bg-primary ring-4 ring-bg shadow-sm z-10" />

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex-1 group-hover:shadow-md transition-all">
        {entry.type === "photo" ? (
          <>
            <div className="w-full aspect-square bg-black/5 relative overflow-hidden">
              <img
                src={decryptedContent}
                alt={decryptedCaption}
                className="w-full h-full object-cover"
              />
              {entry.stickers?.map((sticker) => (
                <div
                  key={sticker.id}
                  className="absolute drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)] pointer-events-none select-none"
                  style={{
                    left: `${sticker.x}%`,
                    top: `${sticker.y}%`,
                    transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                    width: "80px",
                    height: "80px",
                  }}
                >
                  {sticker.emoji.startsWith("data:") ? (
                    <img
                      src={sticker.emoji}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <span className="text-5xl">
                      {sticker.emoji}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {decryptedCaption && (
              <div className="p-4 bg-card border-t border-border">
                <p className="text-sm font-medium text-text">
                  {decryptedCaption}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="p-5 bg-card relative overflow-hidden">
            <div className="absolute -right-4 -top-4 text-primary/5 rotate-12">
              <FileText size={100} />
            </div>
            <p className="text-lg font-serif italic text-text/80 relative z-10">
              "{decryptedContent}"
            </p>
          </div>
        )}

        <div className="px-4 py-2 bg-text/5 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-widest text-text/40">
            {entry.date &&
              (() => {
                const d = new Date(entry.date);
                return isNaN(d.getTime()) ? "" : d.getDate();
              })()}{" "}
            {month.split(" ")[0]}
          </span>
          <button
            onClick={(e) => deleteEntry(entry.id, e)}
            className="text-rose text-[10px] font-bold uppercase hover:underline opacity-50 hover:opacity-100 transition-opacity"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export function TimelineScreen(_props: {}) {
  const { setView, roomId, user, timelineEntries, babyEvolution } =
    useAppStore();
  const [showComposer, setShowComposer] = useState(false);
  const [composerType, setComposerType] = useState<"photo" | "note">("photo");
  const [showBabies, setShowBabies] = useState(false);
  const [localBabyMemories, setLocalBabyMemories] = useState<TimelineEntry[]>(
    [],
  );

  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [composerStickers, setComposerStickers] = useState<TimelineSticker[]>(
    [],
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
    if (composerType === "note" && !caption.trim()) return;

    setIsUploading(true);
    sensory.tap();

    try {
      let contentUrl = caption.trim();

      if (composerType === "photo" && file) {
        // Convert File to Data URL
        const rawDataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });

        // Compress the image locally for free Firestore storage
        contentUrl = await compressImage(rawDataUrl, 800, 0.6); // Compress to ~800px width

        // Firestore limitation is 1MB. Base64 is roughly 33% larger than binary.
        // We ensure it is less than 950KB string length (approx).
        if (contentUrl.length > 950_000) {
          alert(
            "Sorry, the image size is still too large even after compression. Please pick a simpler/smaller photo.",
          );
          setIsUploading(false);
          return;
        }
      }

      const entryData: Omit<TimelineEntry, "id"> = {
        type: composerType,
        content: await encryptData(contentUrl),
        caption: composerType === "photo" ? await encryptData(caption.trim()) : undefined,
        date: date,
        createdAt: serverTimestamp(),
        createdBy: user.uid,
        stickers: composerType === "photo" ? composerStickers : [],
      };

      await addDoc(collection(db, "pairs", roomId, "timeline"), entryData);

      // Reset
      setShowComposer(false);
      setFile(null);
      setPreview(null);
      setCaption("");
      setDate(new Date().toISOString().split("T")[0]);
      setUploadProgress(0);
      setComposerStickers([]);
      sensory.play("pop");
    } finally {
      setIsUploading(false);
    }
  };

  // Listen for Live Baby Memories
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(
      collection(db, "pairs", roomId, "babyMemories"),
      (snap) => {
        const memories = snap.docs.map((doc) => {
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
      },
    );
    return () => unsub();
  }, [roomId]);

  const deleteEntry = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!roomId) return;
    // Removed window.confirm because it is blocked in iframes
    sensory.play("pop");
    try {
      await deleteDoc(doc(db, "pairs", roomId, "timeline", id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddSticker = (emoji: string) => {
    sensory.tap();
    setComposerStickers((prev) => [
      ...prev,
      {
        id: Math.random().toString(),
        emoji,
        x: 40 + Math.random() * 20, // center-ish
        y: 40 + Math.random() * 20,
        rotation: (Math.random() - 0.5) * 40,
        scale: 1 + Math.random() * 0.5,
      },
    ]);
  };

  const handleDragEnd = (id: string, info: any) => {
    if (!previewContainerRef.current) return;
    const rect = previewContainerRef.current.getBoundingClientRect();
    const xPct = ((info.point.x - rect.left) / rect.width) * 100;
    const yPct = ((info.point.y - rect.top) / rect.height) * 100;

    setComposerStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, x: xPct, y: yPct } : s)),
    );
  };

  // Combined Entries
  const allEntries = [...(timelineEntries || [])];
  if (showBabies) {
    allEntries.push(...localBabyMemories);
  }

  // Group entries by month-year
  const groupedEntries = allEntries.reduce(
    (acc: Record<string, TimelineEntry[]>, entry) => {
      if (!entry || !entry.date) return acc;
      const d = new Date(entry.date);
      if (isNaN(d.getTime())) return acc;
      const key = d.toLocaleString("default", {
        month: "long",
        year: "numeric",
      });
      if (!acc[key]) acc[key] = [];
      acc[key].push(entry);
      return acc;
    },
    {},
  );

  // Sort groups descending
  const sortedMonths = Object.keys(groupedEntries).sort((a, b) => {
    const timeA = new Date(a).getTime();
    const timeB = new Date(b).getTime();
    if (isNaN(timeA) || isNaN(timeB)) return 0;
    return timeB - timeA;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col w-full bg-bg relative pt-12 pb-24 min-h-0"
    >
      {/* Header */}
      <header className="px-5 mb-6 relative z-10 flex justify-between items-center bg-bg/80 backdrop-blur-md sticky top-0 py-4 -mt-12">
        <button
          onClick={() => useAppStore.getState().setView("home")}
          className="w-10 h-10 rounded-xl bg-text/5 flex items-center justify-center active:scale-95 transition-transform shrink-0"
        >
          <ArrowLeft size={20} className="text-text" />
        </button>
        <h1 className="text-xl font-display text-text font-bold text-center flex-1">
          Scrapbook 📸
        </h1>
        <button
          onClick={() => setShowBabies(!showBabies)}
          className={cn(
            "px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest transition-all shrink-0",
            showBabies
              ? "bg-primary text-white shadow-lg shadow-primary/20"
              : "bg-card border border-border text-text/20",
          )}
        >
          {showBabies ? "👶 Babies On" : "👶 Show Babies"}
        </button>
      </header>

      {timelineEntries.length === 0 ? (
        <div className="px-5 py-20 flex flex-col items-center text-center opacity-50">
          <div className="w-24 h-24 bg-card border border-border rounded-full flex items-center justify-center shadow-inner mb-6">
            <ImageIcon size={40} className="text-text/30" />
          </div>
          <h2 className="text-lg font-display text-text mb-2">
            Your timeline is empty
          </h2>
          <p className="text-sm font-medium text-text/50">
            Add your first memory together! A photo from your first date or a
            sweet note.
          </p>
        </div>
      ) : (
        <div className="px-5 relative">
          {/* Vertical Line */}
          <div className="absolute left-[39px] top-4 bottom-0 w-[2px] bg-gradient-to-b from-primary/30 via-primary/10 to-transparent" />

          <div className="space-y-10 pb-20">
            {sortedMonths.map((month) => (
              <div key={month} className="relative z-10">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0 border border-primary/20 shadow-sm z-10 text-primary">
                    <Calendar size={18} />
                  </div>
                  <h2 className="text-sm font-bold uppercase tracking-widest text-text/60 bg-bg/90 px-2 py-0.5 rounded-full">
                    {month}
                  </h2>
                </div>

                <div className="space-y-8">
                  {groupedEntries[month]
                    .sort((a, b) => {
                      const timeA = new Date(a.date).getTime();
                      const timeB = new Date(b.date).getTime();
                      if (isNaN(timeA) || isNaN(timeB)) return 0;
                      return timeB - timeA;
                    })
                    .map((entry) => (
                      <TimelineCard key={entry.id} entry={entry} month={month} deleteEntry={deleteEntry} />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Floating Add Button */}
      <button
        onClick={() => {
          sensory.play("pop");
          setShowComposer(true);
        }}
        className="fixed bottom-8 right-6 w-14 h-14 bg-primary text-white rounded-full flex items-center justify-center shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:scale-105 active:scale-95 transition-all z-40"
      >
        <Plus size={24} />
      </button>

      {/* Composer Modal */}
      <AnimatePresence>
        {showComposer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-text/30 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-5"
            onClick={() => !isUploading && setShowComposer(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-card w-full max-w-md sm:rounded-3xl rounded-t-3xl h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-bg/50 backdrop-blur-md">
                <h2 className="text-lg font-display font-bold text-text">
                  New Memory 📸
                </h2>
                <button
                  disabled={isUploading}
                  onClick={() => setShowComposer(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-text/5 text-text/40 hover:text-text hover:bg-text/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 pb-32">
                <div className="flex gap-2 p-1 bg-text/5 rounded-xl mb-6">
                  <button
                    onClick={() => setComposerType("photo")}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2",
                      composerType === "photo"
                        ? "bg-card shadow-sm text-primary"
                        : "text-text/40 hover:text-text",
                    )}
                  >
                    <ImageIcon size={14} /> Photo
                  </button>
                  <button
                    onClick={() => setComposerType("note")}
                    className={cn(
                      "flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-colors flex items-center justify-center gap-2",
                      composerType === "note"
                        ? "bg-card shadow-sm text-primary"
                        : "text-text/40 hover:text-text",
                    )}
                  >
                    <FileText size={14} /> Note
                  </button>
                </div>

                {composerType === "photo" ? (
                  <div className="space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />

                    <div
                      ref={previewContainerRef}
                      onClick={() => !preview && fileInputRef.current?.click()}
                      className={cn(
                        "w-full aspect-square rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center gap-3 cursor-pointer overflow-hidden relative group transition-colors",
                        !preview &&
                          "hover:border-primary/50 hover:bg-primary/5",
                      )}
                    >
                      {preview ? (
                        <>
                          <img
                            src={preview}
                            alt="Preview"
                            className="w-full h-full object-cover pointer-events-none"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm pointer-events-none">
                            Drag stickers around!
                          </div>
                          {composerStickers.map((sticker) => (
                            <motion.div
                              key={sticker.id}
                              drag
                              dragConstraints={previewContainerRef}
                              dragElastic={0}
                              dragMomentum={false}
                              onDragEnd={(_, info) =>
                                handleDragEnd(sticker.id, info)
                              }
                              className="absolute drop-shadow-[0_4px_8px_rgba(0,0,0,0.15)] cursor-grab active:cursor-grabbing touch-none select-none w-20 h-20"
                              style={{
                                left: `${sticker.x}%`,
                                top: `${sticker.y}%`,
                                transform: `translate(-50%, -50%) rotate(${sticker.rotation}deg) scale(${sticker.scale})`,
                              }}
                            >
                              {sticker.emoji.startsWith("data:") ? (
                                <img
                                  src={sticker.emoji}
                                  className="w-full h-full object-contain pointer-events-none"
                                  draggable={false}
                                />
                              ) : (
                                <span className="text-5xl pointer-events-none">
                                  {sticker.emoji}
                                </span>
                              )}
                            </motion.div>
                          ))}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 backdrop-blur-md hover:bg-black/70"
                          >
                            <ImageIcon size={16} />
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                            <Upload size={24} />
                          </div>
                          <span className="text-sm font-semibold text-text/40">
                            Tap to upload a photo
                          </span>
                        </>
                      )}
                    </div>

                    {preview && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text/40 ml-1">
                          Add Stickers
                        </label>
                        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 px-1">
                          {STICKERS.map((stickerUrl, i) => (
                            <button
                              key={i}
                              onClick={() => handleAddSticker(stickerUrl)}
                              className="w-14 h-14 shrink-0 bg-bg border border-border rounded-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform shadow-sm overflow-hidden p-2"
                            >
                              <img
                                src={stickerUrl}
                                className="w-full h-full object-contain pointer-events-none"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text/40 ml-1">
                        Caption
                      </label>
                      <textarea
                        placeholder="What a beautiful day..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-bg border border-border rounded-xl p-4 min-h-[100px] text-text font-medium outline-none resize-none text-sm placeholder:text-text/20 focus:border-primary/30 transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text/40 ml-1">
                        Your Note
                      </label>
                      <textarea
                        placeholder="I couldn't stop smiling when we..."
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        className="w-full bg-bg border border-border rounded-xl p-5 min-h-[250px] text-text font-serif italic text-lg outline-none resize-none placeholder:text-text/20 focus:border-primary/30 transition-colors"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1 mt-6">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-text/40 ml-1">
                    Date of Memory
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-bg border border-border rounded-xl p-4 text-sm font-semibold text-text outline-none focus:border-primary/30 transition-colors"
                  />
                </div>
              </div>

              <div className="absolute bottom-0 inset-x-0 p-5 bg-card/90 backdrop-blur-md border-t border-border">
                <button
                  onClick={handleUpload}
                  disabled={
                    isUploading ||
                    (composerType === "photo" && !file) ||
                    (composerType === "note" && !caption.trim())
                  }
                  className="w-full bg-primary text-white py-4 rounded-xl font-bold shadow-md active:scale-95 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...{" "}
                      {composerType === "photo" &&
                        `${Math.round(uploadProgress)}%`}
                    </>
                  ) : (
                    "Save Memory ✨"
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
