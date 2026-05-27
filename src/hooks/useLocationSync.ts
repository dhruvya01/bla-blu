import { useEffect, useRef } from 'react';
import { useAppStore } from '../store';
import { doc, setDoc, addDoc, collection, query, where, getDocs, deleteDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Device } from '@capacitor/device';
import { CONFIG } from '../config';

// ─── CONFIGURATION ─────────────────────────────────────────────────────────────
const MIN_DISTANCE_CHANGE = 5;         
const MAX_STATIONARY_TIME = 600_000; // 10 minutes for quota safety
const DEFAULT_MOVING_INTERVAL = 45_000; 
const ROLLING_SAMPLES = 5; // Samples for smoothing

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6_371_000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const fetchWeather = async (lat: number, lng: number) => {
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`);
    const data = await res.json();
    return {
      temp: Math.round(data.current_weather.temperature),
      condition: data.current_weather.weathercode <= 3 ? 'Clear' : 'Cloudy'
    };
  } catch (e) {
    return { temp: 24, condition: 'Clear' };
  }
};

const getActivityState = (speedKmh: number) => {
  if (speedKmh <= 2)  return { label: "Resting" };
  if (speedKmh <= 8)  return { label: "Walking" };
  if (speedKmh <= 25) return { label: "Moving"  };
  return { label: "Driving" };
};

export function useLocationSync(roomId: string | null, userId: string | null) {
  const isEnabled          = useAppStore(s => s.locationEnabled);
  const privacyModeEnabled = useAppStore(s => s.privacyModeEnabled);
  const setLocationEnabled = useAppStore(s => s.setLocationEnabled);

  const speedingEvent = useRef<{ maxSpeed: number; startTime: number } | null>(null);
  const lastWritten = useRef<{
    lat: number; lng: number; battery: number;
    isCharging: boolean; time: number;
    speed: number;
  } | null>(null);
  const speedBuffer = useRef<number[]>([]);

  useEffect(() => {
    if (!roomId || !userId || privacyModeEnabled) return;

    const syncLocation = async (pos: GeolocationPosition) => {
      try {
        if (pos.coords.accuracy > 60) return; // Ignore poor accuracy

        const state = useAppStore.getState();
        const { latitude: lat, longitude: lng, speed: rawSpeed } = pos.coords;
        const now = Date.now();
        const role = state.user?.role === 'boyfriend' ? 'his' : 'her';
        const myName = state.user?.nickname || state.user?.name || "Partner";

        // ── OPTIMIZED SPEED TRACKING ──────────────────────────────────────────
        // 1. Convert to km/h (rawSpeed is m/s)
        let currentSpeed = Math.max(0, (rawSpeed || 0) * 3.6);
        
        // 2. GPS Spike Filter: reject physically impossible readings
        if (currentSpeed > 200) currentSpeed = 0;
        
        // 3. Multi-sample buffer (5-sample window)
        if (!(window as any)._speedBuffer) (window as any)._speedBuffer = [];
        const speedBuffer = (window as any)._speedBuffer;
        speedBuffer.push(currentSpeed);
        if (speedBuffer.length > 5) speedBuffer.shift();
        
        // 4. Median Filter (much more robust than mean against GPS spikes)
        const sorted = [...speedBuffer].sort((a: number, b: number) => a - b);
        let avgSpeed = sorted[Math.floor(sorted.length / 2)];
        
        // 5. Noise Cancellation: If very slow, assume stationary
        if (avgSpeed < 1.5) avgSpeed = 0;

        // 6. HOME RADIUS PROTECTION (50m radius)
        const homeCoords = state.user?.homeLocation;
        const partnerHomeCoords = state.partner?.homeLocation;

        let myHomeName = "Home 🏡";
        let partnerHomeName = "Home 🏡";
        if (state.user?.role === 'boyfriend') {
          myHomeName = "Dhruv's Home 🏡";
          partnerHomeName = "Anjali's Home 🏡";
        } else if (state.user?.role === 'girlfriend') {
          myHomeName = "Anjali's Home 🏡";
          partnerHomeName = "Dhruv's Home 🏡";
        }

        let isAtHome = false;
        
        // Check official home coords
        if (homeCoords && typeof homeCoords.lat === 'number' && typeof homeCoords.lng === 'number') {
          const distToHomeMeters = haversine(lat, lng, homeCoords.lat, homeCoords.lng);
          if (distToHomeMeters < 50) {
            isAtHome = true;
          }
        }
        
        // Check any favorite place that contains "home" or "house" in its name as a fallback home zone
        if (!isAtHome && state.favPlaces && Array.isArray(state.favPlaces)) {
          for (const place of state.favPlaces) {
            if (place.name && (place.name.toLowerCase().includes('home') || place.name.toLowerCase().includes('house'))) {
              const distToHomeMeters = haversine(lat, lng, place.lat, place.lng);
              if (distToHomeMeters < 50) {
                isAtHome = true;
                break;
              }
            }
          }
        }
        
        if (isAtHome) {
          avgSpeed = 0; // Force zero speed when at home (within 50m radius)
          (window as any)._speedBuffer = []; // Reset buffer safely
          currentSpeed = 0;
        }

        // ── ADVANCED GEOFENCING SYSTEM (ALL PLACES - DECOUPLED) ───────────────────────────
        const allGeofences: { id: string, name: string, lat: number, lng: number }[] = [];
        
        if (homeCoords && typeof homeCoords.lat === 'number' && typeof homeCoords.lng === 'number') {
          allGeofences.push({ id: 'home', name: myHomeName, lat: homeCoords.lat, lng: homeCoords.lng });
        }
        if (partnerHomeCoords && typeof partnerHomeCoords.lat === 'number' && typeof partnerHomeCoords.lng === 'number') {
          allGeofences.push({ id: 'partner_home', name: partnerHomeName, lat: partnerHomeCoords.lat, lng: partnerHomeCoords.lng });
        }
        if (state.favPlaces && Array.isArray(state.favPlaces)) {
          state.favPlaces.forEach((place: any) => {
            if (typeof place.lat === 'number' && typeof place.lng === 'number') {
              allGeofences.push({ id: place.id, name: `${place.emoji || "📍"} ${place.name}`, lat: place.lat, lng: place.lng });
            }
          });
        }

        if (!(window as any)._geofenceState) {
          (window as any)._geofenceState = {};
        }
        const geofenceState = (window as any)._geofenceState;

        allGeofences.forEach(async (gf) => {
          const distMeters = haversine(lat, lng, gf.lat, gf.lng);
          const wasInside = geofenceState[gf.id] === 'inside';

          // Hysteresis Guard: Must get closer than 70m to enter, and further than 120m to leave.
          // This prevents rapid double triggers and duplicate departures.
          let isCurrentlyInside = wasInside;
          if (distMeters < 70) {
            isCurrentlyInside = true;
          } else if (distMeters > 120) {
            isCurrentlyInside = false;
          }

          if (geofenceState[gf.id] === undefined) {
            geofenceState[gf.id] = distMeters < 80 ? 'inside' : 'outside';
            return;
          }

          if (wasInside !== isCurrentlyInside) {
            geofenceState[gf.id] = isCurrentlyInside ? 'inside' : 'outside';
            
            const eventType = isCurrentlyInside ? 'arrival' : 'departure';
            let transitionMsg = isCurrentlyInside 
              ? `${myName} arrived at ${gf.name}! 💖` 
              : `${myName} left ${gf.name} 👋`;

            // Highly cute & personalized Home / House notifications
            if (gf.id === 'home' || gf.id === 'partner_home') {
              const isBoyfriend = (state.user?.role === 'boyfriend' && gf.id === 'home') || (state.partner?.role === 'boyfriend' && gf.id === 'partner_home');
              if (isBoyfriend) {
                transitionMsg = isCurrentlyInside 
                  ? "Dhruv has safely returned home! 🏡" 
                  : "Dhruv has stepped out of his house! 🏡";
              } else {
                transitionMsg = isCurrentlyInside 
                  ? "Anjali has safely returned home! 🏡" 
                  : "Anjali has stepped out of her house! 🏡";
              }
            } else {
              transitionMsg = isCurrentlyInside 
                ? `${myName} arrived at ${gf.name}! 📍 Safe and sound! 🥰` 
                : `${myName} left ${gf.name}! 👋 On to the next adventure! 🚀`;
            }

            try {
              await addDoc(collection(db, "pairs", roomId, "safeArrivals"), {
                userId,
                userName: myName,
                placeId: gf.id,
                placeName: gf.name,
                type: eventType,
                message: transitionMsg,
                timestamp: Date.now(),
                shown: false
              });
            } catch (e) {
              console.error('[GEOFENCE] Firestore log failed:', e);
            }

            if (state.partner?.fcmToken) {
              const notifTitle = isCurrentlyInside ? "Arrival Alert 📍" : "Departure Alert 📍";
              fetch(`${CONFIG.SERVER_URL}/api/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: state.partner.fcmToken,
                  title: notifTitle,
                  body: transitionMsg,
                  data: { type: 'geofence', senderId: userId, event: eventType, placeId: gf.id }
                })
              }).catch(console.error);
            }
          }
        });

        const speedKmh = Math.round(avgSpeed);
        const SPEED_LIMIT = 45; // km/h — the safety threshold
        
        // ── OPTIMIZED SPEEDING DETECTION ──────────────────────────────────────
        // Majority voting: at least 3 of 5 samples must exceed the limit
        // This prevents a single GPS dip from cancelling a valid alert
        const samplesOverLimit = speedBuffer.filter((s: number) => s > SPEED_LIMIT).length;
        const isSustainedHighSpeed = !isAtHome && speedBuffer.length >= 3 && samplesOverLimit >= 3;
        const isDangerousSpeed = !isAtHome && speedKmh > 80;

        // Track if we already sent a danger-level alert for this event
        if (!(window as any)._dangerAlertSent) (window as any)._dangerAlertSent = false;
        if (!(window as any)._lastSpeedNotifyTime) (window as any)._lastSpeedNotifyTime = 0;
        const speedNotifCooldown = 300_000; // 5 min cooldown between speed alerts

        if (isSustainedHighSpeed) {
          if (!speedingEvent.current) {
            // ── NEW SPEEDING EVENT DETECTED ──
            speedingEvent.current = { maxSpeed: speedKmh, startTime: now };
            (window as any)._dangerAlertSent = false;
            
            // Send speeding notification (with cooldown)
            if (state.speedingNotificationsEnabled && state.partner?.fcmToken && (now - (window as any)._lastSpeedNotifyTime > speedNotifCooldown)) {
              (window as any)._lastSpeedNotifyTime = now;
              fetch(`${CONFIG.SERVER_URL}/api/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: state.partner.fcmToken,
                  title: "⚠️ Blablu Safety",
                  body: `${myName} is going ${speedKmh} km/h — over the ${SPEED_LIMIT} km/h limit!`,
                  data: { type: 'speeding', senderId: userId, speed: speedKmh }
                })
              }).catch(console.error);
            }
          } else {
            // ── ONGOING EVENT: track peak speed ──
            speedingEvent.current.maxSpeed = Math.max(speedingEvent.current.maxSpeed, speedKmh);
            
            // Escalated DANGER alert at 80+ km/h (one-time per event)
            if (isDangerousSpeed && !(window as any)._dangerAlertSent && state.partner?.fcmToken) {
              (window as any)._dangerAlertSent = true;
              fetch(`${CONFIG.SERVER_URL}/api/notify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: state.partner.fcmToken,
                  title: "🚨 DANGER — Blablu Safety",
                  body: `${myName} is going ${speedKmh} km/h! DANGEROUSLY FAST!`,
                  data: { type: 'speeding_danger', senderId: userId, speed: speedKmh }
                })
              }).catch(console.error);
            }
          }
        } else if (speedingEvent.current) {
          // ── SPEEDING EVENT ENDED: user slowed down ──
          const { maxSpeed, startTime } = speedingEvent.current;
          
          // Log to Firestore history (threshold matches the limit: 45 km/h)
          if (maxSpeed > SPEED_LIMIT) { 
            addDoc(collection(db, 'pairs', roomId, 'speedingHistory'), {
              userId,
              userName: myName,
              maxSpeed: Math.round(maxSpeed),
              timestamp: serverTimestamp(),
              startTime,
              duration: now - startTime
            }).catch(console.error);
          }

          // Send "all safe now" notification
          if (state.partner?.fcmToken && maxSpeed > SPEED_LIMIT) {
            fetch(`${CONFIG.SERVER_URL}/api/notify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: state.partner.fcmToken,
                title: "Blablu 💚",
                body: `${myName} slowed down, all safe now 💚`,
                data: { type: 'speeding_ended', senderId: userId }
              })
            }).catch(console.error);
          }

          speedingEvent.current = null;
          (window as any)._dangerAlertSent = false;
        }

        let activityLabel = getActivityState(speedKmh).label;
        if (isAtHome) {
          activityLabel = `At ${myHomeName.replace(" 🏡", "")} rn`;
        } else {
          // Check if inside any favorite place/location
          let insidePlaceName = null;
          if (state.favPlaces && Array.isArray(state.favPlaces)) {
            for (const place of state.favPlaces) {
              if (typeof place.lat === 'number' && typeof place.lng === 'number') {
                const distM = haversine(lat, lng, place.lat, place.lng);
                if (distM < 80) { // inside the location boundary!
                  insidePlaceName = place.name;
                  break;
                }
              }
            }
          }
          if (insidePlaceName) {
            activityLabel = `At the ${insidePlaceName} rn`;
          }
        }
        let activity = { label: activityLabel };
        
        const batt = await Device.getBatteryInfo();
        const battery = Math.round((batt.batteryLevel ?? 0) * 100);
        const isCharging = batt.isCharging ?? false;

        // ── FLUID HIGH-FIDELITY TRACKING WITH EXTREME QUOTA OPTIMIZATION ────
        // Accuracy filter set to 50m to capture clean updates while dropping poor/weak signals.
        if (pos.coords.accuracy > 50) return;

        let chgChanged = false;
        let battDiff = 0;
        let elapsed = 999_999;
        
        if (lastWritten.current) {
          elapsed = now - lastWritten.current.time;
          const moved = haversine(lastWritten.current.lat, lastWritten.current.lng, lat, lng);
          battDiff = Math.abs(lastWritten.current.battery - battery);
          chgChanged = lastWritten.current.isCharging !== isCharging;
          
          // Check if it's currently Night-Time: 11 PM to 7 AM local time
          const localHour = new Date().getHours();
          const isNightTime = localHour >= 23 || localHour < 7;

          // Calibrated responsive intervals for APK/Background operation to respect a 50k daily limit:
          // 1. Inside 50m separately-configured Home Radius: keep updates extremely quiet to save DB quota
          // 2. Slow down even more at night-time (11PM to 7AM) to preserve battery & quota
          // 3. Outside of home: dynamically throttle tracking frequency according to speed
          let dynamicInterval = 300_000; // Default fallback: 5 minutes

          if (isAtHome) {
            if (isNightTime) {
              dynamicInterval = 1500_000; // Night-Time & Home: Update every 25 minutes
            } else {
              dynamicInterval = 900_000;  // Day-Time & Home: Update every 15 minutes
            }
          } else {
            if (isNightTime) {
              dynamicInterval = 900_000;  // Night-Time & Outside: Update every 15 minutes
            } else {
              // Day-Time & Outside: Scale update intervals dynamically based on speed to ensure efficient usage
              if (speedKmh <= 2) {
                dynamicInterval = 300_000; // Stationary / Resting: Update every 5 minutes
              } else if (speedKmh <= 10) {
                dynamicInterval = 240_000; // Walking / Slow speed: Update every 4 minutes 
              } else if (speedKmh <= 30) {
                dynamicInterval = 150_000; // Moderate speed (e.g. running/biking): Update every 2.5 minutes
              } else if (speedKmh <= 70) {
                dynamicInterval = 60_000;  // Driving / Commuting: Update every 60 seconds
              } else {
                dynamicInterval = 45_000;  // High-Speed Driving: Update every 45 seconds for precise navigation trace
              }
            }
          }

          // Smart Real-Time Map Overlay Override (Only applies outside of home to visualize active trips)
          const isViewingMap = state.view === 'map' || state.view === 'journey';
          if (isViewingMap && !isAtHome) {
            dynamicInterval = Math.min(dynamicInterval, speedKmh > 10 ? 30_000 : 60_000); 
          }

          // Displacement threshold set to 50 meters to ignore minor GPS drift when at home.
          // Inside home, we don't trigger updates on drift; outside of home, >50m movement triggers immediate write.
          const hasSignificantChange = (!isAtHome && moved > 50) || chgChanged || (battDiff > 2);
          const intervalPassed = elapsed >= dynamicInterval;

          // Hard safety cooldown (Never update faster than 30s)
          const minCooldown = 30_000;
          if (elapsed < minCooldown) return;

          if (!hasSignificantChange && !intervalPassed) return;
        }

        // ── Weather Refresh Logic ──────────────────────────────────────────
        let weather = state.userLoc?.weather;
        const lastWeatherTime = (window as any)._lastWeatherTime || 0;
        const distMoved = lastWritten.current ? haversine(lastWritten.current.lat, lastWritten.current.lng, lat, lng) : 999;
        
        if (now - lastWeatherTime > 1_800_000 || distMoved > 1000) {
          weather = await fetchWeather(lat, lng);
          (window as any)._lastWeatherTime = now;
        }

        const updateData: Record<string, any> = {
          [`${role}.lat`]: lat,
          [`${role}.lng`]: lng,
          [`${role}.batteryLevel`]: battery,
          [`${role}.isCharging`]: isCharging,
          [`${role}.updatedAt`]: now,
          [`${role}.speed`]: isAtHome ? 0 : speedKmh,
          [`${role}.activity`]: activity.label,
          [`${role}.isSpeeding`]: !isAtHome && speedKmh > 45,
          [`${role}.locationEnabled`]: true
        };

        // Write weather if available
        if (weather) {
          updateData[`${role}.weather`] = weather;
        }

        await updateDoc(doc(db, "pairs", roomId, "mapStatus", "live"), updateData);
        
        // Only update the user profile document if the charging status changed, the battery level changed by > 5%,
        // or if it has been at least 20 minutes since the last written tick!
        if (!lastWritten.current || chgChanged || battDiff > 5 || elapsed > 1_200_000) {
          await updateDoc(doc(db, "users", userId), {
            "activity.batteryLevel": battery,
            "activity.isCharging": isCharging,
            "activity.lastChanged": now
          }).catch(console.error);
        }

        lastWritten.current = { lat, lng, battery, isCharging, time: now, speed: avgSpeed };
        if (!state.locationEnabled) setLocationEnabled(true);

      } catch (err) {
        console.warn('[BLABLU] Location sync failed:', err);
      }
    };

    const watchId = navigator.geolocation.watchPosition(
      syncLocation,
      err => { if (err.code === 1) setLocationEnabled(false); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [roomId, userId, privacyModeEnabled, setLocationEnabled]);
}
