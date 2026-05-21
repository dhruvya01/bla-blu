import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ArrowLeft, Navigation2, ShieldCheck, Heart, MapPin, 
  Wind, Zap, Smartphone, Thermometer, Clock, Calendar, 
  Star, Coffee, Home, Utensils, Flag, Bell, AlertTriangle,
  Battery, BatteryCharging, ChevronDown, ChevronUp, Shield,
  Plus, X, Check, User, Users, History, Signal, CloudRain, Cloud, Sun, Trash2
} from "lucide-react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { CoupleMap } from "../components/CoupleMap";
import { cn } from "../utils";
import { getDistance, formatDistance } from "../utils/geo";
import { sensory } from "../utils/sensory";
import { collection, onSnapshot, query, doc, setDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const getTimeAgo = (timestamp?: number): string => {
  if (!timestamp) return "Unknown"
  const diff = Date.now() - timestamp
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return "Just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const getActivityState = (speedKmh: number) => {
  if (speedKmh <= 2)  return { label: "Resting" };
  if (speedKmh <= 8)  return { label: "Walking" };
  if (speedKmh <= 25) return { label: "Moving"  };
  return { label: "Driving" };
};

export function JourneyTrackerScreen() {
  const { user, partner, userLoc, partnerLoc, roomId, setView, theme, speedingHistory, setHomeLocation, safeArrivals } = useAppStore(useShallow(state => ({
    user: state.user,
    partner: state.partner,
    userLoc: state.userLoc,
    partnerLoc: state.partnerLoc,
    roomId: state.roomId,
    setView: state.setView,
    theme: state.theme,
    speedingHistory: state.speedingHistory,
    setHomeLocation: state.setHomeLocation,
    safeArrivals: state.safeArrivals
  })));

  const DARK_THEMES = ['dark', 'amoled', 'midnight', 'aurora', 'mocha', 'berry'];
  const isDark = DARK_THEMES.includes(theme);

  const [activeTab, setActiveTab] = useState<'live' | 'places' | 'history'>('live');
  const [sheetOpen, setSheetOpen] = useState(true);
  const [favPlaces, setFavPlaces] = useState<any[]>([]);
  const [focusMode, setFocusMode] = useState<"both" | "me" | "partner">("both");
  const [isAddingPlace, setIsAddingPlace] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");
  const [newPlaceEmoji, setNewPlaceEmoji] = useState("📍");
  const [isHomeZone, setIsHomeZone] = useState(false);
  const [pickedCoords, setPickedCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [isRadarSweeper, setIsRadarSweeper] = useState(true);
  const [isHUDExpanded, setIsHUDExpanded] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const stats = useMemo(() => {
    if (!userLoc || !partnerLoc) return null;
    const dist = getDistance(userLoc.lat, userLoc.lng, partnerLoc.lat, partnerLoc.lng);
    const speedKmh = Math.round((partnerLoc.speed || 0) * 3.6);
    let arrivalMins = "??";
    if (speedKmh > 5) {
       const hours = dist / speedKmh;
       arrivalMins = Math.round(hours * 60).toString();
    }

    // Dynamic Bearing & Direction calculation
    const dLon = (partnerLoc.lng - userLoc.lng) * Math.PI / 180;
    const rLat1 = userLoc.lat * Math.PI / 180;
    const rLat2 = partnerLoc.lat * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(rLat2);
    const x = Math.cos(rLat1) * Math.sin(rLat2) - Math.sin(rLat1) * Math.cos(rLat2) * Math.cos(dLon);
    const brng = Math.atan2(y, x) * 180 / Math.PI;
    const bearing = (brng + 360) % 360;

    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const dirIndex = Math.round(((bearing % 360) / 45)) % 8;
    const bearingDirection = directions[dirIndex];

    return { dist, distFmt: formatDistance(dist), speedKmh, arrivalMins, bearing, bearingDirection };
  }, [userLoc, partnerLoc]);

  const [prevDist, setPrevDist] = useState<number | null>(null);
  const [convergenceState, setConvergenceState] = useState<'converging' | 'diverging' | 'stationary' | 'colocated'>('stationary');

  useEffect(() => {
    if (!stats?.dist) return;
    if (stats.dist < 0.05) {
      setConvergenceState('colocated');
    } else if (prevDist !== null) {
      const diff = stats.dist - prevDist;
      if (Math.abs(diff) < 0.003) {
        setConvergenceState('stationary');
      } else if (diff < 0) {
        setConvergenceState('converging');
      } else {
        setConvergenceState('diverging');
      }
    }
    setPrevDist(stats.dist);
  }, [stats?.dist]);

  const midpointRendezvous = useMemo(() => {
    if (!userLoc || !partnerLoc || favPlaces.length === 0) return null;
    const midLat = (userLoc.lat + partnerLoc.lat) / 2;
    const midLng = (userLoc.lng + partnerLoc.lng) / 2;
    
    let closestPlace = favPlaces[0];
    let minDistance = getDistance(midLat, midLng, closestPlace.lat, closestPlace.lng);
    
    for (let i = 1; i < favPlaces.length; i++) {
      const dist = getDistance(midLat, midLng, favPlaces[i].lat, favPlaces[i].lng);
      if (dist < minDistance) {
        minDistance = dist;
        closestPlace = favPlaces[i];
      }
    }
    
    return {
      place: closestPlace,
      distanceToMidpoint: minDistance,
      distanceToMidpointFmt: formatDistance(minDistance)
    };
  }, [userLoc, partnerLoc, favPlaces]);

  const combinedHistory = useMemo(() => {
    const list: any[] = [];
    if (speedingHistory && Array.isArray(speedingHistory)) {
      speedingHistory.forEach((evt: any) => {
        list.push({
          type: 'speeding',
          id: evt.id || `speed-${evt.startTime}`,
          timestamp: evt.startTime,
          title: 'Speeding Alert ⚠️',
          description: `${evt.userName} was speeding!`,
          value: `${evt.maxSpeed} km/h`,
          icon: 'speed'
        });
      });
    }

    if (safeArrivals && Array.isArray(safeArrivals)) {
      safeArrivals.forEach((evt: any) => {
        list.push({
          type: evt.type || 'arrival',
          id: evt.id,
          timestamp: evt.timestamp,
          title: evt.type === 'arrival' ? 'Arrived Safe 🏡' : 'Departed Place 👋',
          description: evt.message,
          value: evt.type === 'arrival' ? 'IN ZONE' : 'LEFT ZONE',
          icon: 'place'
        });
      });
    }

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [speedingHistory, safeArrivals]);

  const sharedPlace = useMemo(() => {
    if (!userLoc || !partnerLoc || !favPlaces.length) return null;
    for (const place of favPlaces) {
      if (typeof place.lat === 'number' && typeof place.lng === 'number') {
        const myDist = getDistance(userLoc.lat, userLoc.lng, place.lat, place.lng);
        const pDist = getDistance(partnerLoc.lat, partnerLoc.lng, place.lat, place.lng);
        if (myDist < 0.1 && pDist < 0.1) return place;
      }
    }
    return null;
  }, [userLoc, partnerLoc, favPlaces]);

  useEffect(() => {
    if (!roomId) return;
    const qFav = query(collection(db, "pairs", roomId, "favoritePlaces"));
    const unsubFav = onSnapshot(qFav, (snap) => {
      setFavPlaces(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubFav();
  }, [roomId]);

  const handleAddPlace = async () => {
    const coords = pickedCoords || (userLoc ? { lat: userLoc.lat, lng: userLoc.lng } : null);
    if (!roomId || !coords || !newPlaceName) return;
    sensory.tap();
    try {
      await addDoc(collection(db, "pairs", roomId, "favoritePlaces"), {
        name: newPlaceName,
        lat: coords.lat,
        lng: coords.lng,
        emoji: newPlaceEmoji,
        createdAt: serverTimestamp()
      });
      if (isHomeZone) {
        setHomeLocation(coords.lat, coords.lng);
        sensory.success();
      }
      setIsAddingPlace(false);
      setNewPlaceName("");
      setNewPlaceEmoji("📍");
      setIsHomeZone(false);
      setPickedCoords(null);
    } catch (e) { console.error(e); }
  };

  const deletePlace = async (id: string) => {
    if (!roomId) return;
    sensory.tap();
    await deleteDoc(doc(db, "pairs", roomId, "favoritePlaces", id));
  };

  const deleteHistoryItem = async (id: string, type: string) => {
    if (!roomId) return;
    sensory.tap();
    try {
      const collectionName = type === 'speeding' ? 'speedingHistory' : 'safeArrivals';
      await deleteDoc(doc(db, "pairs", roomId, collectionName, id));
    } catch (e) {
      console.error('[HISTORY] Delete failed:', e);
    }
  };

  const onMapLongPress = (latlng: any) => {
    sensory.vibrate();
    setPickedCoords({ lat: latlng.lat, lng: latlng.lng });
    setIsAddingPlace(true);
  };

  useEffect(() => {
    if (stats?.dist && stats.dist < 0.5) {
       const interval = setInterval(() => { sensory.vibrate(); }, 2000);
       return () => clearInterval(interval);
    }
  }, [stats?.dist]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-black"
    >
      
      <div className="relative flex-1 min-h-0">
        <div className="absolute inset-0 z-0">
           <CoupleMap 
             focusMode={focusMode} 
             targetLoc={pickedCoords}
             theme={theme} 
             onMapLongPress={onMapLongPress}
             isRadarSweeper={isRadarSweeper}
           />
        </div>

        {/* --- MINIMALIST TOP BAR --- */}
        <div className="fixed top-safe left-4 right-4 z-50 flex items-center justify-between pointer-events-auto mt-2 px-1">
          <button 
            onClick={() => { setView('home'); sensory.tap(); }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-text bg-bg/80 backdrop-blur-xl shadow-lg border border-white/20 dark:border-white/10 active:scale-95 transition-all text-xl"
          >
            <ArrowLeft size={18} />
          </button>

          {stats && (
            <div className="px-5 py-2.5 rounded-full bg-bg/80 backdrop-blur-xl shadow-lg border border-white/20 dark:border-white/10 flex items-center gap-2 font-black text-sm text-text cursor-pointer active:scale-95 transition-all tracking-tight" onClick={() => setSheetOpen(true)}>
               <Heart size={14} className={convergenceState === 'converging' ? "text-rose-500 animate-pulse" : "text-primary"} />
               <span>{stats.distFmt} apart</span>
            </div>
          )}

          <button
            onClick={() => {
              sensory.tap();
              if (focusMode === 'both') setFocusMode('me');
              else if (focusMode === 'me') setFocusMode('partner');
              else setFocusMode('both');
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center text-text bg-bg/80 backdrop-blur-xl shadow-lg border border-white/20 dark:border-white/10 active:scale-95 transition-all"
          >
            {focusMode === 'both' ? <Users size={18} className="text-emerald-500" /> : focusMode === 'me' ? <User size={18} className="text-blue-500" /> : <Heart size={18} className="text-rose-500 fill-rose-500" />}
          </button>
        </div>

        {/* --- PARTNER QUICK TELEMETRY --- */}
        {partnerLoc && !sheetOpen && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 z-40 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="px-4 py-2 rounded-full flex items-center gap-3 bg-card/80 backdrop-blur-md shadow-sm border border-border pointer-events-auto"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-text/80">
                <Navigation2 size={12} className="text-text/40" />
                <span>{Math.round(partnerLoc.speed || 0)} km/h</span>
              </div>
              <div className="w-px h-3 bg-border" />
              <div className="flex items-center gap-1.5 text-xs font-medium text-text/80">
                {partner?.activity?.isCharging ? <BatteryCharging size={12} className="text-emerald-500" /> : <Battery size={12} className="text-text/40" />}
                <span>{partner?.activity?.batteryLevel || 100}%</span>
              </div>
            </motion.div>
          </div>
        )}

      </div>

      {/* --- ADD SANCTUARY FORM (Minimal) --- */}
      <AnimatePresence>
        {isAddingPlace && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-bg/80 backdrop-blur-sm"
            onClick={() => { setIsAddingPlace(false); setPickedCoords(null); }}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }}
              className="w-full max-w-sm rounded-[32px] p-6 bg-card border border-border shadow-xl relative pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-display text-text font-bold">Add Location</h3>
                <button onClick={() => { setIsAddingPlace(false); setPickedCoords(null); }} className="p-2 text-text/40 hover:text-text"><X size={20} /></button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-text/50 block mb-1">Name</label>
                  <input type="text" value={newPlaceName} onChange={e => setNewPlaceName(e.target.value)} placeholder="e.g. Home, Cafe..." className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-sm text-text outline-none focus:border-text/30" />
                </div>
                <div>
                  <label className="text-xs font-medium text-text/50 block mb-2">Icon</label>
                  <div className="flex gap-2 flex-wrap">
                    {["📍", "✨", "🏡", "☕", "🍔", "🏥", "💻"].map(emoji => (
                      <button key={emoji} type="button" onClick={() => setNewPlaceEmoji(emoji)} className={cn("w-10 h-10 rounded-xl text-lg flex items-center justify-center border active:scale-95 transition-all", newPlaceEmoji === emoji ? "bg-bg border-text shadow-sm" : "bg-card border-border")}>{emoji}</button>
                    ))}
                  </div>
                </div>
                
                {/* Home Zone Toggle */}
                <div className="flex items-center justify-between mt-4 p-3 bg-primary/5 rounded-xl border border-primary/10">
                   <div>
                     <p className="text-sm font-bold text-text flex items-center gap-2"><Home size={16} className="text-primary" /> Set as Home Zone</p>
                     <p className="text-xs text-text/50 mt-0.5 max-w-[200px]">Disables speeding alerts automatically within a 50m radius.</p>
                   </div>
                   <button 
                     onClick={() => setIsHomeZone(!isHomeZone)}
                     className={cn("w-12 h-6 md:w-14 md:h-7 rounded-full p-1 transition-colors duration-300 relative", isHomeZone ? "bg-primary" : "bg-border shadow-inner")}
                   >
                     <motion.div 
                       layout
                       className="w-4 h-4 md:w-5 md:h-5 bg-bg rounded-full shadow-sm"
                       animate={{ x: isHomeZone ? (typeof window !== "undefined" && window.innerWidth > 768 ? 24 : 20) : 0 }}
                       transition={{ type: "spring", stiffness: 500, damping: 30 }}
                     />
                   </button>
                </div>

                <div className="pt-2">
                  <button onClick={handleAddPlace} disabled={!newPlaceName.trim()} className="w-full py-4 rounded-xl font-bold text-sm bg-text text-bg disabled:opacity-50 active:scale-95 transition-all">Save Location</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- MINIMAL BOTTOM SHEET --- */}
      <motion.div 
        animate={{ y: sheetOpen ? 0 : "calc(100% - 100px)" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="absolute bottom-0 left-0 right-0 z-[60] bg-card rounded-t-[32px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-border h-[60vh] max-h-[500px]"
      >
        <div onClick={() => setSheetOpen(!sheetOpen)} className="h-12 w-full flex flex-col items-center justify-center cursor-pointer pt-2 shrink-0">
          <div className="w-12 h-1.5 rounded-full bg-border" />
        </div>

        <div className="px-6 flex-1 overflow-y-auto no-scrollbar pb-safe-area-bottom">
           <div className="flex bg-bg p-1 rounded-xl border border-border mb-6">
             {['Status', 'Places', 'History'].map((tab, i) => {
               const tabId = i === 0 ? 'live' : i === 1 ? 'places' : 'history';
               return (
                 <button key={tab} onClick={() => { setActiveTab(tabId as any); sensory.tap(); }} className={cn("flex-1 text-xs font-semibold py-2 rounded-lg transition-all", activeTab === tabId ? "bg-card text-text shadow-sm" : "text-text/50")}>
                   {tab}
                 </button>
               );
             })}
           </div>

           <AnimatePresence mode="wait">
             {activeTab === 'live' && (
               <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
                 <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg border border-border">
                   <div className="w-12 h-12 rounded-full bg-card shadow-sm border border-border flex flex-col items-center justify-center text-xl overflow-hidden">
                     {partner?.avatarUrl ? (
                       <img src={partner.avatarUrl} alt="Partner" className="w-full h-full object-cover" />
                     ) : (
                       <span>{partner?.nickname?.charAt(0) || "🐧"}</span>
                     )}
                   </div>
                   <div className="flex-1">
                     <h4 className="text-sm font-bold text-text">{partner?.name || "Partner"}</h4>
                     <p className="text-xs text-text/50">{partnerLoc?.activity || getActivityState(partnerLoc?.speed || 0).label} • {partnerLoc?.speed ? Math.round(partnerLoc.speed) : 0} km/h</p>
                   </div>
                   <div className="text-right">
                     <span className="text-sm font-bold text-text block">{partner?.activity?.batteryLevel || 100}%</span>
                     <span className="text-[10px] text-text/40 font-bold uppercase tracking-widest">Battery</span>
                   </div>
                 </div>

                 {partnerLoc?.weather && (
                   <div className="flex items-center gap-4 p-4 rounded-2xl bg-bg border border-border">
                     <div className="w-12 h-12 rounded-full bg-card shadow-sm border border-border flex items-center justify-center text-xl text-text">
                       {partnerLoc.weather.condition === 'Rain' ? <CloudRain size={20} /> : partnerLoc.weather.condition === 'Cloudy' ? <Cloud size={20} /> : <Sun size={20} />}
                     </div>
                     <div className="flex-1">
                        <span className="text-[10px] text-text/40 font-bold uppercase tracking-widest block mb-1">Weather</span>
                        <h4 className="text-xl font-display font-bold text-text leading-none">{partnerLoc.weather.temp}°C</h4>
                     </div>
                   </div>
                 )}
               </motion.div>
             )}

             {activeTab === 'places' && (
               <motion.div key="places" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pb-8">
                  {favPlaces.length === 0 ? (
                    <p className="text-sm text-text/40 text-center py-8">No saved locations</p>
                  ) : (
                    favPlaces.map(place => (
                      <div key={place.id} onClick={() => { setPickedCoords({ lat: place.lat, lng: place.lng }); setFocusMode('me' as any); }} className="p-3 rounded-2xl bg-bg border border-border flex items-center gap-3 active:scale-95 transition-all cursor-pointer">
                        <div className="w-10 h-10 rounded-xl bg-card border border-border flex flex-shrink-0 items-center justify-center text-lg">{place.emoji || "📍"}</div>
                        <div className="flex-1"><h5 className="text-sm font-bold text-text">{place.name}</h5></div>
                        <button onClick={e => { e.stopPropagation(); deletePlace(place.id); }} className="w-8 h-8 rounded-full flex items-center justify-center text-text/30 hover:text-rose-500"><Trash2 size={16} /></button>
                      </div>
                    ))
                  )}
                  <button onClick={() => setIsAddingPlace(true)} className="w-full py-4 rounded-2xl border border-dashed border-border text-xs font-bold text-text/60 flex items-center justify-center gap-2 active:scale-95 transition-all"><Plus size={16} /> Add Location</button>
               </motion.div>
             )}

             {activeTab === 'history' && (
               <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 pb-8">
                  {(!combinedHistory || combinedHistory.length === 0) ? (
                    <p className="text-sm text-text/40 text-center py-8">No recent activity</p>
                  ) : (
                    combinedHistory.map((evt) => (
                      <div key={evt.id} className="p-4 rounded-2xl bg-bg border border-border flex items-start gap-3">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 flex-shrink-0", evt.type === 'speeding' ? "bg-rose-500" : "bg-emerald-500")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-text">{evt.title}</p>
                          <p className="text-[10px] text-text/50 mt-0.5 truncate">{evt.description}</p>
                          <p className="text-[10px] text-text/30 mt-1">{getTimeAgo(evt.timestamp)}</p>
                        </div>
                      </div>
                    ))
                  )}
               </motion.div>
             )}
           </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
