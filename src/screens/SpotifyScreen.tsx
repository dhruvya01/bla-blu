import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Play, Pause, Trash2, UploadCloud, Save, Music, Heart, Volume2 } from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { db } from "../firebase/config";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { sensory } from "../utils/sensory";
import { cn } from "../utils";
import { encryptData, decryptData } from "../utils/e2ee";

interface Song {
  id: string;
  title: string;
  url: string;
  singerUid: string;
  singerName: string;
  createdAt: any;
  duration?: number;
  lyrics?: string;
  mood?: string;
  likedBy?: string[];
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
  const [recordingTime, setRecordingTime] = useState(0);
  
  const [songTitle, setSongTitle] = useState("");
  const [songLyrics, setSongLyrics] = useState("");
  const [songMood, setSongMood] = useState("cute");
  const [isUploading, setIsUploading] = useState(false);

  const [recordedAudio, setRecordedAudio] = useState<string | null>(null);
  
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const togglePreviewPlay = () => {
    if (!recordedAudio) return;
    if (isPlayingPreview && previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    } else {
      const audio = new Audio(recordedAudio);
      audio.onended = () => setIsPlayingPreview(false);
      audio.play();
      setPreviewAudio(audio);
      setIsPlayingPreview(true);
    }
  };
  
  const [currentlyPlaying, setCurrentlyPlaying] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const moods = [
    { id: "cute", label: "Cute 🧸", color: "bg-pink-500" },
    { id: "sleepy", label: "Sleepy 😴", color: "bg-indigo-500" },
    { id: "missing", label: "Missing You 🥺", color: "bg-blue-500" },
    { id: "apology", label: "Apology 🥺", color: "bg-orange-500" },
    { id: "romantic", label: "Romantic 💖", color: "bg-rose-500" },
  ];

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, "pairs", roomId, "songs"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const processDocs = async () => {
        const data: Song[] = [];
        const promises = snapshot.docs.map(async (docData) => {
          const songDoc = docData.data();
          let decryptedUrl = songDoc.url;
          
          if (songDoc.url && songDoc.url.startsWith('E2EE:')) {
              try {
                  decryptedUrl = await decryptData(songDoc.url);
              } catch (e) {
                  console.error("Failed to decrypt song url", e);
              }
          }
          return { id: docData.id, ...songDoc, url: decryptedUrl } as Song;
        });

        const resolvedData = await Promise.all(promises);
        setSongs(resolvedData);
      };
      
