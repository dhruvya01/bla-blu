import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Heart,
  MessageCircle,
  Plus,
  X,
  Send,
  Loader2,
  Trash2,
  Music2,
  Volume2,
  VolumeX,
  Video,
  Film,
  LayoutGrid,
} from "lucide-react";
import { useAppStore } from "../store";
import {
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  doc,
  onSnapshot,
  updateDoc,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db, storage } from "../firebase/config";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";

// --- Single Reel Component with play/pause observer integration ---
interface ReelData {
  id: string;
  videoUrl: string;
  caption: string;
  senderId: string;
  senderNickname: string;
  senderAvatar?: string;
  createdAt: any;
  likes?: string[]; // Array of user Uids
  comments?: Array<{
    id: string;
    senderId: string;
    senderNickname: string;
    senderAvatar?: string;
    text: string;
    createdAt: number;
  }>;
  fitMode?: "cover" | "contain" | "card";
  objectPositionX?: number; // 0 to 100 percentage
  objectPositionY?: number; // 0 to 100 percentage
  cardTheme?: string; // name of framing style
}

interface ReelItemProps {
  reel: ReelData;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenComments: (reel: ReelData) => void;
  onLike: (reelId: string, isLiked: boolean) => void;
  onDelete: (reel: ReelData) => void;
  currentUserId: string;
}

// Cloudinary dynamic video optimization parameters injector
function getOptimizedCloudinaryUrl(url: string): string {
  if (!url || !url.includes("cloudinary.com") || url.includes("/f_auto,q_auto,vc_auto/")) {
    return url;
  }
  return url.replace("/video/upload/", "/video/upload/f_auto,q_auto,vc_auto/");
}

