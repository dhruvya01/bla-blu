import { useEffect } from 'react';
import { useAppStore } from '../store';
import { App } from '@capacitor/app';
import { Device } from '@capacitor/device';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export function useActivitySync(roomId: string | null, userId: string | null) {
  const updateActivity = useAppStore(state => state.updateActivity);

  useEffect(() => {
    if (!roomId || !userId) return;

    const syncToFirestore = async (diff: any) => {
      try {
        await updateDoc(doc(db, "users", userId), {
          ...Object.keys(diff).reduce((acc, key) => ({
            ...acc,
            [`activity.${key}`]: diff[key]
          }), {}),
          "activity.lastChanged": Date.now(),
          "lastActive": Date.now()
        });
      } catch (e) {
        console.warn("Activity firestore sync failed", e);
      }
    };

    // Simple Battery & Device Info Tracking
    const syncDeviceInfo = async () => {
      try {
        const info = await Device.getBatteryInfo();
        const diff = { 
          batteryLevel: Math.round((info.batteryLevel || 0) * 100),
          isCharging: info.isCharging 
        };
        updateActivity(diff);
        await syncToFirestore(diff);
      } catch (e) {
        if ('getBattery' in navigator) {
          (navigator as any).getBattery().then((battery: any) => {
            const diff = {
              batteryLevel: Math.round(battery.level * 100),
              isCharging: battery.charging
            };
            updateActivity(diff);
            syncToFirestore(diff);
          });
        }
      }
    };

    // 1. App State Tracking (Simple)
    const handleStateChange = async (state: { isActive: boolean }) => {
      const diff = { isForeground: state.isActive };
      updateActivity(diff);
      await syncToFirestore(diff);
    };

    App.addListener('appStateChange', handleStateChange);

    // Update lastActive instantly on mount
    updateDoc(doc(db, "users", userId), { lastActive: Date.now() }).catch(() => {});

    // 2. Heartbeat (Basic Online Status - Every 3 minutes to keep presence solid but save quotas)
    const heartbeat = setInterval(async () => {
       try {
         await updateDoc(doc(db, "users", userId), {
            "lastActive": Date.now()
         });
       } catch(e) {}
    }, 180000);

    // 3. Battery Info (Every 5 minutes)
    const batteryInterval = setInterval(() => {
       syncDeviceInfo();
    }, 300000);

    syncDeviceInfo();

    // 4. Page Visibility Fallback
    const handleVisibility = () => {
      const diff = { isForeground: document.visibilityState === 'visible' };
      updateActivity(diff);
      syncToFirestore(diff);
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      App.removeAllListeners();
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(batteryInterval);
      clearInterval(heartbeat);
    };
  }, [roomId, userId]);
}