      processDocs();
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
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
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
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setRecordedAudio(null);
      sensory.play("tick");
    } catch (err) {
      console.error("Mic access denied", err);
      alert("Microphone access is required to sing for your cutie!");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      sensory.play("tick");
    }
  };

  const saveSong = async () => {
    if (!recordedAudio || !roomId || !user) return;
    if (!songTitle.trim()) {
      alert("Please give your song cover a cute title!");
      return;
    }
    
    if (previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    }
    
    setIsUploading(true);
    try {
      // Encrypt the base64 audio
      const encryptedAudioUrl = await encryptData(recordedAudio);
      
      await addDoc(collection(db, "pairs", roomId, "songs"), {
        title: songTitle.trim(),
        url: encryptedAudioUrl, // Storing base64 string directly
        singerUid: user.uid,
        singerName: user.email === "anjali@blablu.app" ? "Anjali" : "Dhruvya", // Custom naming
        createdAt: serverTimestamp(),
        duration: recordingTime,
        lyrics: songLyrics.trim(),
        mood: songMood,
        likedBy: [],
      });

      setRecordedAudio(null);
      setSongTitle("");
      setSongLyrics("");
      setSongMood("cute");
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
    if (previewAudio) {
      previewAudio.pause();
      setIsPlayingPreview(false);
    }
    setRecordedAudio(null);
    setRecordingTime(0);
    setSongTitle("");
    setSongLyrics("");
    setSongMood("cute");
  };

  const togglePlay = (song: Song) => {
    if (currentlyPlaying === song.id) {
      audioRef.current?.pause();
      setCurrentlyPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = song.url;
        audioRef.current.play();
        setCurrentlyPlaying(song.id);
        setCurrentTime(0);
        setDuration(song.duration || 0);
      }
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleEnded = () => setCurrentlyPlaying(null);

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  const toggleLike = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!roomId || !user) return;
    sensory.play("tick");
    const isLiked = song.likedBy?.includes(user.uid);
    try {
      await updateDoc(doc(db, "pairs", roomId, "songs", song.id), {
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (err) {
      console.error("Failed to update like", err);
    }
  };

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
    <div className="absolute inset-0 bg-[#000000] text-white overflow-y-auto no-scrollbar pb-32 font-sans select-none">
      <audio ref={audioRef} className="hidden" />
      
      {/* Spotify Header */}
      <div className="pt-12 pb-6 px-6 bg-gradient-to-b from-[#1db954]/40 to-[#000000]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md shadow-lg shadow-[#1db954]/20 border border-white/10">
            <Music className="text-[#1db954]" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2 font-display">
              Personal Spotify <Heart className="text-[#1db954]" size={18} fill="#1db954" />
            </h1>
            <p className="text-xs text-white/60 font-medium tracking-wide">
              {songs.length} {songs.length === 1 ? "beautiful cover" : "beautiful covers"}
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
              Sing for your Cutie 🎤
            </h2>
            
            {recordedAudio ? (
              <div className="w-full space-y-4">
                <div className="flex items-center justify-center gap-3 bg-[#181818] rounded-full p-2 border border-white/10">
                  <button
                    onClick={togglePreviewPlay}
                    className="w-10 h-10 rounded-full bg-[#1db954] flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all"
                  >
                    {isPlayingPreview ? (
                      <Pause size={18} fill="currentColor" />
                    ) : (
                      <Play size={18} fill="currentColor" className="ml-1" />
                    )}
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

                <textarea
                  placeholder="Add a cute note or lyrics... (optional)"
                  value={songLyrics}
                  onChange={(e) => setSongLyrics(e.target.value)}
                  className="w-full bg-[#181818] border-b-2 border-white/10 focus:border-[#1db954] text-white px-4 py-2 text-xs outline-none resize-none placeholder-white/30 rounded-b-xl"
                  rows={2}
                />

                <div className="flex flex-wrap gap-2">
                  {moods.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setSongMood(m.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all",
                        songMood === m.id
                          ? m.color + " text-white shadow-md"
                          : "bg-white/10 text-white/50 hover:bg-white/20 hover:text-white"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>

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
                No songs recorded yet. Sing a beautiful cover for your love!
              </p>
            </div>
          ) : (
            <div className="space-y-3 pb-8">
              <AnimatePresence>
                {songs.map((song, index) => {
                  const isPlaying = currentlyPlaying === song.id;
                  const isLiked = song.likedBy?.includes(user?.uid || "");
                  const moodInfo = moods.find(m => m.id === song.mood) || moods[0];

                  return (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "group bg-[#181818] hover:bg-[#282828] rounded-2xl p-4 flex flex-col gap-3 transition-colors cursor-pointer border",
                      isPlaying ? "border-[#1db954]" : "border-white/5"
                    )}
                    onClick={() => togglePlay(song)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePlay(song);
                          }}
                          className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-[#1db954] group-hover:text-black transition-all shrink-0 relative overflow-hidden"
                        >
                          {isPlaying ? (
                            <Pause size={20} fill="currentColor" />
                          ) : (
                            <Play size={20} fill="currentColor" className="ml-1" />
                          )}
                          {isPlaying && (
                            <div className="absolute inset-0 border-2 border-[#1db954] rounded-full animate-ping opacity-20" />
                          )}
                        </button>
                      
                        <div>
                          <h4 className={cn("font-bold text-base truncate pr-2", isPlaying ? "text-[#1db954]" : "text-white")}>
                            {song.title}
                          </h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
                              {song.singerName}
                            </span>
                            {song.duration && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className="text-[10px] text-white/50 font-mono tracking-widest">{formatTime(song.duration)}</span>
                              </>
                            )}
                            {song.mood && (
                              <>
                                <span className="w-1 h-1 rounded-full bg-white/20" />
                                <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-lg", moodInfo.color, "text-white")}>
                                  {moodInfo.label}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={(e) => toggleLike(song, e)}
                        className="p-2 -mr-2 rounded-full hover:bg-white/10 transition-colors"
                      >
                        <Heart size={20} className={isLiked ? "text-rose-500 fill-rose-500" : "text-white/30"} />
                      </button>
                    </div>

                    {song.lyrics && (
                      <div className="px-3 py-2 bg-black/40 rounded-xl border border-white/5 mx-2">
                        <p className="text-xs text-white/70 italic leading-relaxed line-clamp-3">
                          "{song.lyrics}"
                        </p>
                      </div>
                    )}

                    {isPlaying && (
                      <div className="flex items-center gap-3 px-2">
                         <span className="text-[10px] font-mono text-[#1db954]">{formatTime(currentTime)}</span>
                         <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                           <div 
                             className="h-full bg-[#1db954] transition-all duration-100 ease-linear rounded-full" 
                             style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                           />
                         </div>
                         <span className="text-[10px] font-mono text-white/40">{formatTime(duration)}</span>
                         
                         <button
                           onClick={(e) => {
                             e.stopPropagation();
                             deleteSong(song);
                           }}
                           className="p-1.5 ml-2 rounded-full text-white/30 hover:bg-red-500/20 hover:text-red-500 transition-colors"
                         >
                           <Trash2 size={14} />
                         </button>
                      </div>
                    )}
                  </motion.div>
                )})}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {currentlyPlaying && songs.find(s => s.id === currentlyPlaying) && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 inset-x-0 bg-[#181818] border-t border-white/10 p-4 pb-8 flex flex-col gap-2 shadow-2xl z-50 rounded-t-3xl"
        >
          <div className="flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md bg-[#282828] flex items-center justify-center relative overflow-hidden">
                <Music size={16} className="text-[#1db954]" />
                <div className="absolute bottom-0 inset-x-0 h-1 bg-gradient-to-t from-[#1db954]/50 to-transparent" />
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm text-white truncate max-w-[200px]">
                  {songs.find(s => s.id === currentlyPlaying)?.title}
                </span>
                <span className="text-[10px] text-[#1db954] uppercase tracking-widest font-black">
                  NOW PLAYING
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 pointer-events-auto">
               <button onClick={(e) => toggleLike(songs.find(s => s.id === currentlyPlaying)!, e)}>
                 <Heart size={20} className={songs.find(s => s.id === currentlyPlaying)?.likedBy?.includes(user?.uid || "") ? "text-rose-500 fill-rose-500" : "text-white/50"} />
               </button>
               <button 
                 onClick={() => {
                   audioRef.current?.pause();
                   setCurrentlyPlaying(null);
                 }}
                 className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-black hover:scale-105 active:scale-95 transition-all"
               >
                 <Pause size={18} fill="currentColor" />
               </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-1 relative z-10 pointer-events-auto">
            <span className="text-[10px] font-mono text-white/50 tabular-nums">{formatTime(currentTime)}</span>
            <div 
              className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer relative"
              onClick={(e) => {
                if (audioRef.current && duration) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const percent = (e.clientX - rect.left) / rect.width;
                  audioRef.current.currentTime = percent * duration;
                }
              }}
            >
              <div 
                className="absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-100"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-white/50 tabular-nums">{formatTime(duration)}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
