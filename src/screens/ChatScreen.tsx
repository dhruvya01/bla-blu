import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import {
  Send,
  X,
  Check,
  CheckCheck,
  Reply,
  Utensils,
  Droplet,
  Pill,
  ChevronLeft,
  MoreVertical,
  Trash2,
  Download,
  MessageSquare,
  Plus,
  Battery,
  CloudRain,
  Sun,
  Cloud,
  Heart,
  MapPin,
  Image as ImageIcon,
  Lock,
  Mic,
  Phone,
  Square,
  Play,
  Camera,
  Palette,
  Star,
  Pause,
  Sparkles,
  Maximize2,
  Minimize2,
  Layers,
  Smile,
} from "lucide-react";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  query,
  getDocs,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { Socket } from "socket.io-client";
import { useShallow } from "zustand/react/shallow";
import { db, handleFirestoreError } from "../firebase/config";
import { useAppStore } from "../store";
import { CONFIG } from "../config";
import { cn } from "../utils";
import { sensory } from "../utils/sensory";
import { useNow } from "../hooks/useNow";
import { getDistance, formatDistance } from "../utils/geo";
import { compressImage } from "../utils/imageUtils";
import { encryptData, decryptData, clearE2E } from "../utils/e2ee";

import { DoodleScreen } from "./DoodleScreen";

const isUserOnline = (u: any, now: number) => {
  if (!u?.lastActive) return false;
  return now - u.lastActive < 1000 * 120; // 2 minutes
};

const reactionEmojis = ["❤️", "😂", "🥺", "😡", "👍", "✨"];

function FloatingEmoji({
  emoji,
  onComplete,
}: {
  emoji: string;
  onComplete: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 1, scale: 0.5, rotate: 0 }}
      animate={{
        y: -150,
        opacity: [1, 1, 0],
        scale: [0.5, 2.5, 3],
        rotate: [0, -45, 45, 0],
        x: [0, -20, 20, 0],
      }}
      transition={{ duration: 1.2, ease: "easeOut" }}
      onAnimationComplete={onComplete}
      className="absolute pointer-events-none z-[100] text-4xl drop-shadow-2xl"
      style={{ left: "50%", top: "50%" }}
    >
      {emoji}
    </motion.div>
  );
}

function RomanticEffects({ effect }: { effect: string }) {
  if (effect === "hearts") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              y: -50,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              y: "100vh",
              opacity: [0, 1, 1, 0],
              scale: Math.random() * 1.5 + 0.5,
              rotate: Math.random() * 360,
            }}
            transition={{
              duration: Math.random() * 3 + 2,
              delay: Math.random() * 1.5,
            }}
            className="absolute text-rose-500 text-3xl drop-shadow-md z-50"
          >
            ❤️
          </motion.div>
        ))}
      </div>
    );
  }
  if (effect === "sparkles" || effect === "glow") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(40)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              y: `${Math.random() * 100}vh`,
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              scale: [0, Math.random() * 1.5 + 1, 0],
              rotate: 180,
            }}
            transition={{
              duration: Math.random() * 2 + 1,
              delay: Math.random() * 1,
            }}
            className="absolute text-yellow-300 text-2xl drop-shadow-lg z-50"
          >
            ✨
          </motion.div>
        ))}
      </div>
    );
  }
  if (effect === "sleep") {
    return (
      <div className="absolute inset-0 pointer-events-none overflow-hidden bg-indigo-900/20">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            initial={{
              y: "100vh",
              x: `${Math.random() * 100}vw`,
              opacity: 0,
              scale: 0,
            }}
            animate={{
              y: "-10vh",
              opacity: [0, 1, 0],
              scale: Math.random() * 1.5 + 0.5,
              x: `+=${Math.random() * 50 - 25}px`,
            }}
            transition={{
              duration: Math.random() * 4 + 3,
              delay: Math.random() * 2,
            }}
            className="absolute text-blue-300 text-2xl drop-shadow-md z-50"
          >
            Zzz
          </motion.div>
        ))}
      </div>
    );
  }
  return null;
}

function AudioMessageWaveform({ src, isMe }: { src: string; isMe: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [barHeights, setBarHeights] = useState<number[]>([]);

  // Generate a random stable visual waveform
  useEffect(() => {
    const heights = Array.from({ length: 18 }, () => Math.floor(Math.random() * 16) + 4);
    setBarHeights(heights);
  }, []);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audioRef.current = audio;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      if (audio.duration && audio.duration !== Infinity) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("playing", onPlay);
    audio.addEventListener("auto", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.pause();
      audio.removeEventListener("playing", onPlay);
      audio.removeEventListener("auto", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [src]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error("Error playing audio:", err));
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    audioRef.current.currentTime = percentage * duration;
    setCurrentTime(audioRef.current.currentTime);
  };

  const progress = duration ? currentTime / duration : 0;

  return (
    <div className={cn(
      "flex items-center gap-2.5 py-2 px-3 rounded-2xl border max-w-[245px] select-none shadow-sm",
      isMe 
        ? "bg-white/10 border-white/15 text-white" 
        : "bg-card border-border text-text"
    )}>
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        className={cn(
          "w-8.5 h-8.5 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-90 hover:scale-105 shadow-sm",
          isMe ? "bg-white text-primary" : "bg-primary text-white"
        )}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5" />}
      </button>

      {/* Waveform & Progress */}
      <div className="flex-1 flex flex-col gap-1 min-w-[120px]">
        {/* Interactive Bar Display */}
        <div
          onClick={handleWaveformClick}
          className="h-8 flex items-center gap-[3px] cursor-pointer"
        >
          {barHeights.map((h, i) => {
            const barProgress = (i / barHeights.length);
            const active = progress >= barProgress;
            return (
              <div
                key={i}
                className={cn(
                  "w-[3px] rounded-full transition-colors duration-100",
                  active
                    ? isMe ? "bg-white" : "bg-primary"
                    : isMe ? "bg-white/30" : "bg-text/20"
                )}
                style={{
                  height: `${h}px`,
                  transform: isPlaying && active ? `scaleY(${1 + Math.sin(currentTime * 4 + i) * 0.2})` : "none"
                }}
              />
            );
          })}
        </div>

        {/* Timers */}
        <div className="flex items-center justify-between text-[9px] opacity-75 font-mono leading-none">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "0:04"}</span>
        </div>
      </div>
    </div>
  );
}

