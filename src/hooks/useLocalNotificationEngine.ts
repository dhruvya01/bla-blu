import { useEffect, useRef, useState } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { collection, query, where, onSnapshot, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";

export interface InAppToast {
  id: string;
  title: string;
  body: string;
  type: "chat" | "nudge" | "map";
  view: "chat" | "journey" | "habits" | "planner";
  emoji: string;
}

export const useLocalNotificationEngine = (
  onActiveToast?: (toast: InAppToast) => void
) => {
  const { roomId, user, setView, privacyModeEnabled, speedingNotificationsEnabled } = useAppStore(
    useShallow((state: any) => ({
      roomId: state.roomId,
      user: state.user,
      setView: state.setView,
      privacyModeEnabled: state.privacyModeEnabled,
      speedingNotificationsEnabled: state.speedingNotificationsEnabled,
    }))
  );

  const userId = user?.uid || null;
  const isAppActiveRef = useRef(true);
  const sessionStartRef = useRef(Date.now());

  // Refs for reactive states in Firestore listeners
  const privacyModeEnabledRef = useRef(privacyModeEnabled);
  const speedingNotificationsEnabledRef = useRef(speedingNotificationsEnabled);

  useEffect(() => {
    privacyModeEnabledRef.current = privacyModeEnabled;
  }, [privacyModeEnabled]);

  useEffect(() => {
    speedingNotificationsEnabledRef.current = speedingNotificationsEnabled;
  }, [speedingNotificationsEnabled]);

  // 1. App State Tracking (Active/Foreground vs Background/Minimized)
  useEffect(() => {
    // Check initial state
    isAppActiveRef.current = true;

    const handleStateChange = App.addListener("appStateChange", (state) => {
      isAppActiveRef.current = state.isActive;
      console.log(`[NotificationEngine] App State Changed. IsActive: ${state.isActive}`);
    });

    // Request local notification permissions on mount
    const checkPermissions = async () => {
      if (!Capacitor.isNativePlatform()) {
        console.log("[NotificationEngine] Web platform detected, skipping local notification perm request.");
        return;
      }
      try {
        let perm = await LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          perm = await LocalNotifications.requestPermissions();
        }
        
        // Create custom local notification channel for Android
        await LocalNotifications.createChannel({
          id: "blablu_serverless",
          name: "Blablu Real-time Alerts",
          description: "Serverless real-time chat, nudges, and location alerts",
          importance: 5, // High priority
          visibility: 1, // Public on lock screen
          vibration: true,
          sound: "default",
        });
      } catch (err) {
        console.error("[NotificationEngine] LocalNotification Perm Setup Failed:", err);
      }
    };

    checkPermissions();

    // Listen to native Local Notification Action Clicks
    let handleNotificationClick: any;
    if (Capacitor.isNativePlatform()) {
      handleNotificationClick = LocalNotifications.addListener(
        "localNotificationActionPerformed",
        (action) => {
          const extraData = action.notification.extra;
          console.log("[NotificationEngine] Notification Clicked Action:", action);
          if (extraData?.view) {
            setView(extraData.view);
          }
        }
      );
    }

    return () => {
      handleStateChange.then((h) => h.remove());
      if (handleNotificationClick) {
        handleNotificationClick.then((h: any) => h.remove());
      }
    };
  }, [setView]);

  // 2. Real-Time Firestore Serverless Listeners
  useEffect(() => {
    if (!roomId || !userId) return;

    console.log(`[NotificationEngine] Initializing Serverless Notification Listeners for Room: ${roomId}`);
    const sessionStart = sessionStartRef.current;

    // Helper: Safely convert Firestore dynamic date values to epoch ms
    const parseEpoch = (val: any): number => {
      if (!val) return 0;
      if (typeof val === "number") return val;
      if (val.toMillis) return val.toMillis();
      if (val.seconds) return val.seconds * 1000;
      if (val instanceof Date) return val.getTime();
      return new Date(val).getTime();
    };

    // Helper: Master Router to route alerts to In-App Popup or Native Banner
    const triggerAlert = async (params: {
      title: string;
      body: string;
      type: "chat" | "nudge" | "map";
      view: "chat" | "journey" | "habits" | "planner";
      emoji: string;
    }) => {
      if (isAppActiveRef.current) {
        // App is ACTIVE (Foreground): Suppress system banner, show custom glass in-app toast
        // Show real content inside the app as requested!
        console.log(`[NotificationEngine] Suppressing native banner. App is ACTIVE. Showing in-app popup for: ${params.title}`);
        if (onActiveToast && params.type !== "chat") {
          onActiveToast({
            id: `${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            title: params.title,
            body: params.body,
            type: params.type,
            view: params.view,
            emoji: params.emoji,
          });
        }
      } else {
        // App is INACTIVE/BACKGROUNDED: Fire Native Android/iOS Local Notification Banner
        // Respect privacy toggle on native phone notification banner!
        let finalTitle = params.title;
        let finalBody = params.body;
        if (privacyModeEnabledRef.current) {
          finalTitle = "blablu";
          finalBody = "blablubla blu";
        }

        console.log(`[NotificationEngine] App is BACKGROUNDED. Triggering Native Local Notification: ${finalTitle}`);
        if (Capacitor.isNativePlatform()) {
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Math.random() * 1000000),
                  title: `${params.emoji} ${finalTitle}`,
                  body: finalBody,
                  schedule: { at: new Date(Date.now() + 10) },
                  channelId: "blablu_serverless",
                  extra: { view: params.view },
                  smallIcon: "res://ic_stat_icon_config_sample", // falls back to default app icon if missing
                },
              ],
            });
          } catch (e) {
            console.error("[NotificationEngine] Native LocalNotification scheduling failed:", e);
          }
        } else {
          console.log("[NotificationEngine] Web platform detected, not scheduling native local notification.");
        }
      }
    };

    // ─── LISTENER A: REAL-TIME INCOMING CHATS ───
    const chatQuery = query(
      collection(db, "pairs", roomId, "chatMessages"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubChats = onSnapshot(chatQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msg = change.doc.data();
          const msgTime = parseEpoch(msg.timestamp);

          // Guarantee: Ignore historical messages & ignore own sent messages
          if (msgTime > sessionStart && msg.senderId !== userId) {
            triggerAlert({
              title: msg.senderName || "New Message",
              body: msg.text || "Sent you a message 💬",
              type: "chat",
              view: "chat",
              emoji: "💬",
            });
          }
        }
      });
    }, (error) => console.error("[NotificationEngine] Chat Listener Error:", error));

    // ─── LISTENER B: REAL-TIME NUDGES & PINGS ───
    const pingQuery = query(
      collection(db, "pairs", roomId, "pings"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubPings = onSnapshot(pingQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const ping = change.doc.data();
          const pingTime = parseEpoch(ping.timestamp);

          // Guarantee: Ignore historical pings & own sent pings
          if (pingTime > sessionStart && ping.fromId !== userId) {
            let emoji = "✨";
            let typeLabel = "nudge";
            let bodyText = "Sent you a cute poke!";

            if (ping.type === "heartbeat") {
              emoji = "❤️";
              bodyText = "Sent you a loving Heartbeat! Tap to feel it.";
            } else if (ping.type === "hug") {
              emoji = "🤗";
              bodyText = "Wrapped you in a warm virtual Hug!";
            } else if (ping.type === "sparkle") {
              emoji = "✨";
              bodyText = "Sent you a shower of magical sparkles!";
            }

            triggerAlert({
              title: `Partner Nudge`,
              body: bodyText,
              type: "nudge",
              view: "home",
              emoji: emoji,
            });
          }
        }
      });
    }, (error) => console.error("[NotificationEngine] Pings Listener Error:", error));

    // ─── LISTENER C: REAL-TIME MAP SAFE ARRIVALS & DEPARTURES ───
    const arrivalsQuery = query(
      collection(db, "pairs", roomId, "safeArrivals"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubArrivals = onSnapshot(arrivalsQuery, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const arrival = change.doc.data();
          const arrivalTime = parseEpoch(arrival.timestamp);

          // Guarantee: Ignore history & only notify if PARTNER moved (not ourselves)
          if (arrivalTime > sessionStart && arrival.userId !== userId) {
            const isArrival = arrival.type === "arrival";
            triggerAlert({
              title: isArrival ? "Safe Arrival Alert 🏡" : "Safe Departure Alert 📍",
              body: arrival.message || (isArrival
                ? `${arrival.userName || "Your partner"} has safely arrived at ${arrival.placeName}!`
                : `${arrival.userName || "Your partner"} has left ${arrival.placeName}!`),
              type: "map",
              view: "journey",
              emoji: isArrival ? "📍" : "👋",
            });
          }
        }
      });
    }, (error) => console.error("[NotificationEngine] SafeArrivals Listener Error:", error));

    // ─── LISTENER D: REAL-TIME PARTNER SPEEDING ALERTS ───
    const speedingQuery = query(
      collection(db, "pairs", roomId, "speedingHistory"),
      orderBy("timestamp", "desc"),
      limit(5)
    );
    const unsubSpeeding = onSnapshot(speedingQuery, (snap) => {
      // Respect settings toggle
      if (!speedingNotificationsEnabledRef.current) return;

      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          const speeding = change.doc.data();
          const speedingTime = parseEpoch(speeding.timestamp);

          // Guarantee: Ignore history & only notify if PARTNER is speeding
          if (speedingTime > sessionStart && speeding.userId !== userId) {
            triggerAlert({
              title: "Speeding Alert! ⚠️",
              body: `Your partner is driving over the speed limit (${Math.round(speeding.speed || 0)} km/h). Nudge them to stay safe!`,
              type: "map",
              view: "journey",
              emoji: "🚨",
            });
          }
        }
      });
    }, (error) => console.error("[NotificationEngine] Speeding Listener Error:", error));

    return () => {
      console.log("[NotificationEngine] Disposing Serverless Firestore Listeners");
      unsubChats();
      unsubPings();
      unsubArrivals();
      unsubSpeeding();
    };
  }, [roomId, userId, onActiveToast]);
};
