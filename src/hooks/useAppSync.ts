import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { onSnapshot, doc, collection, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { useShallow } from 'zustand/react/shallow';
import { User, Pair, SafeArrival, FavoritePlace } from '../types';
import { io, Socket } from 'socket.io-client';
import { sensory } from '../utils/sensory';

import { CONFIG } from '../config';

export const useAppSync = (roomId: string | null, userId: string | null) => {
  const { 
    setMessages, 
    setPartner, 
    setPair, 
    setAlerts, 
    setPeriodLogs, 
    setCalendarEvents, 
    setUser, 
    setHealth, 
    setEnvelopes,
    setTimelineEntries,
    setHabits,
    setHabitLogs,
    setBabyEvolution,
    setUserLoc,
    setPartnerLoc,
    setSafeArrivals,
    setFavPlaces,
    setHealthIssues,
    setSpeedingHistory
  } = useAppStore.getState();

  const partnerUnsubRef = useRef<(() => void) | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!roomId || !userId) return;

    // 0. Initialize Socket.IO
    const s = io(CONFIG.SERVER_URL);
    setSocket(s);

    s.emit('join-room', roomId);

    s.on('chat_message', (data) => {
      if (data.senderId !== userId) {
        window.dispatchEvent(new CustomEvent('blablu-notification', {
          detail: {
            title: data.senderName || "Partner",
            body: data.text,
            type: "chat",
            view: "chat",
            emoji: "💬"
          }
        }));
      }
    });

    s.on('ping', (data: { type: "heartbeat" | "hug" | "sparkle", fromId?: string }) => {
      const { setLatestPing } = useAppStore.getState();
      if (data.fromId !== userId) {
        setLatestPing({ id: Date.now(), type: data.type });
        sensory.play('pop');
        sensory.tap();
        
        let emoji = "✨";
        let bodyText = "Sent you a cute poke!";
        if (data.type === "heartbeat") { emoji = "❤️"; bodyText = "Sent you a heartbeat!"; }
        else if (data.type === "hug") { emoji = "🤗"; bodyText = "Sent you a hug!"; }
        
        window.dispatchEvent(new CustomEvent('blablu-notification', {
          detail: {
            title: "Partner Nudge",
            body: bodyText,
            type: "nudge",
            view: "home",
            emoji: emoji
          }
        }));
      }
    });

    // 1. Sync Current User Profile
    const unsubUser = onSnapshot(doc(db, 'users', userId), (snap) => {
      if (snap.exists()) {
        const userData = { uid: snap.id, ...snap.data() } as User;
        setUser(userData);
      }
    }, (error) => handleFirestoreError(error, 'get', 'users/' + userId));

    // 2. Sync Shared Pair Data (Settings, Nicknames, Anniversary)
    const unsubPair = onSnapshot(doc(db, 'pairs', roomId), (docSnap) => {
      if (docSnap.exists()) {
        const pairData = { id: docSnap.id, ...docSnap.data() } as Pair;
        setPair(pairData);
        
        // Auto-sync E2EE passcode
        const sharedPasscode = (pairData as any).e2eePasscode;
        const localPasscode = localStorage.getItem('blablu_e2ee_secret');
        
        if (sharedPasscode) {
          if (localPasscode !== sharedPasscode) {
            import('../utils/e2ee').then(({ initE2E }) => {
              initE2E(sharedPasscode).then(() => {
                const store = useAppStore.getState();
                if (store.setE2eReady) store.setE2eReady(true);
              }).catch(err => console.error("Auto E2EE init failed", err));
            });
          }
        }
        
        const pId = pairData.partnerIds?.find((id: string) => id !== userId);
        if (pId) {
          if (partnerUnsubRef.current) partnerUnsubRef.current();
          partnerUnsubRef.current = onSnapshot(doc(db, 'users', pId), (pSnap) => {
            if (pSnap.exists()) {
              setPartner({ uid: pSnap.id, ...pSnap.data() } as any);
            }
          }, (error) => handleFirestoreError(error, 'get', 'users/' + pId));
        }
      }
    }, (error) => handleFirestoreError(error, 'get', 'pairs/' + roomId));

    // 3. Sync Chat Messages - Limited to last 50 (ESSENTIAL)
    const msgsQuery = query(collection(db, 'pairs', roomId, 'chatMessages'), orderBy('timestamp', 'desc'), limit(50));
    const unsubMsgs = onSnapshot(msgsQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs.reverse() as any);

      // Mark messages as delivered if we just received them (throttled check)
      const undelivered = msgs.filter((m: any) => m.senderId !== userId && m.status === 'sent');
      if (undelivered.length > 0) {
        import('firebase/firestore').then(({ writeBatch, doc }) => {
          const batch = writeBatch(db);
          undelivered.forEach(m => {
            batch.update(doc(db, 'pairs', roomId, 'chatMessages', m.id), { status: 'delivered' });
          });
          batch.commit().catch(e => console.error("Failed to mark delivered", e));
        });
      }
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/chatMessages'));

    // 4. Emergency Alerts (ESSENTIAL)
    const alertsQuery = query(collection(db, 'pairs', roomId, 'emergencyAlerts'), orderBy('createdAt', 'desc'), limit(5));
    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    });

    // 5. Sync Baby Evolution (ESSENTIAL)
    const unsubBabyEvolution = onSnapshot(doc(db, 'pairs', roomId, 'babyEvolution', 'current'), (snap) => {
      if (snap.exists()) {
        setBabyEvolution(snap.data());
      }
    }, (error) => handleFirestoreError(error, 'get', 'pairs/' + roomId + '/babyEvolution/current'));
    
    // 6. Map Status (ESSENTIAL)
    const unsubMapStatus = onSnapshot(doc(db, "pairs", roomId, "mapStatus", "live"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const state = useAppStore.getState();
      const myId = userId;
      const partnerId = state.pair?.partnerIds?.find(id => id !== myId);
      const myRole = state.user?.role === 'boyfriend' ? 'his' : 'her';
      const partnerRole = myRole === 'his' ? 'her' : 'his';

      if (data[partnerRole]) {
         setPartnerLoc({ ...data[partnerRole], id: partnerId });
      }
      if (data[myRole]) {
        setUserLoc({ ...data[myRole], id: myId });
      }
    });

    // 7. Pings (ESSENTIAL)
    const unsubPings = onSnapshot(
      query(
        collection(db, "pairs", roomId, "pings"),
        where("timestamp", ">=", Timestamp.fromMillis(Date.now() - 30000)),
        limit(5)
      ),
      (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            if (data.fromId !== userId) {
              const { setLatestPing } = useAppStore.getState();
              setLatestPing({ id: Date.now(), type: data.type || 'heartbeat' });
              sensory.play('pop');
              sensory.tap();
            }
          }
        });
      }
    );

    // 8. Sync for Scrapbook (ONE-TIME FETCH to save quota and prevent drag flicker)
    import('firebase/firestore').then(async ({ getDocs }) => {
      const q = query(collection(db, 'pairs', roomId, 'timeline'), orderBy('date', 'desc'), limit(50));
      const snap = await getDocs(q);
      setTimelineEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 9. Sync for Letters (REAL-TIME)
    const unsubEnvelopes = onSnapshot(query(collection(db, 'pairs', roomId, 'envelopes'), orderBy('createdAt', 'desc'), limit(30)), (snap) => {
      setEnvelopes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // 10. Sync for Health (REAL-TIME - CRITICAL for tracker to work)
    const unsubHealthIssues = onSnapshot(collection(db, 'pairs', roomId, 'healthIssues'), (snap) => {
      setHealthIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    const unsubPeriodEntries = onSnapshot(collection(db, "pairs", roomId, "periodEntries"), (snap) => {
      const entries = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setHealth({ periodEntries: entries });
    });

    const unsubDailyHealthLogs = onSnapshot(collection(db, "pairs", roomId, "dailyHealthLogs"), (snap) => {
      const logs: any = {};
      snap.docs.forEach(d => { logs[d.id] = d.data(); });
      setHealth({ dailyHealthLogs: logs });
    });

    // Sync habit logs for the tracker (MUST BE ARRAY for store)
    const unsubHabitLogs = onSnapshot(collection(db, "pairs", roomId, "habitLogs"), (snap) => {
      const logs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      setHabitLogs(logs); // This is the separate state for the board
    });

    const unsubCustomHabits = onSnapshot(collection(db, "pairs", roomId, "customHabits"), (snap) => {
      setHabits(snap.docs.map(d => ({ id: d.id, ...d.data() } as any)));
    });

    return () => {
      if (s) s.disconnect();
      unsubUser();
      unsubPair();
      unsubMsgs();
      unsubAlerts();
      unsubBabyEvolution();
      unsubMapStatus();
      unsubPings();
      unsubEnvelopes();
      unsubHealthIssues();
      unsubPeriodEntries();
      unsubDailyHealthLogs();
      unsubHabitLogs();
      unsubCustomHabits();
      if (partnerUnsubRef.current) partnerUnsubRef.current();
    };
  }, [roomId, userId]);

  return { socket };
};