function ReelItem({
  reel,
  isActive,
  isMuted,
  onToggleMute,
  onOpenComments,
  onLike,
  onDelete,
  currentUserId,
}: ReelItemProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const backgroundVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isCaching, setIsCaching] = useState(true);
  const isLiked = (reel.likes || []).includes(currentUserId);

  const lastTap = useRef<number>(0);
  const [hearts, setHearts] = useState<{ id: number; x: number; y: number }[]>([]);

  // Dynamic optimize & HTML5 Native Cache API layer
  useEffect(() => {
    let active = true;
    let objectUrl = "";

    const loadVideo = async () => {
      const optimizedUrl = getOptimizedCloudinaryUrl(reel.videoUrl);
      
      if (!("caches" in window)) {
        if (active) {
          setVideoSrc(optimizedUrl);
          setIsCaching(false);
        }
        return;
      }

      try {
        const cache = await caches.open("blablu-reels-cache-v1");
        const cachedResponse = await cache.match(optimizedUrl);

        if (cachedResponse) {
          // Cache Hit! Retrieve blob memory
          const blob = await cachedResponse.blob();
          objectUrl = URL.createObjectURL(blob);
          if (active) {
            setVideoSrc(objectUrl);
            setIsCaching(false);
          }
        } else {
          // Cache Miss! Stream & save simultaneously
          setIsCaching(true);
          const response = await fetch(optimizedUrl);
          if (!response.ok) throw new Error("Failed to load video source");
          
          const responseToCache = response.clone();
          await cache.put(optimizedUrl, responseToCache);

          const blob = await response.blob();
          objectUrl = URL.createObjectURL(blob);
          if (active) {
            setVideoSrc(objectUrl);
            setIsCaching(false);
          }
        }
      } catch (err) {
        console.warn("Cache pipeline failed, streaming directly with optimization", err);
        if (active) {
          setVideoSrc(optimizedUrl);
          setIsCaching(false);
        }
      }
    };

    loadVideo();

    return () => {
      active = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [reel.videoUrl]);

  useEffect(() => {
    if (hearts.length > 0) {
      const timer = setTimeout(() => {
        setHearts((prev) => prev.slice(1));
      }, 900);
      return () => clearTimeout(timer);
    }
  }, [hearts]);

  useEffect(() => {
    if (videoRef.current && videoSrc && !isCaching) {
      if (isActive) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.log("Autoplay failed:", err);
          setIsPlaying(false);
        });
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.play().catch(() => {});
        }
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.pause();
          backgroundVideoRef.current.currentTime = 0;
        }
      }
    }
  }, [isActive, videoSrc, isCaching, reel.fitMode]);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.pause();
        }
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        });
        if (backgroundVideoRef.current) {
          backgroundVideoRef.current.play().catch(() => {});
        }
      }
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Don't intercept sidebar, comments drawer, deletions, or mute buttons
    if (target.closest("button") || target.closest(".action-sidebar")) {
      return;
    }

    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      // Double tap recognized!
      sensory.play("pop");
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setHearts((prev) => [...prev, { id: Date.now() + Math.random(), x, y }]);
      
      // Force user to like the Reel
      if (!isLiked) {
        onLike(reel.id, false);
      }
    } else {
      // Single tap
      handleVideoClick();
    }
    lastTap.current = now;
  };

  const hasBackgroundBackdrop = reel.fitMode === "contain";
  const renderAsPolaroidCard = reel.fitMode === "card";
  const fitStyle = reel.fitMode === "card" ? "contain" : (reel.fitMode || "cover");

  return (
    <div 
      onClick={handleContainerClick}
      className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-zinc-950 cursor-pointer select-none overflow-hidden"
    >
      {/* Blurred duplication background backdrop for landscape videos styled Contain */}
      {videoSrc && !isCaching && hasBackgroundBackdrop && (
        <video
          ref={backgroundVideoRef}
          src={videoSrc}
          loop
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover filter blur-3xl opacity-50 scale-110 pointer-events-none"
        />
      )}

      {/* Main Video presentation viewport */}
      {videoSrc && !isCaching ? (
        renderAsPolaroidCard ? (
          <div className={cn(
            "z-10 w-[86%] aspect-[3/4] rounded-3xl flex flex-col p-4 shadow-2xl relative border",
            reel.cardTheme === 'romantic-pink' && "bg-gradient-to-br from-pink-100 to-rose-50 border-pink-200/50",
            reel.cardTheme === 'sunset-dream' && "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50",
            reel.cardTheme === 'lavender-mist' && "bg-gradient-to-br from-purple-100 to-indigo-50 border-indigo-200/50",
            reel.cardTheme === 'cherry-blossom' && "bg-stone-50 border-stone-200/60"
          )}>
            <div className="text-center font-sans uppercase tracking-widest text-[9px] font-extrabold text-text/40 mb-2.5 flex items-center justify-center gap-1">
               ✨ Memory Frame ✨
            </div>
            
            <div className="flex-1 bg-black rounded-2xl overflow-hidden relative flex items-center justify-center shadow-inner">
               <video
                 ref={videoRef}
                 src={videoSrc}
                 loop
                 playsInline
                 muted={isMuted}
                 className="w-full h-full object-contain"
               />
            </div>

            <div className="mt-3.5 pb-1 text-center flex flex-col items-center justify-center">
               <Heart size={14} className="fill-rose-500 text-rose-500 animate-pulse mb-1" />
               <span className="font-display font-black text-[11px] text-text/75 truncate w-full italic px-2">
                  {reel.caption}
               </span>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            src={videoSrc}
            loop
            playsInline
            muted={isMuted}
            style={{
              objectFit: fitStyle,
              objectPosition: `${reel.objectPositionX !== undefined ? reel.objectPositionX : 50}% ${reel.objectPositionY !== undefined ? reel.objectPositionY : 50}%`
            }}
            className="w-full h-full max-h-[100dvh]"
          />
        )
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-3">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs text-white/40 tracking-wider font-light">Caching beautiful moment...</p>
        </div>
      )}

      {/* Double tap heart explosion particles */}
      <AnimatePresence>
        {hearts.map((h) => (
          <motion.div
            key={h.id}
            initial={{ scale: 0, opacity: 0, y: h.y - 20 }}
            animate={{ 
              scale: [0, 1.4, 1], 
              opacity: [0, 1, 1, 0],
              y: h.y - 100,
              rotate: [0, Math.random() > 0.5 ? 12 : -12, 0]
            }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            style={{ left: h.x - 24, top: h.y - 24 }}
            className="absolute z-30 pointer-events-none text-rose drop-shadow-[0_8px_16px_rgba(244,63,94,0.5)]"
          >
            <Heart size={48} className="fill-rose text-rose" />
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Tap play/pause indicator overlay */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.7 }}
            exit={{ scale: 1.5, opacity: 0 }}
            className="absolute z-10 pointer-events-none bg-black/45 p-4 rounded-full"
          >
            <div className="w-8 h-8 flex items-center justify-center border-2 border-white rounded-full">
              <div className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-[12px] border-l-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mute button overlay on top right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMute();
        }}
        className="absolute top-20 right-4 z-20 bg-black/40 hover:bg-black/60 p-2.5 rounded-full backdrop-blur-md text-white transition-all active:scale-90"
      >
        {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
      </button>

      {/* Right-side actions drawer overlay */}
      <div className="absolute right-4 bottom-28 z-20 flex flex-col items-center gap-6">
        {/* Profile Avatar of poster */}
        <div className="flex flex-col items-center">
          <div className="w-11 h-11 rounded-full border-2 border-primary/80 overflow-hidden bg-card shadow-lg">
            {reel.senderAvatar ? (
              <img
                src={reel.senderAvatar}
                alt={reel.senderNickname}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-primary/20 text-primary font-bold flex items-center justify-center text-sm">
                {reel.senderNickname[0]?.toUpperCase()}
              </div>
            )}
          </div>
        </div>

        {/* Like Button */}
        <div className="flex flex-col items-center">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={(e) => {
              e.stopPropagation();
              onLike(reel.id, isLiked);
            }}
            className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center transition-all bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-lg text-white",
              isLiked && "text-rose bg-rose/10 border border-rose/20"
            )}
          >
            <Heart
              size={24}
              className={cn(isLiked ? "fill-rose text-rose" : "text-white")}
            />
          </motion.button>
          <span className="text-white text-xs font-bold mt-1 shadow-sm drop-shadow">
            {(reel.likes || []).length}
          </span>
        </div>

        {/* Comment Button */}
        <div className="flex flex-col items-center">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenComments(reel);
            }}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md hover:bg-black/60 shadow-lg text-white"
          >
            <MessageCircle size={24} />
          </button>
          <span className="text-white text-xs font-bold mt-1 shadow-sm drop-shadow">
            {(reel.comments || []).length}
          </span>
        </div>

        {/* Delete button for author/both */}
        {reel.senderId === currentUserId && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(reel);
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-black/40 backdrop-blur-md hover:bg-rose-500/80 hover:text-white text-white/80 active:scale-95 transition-all shadow-lg"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>

      {/* Bottom info banner (sender, caption, soundtrack) */}
      <div className="absolute left-4 right-20 bottom-8 z-10 flex flex-col gap-2.5 text-white bg-gradient-to-t from-black/60 via-black/20 to-transparent p-4 rounded-2xl pointer-events-none">
        <div className="flex items-center gap-2 pointer-events-auto">
          <span className="font-bold text-sm">@{reel.senderNickname}</span>
          <span className="text-[10px] bg-primary/20 text-primary-200 border border-primary/30 px-1.5 py-0.5 rounded font-black uppercase">
            couple reel
          </span>
        </div>
        <p className="text-[11px] text-white/85 font-medium leading-relaxed drop-shadow-sm truncate-2-lines pointer-events-auto max-w-[270px]">
          {reel.caption}
        </p>

        {/* Music scrolling soundtrack replica */}
        <div className="flex items-center gap-2 text-[11px] text-white/80 overflow-hidden w-48 pointer-events-auto">
          {isPlaying ? (
            <div className="flex gap-[1.5px] items-end h-3 w-4 shrink-0 pb-[1px]" title="Playing audio">
              <motion.span animate={{ height: [3, 11, 3] }} transition={{ repeat: Infinity, duration: 0.7, ease: "easeInOut" }} className="w-[2px] bg-primary rounded-full block" />
              <motion.span animate={{ height: [10, 3, 10] }} transition={{ repeat: Infinity, duration: 0.5, ease: "easeInOut" }} className="w-[2px] bg-primary rounded-full block" />
              <motion.span animate={{ height: [4, 9, 4] }} transition={{ repeat: Infinity, duration: 0.6, ease: "easeInOut" }} className="w-[2px] bg-primary rounded-full block" />
              <motion.span animate={{ height: [7, 4, 7] }} transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }} className="w-[2px] bg-primary rounded-full block" />
            </div>
          ) : (
            <Music2 size={12} className="shrink-0 text-white/50" />
          )}
          <span className="whitespace-nowrap animate-marquee tracking-wide font-sans">
            Original audio • {reel.senderNickname}'s sweet memory 💖
          </span>
        </div>
      </div>

      {/* Rotating Vinyl Soundtrack Disk on the absolute bottom-right */}
      <div className="absolute right-4 bottom-20 z-20 pointer-events-none">
        <div 
          className={cn(
            "w-9 h-9 rounded-full bg-zinc-900 border-2 border-zinc-800/80 shadow-lg relative flex items-center justify-center overflow-hidden transition-transform",
            isPlaying ? "animate-spin" : "scale-90 opacity-60"
          )}
          style={{ animationDuration: isPlaying ? "3.5s" : "0s" }}
        >
          {reel.senderAvatar ? (
            <img 
              src={reel.senderAvatar} 
              alt="Avatar" 
              className="w-5 h-5 rounded-full object-cover border border-black/40"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center text-[8px] font-black uppercase text-primary-200">
              {reel.senderNickname[0]}
            </div>
          )}
          {/* Groove concentric borders to look like a true vinyl */}
          <div className="absolute inset-0.5 rounded-full border border-black/10 pointer-events-none" />
          <div className="absolute inset-1.5 rounded-full border border-white/5 pointer-events-none" />
        </div>
      </div>
    </div>
  );
}

