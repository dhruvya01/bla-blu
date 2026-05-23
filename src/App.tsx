import { AnimatePresence, motion } from "framer-motion";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Heart,
  Sparkles,
  AlertCircle,
  Phone,
  MessageCircle,
  Battery,
  Menu,
  X as CloseIcon,
  Zap,
  MessageSquare,
  MapPin,
} from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store";
import { useAppSync } from "./hooks/useAppSync";
import { useCareIntelligence } from "./hooks/useCareIntelligence";
import { useNotifications } from "./hooks/useNotifications";
import {
  useLocalNotificationEngine,
  InAppToast,
} from "./hooks/useLocalNotificationEngine";
import { GlobalErrorBoundary } from "./components/ErrorBoundary";
import { App as CapApp } from "@capacitor/app";
import { Navigation } from "./components/Navigation";
import { LoginScreen } from "./screens/LoginScreen";
import { HearthScreen } from "./screens/HearthScreen";
import { ChatScreen } from "./screens/ChatScreen";
import { CareSanctuaryScreen } from "./screens/CareSanctuaryScreen";
import { SharedPlannerScreen } from "./screens/SharedPlannerScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { TimelineScreen } from "./screens/TimelineScreen";
import { JarScreen } from "./screens/JarScreen";
import { VaultScreen } from "./screens/VaultScreen";
import { BabyGameScreen } from "./screens/BabyGameScreen";
import { JourneyTrackerScreen } from "./screens/JourneyTrackerScreen";
import { DoodleScreen } from "./screens/DoodleScreen";
import { ReelsScreen } from "./screens/ReelsScreen";
import { MistakeScreen } from "./screens/MistakeScreen";
import { cn } from "./utils";
import { doc, setDoc, updateDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db, auth, handleFirestoreError } from "./firebase/config";
import { onAuthStateChanged } from "firebase/auth";
import { User, CareAlert, BabyEvolution } from "./types";
import { useActivitySync } from "./hooks/useActivitySync";
import { useLocationSync } from "./hooks/useLocationSync";
import { sensory } from "./utils/sensory";
import { getRealBirthday } from "./utils/birthday";
import { SurprisesManager } from "./components/SurprisesManager";
import { SideDrawer } from "./components/SideDrawer";
// import { MusicPlayer } from "./components/MusicPlayer";
import { AnjaliWelcomeScreen } from "./screens/AnjaliWelcomeScreen";
import confetti from "canvas-confetti";

