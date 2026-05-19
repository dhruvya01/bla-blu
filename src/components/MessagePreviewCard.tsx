import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Mail } from "lucide-react";
import { query, collection, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { cn } from "../utils";

export const MessagePreviewCard = ({ roomId, userId, partnerName, role }: { roomId: string | null, userId: string | undefined, partnerName: string, role: string | undefined }) => {
  const [lastMessage, setLastMessage] = useState<any>(null);
  const isMale = role === "boyfriend";

  useEffect(() => {
    if (!roomId) return;
    
    const q = query(collection(db, "pairs", roomId, "messages"), orderBy("createdAt", "desc"), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) setLastMessage(snap.docs[0].data());
    });
    return () => unsub();
  }, [roomId]);

  if (!lastMessage) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative p-8 rounded-[2.5rem] border shadow-lg overflow-hidden group",
        isMale 
          ? "bg-card/60 border-border shadow-black/20" 
          : "bg-card border-border shadow-primary/5"
      )}
    >
      <div className={cn("absolute top-0 right-0 w-24 h-24 opacity-5", isMale ? "bg-text" : "bg-primary")} style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 0)' }} />
      
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", isMale ? "bg-card border border-border" : "bg-primary/5 text-primary")}>
            <Mail size={16} />
          </div>
          <span className={cn("text-[10px] font-black uppercase tracking-[0.2em]", isMale ? "text-text/50" : "text-primary/60")}>
            Whisper from {partnerName}
          </span>
        </div>
        
        <p className={cn(
          "text-xl font-medium tracking-tight italic line-clamp-2",
          isMale ? "text-text" : "text-text font-serif"
        )}>
          "{lastMessage.text}"
        </p>

        <div className="flex justify-end">
          <div className={cn("text-[9px] font-bold uppercase tracking-widest", isMale ? "text-text/40" : "text-text/20")}>
            {lastMessage.createdAt?.seconds ? new Date(lastMessage.createdAt.seconds * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'recently'}
          </div>
        </div>
      </div>
    </motion.div>
  );
};
