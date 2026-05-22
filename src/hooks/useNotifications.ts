import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { LocalNotifications } from '@capacitor/local-notifications';
import { User } from '../types';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const useNotifications = (roomId: string | null, user: User | null, setView?: (v: any) => void) => {
  const userId = user?.uid || null;
  const initialized = useRef(false);

  useEffect(() => {
    if (!userId || initialized.current) return;
    
    // Handle Native VS Web logic
    if (!Capacitor.isNativePlatform()) {
      console.log('[DEBUG-PUSH] Non-Native platform. Checking browser notifications...');
      if ("Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().then(permission => {
            console.log('[DEBUG-PUSH] Browser Notification Permission:', permission);
          });
        }
      }
      return;
    }

    initialized.current = true;
    console.log('[DEBUG-PUSH] Initializing Native Android Push System...');

    const setup = async () => {
      try {
        // 1. Request Permissions
        let permStatus = await PushNotifications.checkPermissions();
        console.log('[DEBUG-PUSH] Initial Permission Status:', permStatus.receive);

        if (permStatus.receive === 'prompt') {
          console.log('[DEBUG-PUSH] Requesting Permissions...');
          permStatus = await PushNotifications.requestPermissions();
        }

        if (permStatus.receive !== 'granted') {
          console.error('[DEBUG-PUSH] Permissions DENIED. Notifications will not work.');
          return;
        }

        // 2. Create Android Channel
        await PushNotifications.createChannel({
          id: 'blablu_chat',
          name: 'Chat Messages',
          importance: 5,
          visibility: 1,
          vibration: true,
          sound: 'default'
        });
        console.log('[DEBUG-PUSH] Android Notification Channel Created');

        // 3. Register with FCM
        await PushNotifications.register();
        console.log('[DEBUG-PUSH] PushNotifications.register() called');

        // 4. Token Registration Listener
        PushNotifications.addListener('registration', async (token: Token) => {
          console.log('[DEBUG-PUSH] FCM Device Token Generated:', token.value);
          try {
            await updateDoc(doc(db, "users", userId), {
              fcmToken: token.value,
              tokenType: 'native-android',
              tokenUpdatedAt: Date.now()
            });
            console.log('[DEBUG-PUSH] Token Saved to Firestore: users/' + userId);
          } catch (e) {
            await setDoc(doc(db, "users", userId), { 
              fcmToken: token.value, 
              tokenType: 'native-android',
              tokenUpdatedAt: Date.now() 
            }, { merge: true });
            console.log('[DEBUG-PUSH] Token Set via setDoc: users/' + userId);
          }
        });

        PushNotifications.addListener('registrationError', (err) => {
          console.error('[DEBUG-PUSH] FCM Registration Error:', err);
        });

        // 5. Foreground Receipt
        PushNotifications.addListener('pushNotificationReceived', async (notification) => {
          console.log('[DEBUG-PUSH] Notification Received in Foreground:', notification);
          // OS won't show banner while app is open, so we trigger a local alert
          await LocalNotifications.schedule({
            notifications: [{
              title: notification.title || 'blablu',
              body: notification.body || 'New message!',
              id: Math.floor(Math.random() * 1000000),
              schedule: { at: new Date(Date.now() + 10) },
              channelId: 'blablu_chat'
            }]
          });
        });

        // 6. Notification Clicked
        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[DEBUG-PUSH] User clicked notification:', action);
          if (setView) setView('chat');
        });

        // 7. Schedule Random Baby Notifications (Local)
        const isAnjali = user?.perspective === 'her';
        
        // Clear previously scheduled baby notifications (id range 1000 to 2000)
        try {
          const pending = await LocalNotifications.getPending();
          const babyNotifs = pending.notifications.filter(n => n.id >= 1000 && n.id <= 2000);
          if (babyNotifs.length > 0) {
            await LocalNotifications.cancel({ notifications: babyNotifs });
          }

          // Schedule new ones for the next 3 days
          const notificationsToSchedule = [];
          let idCounter = 1000;
          
          for (let day = 0; day < 3; day++) {
            // 3 random notifications per day
            for (let i = 0; i < 3; i++) {
              const hour = 9 + Math.floor(Math.random() * 12); // Between 9 AM and 9 PM
              const minute = Math.floor(Math.random() * 60);
              
              const scheduleDate = new Date();
              scheduleDate.setDate(scheduleDate.getDate() + day);
              scheduleDate.setHours(hour, minute, 0, 0);
              
              if (scheduleDate.getTime() < Date.now()) continue;

              const isUkku = Math.random() > 0.5;
              const name = isUkku ? "Ukku" : "Pukku";
              
              let messages = [];
              if (isAnjali) {
                messages = isUkku ? [
                  "Mumma hungry! 🍼",
                  "Mumma play time! ✨",
                  "M-ma... sleepy ☁️",
                  "Waaaa! I miss you Mumma! 🥺"
                ] : [
                  "Mumma I want a snack! 🍎",
                  "Mumma look at my dinosaur! 🦖",
                  "I'm protecting Ukku Mumma! 🦸‍♂️",
                  "Hug for me Mumma? 🥺"
                ];
              } else {
                messages = isUkku ? [
                  "Papa hungry! 🍼",
                  "P-pa play with me! 🎀",
                  "Papa ninni... 😴",
                  "Waaaa! Papa! 🥺"
                ] : [
                  "Papa vroom vroom! 🚗",
                  "Papa I'm hungry! 🥪",
                  "Papa let's play catch! 🏃‍♂️",
                  "Where is Papa? 🥺"
                ];
              }

              const randomMsg = messages[Math.floor(Math.random() * messages.length)];

              notificationsToSchedule.push({
                id: idCounter++,
                title: name,
                body: randomMsg,
                schedule: { at: scheduleDate },
                channelId: 'blablu_chat', // Reuse existing channel
                smallIcon: 'ic_stat_icon_config_sample' // default
              });
            }
          }
          
          if (notificationsToSchedule.length > 0) {
            await LocalNotifications.schedule({ notifications: notificationsToSchedule });
          }
        } catch (e) {
          console.error('[DEBUG-PUSH] Failed to schedule baby notifications', e);
        }

      } catch (err) {
        console.error('[DEBUG-PUSH] Push System Initialization Failed:', err);
      }
    };

    setup();

    return () => {
      if (Capacitor.isNativePlatform()) {
        console.log('[DEBUG-PUSH] Wiping push listeners during cleanup and resetting initialization state.');
        PushNotifications.removeAllListeners().catch(() => {});
        initialized.current = false;
      }
    };
  }, [userId]);
};