function BirthdayOverlay({ name }: { name: string }) {
  useEffect(() => {
    const duration = 15 * 1000;
    const animationEnd = Date.now() + duration;
    let skew = 1;

    const frame = () => {
      const timeLeft = animationEnd - Date.now();
      const ticks = Math.max(200, 500 * (timeLeft / duration));
      skew = Math.max(0.8, skew - 0.001);

      confetti({
        particleCount: 1,
        startVelocity: 0,
        ticks: ticks,
        origin: { x: Math.random(), y: Math.random() * skew - 0.2 },
        colors: ["#ff8ab4", "#818cf8", "#34d399", "#fcd34d", "#f472b6"],
        shapes: ["circle"],
        gravity: 0.5 + Math.random() * 0.5,
        scalar: 0.8 + Math.random() * 0.4,
        drift: Math.random() * 2 - 1,
      });

      if (timeLeft > 0) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  }, []);

  return (
    <div className="absolute top-24 left-0 right-0 z-[90] pointer-events-none flex flex-col items-center justify-start pt-4 overflow-visible">
      <motion.div
        initial={{ y: -50, opacity: 0, scale: 0.8 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", bounce: 0.5, duration: 1 }}
        className="bg-card/90 backdrop-blur-md px-6 py-3 rounded-full border-2 border-primary/30 shadow-2xl shadow-primary/20 flex items-center gap-3"
      >
        <span className="text-2xl animate-bounce">🎉</span>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-black uppercase tracking-widest text-text/60">
            Happy Birthday
          </span>
          <span className="text-lg font-display text-primary font-bold">
            {name}! 🎂
          </span>
        </div>
        <span
          className="text-2xl animate-bounce"
          style={{ animationDelay: "0.2s" }}
        >
          🎈
        </span>
      </motion.div>
    </div>
  );
}

function EmergencyAlertModal({
  alert,
  roomId,
}: {
  alert: CareAlert;
  roomId: string;
}) {
  const setView = useAppStore((state) => state.setView);
  const partner = useAppStore((state) => state.partner);
  const setError = useAppStore((state) => state.setError);

  const dismissAlert = async () => {
    if (!roomId || !alert?.id) return;
    try {
      await setDoc(
        doc(db, "pairs", roomId, "emergencyAlerts", alert.id),
        {
          read: true,
        },
        { merge: true },
      );
    } catch (err) {
      handleFirestoreError(
        err,
        "write",
        "pairs/" + roomId + "/emergencyAlerts/" + alert.id,
      );
      setError("Failed to dismiss alert. Try again.");
    }
  };

  const handleCall = () => {
    if (partner?.phoneNumber) {
      window.location.href = `tel:${partner.phoneNumber}`;
    }
  };

  useEffect(() => {
    sensory.play("urgent");
    sensory.alert();
    const interval = setInterval(() => {
      sensory.alert();
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const hasPhone = !!partner?.phoneNumber;

  return (
    <div className="absolute inset-0 z-[999] p-6 flex flex-col justify-end bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="w-full bg-[#ff0000] rounded-[2rem] p-8 text-white shadow-2xl relative overflow-hidden"
      >
        <div className="relative z-10 flex flex-col items-center text-center">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-[#ff0000] mb-6 shadow-xl animate-bounce">
            <AlertCircle size={48} />
          </div>
          <h2 className="text-3xl font-black uppercase tracking-widest mb-2 leading-tight">
            Emergency Alert
          </h2>
          <p className="text-white/80 font-black text-lg mb-8">
            {alert.message}
          </p>
          <div className="w-full space-y-3">
            <button
              disabled={!hasPhone}
              onClick={handleCall}
              className={cn(
                "w-full py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2",
                hasPhone
                  ? "bg-white text-[#ff0000]"
                  : "bg-white/20 text-white/40 cursor-not-allowed",
              )}
            >
              <Phone size={20} /> Call {partner?.nickname || "Her"} Now
            </button>
            <button
              onClick={() => {
                dismissAlert();
                setView("chat");
              }}
              className="w-full py-4 bg-black/20 text-white rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <MessageCircle size={20} /> Open Chat
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

import { E2EESetupModal } from "./components/E2EESetupModal";
import { restoreE2E, isE2EEnabled } from "./utils/e2ee";

export default function App() {
  const {
    user,
    view,
    loading,
    latestPing,
    theme,
    partner,
    pair,
    setView,
    roomId,
    babyEvolution,
    tickBabyLogic,
    e2eReady,
    setE2eReady,
  } = useAppStore(
    useShallow((state) => ({
      user: state.user,
      view: state.view,
      loading: state.loading,
      latestPing: state.latestPing,
      theme: state.theme,
      partner: state.partner,
      pair: state.pair,
      setView: state.setView,
      roomId: state.roomId,
      babyEvolution: state.babyEvolution,
      tickBabyLogic: state.tickBabyLogic,
      e2eReady: state.e2eReady,
      setE2eReady: state.setE2eReady,
    })),
  );

  useEffect(() => {
    restoreE2E().then(success => {
      setE2eReady(success);
    });
  }, [setE2eReady]);

  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showAnjaliSurprise, setShowAnjaliSurprise] = useState(false);
  const [activeToast, setActiveToast] = useState<InAppToast | null>(null);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "Morning Good";
    if (hour >= 12 && hour < 17) return "Afternoon Good";
    if (hour >= 17 && hour < 21) return "Evening Good";
    return "Night Good";
  }, []);

  const { socket } = useAppSync(roomId, isAuthReady && user?.uid ? user.uid : null);
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    
    // Immediate tick on mount/login
    tickBabyLogic(false);
    
    const interval = setInterval(() => {
      tickBabyLogic(false);
    }, 900000);
    return () => clearInterval(interval);
  }, [user, tickBabyLogic]);

  useEffect(() => {
    if (
      user &&
      (user.email === "anjali@blablu.app" || user.role === "girlfriend")
    ) {
      const seen = localStorage.getItem("anjali_surprise_seen");
      if (!seen) {
        setShowAnjaliSurprise(true);
      }
    }
  }, [user]);

  const DARK_THEMES = ["dark", "amoled", "midnight", "aurora", "mocha", "berry"];

  useEffect(() => {
    if (theme) {
      const cls = `theme-${theme}`;
      const isDark = DARK_THEMES.includes(theme);
      
      document.body.className = cls;
      document.documentElement.className = cls;
      
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }

      // Dynamically update the system bar theme color to match the active app background color
      const bgColors: Record<string, string> = {
        pink: "#FFF5F9",
        lavender: "#F8F7FF",
        dark: "#0A0809",
        amoled: "#000000",
        "amoled-cyan": "#000000",
        "amoled-gold": "#000000",
        "amoled-violet": "#000000",
        "amoled-ruby": "#000000",
        mint: "#F0FDF4",
        peach: "#FFF7ED",
        ocean: "#F0F9FF",
        honey: "#FFFBEB",
        rose: "#FFF1F2",
        midnight: "#02021E",
        aurora: "#011612",
        mocha: "#100905",
        berry: "#15020D",
      };
      const activeBg = bgColors[theme] || "#FFF5F9";
      let metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (!metaThemeColor) {
        metaThemeColor = document.createElement('meta');
        metaThemeColor.setAttribute('name', 'theme-color');
        document.head.appendChild(metaThemeColor);
      }
      metaThemeColor.setAttribute('content', activeBg);
    }
  }, [theme]);

  useCareIntelligence();
  useActivitySync(roomId, isAuthReady && user?.uid ? user.uid : null);
  useNotifications(roomId, isAuthReady ? user : null, setView);
  useLocationSync(roomId, isAuthReady && user?.uid ? user.uid : null);

  useLocalNotificationEngine((newToast) => {
    setActiveToast(newToast);
    sensory.play("pop");
    setTimeout(() => {
      setActiveToast((current) =>
        current?.id === newToast.id ? null : current,
      );
    }, 4500);
  });

  useEffect(() => {
    const unsub = CapApp.addListener("backButton", () => {
      const { view, setView } = useAppStore.getState();
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return;
      }
      if (view !== "home" && view !== "login") {
        setView("home");
      } else {
        CapApp.exitApp();
      }
    });
    return () => {
      unsub.then((u) => u.remove());
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      const store = useAppStore.getState();
      if (!fbUser) {
        setIsAuthReady(false);
        store.setUser(null);
        store.setPartner(null);
        store.setPair(null);
        store.setRoomId(null);
        store.setView("login");
        localStorage.removeItem("blablu_user_uid");
        localStorage.removeItem("blablu_last_room");
        store.setLoading(false);
      } else {
        setIsAuthReady(true);
        if (!store.user) {
          try {
            const docSnap = await getDoc(doc(db, "users", fbUser.uid));
            if (docSnap.exists()) {
              const data = { uid: docSnap.id, ...docSnap.data() } as User;
              store.setUser(data);
              store.setRoomId(data.roomId || "blablu_nest");
              if (store.view === "login") store.setView("home");
            }
          } catch (e) {
            console.error(e);
          } finally {
            store.setLoading(false);
          }
        }
      }
    });
    return () => unsub();
  }, []);

  const debugBirthday = useAppStore((state) => state?.debugBirthday);
  const birthdayPerson = debugBirthday || getRealBirthday();

  if (loading || (!isAuthReady && user)) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-bg relative overflow-hidden">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="relative z-10 flex flex-col items-center gap-6"
        >
          <Heart size={64} className="text-primary" fill="currentColor" />
          <h2 className="text-2xl font-black text-text tracking-tighter lowercase">
            BLABLU
          </h2>
        </motion.div>
      </div>
    );
  }

  if (view === "login" || !user || !isAuthReady) return <LoginScreen />;

  return (
    <GlobalErrorBoundary>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex flex-col h-[100dvh] w-full max-w-full sm:max-w-md mx-auto overflow-hidden relative bg-bg transition-all duration-1000 shadow-sm",
          `theme-${theme}`,
          birthdayPerson && "shadow-[inset_0_0_80px_rgba(255,138,180,0.15)]",
        )}
      >
        {/* Global Birthday Floating Elements */}
        {birthdayPerson && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-[5]">
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  y: "110%",
                  x: `${Math.random() * 100}%`,
                  opacity: 0,
                }}
                animate={{
                  y: "-10%",
                  opacity: [0, 1, 1, 0],
                  rotate: [0, 360],
                }}
                transition={{
                  duration: 8 + Math.random() * 10,
                  repeat: Infinity,
                  delay: i * 2,
                  ease: "linear",
                }}
                className="absolute text-xl"
              >
                {["🎈", "🎉", "✨", "🎂", "🥳"][Math.floor(Math.random() * 5)]}
              </motion.div>
            ))}
          </div>
        )}

        <AnimatePresence>
          {isOffline && (
            <motion.div
              initial={{ y: -40 }}
              animate={{ y: 0 }}
              exit={{ y: -40 }}
              className="fixed top-0 left-0 right-0 z-[9999] bg-rose text-white text-[10px] font-black uppercase tracking-widest py-2 text-center shadow-lg"
            >
              No connection — working offline
            </motion.div>
          )}
        </AnimatePresence>

        {/* Global Header */}
        {view !== "chat" &&
          view !== "settings" &&
          view !== "map" &&
          view !== "journey" &&
          view !== "timeline" &&
          view !== "reels" && (
            <motion.header
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
              className="fixed top-0 left-0 right-0 z-[100] pt-[calc(env(safe-area-inset-top,0px)+6px)] px-3 py-1.5 flex items-center justify-between bg-bg/60 backdrop-blur-xl border-b border-border/30"
            >
              <div className="flex items-center gap-2 mt-1">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setIsDrawerOpen(true);
                    sensory.play("pop");
                  }}
                  className="w-10 h-10 rounded-full bg-card border border-white/50 dark:border-white/10 flex items-center justify-center text-text shadow-sm transition-all"
                >
                  <Menu size={18} />
                </motion.button>
                <div className="flex flex-col ml-0.5">
                  <span className="text-[10px] font-bold tracking-widest text-text/50">
                    {greeting} ✨
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-text tracking-tight">
                      {user?.nickname || user?.name || "Lover"}
                    </span>
                    {(() => {
                      const startDate = pair?.anniversary || pair?.createdAt || user?.createdAt;
                      let diff = 0;
                      if (startDate) {
                         const startMs = typeof startDate === 'string' ? new Date(startDate).getTime() : startDate;
                         diff = Date.now() - startMs;
                      }
                      const daysTogether = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
                      const levelFromDays = Math.floor(daysTogether / 100);
                      const baseLevel = pair?.level || 1;
                      const totalLevel = baseLevel + levelFromDays;
                      const currentXp = pair?.xp || 0;
                      const xpNeeded = 100 * baseLevel;
                      const xpPct = Math.min(100, Math.max(0, Math.floor((currentXp / xpNeeded) * 100)));

                      return (
                        <div className="flex items-center gap-1.5 group cursor-pointer">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full ring-1 ring-primary/20">
                            Lv.{totalLevel}
                          </span>
                          {/* XP Bar (hidden by default, shows on hover or click) */}
                          <div className="w-16 h-1.5 bg-text/10 rounded-full overflow-hidden flex" title={`${currentXp} / ${xpNeeded} XP`}>
                            <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${xpPct}%` }}
                               transition={{ duration: 1 }}
                               className="h-full bg-primary" 
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 mr-8">
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    setView("settings");
                    sensory.play("pop");
                  }}
                  className="flex -space-x-3 cursor-pointer hover:scale-105 transition-all drop-shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-card border-2 border-white dark:border-[#1a1a2e] shadow-sm flex items-center justify-center relative z-10">
                    {partner?.avatarUrl ? (
                      <img
                        src={partner.avatarUrl}
                        alt="Partner"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-bold text-text/60">
                        {partner?.nickname?.[0]?.toUpperCase() || "?"}
                      </span>
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-primary/10 border-2 border-white dark:border-[#1a1a2e] shadow-sm flex items-center justify-center relative z-20">
                    {user?.avatarUrl ? (
                      <img
                        src={user.avatarUrl}
                        alt="Me"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-base font-bold text-primary">
                        {user?.nickname?.[0]?.toUpperCase() || "M"}
                      </span>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.header>
          )}

        <SideDrawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
        />

        <main
          className={cn(
            "flex-1 flex flex-col overflow-y-auto no-scrollbar relative min-h-0",
            view !== "chat" &&
              view !== "settings" &&
              view !== "map" &&
              view !== "journey" &&
              view !== "vault" &&
              view !== "timeline" &&
              view !== "reels" &&
              view !== "mistakes" &&
              "pt-[calc(env(safe-area-inset-top,0px)+62px)] pb-[calc(env(safe-area-inset-bottom,0px)+84px)]",
          )}
        >
          <AnimatePresence mode="sync">
            {view === "home" && <HearthScreen key="home" socket={socket} />}
            {view === "chat" && <ChatScreen key="chat" socket={socket} />}
            {view === "planner" && <SharedPlannerScreen key="planner" />}
            {(view === "sanctuary" ||
              view === "habits" ||
              view === "period" ||
              view === "calendar" ||
              view === "history") && (
              <CareSanctuaryScreen key="sanctuary" socket={socket} />
            )}
            {view === "timeline" && <TimelineScreen key="timeline" />}
            {view === "jar" && <JarScreen key="jar" />}
            {view === "babygame" && <BabyGameScreen key="babygame" />}
            {view === "map" && <JourneyTrackerScreen key="map" />}
            {view === "journey" && <JourneyTrackerScreen key="journey" />}
            {view === "settings" && <SettingsScreen key="settings" />}
            {view === "vault" && <VaultScreen key="vault" />}
            {view === "doodle" && <DoodleScreen key="doodle" />}
            {view === "reels" && <ReelsScreen key="reels" />}
            {view === "mistakes" && <MistakeScreen key="mistakes" />}
          </AnimatePresence>
        </main>

        {/* Persistent Navigation */}
        {view !== "chat" &&
          view !== "map" &&
          view !== "journey" &&
          view !== "settings" &&
          view !== "babygame" &&
          view !== "vault" &&
          view !== "doodle" &&
          view !== "jar" &&
          view !== "timeline" &&
          view !== "reels" &&
          view !== "mistakes" && <Navigation />}

        <SurprisesManager />
        {/* <MusicPlayer /> */}

        <AnimatePresence>
          {showAnjaliSurprise && (
            <AnjaliWelcomeScreen
              onDismiss={() => {
                setShowAnjaliSurprise(false);
                localStorage.setItem("anjali_surprise_seen", "true");
              }}
            />
          )}
        </AnimatePresence>

        {/* Advanced In-App Glassmorphic Toast Notification */}
        <AnimatePresence>
          {activeToast && (
            <motion.div
              initial={{ y: -100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -100, opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 20, stiffness: 260 }}
              drag="y"
              dragConstraints={{ top: -200, bottom: 0 }}
              dragElastic={{ top: 0.5, bottom: 0.1 }}
              onDragEnd={(event, info) => {
                if (info.offset.y < -30 || info.velocity.y < -150) {
                  setActiveToast(null);
                }
              }}
              onTap={() => {
                setView(activeToast.view);
                setActiveToast(null);
              }}
              className="fixed top-14 left-6 right-6 z-[99999] glass-card px-5 py-4 rounded-[28px] border border-white/20 shadow-2xl flex items-center gap-4 cursor-pointer active:scale-98 transition-all hover:bg-white/10 select-none touch-none"
            >
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                {activeToast.type === "chat" ? (
                  <MessageSquare size={18} className="text-pink" />
                ) : activeToast.type === "nudge" ? (
                  <Heart
                    size={18}
                    className="text-rose fill-rose/20 animate-pulse"
                  />
                ) : (
                  <MapPin size={18} className="text-mint" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary/75">
                    {activeToast.type === "chat"
                      ? "New message"
                      : activeToast.type === "nudge"
                        ? "poke"
                        : "map alert"}
                  </span>
                  <span className="text-[9px] text-text/30 font-medium">
                    • just now
                  </span>
                </div>
                <h4 className="text-xs font-bold text-text truncate mt-0.5">
                  {activeToast.title}
                </h4>
                <p className="text-[11px] text-text/65 truncate font-medium">
                  {activeToast.body}
                </p>
              </div>

              <div className="text-lg">{activeToast.emoji}</div>
            </motion.div>
          )}
        </AnimatePresence>

        {!e2eReady && user && roomId && (view === 'chat' || view === 'home') && (
          <E2EESetupModal onComplete={() => setE2eReady(true)} />
        )}
      </motion.div>
    </GlobalErrorBoundary>
  );
}
