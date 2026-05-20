import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Eye, EyeOff } from "lucide-react";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { auth, db } from "../firebase/config";
import { useAppStore } from "../store";
import { User } from "../types";

const SHARED_PAIR_ID = "blablu_nest";

const ALLOWED_USERS: Record<string, { email: string, name: string, nickname: string, perspective: "her"|"his", role: "girlfriend"|"boyfriend" }> = {
  "dhruvya": {
    email: "dhruvya@blablu.app",
    name: "Dhruvya",
    nickname: "Hero",
    perspective: "his",
    role: "boyfriend"
  },
  "anjali": {
    email: "anjali@blablu.app",
    name: "Anjali",
    nickname: "Princess",
    perspective: "her",
    role: "girlfriend"
  }
};

export function LoginScreen() {
  const { setUser, setRoomId, setView, user } = useAppStore();
  
  // Form State
  const [selectedUser, setSelectedUser] = useState<"dhruvya" | "anjali" | "">("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.roomId) {
      setView("home");
    }
  }, [user, setView]);

  const showError = (msg: string) => {
    setErrorText(msg);
    setTimeout(() => setErrorText(""), 4000);
  };

  const provisionNewUser = async (uid: string, userKey: string) => {
    const profile = ALLOWED_USERS[userKey];
    const roomId = SHARED_PAIR_ID;
    const userData: User = {
      uid,
      email: profile.email,
      name: profile.name,
      nickname: profile.nickname,
      perspective: profile.perspective,
      role: profile.role,
      roomId: roomId
    };
    
    // Create user doc
    await useAppStore.getState().saveProfile(userData);
    
    // Join or create nest
    const pairRef = doc(db, "pairs", roomId);
    const pairSnap = await getDoc(pairRef);
    
    if (!pairSnap.exists()) {
      await setDoc(pairRef, {
        id: roomId,
        partnerIds: [uid],
        partnerEmails: [profile.email],
        createdAt: Date.now()
      });
    } else {
      await updateDoc(pairRef, { 
        partnerIds: arrayUnion(uid),
        partnerEmails: arrayUnion(profile.email)
      });
    }
    
    return userData;
  };

  const handleLogin = async () => {
    if (!selectedUser) return showError("Please select who you are! 🤍");
    if (!password) return showError("Please enter your password");
    
    const profile = ALLOWED_USERS[selectedUser];
    
    setLoading(true);
    try {
      // Try to sign in
      const cred = await signInWithEmailAndPassword(auth, profile.email, password.trim());
      
      const userSnap = await getDoc(doc(db, "users", cred.user.uid));
      if (!userSnap.exists()) {
        await cred.user.getIdToken(true);
        await new Promise(resolve => setTimeout(resolve, 2000));
        const newUserData = await provisionNewUser(cred.user.uid, selectedUser);
        setUser(newUserData);
      } else {
        const existingData = { uid: userSnap.id, roomId: userSnap.data().roomId || SHARED_PAIR_ID, ...userSnap.data() } as User;
        setUser(existingData);
        setRoomId(existingData.roomId);
      }
      setView("home");

    } catch (err: any) {
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        // Due to Email Enumeration Protection, Firebase returns invalid-credential 
        // for BOTH wrong password AND user not found.
        // We will try to create the user. If it fails with email-already-in-use,
        // it means it was a wrong password instead!
        try {
          const newCred = await createUserWithEmailAndPassword(auth, profile.email, password.trim());
          // Firebase Auth takes a moment to propagate the auth token to the Firestore SDK.
          // Wait before writing initial data to Firestore.
          await newCred.user.getIdToken(true);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const newUserData = await provisionNewUser(newCred.user.uid, selectedUser);
          setUser(newUserData);
          setRoomId(SHARED_PAIR_ID);
          setView("home");
        } catch (createErr: any) {
          if (createErr.code === "auth/email-already-in-use") {
            showError("Invalid password. Please check your credentials.");
          } else {
            showError("Failed to auto-create account.");
            console.error("Create error:", createErr);
          }
        }
      } else if (err.code === "auth/too-many-requests") {
        showError("Too many failed attempts. Please try again later.");
      } else {
        showError("Login failed: " + (err.message || "Unknown error"));
        console.error("Login attempt failed:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg flex flex-col items-center justify-center p-6 overflow-y-auto font-sans">
      <AnimatePresence mode="wait">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div className="text-center space-y-3">
            <div className="w-20 h-20 glass text-primary rounded-full flex items-center justify-center mx-auto mb-4 relative group">
              <Heart size={36} fill="currentColor" className="group-hover:scale-110 transition-transform duration-500" />
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ repeat: Infinity, duration: 4 }}
                className="absolute inset-0 bg-primary/10 rounded-full blur-xl"
              />
            </div>
            <div>
              <h1 className="text-4xl font-black text-text tracking-tighter lowercase">BLABLU</h1>
              <p className="text-text/30 font-black uppercase tracking-[0.2em] text-[9px]">Strictly Private Space</p>
            </div>
          </div>

          <div className="premium-card p-6 space-y-6 bg-card rounded-[2.5rem] shadow-sm border border-border">
            <div className="space-y-4">
              <div className="text-center pb-2">
                <p className="text-sm font-bold text-text/70">our app</p>
                <p className="text-xs font-medium text-primary/80 mt-1">This app is exclusively for Anjali & Dhruvya.</p>
              </div>
              
              <div className="flex gap-2 w-full">
                <button 
                  onClick={() => setSelectedUser("dhruvya")}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-colors ${selectedUser === "dhruvya" ? "bg-primary text-white shadow-md shadow-primary/20" : "glass text-text/50"}`}
                >
                  I'm Dhruvya
                </button>
                <button 
                  onClick={() => setSelectedUser("anjali")}
                  className={`flex-1 py-3 rounded-xl font-bold text-xs transition-colors ${selectedUser === "anjali" ? "bg-primary text-white shadow-md shadow-primary/20" : "glass text-text/50"}`}
                >
                  I'm Anjali
                </button>
              </div>

              <div className="relative group mt-4">
                <input 
                  type={showPassword ? "text" : "password"} 
                  placeholder={selectedUser ? `Password for ${ALLOWED_USERS[selectedUser].name}` : "Password"} 
                  value={password} 
                  onChange={e => setPassword(e.target.value)}
                  disabled={!selectedUser}
                  className="w-full p-4 glass rounded-xl border border-transparent focus:border-primary/20 outline-none text-sm font-bold text-text text-center tracking-widest pr-12 disabled:opacity-50"
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text/30 hover:text-primary transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              
              <button 
                onClick={handleLogin} disabled={loading || !selectedUser}
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-xs uppercase tracking-widest shadow-md active:scale-95 transition-all mt-4 disabled:opacity-50 disabled:active:scale-100"
              >
                {loading ? "Unlocking House..." : "Unlock House"}
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {errorText && (
          <motion.p 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-12 text-rose font-black text-[9px] uppercase tracking-widest font-sans glass px-8 py-4 rounded-full shadow-lg backdrop-blur-md border border-rose/10 z-[100]"
          >
            {errorText}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="fixed bottom-6 text-[10px] font-bold text-text/30 tracking-widest uppercase text-center w-full">
        made by dhruvya for anjali
      </div>
    </div>
  );
}
