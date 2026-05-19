// src/screens/SettingsScreen.tsx
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  Lock,
  Heart,
  User as UserIcon,
  Palette,
  Key,
  LogOut,
  Volume2,
  Smartphone,
  Calendar,
  Quote,
  Check,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { signOut, updatePassword } from "firebase/auth";
import { auth, db } from "../firebase/config";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { doc, updateDoc } from "firebase/firestore";
import { User, Pair } from "../types";
import { sensory } from "../utils/sensory";
import { CONFIG } from "../config";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { compressImage } from "../utils/imageUtils";
import { clearE2E } from "../utils/e2ee";

interface SettingsProps {
  onSave?: (data: any) => void;
  onRequestNotify?: () => void;
}

export function SettingsScreen({ onSave, onRequestNotify }: SettingsProps) {
  const user = useAppStore((state) => state.user);
  const partner = useAppStore((state) => state.partner);
  const pair = useAppStore((state) => state.pair);
  const setView = useAppStore((state) => state.setView);
  const setTheme = useAppStore((state) => state.setTheme);
  const theme = useAppStore((state) => state.theme);
  const roomId = useAppStore((state) => state.roomId);
  const setUser = useAppStore((state) => state.setUser);
  const locationEnabled = useAppStore((state) => state.locationEnabled);
  const setLocationEnabled = useAppStore((state) => state.setLocationEnabled);
  const soundEnabled = useAppStore((state) => state.soundEnabled);
  const setSoundEnabled = useAppStore((state) => state.setSoundEnabled);
  const hapticsEnabled = useAppStore((state) => state.hapticsEnabled);
  const setHapticsEnabled = useAppStore((state) => state.setHapticsEnabled);
  const privacyModeEnabled = useAppStore((state) => state.privacyModeEnabled);
  const setPrivacyModeEnabled = useAppStore(
    (state) => state.setPrivacyModeEnabled,
  );
  const speedingNotificationsEnabled = useAppStore(
    (state) => state.speedingNotificationsEnabled,
  );
  const setSpeedingNotificationsEnabled = useAppStore(
    (state) => state.setSpeedingNotificationsEnabled,
  );
  const customNotificationSound = useAppStore(
    (state) => state.customNotificationSound,
  );
  const setCustomNotificationSound = useAppStore(
    (state) => state.setCustomNotificationSound,
  );
  const e2eReady = useAppStore((state) => state.e2eReady);
  const setE2eReady = useAppStore((state) => state.setE2eReady);

  const [activeTab, setActiveTab] = useState<"profile" | "account">("profile");

  // Profile Form
  const [userNickname, setUserNickname] = useState("");
  const [partnerNickname, setPartnerNickname] = useState("");
  const [myAppNickname, setMyAppNickname] = useState(user?.nickname || "");
  const [userName, setUserName] = useState(user?.name || "");
  const [userPhoneNumber, setUserPhoneNumber] = useState(
    user?.phoneNumber || "",
  );
  const [userAvatarUrl, setUserAvatarUrl] = useState(user?.avatarUrl || "");
  const [anniversary, setAnniversary] = useState(pair?.anniversary || "");
  const [relationshipQuote, setRelationshipQuote] = useState(
    pair?.relationshipQuote || "",
  );
  const [backdropImageUrl, setBackdropImageUrl] = useState(
    pair?.backdropImageUrl || "",
  );
  const [backdropOpacity, setBackdropOpacity] = useState(
    pair?.backdropOpacity ?? 0.35,
  );
  const [backdropBlur, setBackdropBlur] = useState(pair?.backdropBlur ?? 40);
  const [houseName, setHouseName] = useState(
    pair?.houseName || "bondu's house",
  );

  // Account Form
  const [newPassword, setNewPassword] = useState("");

  const [status, setStatus] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [registeringNotifs, setRegisteringNotifs] = useState(false);

  useEffect(() => {
    if (user) {
      setUserName(user.name);
      setMyAppNickname(user.nickname || "");
      setUserPhoneNumber(user.phoneNumber || "");
      setUserAvatarUrl(user.avatarUrl || "");
    }
    if (pair) {
      setAnniversary(pair.anniversary || "");
      setRelationshipQuote(pair.relationshipQuote || "");
      setBackdropImageUrl(pair.backdropImageUrl || "");
      setBackdropOpacity(pair.backdropOpacity ?? 0.35);
      setBackdropBlur(pair.backdropBlur ?? 40);
      setHouseName(pair.houseName || "bondu's house");
      if (partner && user) {
        setPartnerNickname(
          pair.nicknames?.[partner.uid] ||
            pair.nicknames?.[`${user.uid}_partner`] ||
            "",
        );
      }
      if (user) {
        setUserNickname(
          pair.nicknames?.[user.uid] ||
            pair.nicknames?.[`${partner?.uid}_partner`] ||
            pair.nicknames?.[`${user.uid}_self`] ||
            "",
        );
      }
    }
  }, [user, partner, pair]);

  const showStatus = (type: "success" | "error", text: string) => {
    setStatus({ type, text });
    setTimeout(() => setStatus(null), 3000);
  };

  const handleUpdateProfile = async () => {
    if (!user || !partner || !roomId) return;
    setSaving(true);
    try {
      const updatedUser: User = {
        ...user,
        name: userName,
        nickname: myAppNickname,
        theme,
        phoneNumber: userPhoneNumber,
        avatarUrl: userAvatarUrl,
      };

      // 1. Update public profile & shared settings via store
      await useAppStore.getState().saveProfile(updatedUser);

      // 2. Update the shared pair document (remaining fields)
      await updateDoc(doc(db, "pairs", roomId), {
        [`nicknames.${partner.uid}`]: partnerNickname,
        [`nicknames.${user.uid}`]: userNickname,
        anniversary: anniversary,
        relationshipQuote: relationshipQuote,
        backdropImageUrl: backdropImageUrl,
        backdropOpacity: backdropOpacity,
        backdropBlur: backdropBlur,
        houseName: houseName,
      });

      showStatus("success", "Settings saved! ✨");
      sensory.play("pop");
    } catch (err) {
      console.error("Profile update error:", err);
      showStatus("error", "Update failed 😢");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showStatus("error", "Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      if (typeof event.target?.result === "string") {
        try {
          const compressed = await compressImage(event.target.result, 400, 0.6);
          if (compressed.length > 500_000) {
            showStatus(
              "error",
              "Image is too large. Please use a smaller file.",
            );
            return;
          }
          setUserAvatarUrl(compressed);
        } catch (e) {
          console.error("Error compressing image", e);
          showStatus("error", "Failed to process image");
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRegisterNotifications = async () => {
    if (!user) return;
    setRegisteringNotifs(true);
    sensory.tap();

    if (!Capacitor.isNativePlatform()) {
      showStatus(
        "error",
        "Push is only available on real Android/iOS devices.",
      );
      setRegisteringNotifs(false);
      return;
    }

    try {
      console.log(
        "[SETTINGS-PUSH] Triggering manual notification registration...",
      );
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === "prompt") {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== "granted") {
        showStatus(
          "error",
          "Permission denied. Enable notifications in phone settings.",
        );
        setRegisteringNotifs(false);
        return;
      }

      // Create Android Channel
      await PushNotifications.createChannel({
        id: "blablu_chat",
        name: "Chat Messages",
        importance: 5,
        visibility: 1,
        vibration: true,
        sound: "default",
      });

      // Clear existing listeners to prevent duplicates
      await PushNotifications.removeAllListeners().catch(() => {});

      // Listen for registration success
      PushNotifications.addListener("registration", async (token) => {
        console.log(
          "[SETTINGS-PUSH] FCM token successfully generated:",
          token.value,
        );
        try {
          await updateDoc(doc(db, "users", user.uid), {
            fcmToken: token.value,
            tokenType: "native-android",
            tokenUpdatedAt: Date.now(),
          });
          showStatus("success", "Token successfully updated! 🔔");
          sensory.success();
        } catch (e) {
          showStatus("error", "Failed to save token to database.");
        }
        setRegisteringNotifs(false);
      });

      PushNotifications.addListener("registrationError", (err) => {
        console.error("[SETTINGS-PUSH] FCM Registration Error:", err);
        showStatus("error", "FCM registration failed.");
        setRegisteringNotifs(false);
      });

      // Request FCM registration
      await PushNotifications.register();
    } catch (err) {
      console.error("[SETTINGS-PUSH] Registration flow failed:", err);
      showStatus("error", "Registration flow failed.");
      setRegisteringNotifs(false);
    }
  };

  const handleTestNotification = async () => {
    if (!user?.fcmToken) {
      showStatus("error", "No FCM Token found. Try restarting app.");
      return;
    }

    setSaving(true);
    try {
      console.log("[DEBUG-PUSH] Testing notification for:", user.uid);
      const res = await fetch(`${CONFIG.SERVER_URL}/api/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: user.fcmToken,
          title: "Test Notification! 🐣",
          body: "This is a test from Blablu server.",
          data: { type: "test" },
        }),
      });
      const data = await res.json();
      if (data.success) {
        showStatus("success", "Test sent! Check your phone.");
        sensory.success();
      } else {
        showStatus("error", `Server error: ${data.error || "Unknown"}`);
      }
    } catch (err) {
      showStatus("error", "Relay server unreachable");
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showStatus("error", "Password must be at least 6 chars");
      return;
    }
    setSaving(true);
    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, newPassword);
        setNewPassword("");
        showStatus("success", "Password updated! 🔒");
      }
    } catch (err) {
      showStatus("error", "Password update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed inset-0 bg-bg z-[200] flex flex-col h-full safe-area-bottom overflow-hidden font-body"
    >
      <header className="px-6 py-5 flex items-center justify-between border-b border-border bg-bg/90 backdrop-blur-sm sticky top-0 z-50">
        <button
          onClick={() => setView("home")}
          className="p-2 -ml-2 text-text opacity-50 active:scale-95 transition-all"
        >
          <ChevronLeft size={24} />
        </button>
        <h1 className="font-display text-2xl text-text">Settings</h1>
        <div className="w-8" />
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 no-scrollbar pb-64">
        {/* Tab Switcher */}
        <div className="flex items-center gap-2 p-1 bg-card border border-border rounded-full w-fit mx-auto mb-2">
          {(["profile", "account"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                sensory.tap();
              }}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all capitalize",
                activeTab === tab
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "text-text/50 hover:text-text/70 bg-transparent border border-transparent",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === "profile" ? (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* About You Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-2">
                  About You
                </h3>

                <div className="flex flex-col items-center py-4">
                  <div className="relative group cursor-pointer w-24 h-24 mb-2">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-border bg-bg flex items-center justify-center">
                      {userAvatarUrl ? (
                        <img
                          src={userAvatarUrl}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserIcon size={32} className="text-text/30" />
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-xs font-bold text-white">
                        Change
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-text/40">Profile Picture</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Your name
                    </label>
                    <input
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Phone (for emergency call)
                    </label>
                    <input
                      value={userPhoneNumber}
                      onChange={(e) => setUserPhoneNumber(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="e.g. +1 234 567 890"
                      type="tel"
                    />
                  </div>
                </div>
              </section>

              {/* Nicknames Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-2">
                  Nicknames
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      My Nickname (What {partner?.name || "they"} call you)
                    </label>
                    <input
                      value={userNickname}
                      onChange={(e) => setUserNickname(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="e.g. Baby"
                    />
                    <p className="text-[10px] text-text/30 mt-1.5 ml-1 italic">
                      This is what shows on your dashboard
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Partner's Nickname (What you call{" "}
                      {partner?.name || "them"})
                    </label>
                    <input
                      value={partnerNickname}
                      onChange={(e) => setPartnerNickname(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="e.g. Honey"
                    />
                    <p className="text-[10px] text-text/30 mt-1.5 ml-1 italic">
                      This is what shows on their dashboard
                    </p>
                  </div>
                </div>
              </section>

              {/* Our Story Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-2">
                  Our Story
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Anniversary 💍
                    </label>
                    <input
                      type="date"
                      value={anniversary}
                      onChange={(e) => setAnniversary(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      House Name 🏡
                    </label>
                    <input
                      value={houseName}
                      onChange={(e) => setHouseName(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="e.g. bondu's house"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Our Aura Backdrop (Image URL) 🖼️
                    </label>
                    <input
                      value={backdropImageUrl}
                      onChange={(e) => setBackdropImageUrl(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                      placeholder="Paste an image link here..."
                    />
                    <div className="mt-3 space-y-4 px-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text/30">
                          Backdrop Intensity
                        </label>
                        <span className="text-[10px] font-bold text-primary">
                          {Math.round(backdropOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={backdropOpacity}
                        onChange={(e) =>
                          setBackdropOpacity(parseFloat(e.target.value))
                        }
                        className="w-full accent-primary h-1.5 bg-border rounded-full appearance-none cursor-pointer"
                      />

                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black uppercase tracking-widest text-text/30">
                          Dreamy Blur
                        </label>
                        <span className="text-[10px] font-bold text-primary">
                          {backdropBlur}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={backdropBlur}
                        onChange={(e) =>
                          setBackdropBlur(parseInt(e.target.value))
                        }
                        className="w-full accent-primary h-1.5 bg-border rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      Our Quote 💬
                    </label>
                    <textarea
                      value={relationshipQuote}
                      onChange={(e) =>
                        setRelationshipQuote(e.target.value.slice(0, 120))
                      }
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm h-20 resize-none focus:border-primary/50 transition-all outline-none"
                      placeholder="Something special we say..."
                      maxLength={120}
                    />
                  </div>
                </div>
              </section>

              {/* Theme Section */}
              <section className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-4">
                  App Theme
                </h3>
                <p className="text-[9px] font-black uppercase tracking-widest text-text/20 mb-3 ml-1">
                  Light Modes
                </p>
                <div className="grid grid-cols-5 gap-3 mb-5">
                  {[
                    { name: "pink", color: "#FF7EB3", label: "Sweet" },
                    { name: "lavender", color: "#9C89FF", label: "Dreamy" },
                    { name: "cream", color: "#E09F7A", label: "Warm" },
                    { name: "mint", color: "#34D399", label: "Mint" },
                    { name: "peach", color: "#FB923C", label: "Peach" },
                    { name: "sakura", color: "#F472B6", label: "Sakura" },
                    { name: "ocean", color: "#38BDF8", label: "Ocean" },
                    { name: "honey", color: "#F59E0B", label: "Honey" },
                    { name: "rose", color: "#E11D48", label: "Rose" },
                  ].map((t) => (
                    <div key={t.name} className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          setTheme(t.name as any);
                          sensory.tap();
                        }}
                        style={{ backgroundColor: t.color }}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all flex items-center justify-center border-2",
                          theme === t.name
                            ? "border-text/50 scale-110 shadow-md"
                            : "border-transparent opacity-60 hover:opacity-100",
                        )}
                      >
                        {theme === t.name && (
                          <Check size={12} className="text-white font-bold" />
                        )}
                      </button>
                      <span className="text-[8px] text-text/40 capitalize mt-1.5 font-medium">
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] font-black uppercase tracking-widest text-text/20 mb-3 ml-1">
                  Night Modes
                </p>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    {
                      name: "dark",
                      color: "#FF8AB4",
                      bg: "#150F12",
                      label: "Dark",
                    },
                    {
                      name: "amoled",
                      color: "#FF2D78",
                      bg: "#000000",
                      label: "OLED",
                    },
                    {
                      name: "midnight",
                      color: "#818CF8",
                      bg: "#0F0F1A",
                      label: "Midnight",
                    },
                    {
                      name: "aurora",
                      color: "#4ADE80",
                      bg: "#0A1410",
                      label: "Aurora",
                    },
                    {
                      name: "mocha",
                      color: "#D4A574",
                      bg: "#1A1412",
                      label: "Mocha",
                    },
                    {
                      name: "berry",
                      color: "#C084FC",
                      bg: "#150A1E",
                      label: "Berry",
                    },
                  ].map((t) => (
                    <div key={t.name} className="flex flex-col items-center">
                      <button
                        onClick={() => {
                          setTheme(t.name as any);
                          sensory.tap();
                        }}
                        style={{
                          background: `radial-gradient(circle at 60% 40%, ${t.color}, ${t.bg})`,
                        }}
                        className={cn(
                          "w-10 h-10 rounded-full transition-all flex items-center justify-center border-2",
                          theme === t.name
                            ? "border-text/50 scale-110 shadow-md"
                            : "border-transparent opacity-60 hover:opacity-100",
                        )}
                      >
                        {theme === t.name && (
                          <Check size={12} className="text-white font-bold" />
                        )}
                      </button>
                      <span className="text-[8px] text-text/40 capitalize mt-1.5 font-medium">
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* App Icon Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-2">
                  App Icon
                </h3>
                <div className="flex gap-6 items-center px-2">
                  {[
                    { id: "cat", src: "/icons/cat.png", label: "Classic" },
                    {
                      id: "penguin",
                      src: "/icons/penguin.png",
                      label: "Penguin",
                    },
                  ].map((icon) => (
                    <button
                      key={icon.id}
                      onClick={() => {
                        useAppStore.getState().setAppIcon(icon.id as any);
                        sensory.tap();
                        showStatus(
                          "success",
                          "Icon changed! (Native sync pending)",
                        );
                      }}
                      className="flex flex-col items-center gap-2 group"
                    >
                      <div
                        className={cn(
                          "w-16 h-16 rounded-2xl overflow-hidden border-2 transition-all p-0.5",
                          useAppStore.getState().appIcon === icon.id
                            ? "border-primary shadow-lg scale-105"
                            : "border-transparent opacity-60 grayscale-[40%] group-hover:opacity-100 group-hover:grayscale-0",
                        )}
                      >
                        <img
                          src={icon.src}
                          alt={icon.label}
                          className="w-full h-full object-cover rounded-[0.8rem]"
                        />
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-bold tracking-wider",
                          useAppStore.getState().appIcon === icon.id
                            ? "text-primary"
                            : "text-text/30",
                        )}
                      >
                        {icon.label}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-text/30 px-1 italic">
                  Note: Changing the home screen icon requires a full app
                  restart on some devices.
                </p>
              </section>

              {/* Privacy & Features Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-3 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-3">
                  Privacy & Features
                </h3>

                {[
                  {
                    label: "Sound Effects",
                    sub: "Play cute sounds for app interactions",
                    val: soundEnabled,
                    set: () => setSoundEnabled(!soundEnabled),
                  },
                  {
                    label: "Haptic Feedback",
                    sub: "Feel gentle vibrations when you interact",
                    val: hapticsEnabled,
                    set: () => setHapticsEnabled(!hapticsEnabled),
                  },
                  {
                    label: "Privacy Mode",
                    sub: "Hide message content in notifications",
                    val: privacyModeEnabled,
                    set: () => setPrivacyModeEnabled(!privacyModeEnabled),
                  },
                  {
                    label: "Speeding Alerts",
                    sub: "Notify partner when I am speeding (>45km/h)",
                    val: speedingNotificationsEnabled,
                    set: () =>
                      setSpeedingNotificationsEnabled(
                        !speedingNotificationsEnabled,
                      ),
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1"
                  >
                    <div className="max-w-[70%]">
                      <p className="text-sm font-medium text-text">
                        {item.label}
                      </p>
                      <p className="text-[10px] text-text/40">{item.sub}</p>
                    </div>
                    <button
                      onClick={() => {
                        item.set();
                        sensory.tap();
                      }}
                      className={cn(
                        "w-11 h-6 rounded-full transition-colors relative",
                        item.val ? "bg-primary" : "bg-border",
                      )}
                    >
                      <motion.div
                        initial={false}
                        animate={{ x: item.val ? 20 : 0 }}
                        className="w-5 h-5 bg-white rounded-full absolute top-0.5 left-0.5 shadow-sm"
                      />
                    </button>
                  </div>
                ))}

                <div className="pt-4 pb-2 border-t border-border/10">
                  <h4 className="text-xs font-bold text-text/60 mb-3 px-1">
                    Notification Sound
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: "default", label: "Default" },
                      { id: "pop", label: "Pop 🫧" },
                      { id: "chime", label: "Chime 🎐" },
                      { id: "meow", label: "Meow 🐱" },
                      { id: "sparkle", label: "Sparkle ✨" },
                      { id: "snap", label: "Snap 🫰" },
                    ].map((sound) => (
                      <button
                        key={sound.id}
                        onClick={() => {
                          setCustomNotificationSound(
                            sound.id === "default" ? null : sound.id,
                          );
                          setTimeout(() => sensory.play("notification"), 50);
                        }}
                        className={cn(
                          "py-2 px-3 rounded-xl text-xs font-medium transition-all text-left",
                          customNotificationSound === sound.id ||
                            (!customNotificationSound && sound.id === "default")
                            ? "bg-primary text-white shadow-md"
                            : "bg-bg border border-border text-text/70",
                        )}
                      >
                        {sound.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-border/10 space-y-3">
                  <button
                    onClick={handleRegisterNotifications}
                    disabled={registeringNotifs}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary/10 border border-primary/30 rounded-xl text-primary text-xs font-bold uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <Bell size={14} />{" "}
                    {registeringNotifs
                      ? "Registering..."
                      : "Enable/Fix Notifications 🔔"}
                  </button>
                  <button
                    onClick={handleTestNotification}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-primary/5 border border-primary/20 rounded-xl text-primary text-xs font-bold uppercase tracking-widest active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    <Bell size={14} /> Test Notifications
                  </button>
                  <p className="text-[10px] text-text/30 mt-3 italic text-center px-4">
                    {user?.fcmToken
                      ? `Token: ${user.fcmToken.substring(0, 15)}...`
                      : "No device token found"}
                  </p>
                </div>
              </section>

              {/* Native Status Tracking Permissions (Capacitor Native Platform only) */}

              <button
                onClick={handleUpdateProfile}
                disabled={saving}
                className="w-full bg-primary text-white rounded-xl py-3.5 font-semibold text-sm shadow-lg shadow-primary/20 active:scale-[0.98] transition-all disabled:opacity-50"
              >
                {saving ? "Saving changes..." : "Save Settings"}
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="account"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Change Password Section */}
              <section className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-text/60 px-1 border-b border-border pb-2 mb-2">
                  Security
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-text/50 mb-1.5 ml-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm focus:border-primary/50 transition-all outline-none"
                    />
                  </div>
                  <button
                    onClick={handleUpdatePassword}
                    className="w-full py-3 text-primary bg-primary/5 border border-primary/20 rounded-xl font-semibold text-sm active:scale-95 transition-all"
                  >
                    Change Password
                  </button>
                  <button
                    onClick={async () => {
                      if (auth.currentUser?.email) {
                        setSaving(true);
                        try {
                          const { sendPasswordResetEmail } =
                            await import("firebase/auth");
                          await sendPasswordResetEmail(
                            auth,
                            auth.currentUser.email,
                          );
                          showStatus("success", "Reset email sent! ✉️");
                        } catch (err) {
                          showStatus("error", "Failed to send reset email");
                        } finally {
                          setSaving(false);
                        }
                      }
                    }}
                    className="w-full py-3 text-text/50 bg-bg border border-border rounded-xl font-semibold text-xs active:scale-95 transition-all text-center mt-2"
                  >
                    Forgot/Reset via Email ✉️
                  </button>

                  <div className="pt-4 border-t border-border/10">
                    <h4 className="text-xs font-semibold text-text/60 mb-2">End-to-End Encryption (E2EE)</h4>
                    {e2eReady ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                          <ShieldCheck size={16} /> E2EE Secured with active passcode
                        </div>
                        <button
                          onClick={() => {
                            if (window.confirm("Are you sure you want to reset your E2EE passcode? Your messages are secure, but you will need to re-enter your passcode (and make sure your partner enters the exact same one) to decrypt messages again.")) {
                              clearE2E();
                              setE2eReady(false);
                              showStatus("success", "E2EE passcode reset!");
                            }
                          }}
                          className="w-full py-2.5 text-rose-500 bg-rose-500/5 border border-rose-500/15 rounded-xl text-xs font-medium active:scale-95 transition-all text-center"
                        >
                          Reset E2EE Passcode
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-600 dark:text-amber-400 text-xs font-semibold">
                          ⓘ Encryption is currently inactive. Set a passcode in the chat screen to protect your privacy.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Danger Zone Section */}
              <section className="bg-card border border-rose/20 rounded-2xl p-5 space-y-4 shadow-sm">
                <h3 className="font-display text-base text-rose/60 px-1 border-b border-rose/10 pb-2 mb-2">
                  Danger Zone
                </h3>
                <button
                  onClick={async () => {
                    await signOut(auth);
                    useAppStore.getState().setUser(null);
                    useAppStore.getState().setPartner(null);
                    useAppStore.getState().setPair(null);
                    useAppStore.getState().setRoomId(null);
                    useAppStore.getState().setView("login");
                  }}
                  className="w-full border border-rose/40 text-rose rounded-xl py-3 text-sm font-medium hover:bg-rose/5 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <LogOut size={16} /> Sign Out
                </button>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Status Notification */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            className={cn(
              "absolute bottom-8 left-6 right-6 p-4 rounded-2xl shadow-xl z-50 text-center font-bold text-xs uppercase tracking-widest text-white backdrop-blur-md",
              status.type === "success" ? "bg-mint/90" : "bg-rose/90",
            )}
          >
            {status.text}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
