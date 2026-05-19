import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Music, Volume2, VolumeX, X, Upload, Trash2 } from 'lucide-react';
import { cn } from '../utils';
import defaultSongUrl from '../assets/our-song.mp3';

// We'll use a reliable, romantic/soft piano track as the default "Our Song"
const DEFAULT_SONG = defaultSongUrl; 

const DB_NAME = "OurMusicDB";
const STORE_NAME = "songs";

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveSongToDB(blob: Blob, name: string) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put({ blob, name }, "custom_song");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSongFromDB(): Promise<{ blob: Blob, name: string } | null> {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get("custom_song");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

async function removeSongFromDB() {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete("custom_song");
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [songName, setSongName] = useState("We Fell in Love in October");
  const [hasCustomSong, setHasCustomSong] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const initAudio = async () => {
    const saved = await loadSongFromDB().catch(() => null);
    const a = new Audio();
    a.loop = true;
    
    if (saved?.blob) {
      const url = URL.createObjectURL(saved.blob);
      objectUrlRef.current = url;
      a.src = url;
      setSongName(saved.name);
      setHasCustomSong(true);
    } else {
      a.src = DEFAULT_SONG;
      setSongName("We Fell in Love in October");
      setHasCustomSong(false);
    }
    
    audioRef.current = a;
    audioRef.current.muted = isMuted;
  };

  useEffect(() => {
    initAudio();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.play().catch(e => {
        console.error("Audio playback failed:", e);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.muted = isMuted;
  }, [isMuted]);

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPlaying(!isPlaying);
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // We can allow up to e.g. 20MB for local DB, but she mentioned 5MB. 
    setIsUploading(true);
    try {
      await saveSongToDB(file, file.name);
      
      // Stop current playback
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      
      // Reload
      await initAudio();
      setIsPlaying(true); // Auto-play the new song
    } catch(err) {
      console.error("Failed to save song", err);
      alert("Failed to save the song internally.");
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleResetSong = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeSongFromDB();
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
      }
      await initAudio();
    } catch(err) {
      console.error("Failed to reset song", err);
    }
  };

  return (
    <div className="fixed bottom-[110px] right-4 z-[90] flex justify-end">
      <motion.div 
        layout
        className={cn(
          "bg-card/80 backdrop-blur-xl border border-border/50 shadow-2xl overflow-hidden cursor-pointer",
          isExpanded ? "rounded-[2rem] p-4 w-72" : "rounded-full w-12 h-12"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <AnimatePresence mode="popLayout">
          {!isExpanded ? (
            <motion.div 
              key="collapsed"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="w-full h-full flex items-center justify-center relative"
            >
              <Music size={20} className={cn("text-primary transition-all", isPlaying && "animate-bounce")} />
              {isPlaying && (
                <div className="absolute inset-0 rounded-full border-2 border-primary border-t-transparent animate-spin opacity-50" />
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="expanded"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 max-w-[200px]">
                  <div className="min-w-8 w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0">
                    <Music size={14} />
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-bold text-text truncate">{songName}</h4>
                    <p className="text-[9px] font-medium text-text/50 uppercase tracking-widest mt-0.5">
                      {hasCustomSong ? "Local Device Track" : "Always with you"}
                    </p>
                  </div>
                </div>
                <button 
                  className="w-6 h-6 rounded-full bg-bg flex items-center justify-center text-text/50 hover:text-text shrink-0"
                  onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                >
                  <X size={12} />
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 mt-1">
                {hasCustomSong ? (
                  <button 
                    onClick={handleResetSong}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold tracking-wider uppercase active:scale-95 transition-all w-full"
                  >
                    <Trash2 size={12} /> Remove
                  </button>
                ) : (
                  <label 
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[10px] font-bold tracking-wider uppercase active:scale-95 transition-all cursor-pointer w-full"
                  >
                    {isUploading ? (
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Upload size={12} />
                    )}
                    Upload Song
                    <input type="file" accept="audio/*" onChange={handleUpload} className="hidden" />
                  </label>
                )}
              </div>

              <div className="flex items-center justify-between bg-bg/50 px-4 py-3 rounded-2xl mt-1 shadow-inner">
                <button 
                  onClick={toggleMute}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-text/60 active:scale-90 transition-all hover:bg-black/5"
                >
                  {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                </button>
                
                <button 
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/30 active:scale-90 transition-all hover:scale-105"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
                </button>
                
                <div className="w-8 h-8 flex items-center justify-center">
                  {isPlaying && (
                    <div className="flex items-end gap-[3px] h-3">
                      <motion.div animate={{ height: ["4px", "12px", "4px"] }} transition={{ repeat: Infinity, duration: 1 }} className="w-1 bg-primary rounded-t-sm" />
                      <motion.div animate={{ height: ["8px", "4px", "8px"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 bg-primary rounded-t-sm" />
                      <motion.div animate={{ height: ["4px", "10px", "4px"] }} transition={{ repeat: Infinity, duration: 1.2 }} className="w-1 bg-primary rounded-t-sm" />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
