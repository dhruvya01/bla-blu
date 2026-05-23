import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Play, Pause, Trash2, UploadCloud, Save, Music, Heart, Volume2 } from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { db, storage } from "../firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { sensory } from "../utils/sensory";
import { cn } from "../utils";

interface Song {
  id: string;
  title: string;
  url: string;
  singerUid: string;
  singerName: string;
  createdAt: any;
  duration?: number;
}

export function SpotifyScreen() {
  const { user, roomId, partner } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      roomId: state.roomId,
      partner: state.partner,
    })),
  );

  const [songs, setSongs] = useState<Song[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioURL, setAudioURL] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [songTitle, setSongTitle] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, "pairs", roomId, "songs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Song[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Song);
      });
      setSongs(data);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Low bitrate for memory efficiency (16kbps)
      const options = { audioBitsPerSecond: 16000 };
      const recorder = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm;codecs=opus" });
        setAudioBlob(blob);
        setAudioURL(URL.createObjectURL(blob));
        // Stop all tracks to release mic
        stream.getTracks().forEach((track) => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      setAudioBlob(null);
      setAudioURL(null);
      sensory.play("tick");
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Microphone access is required to sing for your cutie!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      setIsRecording(false);
      sensory.play("tick");
    }
  };

  const saveSong = async () => {
    if (!audioBlob || !roomId || !user) return;
    if (!songTitle.trim()) {
      alert("Please give your song cover a cute title!");
      return;
    }
    
    setIsUploading(true);
    try {
      const fileName = `song_${Date.now()}.webm`;
      const storageRef = ref(storage, `pairs/${roomId}/songs/${fileName}`);
      
      await uploadBytes(storageRef, audioBlob);
      const downloadUrl = await getDownloadURL(storageRef);
      
      await addDoc(collection(db, "pairs", roomId, "songs"), {
        title: songTitle.trim(),
        url: downloadUrl,
        singerUid: user.uid,
        singerName: user.email === "anjali@blablu.app" ? "Anjali" : "Dhruvya", // Custom naming
        createdAt: serverTimestamp(),
        duration: recordingTime,
      });

      setAudioBlob(null);
      setAudioURL(null);
      setSongTitle("");
      setRecordingTime(0);
      sensory.play("levelUp");
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload song. Please try again!");
    } finally {
      setIsUploading(false);
    }
  };

  const cancelRecording = () => {
    setAudioBlob(null);
    setAudioURL(null);
    setRecordingTime(0);
    setSongTitle("");
  };

  const togglePlay = (song: Song) => {
    if (currentlyPlaying === song.id) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = song.url;
        audioRef.current.play();
      }
      setCurrentlyPlaying(song.id);
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.onended = () => {
        setCurrentlyPlaying(null);
      };
    }
  }, [audioRef.current]);

  const deleteSong = async (song: Song) => {
    if (!roomId) return;
    if (window.confirm("Are you sure you want to delete this cute voice note?")) {
      try {
        await deleteDoc(doc(db, "pairs", roomId, "songs", song.id));
        // Also try to delete from storage if we can extract the path (handled gracefully if it fails)
      } catch (err) {
        console.error("Delete failed", err);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="absolute inset-0 bg-[#000000] text-white overflow-y-auto no-scrollbar pb-24 font-sans select-none">
      <audio ref={audioRef} className="hidden" />
      
      {/* Spotify Header */}
      <div className="pt-12 pb-6 px-6 bg-gradient-to-b from-[#1db954]/40 to-[#000000]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg shadow-[#1db954]/20 border border-white/10">
            <Music className="text-[#1db954]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 font-display">
              Our Spotify <Heart className="text-[#1db954]" size={18} fill="#1db954" />
            </h1>
            <p className="text-xs text-white/60 font-medium tracking-wide">
              {songs.length} compressed memory covers
            </p>
          </div>
        </div>
      </div>

      <div className="px-6 space-y-6">
        {/* Record Station */}
        <div className="bg-[#121212] rounded-[2rem] p-5 shadow-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-[#1db954]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative z-10 flex flex-col items-center justify-center space-y-4">
            <h2 className="text-sm font-bold text-white/90 uppercase tracking-widest text-center">
              Sing for your Girl 🎤
            </h2>
            
            {audioURL ? (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center gap-3 bg-[#181818] rounded-full p-2 border border-white/10">
                  <button
                    onClick={() => {
                      const audio = new Audio(audioURL);
                      audio.play();
                    }}
                    className="w-10 h-10 rounded-full bg-[#1db954] flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all"
                  >
                    <Play size={18} fill="currentColor" className="ml-1" />
                  </button>
                  <div className="flex-1 flex gap-1 items-center px-2">
                    {/* Fake waveform */}
                    {Array.from({ length: 15 }).map((_, i) => (
                      <div key={i} className="flex-1 h-3 bg-[#1db954]/40 rounded-full" style={{ opacity: Math.random() * 0.5 + 0.5 }} />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-white/50">{formatTime(recordingTime)}</span>
                </div>
                
                <input
                  type="text"
                  placeholder="Song Cover Title..."
                  value={songTitle}
                  onChange={(e) => setSongTitle(e.target.value)}
                  className="w-full bg-[#181818] border-b-2 border-white/10 focus:border-[#1db954] text-white px-4 py-3 rounded-t-xl outline-none text-sm font-bold tracking-wide"
                />

                <div className="flex items-center gap-3">
                  <button
                    onClick={cancelRecording}
                    className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs uppercase tracking-wider transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveSong}
                    disabled={isUploading}
                    className="flex-[2] py-3 rounded-xl bg-[#1db954] text-black font-extrabold text-xs uppercase tracking-wider transition-all hover:bg-[#1ed760] active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUploading ? (
                      <span className="animate-pulse">Uploading...</span>
                    ) : (
                      <>
                        <UploadCloud size={16} /> Save Masterpiece
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={isRecording ? stopRecording : startRecording}
                  className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(29,185,84,0.3)] transition-all",
                    isRecording ? "bg-red-500 animate-pulse" : "bg-[#1db954] hover:bg-[#1ed760]"
                  )}
                >
                  {isRecording ? (
                    <Square size={28} fill="currentColor" className="text-black" />
                  ) : (
                    <Mic size={32} className="text-black" />
                  )}
                </motion.button>
                <div className="mt-4 text-center">
                  {isRecording ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-red-400 font-black text-sm animate-pulse tracking-widest uppercase">Recording...</span>
                      <span className="text-white/50 font-mono text-xs">{formatTime(recordingTime)}</span>
                    </div>
                  ) : (
                    <span className="text-white/40 text-[10px] uppercase font-bold tracking-widest">
                      Tap to start singing
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Playlist */}
        <div className="space-y-4">
          <div className="flex justify-between items-end">
            <h3 className="text-lg font-black tracking-tight text-white font-display">
              Saved Covers
            </h3>
          </div>

          {songs.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 bg-[#181818] rounded-3xl border border-white/5">
              <Mic className="text-white/20" size={48} />
              <p className="text-white/40 text-xs font-medium px-8 leading-relaxed">
                No songs recorded yet. Sing a beautiful cover for your princess, it takes very little memory!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <AnimatePresence>
                {songs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className="group bg-[#181818] hover:bg-[#282828] rounded-2xl p-3 flex items-center gap-4 transition-colors cursor-pointer border border-white/5"
                  >
                    <button
                      onClick={() => togglePlay(song)}
                      className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-[#1db954] group-hover:text-black transition-all shrink-0"
                    >
                      {currentlyPlaying === song.id ? (
                        <Pause size={16} fill="currentColor" />
                      ) : (
                        <Play size={16} fill="currentColor" className="ml-0.5" />
                      )}
                    </button>
                    
                    <div className="flex-1 min-w-0" onClick={() => togglePlay(song)}>
                      <h4 className={cn("font-bold text-sm truncate", currentlyPlaying === song.id ? "text-[#1db954]" : "text-white")}>
                        {song.title}
                      </h4>
                      <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold mt-0.5 flex items-center gap-1.5">
                        <span className="text-white/80">{song.singerName}</span>
                        {song.duration && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-white/20" />
                            <span>{formatTime(song.duration)}</span>
                          </>
                        )}
                      </p>
                    </div>

                    {currentlyPlaying === song.id && (
                      <div className="flex gap-0.5 h-4 items-end shrink-0 mr-2">
                        <motion.div animate={{ height: ["4px", "16px", "8px", "16px"] }} transition={{ repeat: Infinity, duration: 0.8 }} className="w-1 rounded-t-sm bg-[#1db954]" />
                        <motion.div animate={{ height: ["12px", "4px", "16px", "8px"] }} transition={{ repeat: Infinity, duration: 0.7 }} className="w-1 rounded-t-sm bg-[#1db954]" />
                        <motion.div animate={{ height: ["8px", "16px", "4px", "12px"] }} transition={{ repeat: Infinity, duration: 0.9 }} className="w-1 rounded-t-sm bg-[#1db954]" />
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSong(song);
                      }}
                      className="w-8 h-8 rounded-full hover:bg-red-500/10 flex items-center justify-center text-white/30 hover:text-red-500 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
