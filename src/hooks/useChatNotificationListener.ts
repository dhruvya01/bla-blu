import { useEffect, useRef } from "react";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { collection, query, where, onSnapshot, Timestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAppStore } from "../store";

export interface ChatMessageAlert {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
}

export const useChatNotificationListener = (
  roomId: string | null,
  currentUserId: string | null,
  onActiveMessageReceived?: (msg: ChatMessageAlert) => void
) => {
  const isAppActiveRef = useRef(true);
  const sessionStartRef = useRef(Date.now());

  useEffect(() => {
    if (!roomId || !currentUserId) return;

    const sessionStart = sessionStartRef.current;
    console.log(`[ChatNotificationListener] Subscribing. Session started at: ${new Date(sessionStart).toISOString()}`);

    // Track active vs background lifecycle state
    isAppActiveRef.current = true;
    const stateListener = App.addListener("appStateChange", (state) => {
      isAppActiveRef.current = state.isActive;
      console.log(`[ChatNotificationListener] App state changed, Active = ${state.isActive}`);
    });

    // Request permissions for native local alerts
    if (Capacitor.isNativePlatform()) {
      LocalNotifications.checkPermissions().then(async (perm) => {
        if (perm.display !== "granted") {
          await LocalNotifications.requestPermissions();
        }
      }).catch(err => {
        console.error("[ChatNotificationListener] Error checking permissions:", err);
      });
    }

    // Highly optimized index-level query using Firestore server-side filter
    // Uses Timestamp.fromMillis(sessionStart) to ensure historical logs never touch the client connection
    const chatRef = collection(db, "pairs", roomId, "chatMessages");
    const activeChatsQuery = query(
      chatRef,
      where("timestamp", ">", Timestamp.fromMillis(sessionStart))
    );

    const unsub = onSnapshot(activeChatsQuery, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        // We are only interested in new messages added in real time
        if (change.type === "added") {
          const data = change.doc.data();
          
          // Verify that it is NOT a self-sent message
          if (data.senderId !== currentUserId) {
            const msgTimestamp = data.timestamp?.toMillis 
              ? data.timestamp.toMillis() 
              : (typeof data.timestamp === "number" ? data.timestamp : Date.now());

            const alertData: ChatMessageAlert = {
              id: change.doc.id,
              senderName: data.senderName || "Partner",
              text: data.text || "Sent you a message 💬",
              timestamp: msgTimestamp,
            };

            if (isAppActiveRef.current) {
              // Active: Suppress system banner, trigger customized client toast popup
              console.log(`[ChatNotificationListener] App Active: Suppressing native banner. Tapping in-app triggers.`);
              if (onActiveMessageReceived) {
                onActiveMessageReceived(alertData);
              }
            } else {
              // Minimized/Backgrounded: Fire system Local Notification Banner with Deep-linking action
              console.log(`[ChatNotificationListener] App Background: Fire native local notification banner.`);
              
              const isPrivacy = useAppStore.getState().privacyModeEnabled;
              const notifTitle = isPrivacy ? "blablu" : alertData.senderName;
              const notifBody = isPrivacy ? "blablubla blu" : "Sent you a message 💬";
              
              if (Capacitor.isNativePlatform()) {
                try {
                  await LocalNotifications.schedule({
                    notifications: [
                      {
                        id: Math.floor(Math.random() * 999999),
                        title: notifTitle,
                        body: notifBody,
                        schedule: { at: new Date(Date.now() + 10) },
                        channelId: "blablu_serverless", // Reuses channel created in useLocalNotificationEngine
                        extra: { view: "chat" }, // Deep links action straight into chat view
                        smallIcon: "res://ic_stat_icon_config_sample",
                      },
                    ],
                  });
                } catch (e) {
                  console.error("[ChatNotificationListener] Failed to schedule native local banner:", e);
                }
              }
            }
          }
        }
      });
    }, (err) => {
      console.error("[ChatNotificationListener] Real-time chat listener error:", err);
    });

    return () => {
      console.log("[ChatNotificationListener] Disposing chat real-time listeners and app state trackers.");
      unsub();
      stateListener.then((h) => h.remove());
    };
  }, [roomId, currentUserId, onActiveMessageReceived]);
};