function ChatMessage({
  m,
  isMe,
  user,
  partner,
  messages,
  onReply,
  onReact,
  onVisible,
  onStar,
  reactToMsgId,
  setReactToMsgId,
  onExpandImage,
  nextMsg,
}: any) {
  const roomId = useAppStore((state) => state.roomId);
  const messageRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<any>(null);
  const [decryptedText, setDecryptedText] = useState(m.text || "");
  const [decryptedImage, setDecryptedImage] = useState(m.image || "");
  const [decryptedAudio, setDecryptedAudio] = useState(m.audio || "");
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    const handleHighlight = (e: any) => {
      if (e.detail?.id === m.id) {
        setIsHighlighted(true);
        setTimeout(() => {
          setIsHighlighted(false);
        }, 3000);
      }
    };
    window.addEventListener("highlight-msg" as any, handleHighlight);
    return () => {
      window.removeEventListener("highlight-msg" as any, handleHighlight);
    };
  }, [m.id]);

  useEffect(() => {
    let active = true;
    
    const attemptDecrypt = () => {
      if (m.text && m.text.startsWith('E2EE:')) {
        decryptData(m.text).then(t => active && setDecryptedText(t));
      } else {
        setDecryptedText(m.text || "");
      }
      if (m.image && m.image.startsWith('E2EE:')) {
        decryptData(m.image).then(i => active && setDecryptedImage(i));
      } else {
        setDecryptedImage(m.image || "");
      }
      if (m.audio && m.audio.startsWith('E2EE:')) {
        decryptData(m.audio).then(a => active && setDecryptedAudio(a));
      } else {
        setDecryptedAudio(m.audio || "");
      }
    };

    attemptDecrypt();
    window.addEventListener('e2ee-ready', attemptDecrypt);

    return () => { 
      active = false; 
      window.removeEventListener('e2ee-ready', attemptDecrypt);
    };
  }, [m.text, m.image, m.audio]);

  useEffect(() => {
    if (isMe || m.status === "seen") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          onVisible(m.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );

    if (messageRef.current) {
      observer.observe(messageRef.current);
    }

    return () => observer.disconnect();
  }, [m.id, m.status, isMe, onVisible]);

  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  const longPressTimerRef = useRef<any>(null);
  const isLongPressActive = useRef<boolean>(false);
  const touchStartPos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });

  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  const startPressTimer = (clientX: number, clientY: number) => {
    isLongPressActive.current = false;
    touchStartPos.current = { x: clientX, y: clientY };
    
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    
    longPressTimerRef.current = setTimeout(() => {
      isLongPressActive.current = true;
      sensory.success();
      setReactToMsgId(m.id);
    }, 600); // 600ms long press
  };

  const cancelPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleTouchStartCustom = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    startPressTimer(touch.clientX, touch.clientY);
  };

  const handleTouchMoveCustom = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPos.current.x);
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelPressTimer();
    }
  };

  const handleTouchEndCustom = (e: React.TouchEvent) => {
    cancelPressTimer();
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const handleMouseDownCustom = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // primary only
    startPressTimer(e.clientX, e.clientY);
  };

  const handleMouseMoveCustom = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - touchStartPos.current.x);
    const dy = Math.abs(e.clientY - touchStartPos.current.y);
    if (dx > 10 || dy > 10) {
      cancelPressTimer();
    }
  };

  const handleMouseUpCustom = (e: React.MouseEvent) => {
    cancelPressTimer();
    if (isLongPressActive.current) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const repliedMsg = m.replyTo
    ? (messages || []).find((msg: any) => msg.id === m.replyTo)
    : null;

  const [repliedMsgText, setRepliedMsgText] = useState(repliedMsg?.text || "");

  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (repliedMsg?.text && repliedMsg.text.startsWith('E2EE:')) {
        decryptData(repliedMsg.text).then(t => active && setRepliedMsgText(t));
      } else {
        setRepliedMsgText(repliedMsg?.text || "");
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { active = false; window.removeEventListener('e2ee-ready', attempt); };
  }, [repliedMsg?.text]);
  const reactions = m.reactions || {};
  const reactionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    Object.values(reactions).forEach((emoji: any) => {
      counts[emoji] = (counts[emoji] || 0) + 1;
    });
    return counts;
  }, [reactions]);

  if (m.isCareBtn) {
    return (
      <div className="flex justify-center w-full my-2">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 8 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-full px-4 py-2 text-sm font-medium flex items-center gap-2 text-text shadow-sm"
        >
          {m.careType === "eat" && (
            <Utensils size={14} className="text-orange-400" />
          )}
          {m.careType === "water" && (
            <Droplet size={14} className="text-blue-400" />
          )}
          {m.careType === "medicine" && (
            <Pill size={14} className="text-primary" />
          )}
          <span className="text-text/70">{decryptedText}</span>
        </motion.div>
      </div>
    );
  }

  if (m.isDeleted) {
    return (
      <div
        className={cn("flex w-full mb-2", isMe ? "justify-end" : "justify-start")}
      >
        <div
          className={cn(
            "flex flex-col max-w-[85%] relative",
            isMe ? "items-end" : "items-start",
          )}
        >
          <div
            className={cn(
              "px-4 py-2 rounded-2xl text-xs italic opacity-60 flex items-center gap-1.5 border select-none",
              isMe
                ? "bg-primary/5 text-primary/80 border-primary/20 rounded-br-sm"
                : "bg-card text-text/60 border-border rounded-bl-sm"
            )}
          >
            <Trash2 size={12} className="shrink-0 opacity-50" />
            <span>This message was deleted</span>
          </div>
          {shouldShowTimestamp(m, nextMsg) && (
            <div className={cn("mt-1 flex", isMe ? "justify-end" : "justify-start")}>
              <span className="text-[10px] text-text/50 font-medium lowercase">
                {formatBubbleTime(m.timestamp)}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  const x = useMotionValue(0);
  const replyIconOpacity = useTransform(x, [-50, -30, 30, 50], [1, 0, 0, 1]);
  const replyIconScale = useTransform(x, [-50, -30, 30, 50], [1, 0.5, 0.5, 1]);

  return (
    <div
      id={`msg-${m.id}`}
      className={cn(
        "flex w-full mb-2 transition-all duration-300", 
        isMe ? "justify-end" : "justify-start",
        isHighlighted && "scale-[1.03] duration-500"
      )}
    >
      <div
        ref={messageRef}
        className={cn(
          "flex flex-col max-w-[85%] relative",
          isMe ? "items-end" : "items-start",
        )}
      >
        <div className="relative flex items-center justify-center">
          <motion.div
            style={{ opacity: replyIconOpacity, scale: replyIconScale, x: isMe ? -20 : 20 }}
            className={cn(
              "absolute z-0",
              isMe ? "right-full" : "left-full"
            )}
          >
            <div className="w-8 h-8 rounded-full bg-black/10 dark:bg-white/10 flex items-center justify-center text-text shadow-sm">
              <Reply size={16} />
            </div>
          </motion.div>
          <motion.div
            drag="x"
            style={{ x }}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={{ left: 0.1, right: 0.8 }}
            onDragEnd={(_, info) => {
              if (info.offset.x > 50 || info.offset.x < -50) {
                onReply(m.id);
                sensory.play("swoosh");
              }
            }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            onContextMenu={(e) => {
              e.preventDefault();
              setReactToMsgId(m.id);
            }}
            onDoubleClick={() => onReply(m.id)}
            onTouchStart={handleTouchStartCustom}
            onTouchMove={handleTouchMoveCustom}
            onTouchEnd={handleTouchEndCustom}
            onMouseDown={handleMouseDownCustom}
            onMouseMove={handleMouseMoveCustom}
            onMouseUp={handleMouseUpCustom}
            className={cn(
              m.isSticker
                ? "p-0 bg-transparent border-none shadow-none relative select-none cursor-pointer"
                : "px-4 py-2.5 rounded-2xl relative transition-all cursor-pointer",
              !m.isSticker && (isMe
                ? "bg-primary text-white rounded-br-sm shadow-sm"
                : "bg-card text-text border border-border rounded-bl-sm shadow-sm"),
              isHighlighted && "ring-4 ring-amber-400 ring-offset-2 dark:ring-offset-[#0d0a15] shadow-[0_0_15px_rgba(245,158,11,0.5)] z-20"
            )}
          >
            {repliedMsg && (
              <div
                className={cn(
                  "border-l-2 pl-2 py-0.5 mb-2 text-[11px] rounded-sm bg-black/5",
                  isMe
                    ? "border-white/40 text-white/80"
                    : "border-primary/40 text-text/60",
                )}
              >
                <span className="font-bold block mb-0.5">
                  {repliedMsg.senderId === user?.uid
                    ? "You"
                    : partner?.nickname || "Them"}
                </span>
                <span className="truncate block opacity-80 italic">
                  "{repliedMsgText}"
                </span>
              </div>
            )}

            <div className="relative group flex flex-col items-start gap-1">
              {decryptedImage && decryptedImage.startsWith("🔒") ? (
                <div className="flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-xl p-4 mt-1 mb-1 shadow-sm border border-black/5 text-text/60 w-32 h-32">
                  <Lock size={24} className="mb-2 opacity-50" />
                  <span className="text-xs font-semibold text-center leading-tight">Verification<br/>Failed</span>
                </div>
              ) : decryptedImage ? (
                <motion.img
                  whileHover={{ scale: m.isSticker ? 1.15 : 1, rotate: m.isSticker ? 2 : 0 }}
                  whileTap={{ scale: m.isSticker ? 0.95 : 1 }}
                  src={decryptedImage}
                  alt={m.isSticker ? "Sticker" : "Image"}
                  className={cn(
                    m.isSticker
                      ? "w-28 h-28 md:w-32 md:h-32 object-contain filter drop-shadow-md cursor-pointer pointer-events-auto select-none"
                      : "mt-1 mb-1 max-w-full rounded-xl object-contain shadow-sm border border-black/5 cursor-pointer hover:opacity-90 transition-opacity"
                  )}
                  style={m.isSticker ? { maxHeight: "none" } : { maxHeight: "300px" }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setReactToMsgId(m.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isLongPressActive.current) return;
                    if (m.isSticker) {
                      setReactToMsgId(reactToMsgId === m.id ? null : m.id);
                    } else if (onExpandImage) {
                      onExpandImage(decryptedImage!);
                    }
                  }}
                />
              ) : null}
              {decryptedAudio && decryptedAudio.startsWith("🔒") ? (
                <div className="flex flex-col items-center justify-center bg-black/5 dark:bg-white/5 rounded-xl p-4 mt-1 mb-1 shadow-sm border border-black/5 text-text/60 w-32 h-16">
                  <Lock size={16} className="mb-1 opacity-50" />
                  <span className="text-[10px] font-semibold text-center leading-tight">Secure Audio</span>
                </div>
              ) : decryptedAudio ? (
                <div className="mt-1 mb-1 relative">
                  <AudioMessageWaveform src={decryptedAudio} isMe={isMe} />
                </div>
              ) : null}
              {decryptedText && (
                <span
                  className="text-[15px] font-medium leading-relaxed break-words"
                >
                  {decryptedText}
                </span>
              )}
            </div>
          </motion.div>

          {Object.keys(reactionCounts).length > 0 && (
            <div
              className={cn(
                "absolute -bottom-2 flex gap-1 z-10",
                isMe ? "-right-2" : "-left-2",
              )}
            >
              <div className="bg-card border border-border rounded-full px-2 py-0.5 text-xs flex items-center gap-1 shadow-sm selection:bg-transparent">
                {Object.entries(reactionCounts).map(([emoji, count]: any) => (
                  <button
                    key={emoji}
                    onClick={() => onReact(m.id, emoji)}
                    className={cn(
                      "flex items-center active:scale-95 transition-transform",
                      m.reactions?.[user?.uid] === emoji
                        ? "opacity-100"
                        : "opacity-80",
                    )}
                  >
                    {emoji}
                    {count > 1 && (
                      <span className="ml-0.5 opacity-60 text-[10px]">
                        {count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {shouldShowTimestamp(m, nextMsg) && (
          <div className={cn("mt-1 flex", isMe ? "justify-end" : "justify-start")}>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-text/50 font-medium lowercase">
                {formatBubbleTime(m.timestamp)}
              </span>
              {m.isStarred && (
                <Star size={10} className="text-amber-400 fill-amber-400" />
              )}
              {isMe && (
                <span className="inline-flex items-center">
                  {m.status === "seen" ? (
                    <CheckCheck size={14} className="text-blue-500" />
                  ) : m.status === "delivered" ? (
                    <CheckCheck size={14} className="text-text/60" />
                  ) : (
                    <Check size={14} className="text-text/60" />
                  )}
                </span>
              )}
            </div>
          </div>
        )}

        <AnimatePresence>
          {reactToMsgId === m.id && (
            <>
              <div 
                className="fixed inset-0 z-[90]" 
                onClick={(e) => { e.stopPropagation(); setReactToMsgId(null); }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={cn(
                  "absolute z-[100] bg-bg/85 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-full shadow-2xl p-1.5 flex items-center gap-1 bottom-full mb-1",
                  isMe ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left",
                )}
              >
                <div className="flex items-center gap-0.5 px-1">
                  {reactionEmojis.map((emoji, idx) => (
                    <motion.button
                      key={emoji}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={(e) => { e.stopPropagation(); onReact(m.id, emoji); }}
                      className={cn(
                        "text-2xl p-1 cursor-pointer hover:scale-[1.3] transition-all duration-200 active:scale-95",
                        m.reactions?.[user?.uid] === emoji && "bg-primary/20 rounded-full"
                      )}
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </div>
                <div className="w-px h-6 bg-border/50 mx-1" />
                <div className="flex items-center space-x-1 pr-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onReply(m.id);
                      setReactToMsgId(null);
                    }}
                    className="p-1.5 text-text/60 hover:text-text hover:bg-black/5 dark:hover:bg-white/10 rounded-full active:scale-90 transition-all"
                  >
                    <Reply size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete();
                    }}
                    className="p-1.5 text-rose-500/70 hover:text-rose-500 hover:bg-rose-500/10 rounded-full active:scale-90 transition-all"
                    title="Delete message"
                  >
                    <Trash2 size={18} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onStar) onStar(m.id, m.isStarred);
                      setReactToMsgId(null);
                    }}
                    className={cn(
                      "p-1.5 rounded-full active:scale-90 transition-all",
                      m.isStarred 
                        ? "text-amber-400 hover:text-amber-500 bg-amber-500/10" 
                        : "text-text/60 hover:text-amber-400 hover:bg-amber-400/10"
                    )}
                    title={m.isStarred ? "Unstar message" : "Star message"}
                  >
                    <Star size={18} fill={m.isStarred ? "currentColor" : "none"} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReactToMsgId(null); }}
                    className="p-1.5 text-text/50 hover:text-text/80 active:scale-90 transition-all rounded-full hover:bg-black/5"
                  >
                    <X size={18} />
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showConfirmDelete && (
            <>
              <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999]" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowConfirmDelete(false);
                }} 
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                transition={{ type: "spring", damping: 25, stiffness: 350 }}
                className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-border p-6 rounded-3xl shadow-xl z-[1000] w-[90%] max-w-sm flex flex-col items-center text-center gap-4 text-text"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3 bg-rose-500/10 rounded-full text-rose-500">
                  <Trash2 size={32} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-text font-sans">Delete message?</h3>
                  <p className="text-sm text-text/60 mt-1">
                    This will permanently delete this message or sticker for both you and your partner from the backend.
                  </p>
                </div>
                <div className="flex w-full gap-2 mt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowConfirmDelete(false);
                    }}
                    className="flex-1 py-2.5 rounded-xl border border-border hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all text-sm font-semibold select-none cursor-pointer text-text/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      setShowConfirmDelete(false);
                      if (!roomId) return;
                      try {
                        await updateDoc(
                          doc(db, "pairs", roomId, "chatMessages", m.id),
                          {
                            isDeleted: true,
                            text: "This message was deleted",
                            image: deleteField(),
                            isSticker: deleteField(),
                            reactions: deleteField(),
                            replyTo: deleteField()
                          }
                        );
                        sensory.tap();
                        setReactToMsgId(null);
                      } catch (err) {
                        handleFirestoreError(
                          err,
                          "delete",
                          `pairs/${roomId}/chatMessages/${m.id}`,
                        );
                      }
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-semibold shadow-sm hover:bg-rose-600 active:scale-95 transition-all text-sm select-none cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

const formatBubbleTime = (ts: any) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit", hour12: true });
};

const formatSeparatorDate = (ts: any) => {
  if (!ts) return "";
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();
  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const getSeenText = (lastActive: number, now: number) => {
  const diff = now - lastActive;
  if (diff < 120000) return "Online now";
  if (diff < 3600000) return `Seen ${Math.floor(diff / 60000)}m ago`;
  
  const d = new Date(lastActive);
  const timeStr = d.toLocaleTimeString('en-US', { hour: "numeric", minute: "2-digit", hour12: true });
  
  if (diff < 86400000 && new Date(now).getDate() === d.getDate()) {
    return `Seen today at ${timeStr}`;
  } else if (diff < 172800000) {
    return `Seen yesterday at ${timeStr}`;
  }
  return `Seen ${d.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`;
};

const shouldShowTimestamp = (m: any, next: any) => {
  if (!next) return true; // always show on last message
  if (next.senderId !== m.senderId) return true; // show when sender changes
  const mTs = m.timestamp?.toDate
    ? m.timestamp.toDate().getTime()
    : m.timestamp;
  const nTs = next.timestamp?.toDate
    ? next.timestamp.toDate().getTime()
    : next.timestamp;
  if (!mTs || !nTs) return true;
  return nTs - mTs > 120000; // show if next msg is > 2 min later
};

const detectRomanticEffect = (text: string) => {
  if (!text || typeof text !== "string") return null;
  const t = text.toLowerCase();
  if (t.includes("i love you") || t.includes("love u")) return "hearts";
  if (t.includes("kiss") || t.includes("mwah")) return "kisses";
  if (t.includes("miss you") || t.includes("miss u")) return "sparkles";
  if (t.includes("baby") || t.includes("babe") || t.includes("bubi"))
    return "glow";
  if (t.includes("sorry")) return "sorry";
  if (
    t.includes("goodnight") ||
    t.includes("good night") ||
    t.includes("nighty") ||
    t.includes("sweet dreams")
  )
    return "sleep";
  return null;
};

export const getClownCatStickerDataUrl = () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
    <defs>
      <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-opacity="0.15"/>
      </filter>
      <radialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFFFFF"/>
        <stop offset="100%" stop-color="#F3F4F6"/>
      </radialGradient>
    </defs>

    <!-- Ears -->
    <path d="M 28 42 L 15 15 L 45 32 Z" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
    <path d="M 31 39 L 20 20 L 42 32 Z" fill="#FDA4AF"/>
    <path d="M 92 42 L 105 15 L 75 32 Z" fill="#F8FAFC" stroke="#E2E8F0" stroke-width="1.5"/>
    <path d="M 89 39 L 100 20 L 78 32 Z" fill="#FDA4AF"/>

    <!-- Head -->
    <ellipse cx="60" cy="65" rx="42" ry="34" fill="url(#faceGrad)" stroke="#E2E8F0" stroke-width="2" filter="url(#shadow)"/>

    <!-- Rainbow Wig -->
    <g filter="url(#shadow)">
      <circle cx="42" cy="30" r="12" fill="#EF4444"/>
      <circle cx="54" cy="24" r="13" fill="#F97316"/>
      <circle cx="68" cy="24" r="13" fill="#EAB308"/>
      <circle cx="80" cy="31" r="12" fill="#22C55E"/>
      <circle cx="60" cy="18" r="14" fill="#3B82F6"/>
      <circle cx="48" cy="20" r="11" fill="#A855F7"/>
      <circle cx="72" cy="20" r="11" fill="#EC4899"/>
    </g>

    <polygon points="38,48 42,65 38,82 34,65" fill="#38BDF8" opacity="0.8"/>
    <polygon points="82,48 86,65 82,82 78,65" fill="#38BDF8" opacity="0.8"/>

    <circle cx="38" cy="63" r="6" fill="#1E293B"/>
    <circle cx="36" cy="61" r="2" fill="#FFFFFF"/>
    <circle cx="82" cy="63" r="6" fill="#1E293B"/>
    <circle cx="80" cy="61" r="2" fill="#FFFFFF"/>

    <path d="M 33,60 Q 28,57 26,61" stroke="#0F172A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M 32,58 Q 27,53 26,56" stroke="#0F172A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M 35,57 Q 31,51 32,53" stroke="#0F172A" stroke-width="1.5" fill="none" stroke-linecap="round"/>

    <path d="M 87,60 Q 92,57 94,61" stroke="#0F172A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <path d="M 88,58 Q 93,53 94,56" stroke="#0F172A" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <path d="M 85,57 Q 89,51 88,53" stroke="#0F172A" stroke-width="1.5" fill="none" stroke-linecap="round"/>

    <circle cx="28" cy="74" r="7" fill="#F87171" opacity="0.6"/>
    <circle cx="92" cy="74" r="7" fill="#F87171" opacity="0.6"/>

    <circle cx="60" cy="67" r="9" fill="#EF4444" filter="url(#shadow)"/>
    <circle cx="57" cy="64" r="3" fill="#FFFFFF" opacity="0.6"/>

    <path d="M 54 75 Q 60 78 60 75 Q 60 78 66 75" stroke="#475569" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <line x1="22" y1="71" x2="10" y2="70" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="22" y1="75" x2="8" y2="76" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="98" y1="71" x2="110" y2="70" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
    <line x1="98" y1="75" x2="112" y2="76" stroke="#94A3B8" stroke-width="1.2" stroke-linecap="round"/>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
};

interface LiveSnapCameraProps {
  onCapture: (base64: string) => void;
  onClose: () => void;
}

function LiveSnapCamera({ onCapture, onClose }: LiveSnapCameraProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [capturedImg, setCapturedImg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"none" | "love" | "glow" | "noir">("none");
  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function startCamera() {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: false,
        });
        if (active) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        }
      } catch (err) {
        console.error("Failed to fetch camera stream: ", err);
        setCameraError("Camera access has been disabled or is not supported in this frame. Please allow access or choose a photo.");
      }
    }
    startCamera();
    return () => {
      active = false;
    };
  }, [facingMode]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === "user" ? "environment" : "user"));
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      if (facingMode === "user") {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setCapturedImg(dataUrl);
      sensory.success();
    }
  };

  const getFilterStyle = (filterType: "none" | "love" | "glow" | "noir") => {
    switch (filterType) {
      case "love":
        return "sepia(20%) saturate(140%) hue-rotate(-20deg) brightness(105%) contrast(95%)";
      case "glow":
        return "brightness(115%) saturate(110%) contrast(90%) opacity(95%)";
      case "noir":
        return "grayscale(100%) contrast(125%) brightness(95%)";
      case "none":
      default:
        return "none";
    }
  };

  const handleApply = () => {
    if (!capturedImg) return;
    const img = new Image();
    img.src = capturedImg;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.filter = getFilterStyle(activeFilter);
        ctx.drawImage(img, 0, 0);
        const filteredDataUrl = canvas.toDataURL("image/jpeg");
        onCapture(filteredDataUrl);
      }
    };
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black text-white flex flex-col justify-between p-6 select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between z-10">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all active:scale-95"
        >
          <X size={20} />
        </button>
        <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider flex items-center gap-1.5 uppercase">
          <Sparkles size={12} className="text-amber-400" />
          <span>Snapchat Snap</span>
        </div>
        <div className="w-10 h-10" /> {/* Spacer */}
      </div>

      {/* Main Viewfinder / Snapped preview container */}
      <div className="relative flex-1 my-6 rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 flex items-center justify-center shadow-2xl">
        {capturedImg ? (
          <img
            src={capturedImg}
            alt="Snap Preview"
            className="w-full h-full object-cover"
            style={{ filter: getFilterStyle(activeFilter) }}
          />
        ) : cameraError ? (
          <div className="p-8 text-center flex flex-col items-center gap-4">
            <Camera size={40} className="text-white/20" />
            <p className="text-sm font-semibold opacity-70 max-w-[280px] leading-relaxed">{cameraError}</p>
            <button
              onClick={onClose}
              className="mt-2 px-6 py-2.5 bg-white text-black font-bold text-xs rounded-full shadow-lg"
            >
              Choose from Gallery
            </button>
          </div>
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              "w-full h-full object-cover",
              facingMode === "user" && "scale-x-[-1]"
            )}
          />
        )}

        {/* Dynamic Watermark on Love Theme */}
        {capturedImg && activeFilter === "love" && (
          <div className="absolute top-4 right-4 bg-rose-500/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-wider text-rose-200 border border-rose-400/30">
            💖 Love Spell Filter
          </div>
        )}
      </div>

      {/* Bottom control items */}
      <div className="z-10 flex flex-col items-center gap-4 shrink-0">
        {capturedImg ? (
          <div className="w-full space-y-5">
            {/* Filter Sliders / selectors */}
            <div className="flex items-center justify-center gap-2">
              {[
                { id: "none", label: "Original", icon: "🎬" },
                { id: "love", label: "Romance", icon: "🌸" },
                { id: "glow", label: "Glow", icon: "✨" },
                { id: "noir", label: "Noir", icon: "🎞️" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setActiveFilter(f.id as any);
                    sensory.tap();
                  }}
                  className={cn(
                    "px-3.5 py-2.5 rounded-2xl flex items-center gap-1.5 text-xs font-bold border transition-all active:scale-95",
                    activeFilter === f.id
                      ? "bg-white text-black border-white shadow-md scale-103"
                      : "bg-white/5 text-white/80 border-white/5 hover:border-white/15"
                  )}
                >
                  <span>{f.icon}</span>
                  <span>{f.label}</span>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button
                onClick={() => {
                  setCapturedImg(null);
                  sensory.tap();
                }}
                className="py-3.5 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-2xl active:scale-95 transition-all text-xs"
              >
                Retake
              </button>
              <button
                onClick={handleApply}
                className="py-3.5 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl active:scale-95 transition-all text-xs shadow-lg shadow-primary/20"
              >
                Send Snap Photo
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-10 w-full mb-2">
            {/* Gallery Fallback */}
            <button
              onClick={onClose}
              className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-90"
              title="Gallery"
            >
              <ImageIcon size={20} className="text-white/80" />
            </button>

            {/* Shutter Button with snap animation */}
            <button
              onClick={capturePhoto}
              className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 active:scale-95 transition-all bg-transparent disabled:opacity-50"
              disabled={!!cameraError}
            >
              <div className="w-14 h-14 rounded-full bg-white relative">
                <div className="absolute inset-0.5 rounded-full border border-black/10" />
              </div>
            </button>

            {/* Switch Camera */}
            <button
              onClick={toggleFacingMode}
              className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all active:scale-95 disabled:opacity-50"
              disabled={!!cameraError}
              title="Flip Camera"
            >
              <Palette size={20} className="text-white/80 rotate-45" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

interface ChatProps {
  socket: Socket | null;
}

export function ChatScreen({ socket }: ChatProps) {
  const {
    user,
    partner,
    userLoc,
    partnerLoc,
    messages,
    roomId,
    setView,
    addCoins,
    setE2eReady,
  } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      partner: state.partner,
      userLoc: state.userLoc,
      partnerLoc: state.partnerLoc,
      messages: state.messages,
      roomId: state.roomId,
      setView: state.setView,
      addCoins: state.addCoins,
      setE2eReady: state.setE2eReady,
    })),
  );

  const [showChatMenu, setShowChatMenu] = useState(false);
  const [chatWallpaper, setChatWallpaper] = useState(() => {
    return localStorage.getItem("blablu_chat_wallpaper") || "default";
  });
  const [showWallpaperSelector, setShowWallpaperSelector] = useState(false);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [showDoodleCreator, setShowDoodleCreator] = useState(false);
  const [showStarredDrawer, setShowStarredDrawer] = useState(false);
  const [decryptedMap, setDecryptedMap] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    messages.forEach((m: any) => {
      if (m.text && !decryptedMap[m.id]) {
        if (m.text.startsWith && m.text.startsWith("E2EE:")) {
          decryptData(m.text).then((t) => {
            if (active) {
              setDecryptedMap((prev) => ({ ...prev, [m.id]: t }));
            }
          });
        } else {
          setDecryptedMap((prev) => ({ ...prev, [m.id]: m.text || "" }));
        }
      }
    });
    return () => {
      active = false;
    };
  }, [messages, decryptedMap]);

  const sendDoodle = async (base64: string) => {
    if (!roomId || !user) return;
    try {
      sensory.success();
      const encryptedImage = await encryptData(base64);
      await addDoc(collection(db, "pairs", roomId, "chatMessages"), {
        senderId: user.uid,
        image: encryptedImage,
        timestamp: serverTimestamp(),
        status: "sent",
      });
      setShowDoodleCreator(false);
      setShowAttachmentMenu(false);
    } catch (err) {
      console.error("Failed to send doodle", err);
    }
  };

  const handleScrollToMessage = (msgId: string) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent("highlight-msg", { detail: { id: msgId } }));
      }, 300);
      sensory.success();
    }
  };

  const DEFAULT_QUICK_MESSAGES = [
    { id: "eat", type: "eat", label: "Ask to eat", icon: "Utensils" },
    { id: "water", type: "water", label: "Ask to drink", icon: "Droplet" },
    { id: "medicine", type: "medicine", label: "Ask med", icon: "Pill" },
  ];

  const [quickMessages, setQuickMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(`blablu_qm_${user?.uid}`);
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_QUICK_MESSAGES;
  });

  useEffect(() => {
    if (user?.uid) {
      localStorage.setItem(
        `blablu_qm_${user.uid}`,
        JSON.stringify(quickMessages),
      );
    }
  }, [quickMessages, user?.uid]);

  const [isAddingQM, setIsAddingQM] = useState(false);
  const [newQMLabel, setNewQMLabel] = useState("");

  const handleAddQM = () => {
    if (!newQMLabel.trim()) {
      setIsAddingQM(false);
      return;
    }
    const newQM = {
      id: Date.now().toString(),
      type: "custom",
      label: newQMLabel.trim(),
      icon: "MessageSquare",
    };
    setQuickMessages([...quickMessages, newQM]);
    setNewQMLabel("");
    setIsAddingQM(false);
    sensory.tap();
  };

  const handleDeleteQM = (id: string) => {
    setQuickMessages(quickMessages.filter((qm: any) => qm.id !== id));
    sensory.tap();
  };

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [reactToMsgId, setReactToMsgId] = useState<string | null>(null);
  const [replyToMsgId, setReplyToMsgId] = useState<string | null>(null);
  const [activeEffect, setActiveEffect] = useState<string | null>(null);
  const [floatingEmojis, setFloatingEmojis] = useState<
    { id: string; emoji: string }[]
  >([]);
  const [showCare, setShowCare] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const DEFAULT_STICKERS = [
    "/screenshot_sticker_1.png",
    getClownCatStickerDataUrl(),
  ];

  const [customStickers, setCustomStickers] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("blablu_custom_stickers");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const stickerInputRef = useRef<HTMLInputElement>(null);
  const longPressTimeoutRef = useRef<any>(null);
  const isLongPressRef = useRef<boolean>(false);
  const lastStickerSentTimeRef = useRef<number>(0);

  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          if (audioChunksRef.current.length > 0) {
            setRecordedAudio(reader.result as string);
          }
        };
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      sensory.tap();
    } catch (err) {
      console.error("Failed to start recording", err);
      alert("Microphone permission denied or not available.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      sensory.tap();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
      setRecordedAudio(null);
      setIsRecording(false);
      sensory.tap();
    } else {
      setRecordedAudio(null);
    }
  };

  const handleAddCustomSticker = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      const updated = [...customStickers, base64];
      setCustomStickers(updated);
      localStorage.setItem("blablu_custom_stickers", JSON.stringify(updated));
      sensory.success();
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomSticker = (index: number) => {
    const updated = customStickers.filter((_, i) => i !== index);
    setCustomStickers(updated);
    localStorage.setItem("blablu_custom_stickers", JSON.stringify(updated));
    sensory.tap();
  };

  const [isTypingLocal, setIsPartnerTypingLocal] = useState(false);
  const [tick, setTick] = useState(0);
  const [imageFile, setImageFile] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const exportChatTxt = () => {
    if (!messages.length) return;
    const txt = messages
      .map(
        (m) =>
          `[${new Date(m.timestamp?.toMillis ? m.timestamp.toMillis() : Date.now()).toLocaleString()}] ${m.senderId === user?.uid ? user?.nickname || "Me" : partner?.nickname || "Partner"}: ${m.text || (m.image ? "[Image]" : "")}`,
      )
      .join("\n");
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat_export_${Date.now()}.txt`;
    a.click();
    setShowMenu(false);
  };

  const exportChatPdf = async () => {
    if (!messages.length) return;
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();
      let y = 10;
      doc.setFontSize(10);
      messages.forEach((m) => {
        const line = `[${new Date(m.timestamp?.toMillis ? m.timestamp.toMillis() : Date.now()).toLocaleString()}] ${m.senderId === user?.uid ? user?.nickname || "Me" : partner?.nickname || "Partner"}: ${m.text || (m.image ? "[Image]" : "")}`;
        const split = doc.splitTextToSize(line, 180);
        doc.text(split, 10, y);
        y += 7 * split.length;
        if (y > 280) {
          doc.addPage();
          y = 10;
        }
      });
      doc.save(`chat_export_${Date.now()}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to export PDF");
    }
    setShowMenu(false);
  };

  const deleteChatHistory = async () => {
    if (!roomId) return;
    if (
      !window.confirm(
        "Are you sure you want to delete ALL messages for both of you? This cannot be undone.",
      )
    )
      return;

    try {
      // Deleting all messages in the collection might require multiple batches if there are >500 messages,
      // but for this preview we'll assume under 500 or just delete the recently fetched ones for now.
      // Better to fetch all current loaded docs and delete them.
      const msgsRef = collection(db, "pairs", roomId, "chatMessages");
      const q = query(msgsRef);
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error(err);
    }
    setShowMenu(false);
  };

  const handleResetE2EE = async () => {
    if (
      window.confirm(
        "Are you sure you want to reset your E2EE passcode? Your messages are secure, but you will need to re-enter your passcode (and make sure your partner enters the exact same one) to decrypt messages again.",
      )
    ) {
      clearE2E();
      setE2eReady(false);
      setShowMenu(false);
      if (roomId) {
        try {
          await updateDoc(doc(db, "pairs", roomId), {
            e2eePasscode: deleteField()
          });
        } catch (err) {
          console.error("Failed to reset database E2EE passcode", err);
        }
      }
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === "string") {
        try {
          // Extremely aggressive compression to keep it well under 1MB Firestore limit
          // since we are bypassing Firebase Storage entirely.
          const compressed = await compressImage(event.target.result, 600, 0.4);

          if (compressed.length > 900_000) {
            alert(
              "Image is too large even after compression. Please select a smaller photo.",
            );
            return;
          }

          setImageFile(compressed);
          sensory.tap();
        } catch (err) {
          console.error("Image compression failed", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const lastProcessedMsgId = useRef<string | null>(null);
  const lastPushSentRef = useRef<number>(0);

  // Ticker to refresh "seen Xm ago" labels
  useEffect(() => {
    const ticker = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!roomId || !user || !messages || messages.length === 0) return;

    const unreadMessages = (messages || []).filter(
      (m) => m.senderId !== user.uid && (!m.read || m.status !== "seen"),
    );
    if (unreadMessages.length > 0) {
      const batch = writeBatch(db);
      unreadMessages.forEach((m) => {
        batch.update(doc(db, "pairs", roomId, "chatMessages", m.id), {
          read: true,
          status: "seen",
        });
      });
      batch
        .commit()
        .catch((err) =>
          console.error("Failed to mark messages as read/seen:", err),
        );
      sensory.play("swoosh");
    }
  }, [messages.length, roomId, user?.uid]);

  useEffect(() => {
    if (!messages || !messages.length || !user) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.senderId !== user.uid &&
      lastMsg.id !== lastProcessedMsgId.current
    ) {
      lastProcessedMsgId.current = lastMsg.id;
      const effect = detectRomanticEffect(lastMsg.text);
      if (effect) {
        setActiveEffect(effect);
        setTimeout(() => setActiveEffect(null), 4000);
      }
    }
  }, [messages, user]);

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(timer);
  }, [(messages || []).length]);

  const sendMessage = async () => {
    if ((!input.trim() && !imageFile && !recordedAudio) || !user || !roomId) return;
    const textToSend = input.trim();
    const imageToSend = imageFile;
    const audioToSend = recordedAudio;

    setInput("");
    setImageFile(null);
    setRecordedAudio(null);
    setReplyToMsgId(null);
    
    const lowerText = textToSend.toLowerCase();
    const sweetPhrases = ["i love you", "baby"];
    if (sweetPhrases.some(phrase => lowerText.includes(phrase))) {
      useAppStore.getState().addPairXp(10);
    }
    
    try {
      const msgData: any = {
        senderId: user.uid,
        status: "sent",
        timestamp: serverTimestamp(),
        ...(replyToMsgId ? { replyTo: replyToMsgId } : {}),
      };
      if (textToSend) msgData.text = await encryptData(textToSend);
      if (imageToSend) msgData.image = await encryptData(imageToSend);
      if (audioToSend) msgData.audio = await encryptData(audioToSend);

      await addDoc(collection(db, "pairs", roomId, "chatMessages"), msgData);

      if (socket) {
        socket.emit("chat_message", {
          roomId,
          senderId: user.uid,
          senderName: user.nickname || "Partner",
          text: textToSend || "Sent you a file 📎",
          type: "chat"
        });
      }

      if (partner?.fcmToken) {
        const privacy = useAppStore.getState().privacyModeEnabled;
        fetch(`${CONFIG.SERVER_URL}/api/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: partner.fcmToken,
            title: "Blablu",
            body: privacy ? "blablubla blu" : `${user.nickname || "Partner"} sent you a chat`,
            data: { roomId, senderId: user.uid, type: "chat" },
          }),
        }).catch(() => {});
      }

      sensory.play("pop");
      sensory.tap();
    } catch (err: any) {
      console.error("sendMessage failed:", err);
      setInput(textToSend);
    }
  };

  const sendSticker = async (stickerSrc: string) => {
    if (!user || !roomId) return;
    const nowTime = Date.now();
    if (nowTime - lastStickerSentTimeRef.current < 450) return;
    lastStickerSentTimeRef.current = nowTime;
    
    try {
      const encryptedImage = await encryptData(stickerSrc);
      await addDoc(collection(db, "pairs", roomId, "chatMessages"), {
        senderId: user.uid,
        status: "sent",
        timestamp: serverTimestamp(),
        image: encryptedImage,
        isSticker: true
      });

      if (socket) {
        socket.emit("chat_message", {
          roomId,
          senderId: user.uid,
          senderName: user.nickname || "Partner",
          text: "Sent you a sticker 🤩",
          type: "chat"
        });
      }

      if (partner?.fcmToken) {
        const privacy = useAppStore.getState().privacyModeEnabled;
        fetch(`${CONFIG.SERVER_URL}/api/notify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: partner.fcmToken,
            title: "Blablu Sticker",
            body: privacy ? "blablubla blu 🌈" : `${user.nickname || "Partner"} sent you a sticker 🤩`,
            data: { roomId, senderId: user.uid, type: "chat" },
          }),
        }).catch(() => {});
      }

      sensory.play("pop");
      sensory.tap();
    } catch (err: any) {
      console.error("sendSticker failed:", err);
    }
  };

  const deleteAllChat = async () => {
    if (!roomId) return;
    if (!window.confirm("Are you sure you want to delete all chat?")) return;
    try {
      const q = query(collection(db, "pairs", roomId, "chatMessages"));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      sensory.tap();
    } catch (err) {
      handleFirestoreError(err, "delete", `pairs/${roomId}/chatMessages`);
    }
  };

  const exportChatAsText = () => {
    if (!messages || messages.length === 0) return;

    const partnerName = partner?.nickname || partner?.name || "Partner";
    let textContent = `Chat Export with ${partnerName}\nDate: ${new Date().toLocaleDateString()}\n\n`;

    messages.forEach((m) => {
      const isMe = m.senderId === user?.uid;
      const senderName = isMe ? "Me" : partnerName;
      const time = new Date(m.timestamp).toLocaleString();
      textContent += `[${time}] ${senderName}:\n${m.text}\n`;
      if (m.reactions && Object.keys(m.reactions).length > 0) {
        const reactionStrs = Object.values(m.reactions).join(" ");
        if (reactionStrs) {
          textContent += `(Reactions: ${reactionStrs})\n`;
        }
      }
      textContent += `\n`;
    });

    const blob = new Blob([textContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Chat_Export_${partnerName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setShowChatMenu(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const addReaction = async (msgId: string, emoji: string) => {
    if (!user || !roomId || !msgId) return;
    try {
      const msg = messages?.find((m) => m.id === msgId);
      const isRemoving = msg?.reactions?.[user.uid] === emoji;

      setReactToMsgId(null);
      sensory.tap();

      if (isRemoving) {
        await updateDoc(doc(db, "pairs", roomId, "chatMessages", msgId), {
          [`reactions.${user.uid}`]: deleteField(),
        });
      } else {
        const id = Math.random().toString(36).substr(2, 9);
        setFloatingEmojis((prev) => [...prev, { id, emoji }]);

        // Delay firestore write so the corner reaction appears after flying animation
        setTimeout(async () => {
          try {
            await updateDoc(doc(db, "pairs", roomId, "chatMessages", msgId), {
              [`reactions.${user.uid}`]: emoji,
            });
          } catch (err) {
            handleFirestoreError(
              err,
              "update",
              `pairs/${roomId}/chatMessages/${msgId}`,
            );
          }
        }, 1000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const markAsSeen = async (msgId: string) => {
    // Legacy single message seen marker - keeping this for intersection observer just in case
    if (!user || !roomId || !msgId) return;
    try {
      await updateDoc(doc(db, "pairs", roomId, "chatMessages", msgId), {
        status: "seen",
      });
    } catch (e) {
      console.error("Error marking seen", e);
    }
  };

  const toggleStarMessage = async (msgId: string, currentlyStarred?: boolean) => {
    if (!user || !roomId || !msgId) return;
    try {
      await updateDoc(doc(db, "pairs", roomId, "chatMessages", msgId), {
        isStarred: !currentlyStarred,
      });
      sensory.success();
    } catch (err) {
      console.error("Failed to toggle star status: ", err);
    }
  };

  const getWallpaperClass = () => {
    switch (chatWallpaper) {
      case "sakura":
        return "bg-gradient-to-tr from-pink-50/90 via-[#fff0f3]/80 to-rose-100/95 dark:from-[#2e0e15] dark:via-[#1c080e] dark:to-[#3b121e] relative before:content-[''] before:absolute before:inset-0 before:opacity-[0.03] before:dark:opacity-[0.07] before:bg-[radial-gradient(#e11d48_1px,transparent_1px)] before:[background-size:16px_16px]";
      case "sunset":
        return "bg-gradient-to-tr from-orange-50/90 via-[#fff3e0]/80 to-rose-100/90 dark:from-[#351515] dark:via-[#200c0c] dark:to-[#2e1d35] relative before:content-[''] before:absolute before:inset-0 before:opacity-[0.04] before:bg-[linear-gradient(45deg,#f43f5e_1px,transparent_1px)] before:[background-size:24px_24px]";
      case "midnight":
        return "bg-gradient-to-b from-[#0a071c] via-[#05030e] to-[#010005] text-white relative before:content-[''] before:absolute before:inset-0 before:opacity-[0.12] before:bg-[radial-gradient(#ffffff_1px,transparent_1px)] before:[background-size:32px_32px]";
      case "mint":
        return "bg-[#f4fbf7] dark:bg-[#071710] relative before:content-[''] before:absolute before:inset-0 before:opacity-[0.05] before:dark:opacity-[0.08] before:bg-[linear-gradient(to_right,#059669_1px,transparent_1px),linear-gradient(to_bottom,#059669_1px,transparent_1px)] before:[background-size:20px_20px]";
      case "default":
      default:
        return "bg-bg shadow-inner";
    }
  };

  const now = useNow(10000);
  const pOnline = isUserOnline(partner, now);
  const replyMsg = replyToMsgId
    ? (messages || []).find((m) => m.id === replyToMsgId)
    : null;

  const [replyMsgText, setReplyMsgText] = useState("");

  useEffect(() => {
    let active = true;
    const attempt = () => {
      if (replyMsg?.text && replyMsg.text.startsWith('E2EE:')) {
        decryptData(replyMsg.text).then(t => active && setReplyMsgText(t));
      } else {
        setReplyMsgText(replyMsg?.text || "");
      }
    };
    attempt();
    window.addEventListener('e2ee-ready', attempt);
    return () => { active = false; window.removeEventListener('e2ee-ready', attempt); };
  }, [replyMsg?.text]);

  const distanceStats = useMemo(() => {
    if (!userLoc || !partnerLoc) return null;
    const dist = getDistance(
      userLoc.lat,
      userLoc.lng,
      partnerLoc.lat,
      partnerLoc.lng,
    );
    return formatDistance(dist);
  }, [userLoc, partnerLoc]);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-bg z-[200] flex flex-col h-full safe-area-bottom overflow-hidden font-sans"
    >
      {/* Romantic Effects Overlay */}
      <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
        <AnimatePresence>
          {activeEffect && <RomanticEffects effect={activeEffect} />}
        </AnimatePresence>
      </div>

      {/* ADVANCED HEADER */}
      <div className="fixed top-0 left-0 right-0 z-[100] pt-safe-top bg-bg/85 backdrop-blur-2xl border-b border-border/40 shadow-sm flex flex-col">
        {/* Primary Row Container */}
        <div className="px-2 py-3 flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
          <button
            onClick={() => setView("home")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-card border border-border text-text shadow-sm active:scale-90 transition-all hover:bg-black/5"
          >
            <ChevronLeft size={24} />
          </button>
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div
                className="w-11 h-11 rounded-full overflow-hidden bg-card border-2 border-white dark:border-[#1a1a2e] shadow-sm flex items-center justify-center relative z-10 cursor-pointer hover:scale-105 transition-transform"
                onClick={() => setView("journey")}
              >
                {partner?.avatarUrl ? (
                  <img
                    src={partner.avatarUrl}
                    alt="Partner"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-text/60">
                    {partner?.nickname?.[0]?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
              {pOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white dark:border-[#1a1a2e] rounded-full z-20 shadow-sm" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-text text-base leading-tight">
                {partner?.nickname || partner?.name || "Partner"}
              </span>
              <div className="flex items-center gap-1.5 opacity-60">
                <span className="text-[11px] font-medium truncate">
                  {pOnline
                    ? "Online now"
                    : getSeenText(partner?.lastActive || 0, now)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 relative">
          {distanceStats && (
            <div
              className="px-3 py-1.5 rounded-full bg-card/60 border border-white/50 dark:border-white/10 flex items-center gap-1.5 shadow-sm text-[11px] font-bold text-text/80 cursor-pointer hover:bg-primary/5 transition-colors"
              onClick={() => setView("journey")}
            >
              <MapPin size={12} className="text-primary/70" />
              {distanceStats}
            </div>
          )}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-10 h-10 rounded-full bg-card/60 border border-white/50 dark:border-white/10 flex items-center justify-center shadow-sm hover:bg-black/5 transition-colors"
          >
            <MoreVertical size={20} className="text-text/70" />
          </button>

          <AnimatePresence>
            {showMenu && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="absolute top-12 right-0 w-56 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                >
                  <div className="p-1 space-y-1">
                    <button
                      onClick={exportChatTxt}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Download size={16} /> Export TXT
                    </button>
                    <button
                      onClick={exportChatPdf}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Download size={16} /> Export PDF
                    </button>
                    <button
                      onClick={handleResetE2EE}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Lock size={16} /> Reset E2EE Passcode
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowStarredDrawer(true);
                        sensory.tap();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Star size={16} className="text-amber-500 fill-amber-500/20" /> Starred Memories
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowWallpaperSelector(true);
                        sensory.tap();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-black/5 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Palette size={16} /> Choose Wallpaper
                    </button>
                    <button
                      onClick={deleteChatHistory}
                      className="w-full text-left px-4 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors flex items-center gap-2"
                    >
                      <Trash2 size={16} /> Clear Chat
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
        </div>

      </div>

      {/* STARRED MEMORIES DRAWER */}
      <AnimatePresence>
        {showStarredDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-[250] backdrop-blur-sm"
              onClick={() => setShowStarredDrawer(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[260] bg-card border-t border-border rounded-t-[2.5rem] shadow-2xl p-6 flex flex-col max-w-md mx-auto h-[80vh]"
            >
              {/* Top pull bar */}
              <div className="w-12 h-1.5 bg-border rounded-full mb-5 cursor-pointer self-center" onClick={() => setShowStarredDrawer(false)} />
              
              <div className="flex items-center gap-2 mb-1 self-center">
                <Star className="text-amber-400 fill-amber-400" size={22} />
                <h3 className="font-display font-bold text-lg text-text">Memory Treasure Box</h3>
              </div>
              <p className="text-xs text-text/50 mb-5 text-center px-6 font-medium">Your bookmarked romantic chats, snaps, and sweet letters</p>

              {/* Starred items content list */}
              <div className="flex-1 overflow-y-auto no-scrollbar space-y-3.5 pr-1 pb-4">
                {(() => {
                  const starred = messages.filter((m: any) => m.isStarred);
                  if (starred.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-center opacity-45 px-6">
                        <div className="w-14 h-14 rounded-full bg-amber-400/10 flex items-center justify-center mb-3">
                          <Star size={24} className="text-amber-400" />
                        </div>
                        <p className="text-sm font-semibold text-text mb-1">Your memory box is empty</p>
                        <p className="text-xs text-text/70 leading-relaxed max-w-[210px] font-medium">Long-press any message bubble and tap Star to highlight your favorite couple moments.</p>
                      </div>
                    );
                  }
                  return starred.map((m: any) => {
                    const text = decryptedMap[m.id] || m.text || "";
                    const isMe = m.senderId === user?.uid;
                    const senderNickname = isMe ? "You" : partner?.nickname || "Them";
                    return (
                      <div
                        key={m.id}
                        className="bg-bg/50 border border-border/50 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-xs hover:border-primary/20 transition-all cursor-pointer group"
                        onClick={() => {
                          setShowStarredDrawer(false);
                          setTimeout(() => {
                            handleScrollToMessage(m.id);
                          }, 250);
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full overflow-hidden bg-white flex items-center justify-center text-[10px] font-bold border border-border">
                              {isMe ? (
                                user?.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full object-cover" /> : "ME"
                              ) : (
                                partner?.avatarUrl ? <img src={partner.avatarUrl} className="w-full h-full object-cover" /> : "P"
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-text/70">{senderNickname}</span>
                          </div>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              sensory.tap();
                              try {
                                await toggleStarMessage(m.id, true);
                              } catch (err) {
                                console.error(err);
                              }
                            }}
                            className="p-1 text-amber-500 hover:text-text/30 active:scale-90 transition-all"
                            title="Unstar memory"
                          >
                            <Star size={14} fill="currentColor" />
                          </button>
                        </div>

                        <div className="text-xs text-text/80 font-medium break-words px-1">
                          {m.image ? (
                            <div className="flex items-center gap-2 text-primary">
                              <ImageIcon size={14} />
                              <span className="font-semibold text-[11px]">Secure Image Attachment</span>
                            </div>
                          ) : m.audio ? (
                            <div className="flex items-center gap-2 text-primary">
                              <Mic size={14} />
                              <span className="font-semibold text-[11px]">Secure Voice Memo</span>
                            </div>
                          ) : (
                            text
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[9px] text-text/40 hover:text-primary transition-colors font-semibold uppercase tracking-wider leading-none mt-1">
                          <span>{m.timestamp ? formatBubbleTime(m.timestamp) : "Just now"}</span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold leading-none text-primary normal-case">Jump to message &rarr;</span>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              <button
                onClick={() => setShowStarredDrawer(false)}
                className="w-full mt-4 py-3.5 bg-neutral-100 dark:bg-white/5 text-text/80 hover:bg-neutral-200 dark:hover:bg-white/10 font-bold rounded-2xl active:scale-95 transition-all text-xs border border-border"
              >
                Close Treasure Box
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* WALLPAPER SELECTOR MODAL */}
      <AnimatePresence>
        {showWallpaperSelector && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-[250]"
              onClick={() => setShowWallpaperSelector(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="fixed bottom-0 left-0 right-0 z-[260] bg-card border-t border-border rounded-t-[2.5rem] shadow-2xl p-6 pb-10 flex flex-col items-center max-w-md mx-auto"
            >
              <div className="w-12 h-1.5 bg-border rounded-full mb-6 cursor-pointer" onClick={() => setShowWallpaperSelector(false)} />
              
              <div className="flex items-center gap-2 mb-2">
                <Palette className="text-primary" size={20} />
                <h3 className="font-display font-bold text-lg text-text">Chat Wallpaper</h3>
              </div>
              <p className="text-xs text-text/50 mb-6 text-center">Customize the background with romantic presets</p>

              <div className="grid grid-cols-2 gap-4 w-full">
                {[
                  { id: "default", label: "Cozy Slate", class: "bg-bg shadow-sm border border-border", icon: <Layers size={22} className="text-text/70" /> },
                  { id: "sakura", label: "Sakura Love", class: "bg-gradient-to-tr from-pink-100 to-rose-200", icon: <Heart size={22} className="text-rose-600 fill-rose-600/30" /> },
                  { id: "sunset", label: "Sunset Kiss", class: "bg-gradient-to-tr from-amber-100 via-rose-100 to-purple-200", icon: <Sun size={22} className="text-amber-600" /> },
                  { id: "midnight", label: "Starry Night", class: "bg-gradient-to-b from-indigo-950 to-purple-950", icon: <Sparkles size={22} className="text-amber-400" /> },
                  { id: "mint", label: "Mint Grid", class: "bg-emerald-50", icon: <Palette size={22} className="text-emerald-700" /> },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setChatWallpaper(item.id);
                      localStorage.setItem("blablu_chat_wallpaper", item.id);
                      sensory.success();
                    }}
                    className={cn(
                      "group relative flex flex-col items-center justify-center p-4 rounded-3xl border-2 transition-all cursor-pointer h-24 overflow-hidden shadow-sm",
                      chatWallpaper === item.id 
                        ? "border-primary shadow-md scale-102" 
                        : "border-border hover:border-text/20"
                    )}
                  >
                    <div className={cn("absolute inset-0 opacity-85 group-hover:opacity-100 transition-opacity", item.class)} />
                    <div className="relative z-10 flex flex-col items-center">
                      <span className="mb-1 flex items-center justify-center">{item.icon}</span>
                      <span className="text-xs font-bold font-sans text-text">{item.label}</span>
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowWallpaperSelector(false)}
                className="w-full mt-6 py-3.5 bg-primary text-white font-bold rounded-2xl active:scale-95 transition-all text-sm shadow-md hover:bg-primary/90"
              >
                Apply Wallpaper
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* EXPANDED IMAGE MODAL */}
      <AnimatePresence>
        {expandedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setExpandedImage(null)}
          >
            <button
              onClick={() => setExpandedImage(null)}
              className="absolute top-safe-top right-4 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[310]"
            >
              <X size={24} />
            </button>
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={expandedImage}
              alt="Expanded"
              className="max-w-full max-h-full object-contain touch-pinch-zoom rounded-md"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* CHAT AREA */}
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 min-h-0 overflow-y-auto px-5 pt-28 pb-6 flex flex-col no-scrollbar",
          getWallpaperClass()
        )}
      >
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-center px-10">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mb-4">
              <Send size={32} className="text-primary" />
            </div>
            <p className="font-display text-xl text-text">
              Say something sweet...
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {messages.map((m, i) => {
              const prev = messages[i - 1];
              const showDate =
                !prev ||
                formatSeparatorDate(m.timestamp) !==
                  formatSeparatorDate(prev.timestamp);

              return (
                <React.Fragment key={m.id}>
                  {showDate && (
                    <div className="flex items-center justify-center my-4 opacity-50">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-[10px] font-bold text-text/40 uppercase tracking-[0.2em] px-3">
                        {formatSeparatorDate(m.timestamp)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                  )}
                  <ChatMessage
                    m={m}
                    isMe={m.senderId === user?.uid}
                    user={user}
                    partner={partner}
                    messages={messages}
                    onReply={setReplyToMsgId}
                    onReact={addReaction}
                    onVisible={markAsSeen}
                    onStar={toggleStarMessage}
                    reactToMsgId={reactToMsgId}
                    setReactToMsgId={setReactToMsgId}
                    onExpandImage={setExpandedImage}
                    nextMsg={messages[i + 1]}
                  />
                </React.Fragment>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}

        <AnimatePresence>
          {floatingEmojis.map((fe) => (
            <FloatingEmoji
              key={fe.id}
              emoji={fe.emoji}
              onComplete={() =>
                setFloatingEmojis((prev) => prev.filter((e) => e.id !== fe.id))
              }
            />
          ))}
        </AnimatePresence>
      </div>

      {/* INPUT AREA */}
      <div
        className="bg-bg border-t border-border px-4 py-3 sticky bottom-0 z-[60]"
        style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}
      >
        {/* Reply Bar */}
        <AnimatePresence>
          {replyMsg && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="bg-card border border-border rounded-xl px-3 py-2 mb-2 flex items-center justify-between text-xs"
            >
              <div className="flex-1 truncate pr-3">
                <span className="font-bold text-primary block mb-0.5">
                  Replying to{" "}
                  {replyMsg.senderId === user?.uid
                    ? "yourself"
                    : partner?.nickname || "them"}
                </span>
                <p className="opacity-60 italic truncate text-[11px] leading-tight">
                  "{replyMsgText}"
                </p>
              </div>
              <button
                onClick={() => setReplyToMsgId(null)}
                className="p-1 hover:bg-black/5 rounded-full transition-colors"
              >
                <X size={14} className="text-text/40" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stickers & Care Hub */}
        <AnimatePresence>
          {showStickers && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="overflow-hidden bg-card border border-border rounded-2xl p-3 shadow-md"
            >
              <div className="flex items-center justify-between mb-3 border-b border-border pb-2">
                <div className="flex items-center gap-1.5 text-text">
                  <Sparkles size={16} className="text-primary" />
                  <span className="text-sm font-black flex items-center gap-1">
                    Sticker Center
                  </span>
                  <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-bold">
                    Couple Pack
                  </span>
                </div>
                <button
                  onClick={() => stickerInputRef.current?.click()}
                  className="bg-primary hover:bg-primary/95 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1 active:scale-95 transition-all shadow-sm"
                >
                  <Plus size={10} /> Add from Gallery
                </button>
              </div>

              {/* Scrollable grid of stickers */}
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5 max-h-40 overflow-y-auto pr-1 no-scrollbar py-1 mb-3">
                {/* Default stickers */}
                {DEFAULT_STICKERS.map((src, i) => (
                  <div
                    key={`default-${i}`}
                    className="aspect-square bg-card border border-border rounded-xl p-1.5 flex items-center justify-center hover:scale-105 hover:border-primary/40 transition-all shadow-sm group relative"
                  >
                    <button
                      onClick={() => sendSticker(src)}
                      className="w-full h-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
                    >
                      <img
                        src={src}
                        alt="Sticker"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </button>
                  </div>
                ))}

                {/* Custom gallery stickers */}
                {customStickers.map((src, i) => (
                  <div
                    key={`custom-${i}`}
                    className="aspect-square bg-card border border-border rounded-xl p-1.5 flex items-center justify-center hover:scale-105 hover:border-primary/40 transition-all shadow-sm group relative"
                  >
                    <button
                      onMouseDown={(e) => {
                        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                        isLongPressRef.current = false;
                        longPressTimeoutRef.current = setTimeout(() => {
                          isLongPressRef.current = true;
                          sensory.success();
                          if (window.confirm("Are you sure you want to delete this custom sticker?")) {
                            handleRemoveCustomSticker(i);
                          }
                        }, 650);
                      }}
                      onMouseUp={() => {
                        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                        if (!isLongPressRef.current) {
                          sendSticker(src);
                        }
                      }}
                      onMouseLeave={() => {
                        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                      }}
                      onTouchStart={() => {
                        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                        isLongPressRef.current = false;
                        longPressTimeoutRef.current = setTimeout(() => {
                          isLongPressRef.current = true;
                          sensory.success();
                          if (window.confirm("Are you sure you want to delete this custom sticker?")) {
                            handleRemoveCustomSticker(i);
                          }
                        }, 650);
                      }}
                      onTouchEnd={() => {
                        if (longPressTimeoutRef.current) clearTimeout(longPressTimeoutRef.current);
                        if (!isLongPressRef.current) {
                          sendSticker(src);
                        }
                      }}
                      className="w-full h-full flex items-center justify-center cursor-pointer active:scale-95 transition-transform select-none"
                      title="Long press to delete this sticker"
                    >
                      <img
                        src={src}
                        alt="Custom Sticker"
                        className="w-full h-full object-contain pointer-events-none"
                      />
                    </button>
                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveCustomSticker(i);
                      }}
                      className="absolute -top-1.5 -right-1.5 bg-rose-500/90 text-white w-4 h-4 flex items-center justify-center rounded-full hover:scale-110 active:scale-90 transition-transform shadow-sm md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      title="Delete sticker"
                    >
                      <X size={8} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Quick Care Messages Section built right in */}
              <div className="border-t border-border/50 pt-2">
                <span className="text-[10px] uppercase tracking-wider text-text/40 font-bold block mb-2">
                  Quick Care alerts
                </span>
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                  {quickMessages.map((care: any) => {
                    let IconComponent = MessageSquare;
                    if (care.icon === "Utensils") IconComponent = Utensils;
                    else if (care.icon === "Droplet") IconComponent = Droplet;
                    else if (care.icon === "Pill") IconComponent = Pill;

                    return (
                      <div
                        key={care.id}
                        className="relative flex shrink-0 items-stretch bg-background border border-border rounded-full shadow-sm hover:border-primary/20 transition-all"
                      >
                        <button
                          onClick={async () => {
                            if (!user || !roomId) return;
                            await addDoc(
                              collection(db, "pairs", roomId, "chatMessages"),
                              {
                                senderId: user.uid,
                                text:
                                  care.type === "custom"
                                    ? care.label
                                    : `Honey, please ${care.type === "eat" ? "eat something" : care.type === "water" ? "drink water" : "take your medicine"} 🫂`,
                                isCareBtn: true,
                                careType: care.type,
                                timestamp: serverTimestamp(),
                              },
                            );
                            sensory.tap();
                            setShowStickers(false);
                          }}
                          className="px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 text-text/70 active:scale-95"
                        >
                          <IconComponent size={12} className="text-primary/60" />
                          {care.label}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteQM(care.id);
                          }}
                          className="pr-2 pl-1 flex items-center justify-center text-text/40 hover:text-rose-500 active:scale-95 border-l border-border/50"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}

                  {isAddingQM ? (
                    <div className="shrink-0 flex items-center gap-1 bg-background border border-border rounded-full pl-3 pr-1 py-1 shadow-sm">
                      <input
                        type="text"
                        value={newQMLabel}
                        onChange={(e) => setNewQMLabel(e.target.value)}
                        placeholder="New message..."
                        className="bg-transparent border-none outline-none text-[11px] w-24 text-text"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddQM();
                          if (e.key === "Escape") setIsAddingQM(false);
                        }}
                      />
                      <button
                        onClick={handleAddQM}
                        className="bg-primary/20 text-primary p-1 rounded-full active:scale-90 transition-all"
                      >
                        <Check size={12} />
                      </button>
                      <button
                        onClick={() => setIsAddingQM(false)}
                        className="bg-rose-500/10 text-rose-500 p-1 rounded-full active:scale-90 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsAddingQM(true)}
                      className="shrink-0 bg-primary/5 border border-primary/30 border-dashed rounded-full px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 text-primary/70 active:scale-95 transition-all"
                    >
                      <Plus size={12} /> Add Alert
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Image Preview */}
        <AnimatePresence>
          {imageFile && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="relative inline-block mb-3"
            >
              <img
                src={imageFile}
                alt="Preview"
                className="h-24 w-auto rounded-xl object-cover shadow-sm border border-border"
              />
              <button
                onClick={() => setImageFile(null)}
                className="absolute -top-2 -right-2 bg-rose-500 text-white w-6 h-6 flex items-center justify-center rounded-full shadow-md hover:scale-110 transition-transform"
              >
                <X size={14} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-end gap-2 relative">
          <button
            onClick={() => {
              setShowStickers(!showStickers);
            }}
            className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 active:scale-95 transition-all mb-0.5 shadow-sm border border-border/50",
              showStickers 
                ? "bg-primary text-white" 
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
            title="Stickers Center"
          >
            <Smile size={20} className={cn(showStickers ? "text-white" : "text-primary")} />
          </button>
          
          <div className="relative">
            <AnimatePresence>
              {showAttachmentMenu && (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-40"
                    onClick={() => setShowAttachmentMenu(false)}
                  />
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full left-0 mb-2 w-48 bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden"
                  >
                    <button
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        setShowDoodleCreator(true);
                        sensory.tap();
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-black/5 active:bg-black/10 transition-colors flex items-center gap-3 border-b border-border/50"
                    >
                      <Palette size={18} className="text-primary" />
                      Open Doodle Studio
                    </button>
                    <button
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        setIsLiveCameraOpen(true);
                        sensory.tap();
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-black/5 active:bg-black/10 transition-colors flex items-center gap-3 border-b border-border/50"
                    >
                      <Camera size={18} className="text-primary" />
                      Take Live Snap
                    </button>
                    <button
                      onClick={() => {
                        setShowAttachmentMenu(false);
                        fileInputRef.current?.click();
                      }}
                      className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-black/5 active:bg-black/10 transition-colors flex items-center gap-3"
                    >
                      <ImageIcon size={18} className="text-rose-500" />
                      Choose from Gallery
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
            <button
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className="w-10 h-10 rounded-xl bg-card border border-border text-text/60 flex items-center justify-center shrink-0 active:scale-95 transition-all mb-0.5 hover:text-primary relative z-50"
            >
              <ImageIcon size={20} />
            </button>
          </div>
          
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={cameraInputRef}
            onChange={handleImageSelect}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImageSelect}
          />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            ref={stickerInputRef}
            onChange={handleAddCustomSticker}
          />
          {isRecording ? (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl px-4 py-3 flex-1 flex items-center justify-between shadow-sm h-10">
              <div className="flex items-center gap-2 text-rose-500 animate-pulse text-sm font-medium">
                <Mic size={16} />
                Recording...
              </div>
              <button onClick={cancelRecording} className="text-text/50 hover:text-text pr-2">
                <Trash2 size={16} />
              </button>
            </div>
          ) : recordedAudio ? (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl px-4 py-2 flex-1 flex items-center justify-between shadow-sm h-10">
              <audio src={recordedAudio} controls className="h-6 w-full max-w-[150px] scale-90 origin-left" />
              <button onClick={cancelRecording} className="text-text/50 hover:text-text pl-2">
                <X size={16} />
              </button>
            </div>
          ) : (
            <textarea
              value={input}
              onChange={handleInputChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Write a message..."
              rows={1}
              className="bg-card border border-border rounded-2xl px-4 py-3 flex-1 text-sm outline-none resize-none transition-all focus:border-primary/50 max-h-32 shadow-sm placeholder:text-text/20"
              style={{ height: "auto" }}
            />
          )}
          
          <button
            onClick={() => {
              const whatsappNumber = user?.nickname?.toLowerCase().includes("dhruvya") 
                ? "8791013105" 
                : user?.nickname?.toLowerCase().includes("anjali") 
                  ? "7889686144" 
                  : "8791013105"; 
              window.open(`https://wa.me/${whatsappNumber}`, "_blank");
            }}
            className="w-10 h-10 rounded-xl bg-[#25D366] text-white flex items-center justify-center shrink-0 active:scale-95 transition-all shadow-md mb-0.5"
            title="WhatsApp Call"
          >
            <Phone size={18} />
          </button>

          {isRecording ? (
            <button
              onClick={stopRecording}
              className="w-10 h-10 rounded-xl bg-rose-500 text-white flex items-center justify-center shrink-0 active:scale-90 transition-all shadow-md animate-pulse"
            >
              <Square size={18} fill="currentColor" />
            </button>
          ) : input.trim() || imageFile || recordedAudio ? (
            <button
              onClick={sendMessage}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-all shadow-md"
            >
              <Send size={18} />
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 active:scale-90 transition-all shadow-md"
            >
              <Mic size={18} />
            </button>
          )}
        </div>
      </div>

      {isLiveCameraOpen && (
        <LiveSnapCamera
          onCapture={async (base64) => {
            try {
              setIsLiveCameraOpen(false);
              const compressed = await compressImage(base64, 600, 0.4);
              setImageFile(compressed);
            } catch (err) {
              console.error("Compression of snapped image failed:", err);
            }
          }}
          onClose={() => setIsLiveCameraOpen(false)}
        />
      )}

      <AnimatePresence>
        {showDoodleCreator && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-0 z-[500] bg-bg"
          >
            <DoodleScreen 
              onSend={sendDoodle} 
              onClose={() => setShowDoodleCreator(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