// --- Main Reels Page ---
export function ReelsScreen() {
  const setView = useAppStore((state) => state.setView);
  const user = useAppStore((state) => state.user);
  const partner = useAppStore((state) => state.partner);
  const roomId = useAppStore((state) => state.roomId);
  const pair = useAppStore((state) => state.pair);

  const [activeTab, setActiveTab] = useState<"feed" | "profile">("feed");
  const [reels, setReels] = useState<ReelData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Bio custom fields
  const [isEditingBio, setIsEditingBio] = useState(false);
  const [tempBio, setTempBio] = useState("");
  const [isSavingBio, setIsSavingBio] = useState(false);

  // Upload fields
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [chosenVideoUrl, setChosenVideoUrl] = useState("");
  const [fitMode, setFitMode] = useState<"cover" | "contain" | "card">("cover");
  const [objectPositionX, setObjectPositionX] = useState<number>(50);
  const [objectPositionY, setObjectPositionY] = useState<number>(50);
  const [cardTheme, setCardTheme] = useState<string>("romantic-pink");
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Comments state
  const [selectedReel, setSelectedReel] = useState<ReelData | null>(null);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [newComment, setNewComment] = useState("");

  const containerRef = useRef<HTMLDivElement | null>(null);

  // Live collection fetch for Reels subcollection under current couple
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(
      collection(db, "pairs", roomId, "reels"),
      (snap) => {
        const fetched: ReelData[] = [];
        snap.forEach((docSnap) => {
          fetched.push({ id: docSnap.id, ...docSnap.data() } as ReelData);
        });
        // Sort by newest first
        fetched.sort((a, b) => {
          const t1 = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt || 0);
          const t2 = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt || 0);
          return t2 - t1;
        });
        setReels(fetched);
        setIsLoading(false);
      }
    );
    return () => unsub();
  }, [roomId]);

  // Track vertical snap-scrolling active visible index
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollY = container.scrollTop;
    const height = container.clientHeight;
    if (height > 0) {
      const idx = Math.round(scrollY / height);
      if (idx !== activeIdx && idx >= 0 && idx < reels.length) {
        setActiveIdx(idx);
      }
    }
  };

  // Like / Unlike action
  const handleLike = async (reelId: string, isCurrentlyLiked: boolean) => {
    if (!roomId || !user?.uid) return;
    sensory.play("pop");
    try {
      const reelDocRef = doc(db, "pairs", roomId, "reels", reelId);
      await updateDoc(reelDocRef, {
        likes: isCurrentlyLiked ? arrayRemove(user.uid) : arrayUnion(user.uid),
      });
    } catch (err) {
      console.error("Failed to like reel:", err);
    }
  };

  // Delete video and doc
  const handleDeleteReel = async (reel: ReelData) => {
    if (!roomId) return;
    if (!window.confirm("Are you sure you want to delete this Reel? This will permanently delete the backup as well.")) return;

    sensory.tap();
    try {
      // First, trigger Cloudinary Backend Delete
      if (reel.videoUrl && (reel.videoUrl.includes("cloudinary.com") || reel.videoUrl.includes("firebasestorage.googleapis.com"))) {
        try {
            if (reel.videoUrl.includes("firebasestorage.googleapis.com")) {
                await deleteObject(ref(storage, reel.videoUrl));
            } else {
                fetch("/api/cloudinary/delete", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ url: reel.videoUrl }),
                }).catch((err) => console.error("Cloudinary delete failed", err));
            }
        } catch (err) {
            console.error("Storage delete failed", err);
        }
      }

      // Then delete Firestore doc
      await deleteDoc(doc(db, "pairs", roomId, "reels", reel.id));
      sensory.success();
    } catch (e) {
      console.error("Failed to delete reel:", e);
    }
  };

  // Save custom couples bio
  const handleSaveBio = async () => {
    if (!roomId) return;
    setIsSavingBio(true);
    sensory.tap();
    try {
      await updateDoc(doc(db, "pairs", roomId), {
        reelsBio: tempBio,
      });
      setIsEditingBio(false);
      sensory.success();
    } catch (err) {
      console.error("Failed to save bio:", err);
    } finally {
      setIsSavingBio(false);
    }
  };

  // Select video for uploading
  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      alert("Please select a valid video file.");
      return;
    }

    setIsUploading(true);
    sensory.play("swoosh");

    try {
      const videoRef = ref(storage, `reels/${roomId}/${Date.now()}_${file.name}`);
      await uploadBytes(videoRef, file);
      const url = await getDownloadURL(videoRef);
      if (url) {
        setChosenVideoUrl(url);
        setFitMode("cover");
        setObjectPositionX(50);
        setObjectPositionY(50);
        setCardTheme("romantic-pink");
        setShowUploadModal(true);
      } else {
        alert("Upload was not successful. Try again!");
      }
    } catch (err) {
      alert("Uh-oh! Failed uploading video.");
    } finally {
      setIsUploading(false);
    }
  };

  // Share Reel finally
  const handleShareReel = async () => {
    if (!roomId || !user || !chosenVideoUrl) return;
    try {
      await addDoc(collection(db, "pairs", roomId, "reels"), {
        videoUrl: chosenVideoUrl,
        caption: captionText.trim() || "Love is in the air! 💕",
        senderId: user.uid,
        senderNickname: user.nickname || user.name || "Lover",
        senderAvatar: user.avatarUrl || "",
        createdAt: serverTimestamp(),
        likes: [],
        comments: [],
        fitMode: fitMode || "cover",
        objectPositionX: objectPositionX ?? 50,
        objectPositionY: objectPositionY ?? 50,
        cardTheme: cardTheme || "romantic-pink",
      });

      // Clear & Close
      setChosenVideoUrl("");
      setCaptionText("");
      setShowUploadModal(false);
      sensory.success();
    } catch (err) {
      console.error("Sharing reel failed", err);
    }
  };

  // Open Comments drawer
  const handleOpenComments = (reel: ReelData) => {
    setSelectedReel(reel);
    setShowCommentsDrawer(true);
  };

  // Post Comment
  const handlePostComment = async () => {
    if (!roomId || !user || !selectedReel || !newComment.trim()) return;
    sensory.play("pop");

    const commentObj = {
      id: "comment_" + Date.now(),
      senderId: user.uid,
      senderNickname: user.nickname || user.name || "Lover",
      senderAvatar: user.avatarUrl || "",
      text: newComment.trim(),
      createdAt: Date.now(),
    };

    try {
      const reelRef = doc(db, "pairs", roomId, "reels", selectedReel.id);
      await updateDoc(reelRef, {
        comments: arrayUnion(commentObj),
      });

      // Update local copy immediately for instant UI response before firestore listener triggers
      setSelectedReel((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          comments: [...(prev.comments || []), commentObj],
        };
      });

      setNewComment("");
    } catch (e) {
      console.error("Failed to add comment:", e);
    }
  };

  return (
    <div className={cn("flex flex-col h-[100dvh] w-full max-w-full sm:max-w-md mx-auto relative select-none overflow-hidden transition-colors duration-300", activeTab === "profile" ? "bg-bg text-text" : "bg-black text-white")}>
      {/* Hidden file input for vertical video files */}
      <input
        type="file"
        ref={videoInputRef}
        onChange={handleVideoSelect}
        accept="video/*"
        className="hidden"
      />

      {/* Main content split between Tabs */}
      {activeTab === "feed" ? (
        <>
          {/* Header Overlay */}
          <div className="absolute top-0 left-0 right-0 z-30 pt-safe-top px-4 py-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
            <button
              onClick={() => {
                sensory.play("pop");
                setView("home");
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-black/30 backdrop-blur-md text-white border border-white/10 active:scale-95 transition-all"
            >
              <ArrowLeft size={18} />
            </button>

            <h1 className="text-base font-bold font-display uppercase tracking-widest text-white mt-1 drop-shadow-md">
              Couple Reels 🎬
            </h1>

            <button
              onClick={() => videoInputRef.current?.click()}
              disabled={isUploading}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white border border-primary/20 active:scale-95 transition-all shadow-md"
            >
              {isUploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Plus size={18} />
              )}
            </button>
          </div>

          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-black gap-4">
              <Loader2 size={36} className="animate-spin text-primary" />
              <p className="text-sm text-white/50 font-medium">Fetching sweet memories...</p>
            </div>
          ) : reels.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-black gap-5 text-center p-8">
              <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-rose-400">
                <Video size={32} />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">No Reels Shared Yet</h2>
                <p className="text-xs text-white/40 mt-1.5 max-w-xs leading-relaxed">
                  Capture your cutest coordinates, silly dances, or intimate videos and upload your first Reel together!
                </p>
              </div>
              <button
                onClick={() => videoInputRef.current?.click()}
                className="px-6 py-3 bg-primary hover:bg-primary-600 text-white font-bold rounded-full text-xs shadow-lg shadow-primary/20 active:scale-95 transition-all"
              >
                Upload First Video
              </button>
            </div>
          ) : (
            <div
              ref={containerRef}
              onScroll={handleScroll}
              className="flex-1 h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar scroll-smooth relative bg-black"
            >
              {reels.map((reel, index) => (
                <ReelItem
                  key={reel.id}
                  reel={reel}
                  isActive={index === activeIdx}
                  isMuted={isMuted}
                  onToggleMute={() => setIsMuted(!isMuted)}
                  onOpenComments={handleOpenComments}
                  onLike={handleLike}
                  onDelete={handleDeleteReel}
                  currentUserId={user?.uid || ""}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        /* INSTAGRAM-STYLE PROFILE VIEW WITH DYNAMIC APP THEME ADAPTATION */
        <div className="flex-1 flex flex-col bg-bg overflow-hidden animate-fade-in">
          {/* PROFILE TOP HEADER */}
          <div className="pt-safe-top px-4 py-3 flex items-center justify-between border-b border-border bg-card/60 backdrop-blur-md shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  sensory.play("pop");
                  setView("home");
                }}
                className="p-1.5 rounded-full hover:bg-primary/20 text-text active:scale-95 transition-all"
              >
                <ArrowLeft size={20} className="text-text" />
              </button>
              <span className="font-bold text-sm tracking-tight font-display text-text truncate max-w-[140px]">
                {user?.nickname?.toLowerCase() || user?.name?.toLowerCase() || "couple"}_{partner?.nickname?.toLowerCase() || partner?.name?.toLowerCase() || "memories"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploading}
                className="p-1.5 hover:bg-primary/20 rounded-full active:scale-95 transition-all text-text"
              >
                <Plus size={20} className="text-text" />
              </button>
            </div>
          </div>

          {/* PROFILE SUMMARY HERO */}
          <div className="p-5 flex flex-col gap-4 bg-card/30 border-b border-border shadow-sm shrink-0">
            <div className="flex items-center gap-5">
              {/* Overlapping double profile circles */}
              <div className="relative flex items-center justify-center shrink-0 py-1">
                {/* User Story border circle */}
                <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-rose-500 via-purple-600 to-yellow-500 shadow-md relative z-10">
                  <div className="w-full h-full rounded-full border-2 border-bg bg-bg overflow-hidden">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.nickname || user.name || "Me"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black bg-primary text-sm">
                        {(user?.nickname || user?.name || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Partner Story border overlapping circle */}
                <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-rose-500 via-purple-600 to-yellow-500 shadow-md relative z-20 -ml-5 border-l-4 border-bg">
                  <div className="w-full h-full rounded-full border border-bg bg-bg overflow-hidden">
                    {partner?.avatarUrl ? (
                      <img
                        src={partner.avatarUrl}
                        alt={partner.nickname || partner.name || "Partner"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black bg-violet-500 text-sm">
                        {(partner?.nickname || partner?.name || "P")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Instagram-style column statistics */}
              <div className="flex-1 flex justify-around text-center">
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-text">{reels.length}</span>
                  <span className="text-[10px] text-text/60 font-medium font-sans">Posts</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-text">
                    {reels.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0)}
                  </span>
                  <span className="text-[10px] text-text/60 font-medium font-sans">Likes</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-text">
                    {reels.reduce((acc, curr) => acc + (curr.comments?.length || 0), 0)}
                  </span>
                  <span className="text-[10px] text-text/60 font-medium font-sans">Comments</span>
                </div>
              </div>
            </div>

            {/* Profile handle, titles, bios */}
            <div className="relative group/bio">
              <h3 className="font-bold text-xs text-text">
                {user?.nickname || user?.name || "Lover"} & {partner?.nickname || partner?.name || "Partner"} 💑
              </h3>
              <p className="text-[10px] text-text/60 font-medium font-sans mt-0.5">Private Couple Memory Reel Blog</p>
              
              {isEditingBio ? (
                <div className="mt-2.5 flex flex-col gap-2">
                  <textarea
                    value={tempBio}
                    onChange={(e) => setTempBio(e.target.value)}
                    placeholder="Describe your love story, couples goals, silly vows, or special memory moments..."
                    maxLength={160}
                    className="w-full text-[11px] h-16 bg-bg border border-border rounded p-2 text-text placeholder-text/40 focus:outline-none focus:border-primary resize-none font-sans"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditingBio(false)}
                      className="px-2.5 py-1 text-[9px] bg-border/40 text-text/60 rounded hover:text-text hover:bg-border/60 transition-all uppercase font-black"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveBio}
                      disabled={isSavingBio}
                      className="px-2.5 py-1 text-[9px] bg-primary rounded text-white font-black transition-all flex items-center gap-1 uppercase hover:opacity-90 active:scale-95"
                    >
                      {isSavingBio ? <Loader2 size={8} className="animate-spin" /> : null} Save Bio
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 flex items-start gap-1 justify-between">
                  <p className="text-[11px] text-text/80 leading-relaxed max-w-[280px] italic">
                    {pair?.reelsBio || "A private vault of our vertical video snap-scrolls, special dates, laughing fits, and silly dances. 🎬💖"}
                  </p>
                  
                  <button
                    onClick={() => {
                      sensory.play("pop");
                      setTempBio(pair?.reelsBio || "A private vault of our vertical video snap-scrolls, special dates, laughing fits, and silly dances. 🎬💖");
                      setIsEditingBio(true);
                    }}
                    className="p-1 rounded bg-primary/10 text-primary hover:text-white hover:bg-primary/80 active:scale-90 transition-all ml-2 shrink-0 self-start"
                    title="Edit Couples Bio"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                </div>
              )}
            </div>

            {/* Actions tab */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => videoInputRef.current?.click()}
                className="flex-1 py-2 bg-primary hover:opacity-95 active:scale-98 transition-all rounded-lg text-[11px] font-extrabold text-white flex items-center justify-center gap-1.5 shadow-sm shadow-primary/10"
              >
                <Plus size={14} /> Upload New Memory
              </button>
            </div>
          </div>

          {/* GRID OF REEL VIDEOS */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-bg p-2 shrink-0 min-h-0">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : reels.length === 0 ? (
              <div className="py-24 flex flex-col items-center justify-center text-center gap-3 text-text/40">
                <LayoutGrid size={32} strokeWidth={1} />
                <p className="text-xs font-semibold">No Reels Uploaded Yet</p>
                <p className="text-[10px] text-text/50 max-w-xs px-6 leading-relaxed">
                  Click "+ Upload New Memory" to record your first cute story!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
                {reels.map((reel, idx) => {
                  return (
                    <div
                      key={reel.id}
                      onClick={() => {
                        sensory.play("pop");
                        setActiveIdx(idx);
                        setActiveTab("feed");
                      }}
                      className="aspect-square relative bg-card group cursor-pointer overflow-hidden rounded-xl border border-border shadow-xs active:scale-95 hover:border-primary/55 transition-all"
                    >
                      <video
                        src={getOptimizedCloudinaryUrl(reel.videoUrl) + "#t=0.5"}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover"
                      />
                      {/* Interactive hover icon trigger bar */}
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all">
                        <div className="bg-black/60 p-2 rounded-full text-white">
                          <Film size={14} className="fill-white" />
                        </div>
                      </div>
                      
                      {/* Stat summary count inside miniature visual card */}
                      <div className="absolute bottom-1 right-1 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded flex items-center gap-1 text-[9px] text-white font-extrabold">
                        <Heart size={8} className="fill-rose text-rose" />
                        <span>{(reel.likes || []).length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mini style footer navigation tabs inside ReelsScreen, fully themed with variables */}
      <div className="bg-card/95 border-t border-border/80 py-3 px-16 flex items-center justify-between shrink-0 backdrop-blur-md">
        <button
          onClick={() => {
            sensory.play("pop");
            setActiveTab("feed");
          }}
          className="flex flex-col items-center justify-center gap-1 active:scale-90 transition-all cursor-pointer"
        >
          <Film
            size={22}
            className={cn(
              activeTab === "feed" ? "text-primary stroke-[2.5px]" : "text-text/50 hover:text-text"
            )}
          />
          <span className={cn(
            "text-[8px] uppercase tracking-wider font-extrabold",
            activeTab === "feed" ? "text-primary" : "text-text/50"
          )}>
            Reels
          </span>
        </button>

        <button
          onClick={() => {
            sensory.play("pop");
            setActiveTab("profile");
          }}
          className="flex flex-col items-center justify-center gap-1 active:scale-90 transition-all cursor-pointer"
        >
          <div className={cn(
            "w-6 h-6 rounded-full p-[1.5px] overflow-hidden bg-border transition-all",
            activeTab === "profile" ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 ring-2 ring-primary scale-105" : "hover:scale-105"
          )}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Me"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover pointer-events-none"
              />
            ) : (
              <div className="w-full h-full bg-primary rounded-full flex items-center justify-center text-white text-[9px] font-black uppercase">
                {(user?.nickname || user?.name || "U")[0]}
              </div>
            )}
          </div>
          <span className={cn(
            "text-[8px] uppercase tracking-wider font-extrabold",
            activeTab === "profile" ? "text-primary" : "text-text/50"
          )}>
            Profile
          </span>
        </button>
      </div>

      {/* Upload Progress Overlay */}
      <AnimatePresence>
        {isUploading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-4 text-white"
          >
            <div className="relative flex items-center justify-center">
              <Loader2 size={48} className="animate-spin text-primary" />
              <Heart size={20} className="absolute text-rose animate-pulse" />
            </div>
            <p className="text-sm font-semibold tracking-wide">Uploading video memory...</p>
            <p className="text-[10px] text-white/40 uppercase tracking-widest font-black">Storing securely</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Caption Sharing Dialog modal */}
      <AnimatePresence>
        {showUploadModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-md overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-[32px] border border-border overflow-hidden p-6 text-text shadow-2xl my-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex flex-col">
                  <h3 className="font-extrabold text-lg text-text font-display">New Reel Post</h3>
                  <span className="text-[10px] text-text/40 uppercase tracking-widest font-black font-sans">Visual Positioning Editor</span>
                </div>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1.5 rounded-full hover:bg-neutral-500/10 text-text/50 hover:text-text transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* simulated Live feed screen monitor */}
              <div className="w-full h-64 rounded-2xl bg-black relative overflow-hidden shadow-inner border border-border/80 flex items-center justify-center mb-4">
                {fitMode === "contain" && (
                  <video
                    src={getOptimizedCloudinaryUrl(chosenVideoUrl)}
                    muted
                    playsInline
                    autoPlay
                    loop
                    className="absolute inset-0 w-full h-full object-cover blur-2xl opacity-50 scale-110 pointer-events-none"
                  />
                )}

                {/* Main preview loader elements */}
                <div className="absolute inset-0 z-0 flex items-center justify-center text-text/10 bg-zinc-950 pointer-events-none">
                  <Film size={48} className="animate-pulse" />
                </div>

                {/* Interactive live viewport */}
                <div className="absolute inset-0 w-full h-full z-10 flex items-center justify-center overflow-hidden">
                  {fitMode === "card" ? (
                    <div className={cn(
                      "w-[76%] h-[85%] rounded-2xl flex flex-col p-2.5 shadow-2xl relative border transition-all duration-300",
                      cardTheme === 'romantic-pink' && "bg-gradient-to-br from-pink-100 to-rose-50 border-pink-200/50",
                      cardTheme === 'sunset-dream' && "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200/50",
                      cardTheme === 'lavender-mist' && "bg-gradient-to-br from-purple-100 to-indigo-50 border-indigo-200/50",
                      cardTheme === 'cherry-blossom' && "bg-stone-50 border-stone-200/60"
                    )}>
                      <div className="text-center font-sans uppercase tracking-widest text-[8px] font-extrabold text-text/40 mb-1.5">
                         ✨ Sweet Frame ✨
                      </div>
                      <div className="flex-1 bg-black rounded-xl overflow-hidden relative flex items-center justify-center shadow-inner">
                         <video
                           src={getOptimizedCloudinaryUrl(chosenVideoUrl)}
                           muted
                           playsInline
                           autoPlay
                           loop
                           className="w-full h-full object-contain"
                         />
                      </div>
                      <div className="mt-2 text-center flex flex-col items-center justify-center overflow-hidden shrink-0">
                         <Heart size={10} className="fill-rose-500 text-rose-500 animate-pulse mb-0.5" />
                         <span className="font-display font-black text-[9px] text-text/75 truncate w-full italic px-1">
                            {captionText || "Together is better 💖"}
                         </span>
                      </div>
                    </div>
                  ) : (
                    <video
                      src={getOptimizedCloudinaryUrl(chosenVideoUrl)}
                      muted
                      playsInline
                      autoPlay
                      loop
                      style={{
                        objectFit: fitMode,
                        objectPosition: `${objectPositionX}% ${objectPositionY}%`,
                      }}
                      className="w-full h-full transition-all duration-150"
                    />
                  )}
                </div>

                {/* Simulated frame overlays */}
                <span className="absolute top-2 left-2 z-20 text-[8px] bg-black/75 backdrop-blur-md text-white/95 px-2 py-0.5 rounded-full uppercase font-black tracking-widest flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                  Live Crop Feed
                </span>
                <span className="absolute bottom-2 right-2 z-20 text-[8px] bg-primary text-white font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider shadow-sm">
                   {fitMode === 'cover' ? "Full Crop" : fitMode === 'contain' ? "Insta-Fit" : "Polaroid"}
                </span>
              </div>

              {/* Layout Fit Selection tabs */}
              <div className="space-y-3.5 mb-4 shrink-0">
                <div>
                  <label className="text-[10px] uppercase font-black tracking-wider text-text/45 block mb-1.5">Fit & Framing Options</label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-bg border border-border rounded-xl">
                    <button
                      onClick={() => { setFitMode('cover'); sensory.play("pop"); }}
                      className={cn(
                        "py-1.5 text-[10px] font-black rounded-lg transition-all",
                        fitMode === 'cover' ? "bg-primary text-white shadow-sm" : "text-text/60 hover:text-text hover:bg-neutral-500/5"
                      )}
                    >
                      Cover-Crop
                    </button>
                    <button
                      onClick={() => { setFitMode('contain'); sensory.play("pop"); }}
                      className={cn(
                        "py-1.5 text-[10px] font-black rounded-lg transition-all",
                        fitMode === 'contain' ? "bg-primary text-white shadow-sm" : "text-text/60 hover:text-text hover:bg-neutral-500/5"
                      )}
                    >
                      Insta-Fit
                    </button>
                    <button
                      onClick={() => { setFitMode('card'); sensory.play("pop"); }}
                      className={cn(
                        "py-1.5 text-[10px] font-black rounded-lg transition-all",
                        fitMode === 'card' ? "bg-primary text-white shadow-sm" : "text-text/60 hover:text-text hover:bg-neutral-500/5"
                      )}
                    >
                      Gift Frame
                    </button>
                  </div>
                </div>

                {/* Sub-panels for individual crop styles */}
                <AnimatePresence mode="wait">
                  {fitMode === 'cover' && (
                    <motion.div
                      key="cover-options"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="space-y-2.5 bg-bg border border-border rounded-2xl p-3"
                    >
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1 font-sans">
                          <span className="font-black text-text/50">Horizontal Center (X-Crop Shift)</span>
                          <span className="font-bold text-primary">{objectPositionX}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={objectPositionX}
                          onChange={(e) => setObjectPositionX(parseInt(e.target.value))}
                          className="w-full accent-primary cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none"
                        />
                      </div>
                      <div>
                        <div className="flex justify-between items-center text-[10px] mb-1 font-sans">
                          <span className="font-black text-text/50">Vertical Center (Y-Crop Shift)</span>
                          <span className="font-bold text-primary">{objectPositionY}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={objectPositionY}
                          onChange={(e) => setObjectPositionY(parseInt(e.target.value))}
                          className="w-full accent-primary cursor-pointer h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-lg appearance-none"
                        />
                      </div>
                    </motion.div>
                  )}

                  {fitMode === 'card' && (
                    <motion.div
                      key="card-options"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="space-y-2 bg-bg border border-border rounded-2xl p-3"
                    >
                      <label className="text-[9px] uppercase font-black text-text/45 block mb-1 font-sans">Border Card Theme</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'romantic-pink', name: '🌸 Sweet Pink', class: 'bg-rose-400' },
                          { id: 'sunset-dream', name: '🌇 Sunset Aura', class: 'bg-orange-400' },
                          { id: 'lavender-mist', name: '🌌 Stardust', class: 'bg-indigo-500' },
                          { id: 'cherry-blossom', name: '🍡 Soft Cream', class: 'bg-amber-100/50 border border-border/60' },
                        ].map((theme) => (
                          <button
                            key={theme.id}
                            onClick={() => { setCardTheme(theme.id); sensory.play("pop"); }}
                            className={cn(
                              "py-1.5 px-2 text-[9px] font-black rounded-lg transition-all flex items-center gap-1.5 border justify-start",
                              cardTheme === theme.id 
                                ? "bg-primary/5 border-primary text-primary shadow-xs ring-1 ring-primary/20" 
                                : "text-text/70 bg-card/60 hover:bg-card border-border/40"
                            )}
                          >
                            <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", theme.class)} />
                            <span className="truncate">{theme.name}</span>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="Give it an adorable caption..."
                maxLength={180}
                className="w-full h-16 px-4 py-3 bg-bg border border-border rounded-2xl text-xs text-text focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none placeholder-text/50 mb-4"
              />

              <div className="flex gap-2.5 select-none font-sans shrink-0">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-3 bg-neutral-500/10 hover:bg-neutral-500/20 text-text/80 rounded-2xl text-xs font-extrabold active:scale-95 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleShareReel}
                  className="flex-1 py-3 bg-primary hover:bg-primary-600 text-white rounded-2xl text-xs font-extrabold shadow-lg active:scale-95 transition-all"
                >
                  Share Reel 🚀
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Comments Bottom Sheet Drawer */}
      <AnimatePresence>
        {showCommentsDrawer && selectedReel && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 z-40 backdrop-blur-xs"
              onClick={() => setShowCommentsDrawer(false)}
            />

            {/* Bottom Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 24, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 w-full max-w-full sm:max-w-md mx-auto bg-card rounded-t-[32px] border-t border-border z-50 h-[60dvh] flex flex-col text-text overflow-hidden"
            >
              {/* Drag line */}
              <div className="w-12 h-1 bg-border/50 rounded-full mx-auto my-3 shrink-0" />

              <div className="px-5 pb-3 border-b border-border/30 flex items-center justify-between shrink-0">
                <span className="font-bold text-sm text-text">
                  Comments ({(selectedReel.comments || []).length})
                </span>
                <button
                  onClick={() => setShowCommentsDrawer(false)}
                  className="p-1 rounded-full text-text/50 hover:text-text"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-5 no-scrollbar space-y-4">
                {(selectedReel.comments || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-center">
                    <MessageCircle size={28} className="text-text/20 animate-wiggle" />
                    <p className="text-xs text-text/40 font-medium">No comments yet. Start the cute spark!</p>
                  </div>
                ) : (
                  (selectedReel.comments || []).map((comm) => (
                    <div key={comm.id} className="flex gap-3 text-text">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-primary/10 shrink-0 border border-primary/20 flex items-center justify-center">
                        {comm.senderAvatar ? (
                          <img
                            src={comm.senderAvatar}
                            alt={comm.senderNickname}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-primary font-bold uppercase">
                            {comm.senderNickname[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{comm.senderNickname}</span>
                          <span className="text-[9px] text-text/40">
                            {new Date(comm.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-text/90 mt-0.5 leading-relaxed bg-primary/5 p-2.5 rounded-2xl rounded-tl-none border border-border">
                          {comm.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Preset Love & Fun comment reaction tags row */}
              <div className="px-5 py-2.5 bg-bg/60 border-t border-border shrink-0 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                {["Adorable! 🥰", "My absolute favorite 💖", "Made me blush! 👉👈", "Miss you, sweetheart! 💕", "Pure silly vibes 😂", "Can't stop rewatching! ✨", "Couples goals 💑"].map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      sensory.play("pop");
                      setNewComment(preset);
                    }}
                    className="shrink-0 px-3.5 py-1.5 bg-card hover:bg-primary/10 hover:border-primary/50 transition-all border border-border rounded-full text-[10px] font-bold text-text/90 tracking-wide active:scale-95"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Comment Input Footer */}
              <div className="p-4 bg-bg border-t border-border/50 shrink-0 flex gap-2 items-center">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handlePostComment();
                  }}
                  placeholder="Say something lovely..."
                  className="flex-1 px-4 py-3 bg-card border border-border rounded-2xl text-xs text-text placeholder-text/50 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                />
                <button
                  onClick={handlePostComment}
                  disabled={!newComment.trim()}
                  className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white disabled:opacity-40 select-none active:scale-95 transition-all"
                >
                  <Send size={14} />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
