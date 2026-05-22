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
import { db } from "../firebase/config";
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
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoSrc, setVideoSrc] = useState<string>("");
  const [isCaching, setIsCaching] = useState(true);
  const isLiked = (reel.likes || []).includes(currentUserId);

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
    if (videoRef.current && videoSrc && !isCaching) {
      if (isActive) {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch((err) => {
          console.log("Autoplay failed:", err);
          setIsPlaying(false);
        });
      } else {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
        setIsPlaying(false);
      }
    }
  }, [isActive, videoSrc, isCaching]);

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().then(() => {
          setIsPlaying(true);
        });
      }
    }
  };

  return (
    <div className="w-full h-full snap-start snap-always relative flex items-center justify-center bg-black">
      {/* Video element */}
      {videoSrc && !isCaching ? (
        <video
          ref={videoRef}
          src={videoSrc}
          loop
          playsInline
          muted={isMuted}
          onClick={handleVideoClick}
          className="w-full h-full object-cover max-h-[100dvh]"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950 gap-3">
          <Loader2 size={36} className="animate-spin text-primary" />
          <p className="text-xs text-white/40 tracking-wider font-light">Caching beautiful moment...</p>
        </div>
      )}

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
        <p className="text-xs text-white/90 font-medium leading-relaxed drop-shadow truncate-2-lines pointer-events-auto">
          {reel.caption}
        </p>

        {/* Music scrolling soundtrack replica */}
        <div className="flex items-center gap-1.5 text-[11px] text-white/70 overflow-hidden w-48">
          <Music2 size={12} className="shrink-0 animate-bounce" />
          <span className="whitespace-nowrap animate-marquee">
            Original audio • Ukku & Pukku Love
          </span>
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

  const [activeTab, setActiveTab] = useState<"feed" | "profile">("feed");
  const [reels, setReels] = useState<ReelData[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Upload fields
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [chosenVideoUrl, setChosenVideoUrl] = useState("");
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
      if (reel.videoUrl && reel.videoUrl.includes("cloudinary.com")) {
        fetch("/api/cloudinary/delete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: reel.videoUrl }),
        }).catch((err) => console.error("Cloudinary delete failed", err));
      }

      // Then delete Firestore doc
      await deleteDoc(doc(db, "pairs", roomId, "reels", reel.id));
      sensory.success();
    } catch (e) {
      console.error("Failed to delete reel:", e);
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", "blablu_videos");

    try {
      const res = await fetch("https://api.cloudinary.com/v1_1/dcwl4l70x/video/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setChosenVideoUrl(data.secure_url);
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
    <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto relative bg-black select-none text-white overflow-hidden">
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
        /* INSTAGRAM-STYLE PROFILE VIEW */
        <div className="flex-1 flex flex-col bg-zinc-950 overflow-hidden">
          {/* PROFILE TOP HEADER */}
          <div className="pt-safe-top px-4 py-3 flex items-center justify-between border-b border-white/10 bg-zinc-950 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  sensory.play("pop");
                  setView("home");
                }}
                className="p-1.5 rounded-full hover:bg-white/10 text-white active:scale-95 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <span className="font-bold text-sm tracking-tight font-display text-white truncate max-w-[140px]">
                {user?.nickname?.toLowerCase() || user?.name?.toLowerCase() || "couple"}_{partner?.nickname?.toLowerCase() || partner?.name?.toLowerCase() || "memories"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => videoInputRef.current?.click()}
                disabled={isUploading}
                className="p-1.5 hover:bg-white/10 rounded-full active:scale-95 transition-all text-white"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* PROFILE SUMMARY HERO */}
          <div className="p-5 flex flex-col gap-4 bg-zinc-950/40 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-5">
              {/* Overlapping double profile circles */}
              <div className="relative flex items-center justify-center shrink-0 py-1">
                {/* User Story border circle */}
                <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-rose-500 via-purple-600 to-yellow-500 shadow-md relative z-10">
                  <div className="w-full h-full rounded-full border-2 border-zinc-950 bg-zinc-900 overflow-hidden">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt={user.nickname || user.name || "Me"}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-white font-black bg-pink-500 text-sm">
                        {(user?.nickname || user?.name || "U")[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>

                {/* Partner Story border overlapping circle */}
                <div className="w-16 h-16 rounded-full p-[2.5px] bg-gradient-to-tr from-rose-500 via-purple-600 to-yellow-500 shadow-md relative z-20 -ml-5 border-l-4 border-zinc-950">
                  <div className="w-full h-full rounded-full border border-zinc-950 bg-zinc-900 overflow-hidden">
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
                  <span className="font-extrabold text-sm text-white">{reels.length}</span>
                  <span className="text-[10px] text-zinc-400 font-medium font-sans">Posts</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-white">
                    {reels.reduce((acc, curr) => acc + (curr.likes?.length || 0), 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium font-sans">Likes</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-extrabold text-sm text-white">
                    {reels.reduce((acc, curr) => acc + (curr.comments?.length || 0), 0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 font-medium font-sans">Comments</span>
                </div>
              </div>
            </div>

            {/* Profile handle, titles, bios */}
            <div>
              <h3 className="font-bold text-xs text-white">
                {user?.nickname || user?.name || "Lover"} & {partner?.nickname || partner?.name || "Partner"} 💑
              </h3>
              <p className="text-[10px] text-zinc-400 font-medium font-sans mt-0.5">Private Couple Memory Reel Blog</p>
              <p className="text-[11px] mt-2 text-zinc-300 leading-relaxed max-w-sm">
                A private vault of our vertical video snap-scrolls, special dates, laughing fits, and silly dances. 🎬💖
              </p>
            </div>

            {/* Actions tab */}
            <div className="flex gap-2.5 mt-1">
              <button
                onClick={() => videoInputRef.current?.click()}
                className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-pink-600 active:scale-98 transition-all rounded-lg text-[11px] font-extrabold text-white flex items-center justify-center gap-1.5 shadow-md shadow-violet-950/20"
              >
                <Plus size={14} /> Upload New Memory
              </button>
            </div>
          </div>

          {/* GRID OF REEL VIDEOS */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-black p-1">
            {isLoading ? (
              <div className="h-full flex items-center justify-center">
                <Loader2 size={24} className="animate-spin text-primary" />
              </div>
            ) : reels.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center gap-3 text-zinc-600">
                <LayoutGrid size={32} strokeWidth={1} />
                <p className="text-xs font-semibold">No Reels Uploaded Yet</p>
                <p className="text-[10px] text-zinc-500 max-w-xs px-6">
                  Click "+ Upload New Memory" to record your first cute story!
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-0.5">
                {reels.map((reel, idx) => {
                  return (
                    <div
                      key={reel.id}
                      onClick={() => {
                        sensory.play("pop");
                        setActiveIdx(idx);
                        setActiveTab("feed");
                      }}
                      className="aspect-[9/16] relative bg-zinc-950 group cursor-pointer overflow-hidden rounded-md border border-white/5 active:scale-95 transition-all"
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

      {/* Mini Instagram style footer navigation tabs inside ReelsScreen */}
      <div className="bg-zinc-950/95 border-t border-white/10 py-3 px-16 flex items-center justify-between shrink-0">
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
              activeTab === "feed" ? "text-violet-400 stroke-[2.5px]" : "text-zinc-500 hover:text-white"
            )}
          />
          <span className={cn(
            "text-[8px] uppercase tracking-wider font-extrabold",
            activeTab === "feed" ? "text-violet-400" : "text-zinc-500"
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
            "w-6 h-6 rounded-full p-[1.5px] overflow-hidden bg-zinc-800 transition-all",
            activeTab === "profile" ? "bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 ring-2 ring-violet-500/50 scale-105" : "hover:scale-105"
          )}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt="Me"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover pointer-events-none"
              />
            ) : (
              <div className="w-full h-full bg-violet-600 rounded-full flex items-center justify-center text-white text-[9px] font-black uppercase">
                {(user?.nickname || user?.name || "U")[0]}
              </div>
            )}
          </div>
          <span className={cn(
            "text-[8px] uppercase tracking-wider font-extrabold",
            activeTab === "profile" ? "text-violet-400" : "text-zinc-500"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card w-full max-w-sm rounded-[24px] border border-border overflow-hidden p-5 text-text"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-base text-white font-display">New Reel Post</h3>
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Video Preview Miniature */}
              <div className="w-full aspect-[16/9] rounded-xl overflow-hidden bg-black mb-4 flex items-center justify-center relative">
                <video
                  src={getOptimizedCloudinaryUrl(chosenVideoUrl)}
                  muted
                  playsInline
                  autoPlay
                  loop
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-2 left-2 text-[8px] bg-black/60 text-white px-1.5 py-0.5 rounded uppercase font-black tracking-widest">
                  Preview
                </span>
              </div>

              <textarea
                value={captionText}
                onChange={(e) => setCaptionText(e.target.value)}
                placeholder="Give it an adorable caption..."
                maxLength={180}
                className="w-full h-20 px-3.5 py-2.5 bg-black/20 border border-border/60 rounded-xl text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary resize-none placeholder-text/40"
              />

              <div className="flex gap-2.5 mt-4">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="flex-1 py-3 bg-black/20 hover:bg-black/30 text-white/80 border border-border rounded-xl text-xs font-bold active:scale-95 transition-all"
                >
                  Discard
                </button>
                <button
                  onClick={handleShareReel}
                  className="flex-1 py-3 bg-primary hover:bg-primary-600 text-white rounded-xl text-xs font-bold shadow-md active:scale-95 transition-all"
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
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-card rounded-t-[32px] border-t border-border z-50 h-[60dvh] flex flex-col text-text overflow-hidden"
            >
              {/* Drag line */}
              <div className="w-12 h-1 bg-border/50 rounded-full mx-auto my-3 shrink-0" />

              <div className="px-5 pb-3 border-b border-border/30 flex items-center justify-between shrink-0">
                <span className="font-bold text-sm text-white">
                  Comments ({(selectedReel.comments || []).length})
                </span>
                <button
                  onClick={() => setShowCommentsDrawer(false)}
                  className="p-1 rounded-full text-white/50 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Comments List */}
              <div className="flex-1 overflow-y-auto p-5 no-scrollbar space-y-4">
                {(selectedReel.comments || []).length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full py-10 gap-3 text-center">
                    <MessageCircle size={28} className="text-white/20 animate-wiggle" />
                    <p className="text-xs text-white/30 font-medium">No comments yet. Start the cute spark!</p>
                  </div>
                ) : (
                  (selectedReel.comments || []).map((comm) => (
                    <div key={comm.id} className="flex gap-3 text-white">
                      <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 border border-white/10 flex items-center justify-center">
                        {comm.senderAvatar ? (
                          <img
                            src={comm.senderAvatar}
                            alt={comm.senderNickname}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-xs text-white font-bold uppercase">
                            {comm.senderNickname[0]}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs">{comm.senderNickname}</span>
                          <span className="text-[9px] text-white/40">
                            {new Date(comm.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-white/80 mt-0.5 leading-relaxed bg-black/20 p-2.5 rounded-2xl rounded-tl-none border border-border/30">
                          {comm.text}
                        </p>
                      </div>
                    </div>
                  ))
                )}
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
                  className="flex-1 px-4 py-3 bg-black/30 border border-border rounded-2xl text-xs text-white placeholder-text/30 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
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
