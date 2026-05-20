import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store';
import { onSnapshot, doc, collection, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { useShallow } from 'zustand/react/shallow';
import { User, Pair, SafeArrival, FavoritePlace } from '../types';
import { io, Socket } from 'socket.io-client';

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
    setUserLoc,
    setPartnerLoc,
    setSafeArrivals,
    setFavPlaces
  } = useAppStore(
    useShallow((state) => ({
      setMessages: state.setMessages,
      setPartner: state.setPartner,
      setPair: state.setPair,
      setAlerts: state.setAlerts,
      setPeriodLogs: state.setPeriodLogs,
      setCalendarEvents: state.setCalendarEvents,
      setUser: state.setUser,
      setHealth: state.setHealth,
      setEnvelopes: state.setEnvelopes,
      setTimelineEntries: state.setTimelineEntries,
      setHabits: state.setHabits,
      setHabitLogs: state.setHabitLogs,
      setUserLoc: state.setUserLoc,
      setPartnerLoc: state.setPartnerLoc,
      setSafeArrivals: state.setSafeArrivals,
      setFavPlaces: state.setFavPlaces
    }))
  );

  const partnerUnsubRef = useRef<(() => void) | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // 0. Initialize Socket.IO
    const s = io(CONFIG.SERVER_URL);
    setSocket(s);

    s.on('ping', (data: { type: "heartbeat" | "hug" | "sparkle" }) => {
      const { setLatestPing } = useAppStore.getState();
      setLatestPing({ id: Date.now(), type: data.type });
    });

    return () => {
      s.off('ping');
      s.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!roomId || !userId) return;

    if (socket) {
      socket.emit('join-room', roomId);
    }

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

    // 3. Sync Chat Messages - Limited to last 50
    const msgsQuery = query(collection(db, 'pairs', roomId, 'chatMessages'), orderBy('timestamp', 'desc'), limit(50));
    const unsubMsgs = onSnapshot(msgsQuery, (snapshot) => {
      const msgs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(msgs.reverse() as any);

      // Mark messages as delivered if we just received them
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

    // 4. Sync Emergency Alerts - Limited to last 10
    const alertsQuery = query(collection(db, 'pairs', roomId, 'emergencyAlerts'), orderBy('createdAt', 'desc'), limit(10));
    const unsubAlerts = onSnapshot(alertsQuery, (snapshot) => {
      setAlerts(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/emergencyAlerts'));

    // 5. Sync Envelopes - Limited to last 20
    const envQuery = query(collection(db, 'pairs', roomId, 'envelopes'), orderBy('createdAt', 'desc'), limit(20));
    const unsubEnvelopes = onSnapshot(envQuery, (snapshot) => {
      setEnvelopes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/envelopes'));

    // Sync Timeline Entries - Limited to last 30
    const timelineQuery = query(collection(db, 'pairs', roomId, 'timeline'), orderBy('date', 'desc'), limit(30));
    const unsubTimeline = onSnapshot(timelineQuery, (snapshot) => {
      setTimelineEntries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/timeline'));

    // 6. Sync Shared Calendar Events (Limited to recent and future)
    const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgoStr = thirtyDaysAgoDate.toISOString().split('T')[0];
    const calQuery = query(
      collection(db, 'pairs', roomId, 'calendarEvents'),
      where('date', '>=', thirtyDaysAgoStr),
      orderBy('date', 'asc')
    );
    const unsubCal = onSnapshot(calQuery, (snapshot) => {
      setCalendarEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/calendarEvents'));

    // 7. Sync Period Logs
    const periodQuery = query(collection(db, 'pairs', roomId, 'periodLogs'), orderBy('startDate', 'desc'));
    const unsubPeriod = onSnapshot(periodQuery, (snapshot) => {
      setPeriodLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any);
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/periodLogs'));


    // 9. Sync Custom Habits
    const habitsQuery = query(collection(db, 'pairs', roomId, 'customHabits'), orderBy('createdAt', 'asc'));
    const unsubHabits = onSnapshot(habitsQuery, (snapshot) => {
      const habits = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any;
      setHabits(habits);
      useAppStore.getState().setHealth({ ...useAppStore.getState().health, customHabits: habits });
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/customHabits'));

    // 10. Sync Habit Logs (Limited to last ~60 days)
    const sixtyDaysAgoDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgoStr = sixtyDaysAgoDate.toISOString().split('T')[0];
    const habitLogsQuery = query(
      collection(db, 'pairs', roomId, 'habitLogs'),
      where('date', '>=', sixtyDaysAgoStr)
    );
    const unsubHabitLogs = onSnapshot(habitLogsQuery, (snapshot) => {
      const logs = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as any;
      setHabitLogs(logs);
      
      // Also update health.habitLogs as a map for CareSanctuaryScreen's convenience
      const logsMap: Record<string, Record<string, number>> = {};
      logs.forEach((log: any) => {
        if (!logsMap[log.date]) logsMap[log.date] = {};
        logsMap[log.date][log.habitId] = log.completed ? 1 : 0;
      });
      useAppStore.getState().setHealth({ ...useAppStore.getState().health, habitLogs: logsMap });
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/habitLogs'));

    // 11. Sync Period Entries
    const periodEntriesQuery = query(
      collection(db, 'pairs', roomId, 'periodEntries'),
      orderBy('startDate', 'desc'),
      limit(20) // Only need recent history for calculations
    );
    const unsubPeriodEntries = onSnapshot(periodEntriesQuery, (snap) => {
      const entries: any[] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      useAppStore.getState().setHealth({ ...useAppStore.getState().health, periodEntries: entries });
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/periodEntries'));

    // 12. Sync Health Settings & State
    const unsubHealth = onSnapshot(doc(db, 'pairs', roomId, 'health', 'current'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        useAppStore.getState().setHealth({ ...useAppStore.getState().health, ...data });
      }
    }, (error) => handleFirestoreError(error, 'get', 'pairs/' + roomId + '/health/current'));

    // 13. Sync Daily Health Logs - Optimized: Limit to last 31 days
    const healthLogsQuery = query(collection(db, 'pairs', roomId, 'dailyHealthLogs'), limit(31));
    const unsubHealthLogs = onSnapshot(healthLogsQuery, (snap) => {
      const logs: Record<string, any> = {};
      snap.docs.forEach(d => { logs[d.id] = d.data(); });
      useAppStore.getState().setHealth({ ...useAppStore.getState().health, dailyHealthLogs: logs });
    }, (error) => handleFirestoreError(error, 'list', 'pairs/' + roomId + '/dailyHealthLogs'));
    
    // 13. Map Listeners - Unified Live Sync
    const unsubMapStatus = onSnapshot(doc(db, "pairs", roomId, "mapStatus", "live"), (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const state = useAppStore.getState();
      
      // Determine roles dynamically to ensure correct mapping
      const myId = userId;
      const partnerId = state.pair?.partnerIds?.find(id => id !== myId);
      // Determine roles — must match the keys used in useLocationSync ('his'/'her')
      const myRole = state.user?.role === 'boyfriend' ? 'his' : 'her';
      const partnerRole = myRole === 'his' ? 'her' : 'his';

      if (data[partnerRole]) {
        const pData = data[partnerRole];
        setPartnerLoc({ ...pData, id: partnerId });
        
        // Sync partner battery into partner.activity for the header & bento cards
        const latestState = useAppStore.getState();
        if (pData.batteryLevel !== undefined && latestState.partner) {
          setPartner({ 
            ...latestState.partner, 
            activity: { 
              ...latestState.partner.activity, 
              batteryLevel: pData.batteryLevel, 
              isCharging: pData.isCharging,
              lastChanged: pData.updatedAt
            } 
          });
        }
      }
      if (data[myRole]) {
        setUserLoc({ ...data[myRole], id: myId });
      }
    }, err => handleFirestoreError(err, 'read', 'pairs/' + roomId + '/mapStatus/live'));

    const unsubSafe = onSnapshot(collection(db, "pairs", roomId, "safeArrivals"), (snap) => {
      setSafeArrivals(snap.docs.map(d => ({ id: d.id, ...d.data() } as SafeArrival)));
    }, err => handleFirestoreError(err, 'read', 'pairs/' + roomId + '/safeArrivals'));

    const unsubFavPlaces = onSnapshot(collection(db, "pairs", roomId, "favoritePlaces"), (snap) => {
      setFavPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() } as FavoritePlace)));
    }, err => handleFirestoreError(err, 'read', 'pairs/' + roomId + '/favoritePlaces'));

    const unsubSpeeding = onSnapshot(
      query(collection(db, "pairs", roomId, "speedingHistory"), orderBy('timestamp', 'desc'), limit(30)),
      (snap) => {
        useAppStore.getState().setSpeedingHistory(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubHealthIssues = onSnapshot(
      query(collection(db, "pairs", roomId, "healthIssues"), orderBy('date', 'desc'), limit(50)),
      (snap) => {
        useAppStore.getState().setHealthIssues(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    );

    const unsubPings = onSnapshot(
      query(
        collection(db, "pairs", roomId, "pings"),
        where("timestamp", ">=", Timestamp.fromMillis(Date.now() - 15000)),
        limit(10)
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


    return () => {
      unsubUser();
      unsubPair();
      unsubMsgs();
      unsubAlerts();
      unsubEnvelopes();
      unsubTimeline();
      unsubCal();
      unsubPeriod();
      unsubHabits();
      unsubHabitLogs();
      unsubPeriodEntries();
      unsubHealth();
      unsubHealthLogs();
      unsubMapStatus();
      unsubSafe();
      unsubFavPlaces();
      unsubSpeeding();
      unsubHealthIssues();
      unsubPings();
      if (partnerUnsubRef.current) partnerUnsubRef.current();
    };
  }, [roomId, userId, socket, setUser, setPartner, setPair, setHealth, setMessages, setAlerts, setPeriodLogs, setCalendarEvents, setEnvelopes, setTimelineEntries, setHabits, setHabitLogs, setUserLoc, setPartnerLoc]);

  return { socket };
};
