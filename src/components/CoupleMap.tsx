import React, { useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker, Source, Layer, MapRef } from "react-map-gl/maplibre";
import maplibregl from "maplibre-gl";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "../utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Battery,
  Zap,
  CloudRain,
  Sun,
  Cloud,
  Wind,
  Home,
  MapPin,
} from "lucide-react";
import "maplibre-gl/dist/maplibre-gl.css";
import { getDistance } from "../utils/geo";
import { sensory } from "../utils/sensory";

// ─── CONFIG ────────────────────────────────────────────────────────────────────
const DARK_THEMES = ["dark", "amoled", "midnight", "aurora", "mocha", "berry"];
const getMapStyle = (theme: string) => {
  if (DARK_THEMES.includes(theme))
    return "https://tiles.basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
  return "https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json";
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const isValidLoc = (loc: any): loc is { lat: number; lng: number } =>
  !!loc && typeof loc.lat === "number" && typeof loc.lng === "number";

// ─── CUTE LOGO COMPONENTS ──────────────────────────────────────────────────────
const CatLogo = ({ color, bg }: { color: string; bg: string }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
    <circle cx="50" cy="50" r="46" fill={bg} stroke={color} strokeWidth="2.5" />
    <path
      d="M32 30 L22 12 Q35 18 42 26"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M68 30 L78 12 Q65 18 58 26"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M36 50 Q40 54 44 50"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M56 50 Q60 54 64 50"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M48 58 L52 58 L50 60 Z" fill={color} />
  </svg>
);

const PenguinLogo = ({ color, bg }: { color: string; bg: string }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
    <circle cx="50" cy="50" r="46" fill={bg} stroke={color} strokeWidth="2.5" />
    <path
      d="M30 65 Q50 30 70 65"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
    <path
      d="M38 48 Q41 51 44 48"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M56 48 Q59 51 62 48"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M47 54 L53 54 L50 58 Z" fill="#FFA500" />
  </svg>
);

const CottageLogo = ({ bg, accent }: { bg: string; accent: string }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-xl">
    <rect
      x="25"
      y="45"
      width="50"
      height="40"
      rx="8"
      fill={bg}
      stroke={accent}
      strokeWidth="4"
    />
    <path
      d="M20 50 L50 20 L80 50"
      fill="none"
      stroke={accent}
      strokeWidth="6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M45 35 Q50 30 55 35"
      fill="none"
      stroke={accent}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

// ─── MAIN COMPONENT ────────────────────────────────────────────────────────────
export function CoupleMap({
  focusMode,
  targetLoc,
  theme,
  onMapLongPress,
  isRadarSweeper = true,
}: {
  focusMode: string;
  targetLoc?: { lat: number; lng: number } | null;
  theme: string;
  onMapLongPress?: (latlng: { lat: number; lng: number }) => void;
  isRadarSweeper?: boolean;
}) {
  const mapRef = useRef<MapRef>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = (evt: any) => {
    if (!evt.lngLat || !evt.point) return;
    startPos.current = { x: evt.point.x, y: evt.point.y };
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      sensory.vibrate();
      if (onMapLongPress) {
        onMapLongPress({ lat: evt.lngLat.lat, lng: evt.lngLat.lng });
      }
      longPressTimer.current = null;
    }, 600);
  };

  const handlePointerUpOrMove = (evt: any) => {
    if (longPressTimer.current) {
      if (evt.point && startPos.current) {
        const dx = evt.point.x - startPos.current.x;
        const dy = evt.point.y - startPos.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
      } else {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  };
  const { user, partner, userLoc, partnerLoc, favPlaces } = useAppStore(
    useShallow((state: any) => ({
      user: state.user,
      partner: state.partner,
      userLoc: state.userLoc,
      partnerLoc: state.partnerLoc,
      favPlaces: state.favPlaces,
    })),
  );

  const isDark = DARK_THEMES.includes(theme);
  const primaryPink = "#ff7eb3";
  const secondaryLavender = "#c5c5d8";

  const [viewState, setViewState] = useState({
    latitude: userLoc?.lat || 28.6139,
    longitude: userLoc?.lng || 77.209,
    zoom: 13,
    pitch: 45,
    bearing: 0,
  });

  const [mapLoaded, setMapLoaded] = useState(false);
  const distanceKm = useMemo(() => {
    if (!isValidLoc(userLoc) || !isValidLoc(partnerLoc)) return Infinity;
    return getDistance(
      userLoc.lat,
      userLoc.lng,
      partnerLoc.lat,
      partnerLoc.lng,
    );
  }, [userLoc, partnerLoc]);

  const isClose = distanceKm < 1.0;
  const midpoint = useMemo(() => {
    if (!isValidLoc(userLoc) || !isValidLoc(partnerLoc)) return null;
    return {
      lat: (userLoc.lat + partnerLoc.lat) / 2,
      lng: (userLoc.lng + partnerLoc.lng) / 2,
    };
  }, [userLoc, partnerLoc]);

  useEffect(() => {
    if (!mapRef.current) return;
    try {
      const map = mapRef.current.getMap();
      if (!map) return;
      if (targetLoc) {
        map.flyTo({
          center: [targetLoc.lng, targetLoc.lat],
          zoom: 17,
          duration: 2000,
        });
      } else if (focusMode === "me" && isValidLoc(userLoc)) {
        map.flyTo({
          center: [userLoc.lng, userLoc.lat],
          zoom: 16,
          duration: 2000,
        });
      } else if (focusMode === "partner" && isValidLoc(partnerLoc)) {
        map.flyTo({
          center: [partnerLoc.lng, partnerLoc.lat],
          zoom: 16,
          duration: 2000,
        });
      } else if (isValidLoc(userLoc) && isValidLoc(partnerLoc)) {
        const bounds = new maplibregl.LngLatBounds()
          .extend([userLoc.lng, userLoc.lat])
          .extend([partnerLoc.lng, partnerLoc.lat]);
        map.fitBounds(bounds, { padding: 120, maxZoom: 15, duration: 2000 });
      }
    } catch (e) {
      console.error(e);
    }
  }, [
    focusMode,
    targetLoc,
    userLoc?.lat,
    userLoc?.lng,
    partnerLoc?.lat,
    partnerLoc?.lng,
    mapLoaded,
  ]);

  const [userTrail, setUserTrail] = useState<[number, number][]>([]);
  const [partnerTrail, setPartnerTrail] = useState<[number, number][]>([]);

  useEffect(() => {
    if (isValidLoc(userLoc))
      setUserTrail((prev) =>
        [[userLoc.lng, userLoc.lat], ...prev].slice(0, 10),
      );
  }, [userLoc?.lat, userLoc?.lng]);

  useEffect(() => {
    if (isValidLoc(partnerLoc))
      setPartnerTrail((prev) =>
        [[partnerLoc.lng, partnerLoc.lat], ...prev].slice(0, 10),
      );
  }, [partnerLoc?.lat, partnerLoc?.lng]);

  const breadcrumbsData = useMemo(
    () => ({
      type: "FeatureCollection",
      features: [
        ...userTrail.map((coord, i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: coord },
          properties: { opacity: 0.6 - i / 10, color: primaryPink },
        })),
        ...partnerTrail.map((coord, i) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: coord },
          properties: { opacity: 0.6 - i / 10, color: secondaryLavender },
        })),
      ],
    }),
    [userTrail, partnerTrail],
  );

  const polylineData: any = useMemo(() => {
    if (!isValidLoc(userLoc) || !isValidLoc(partnerLoc)) return null;
    return {
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [userLoc.lng, userLoc.lat],
          [partnerLoc.lng, partnerLoc.lat],
        ],
      },
    };
  }, [userLoc, partnerLoc]);

  return (
    <div className="w-full h-full relative overflow-hidden bg-[#131313]">
      <style>{`
        @keyframes pulse-ring {
          0% { transform: scale(0.6); opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { transform: scale(2.2); opacity: 0; }
        }
      `}</style>
      <Map
        {...viewState}
        ref={mapRef}
        onMove={(evt) => setViewState(evt.viewState)}
        onLoad={() => setMapLoaded(true)}
        mapStyle={getMapStyle(theme)}
        style={{ width: "100%", height: "100%", position: "absolute" }}
        antialias={true}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUpOrMove}
        onMouseMove={handlePointerUpOrMove}
      >
        <Source id="breadcrumbs" type="geojson" data={breadcrumbsData}>
          <Layer
            id="breadcrumbs-layer"
            type="circle"
            paint={{
              "circle-radius": 6,
              "circle-color": ["get", "color"],
              "circle-opacity": ["get", "opacity"],
              "circle-blur": 1,
            }}
          />
        </Source>

        {polylineData && (
          <Source id="love-trail" type="geojson" data={polylineData}>
            <Layer
              id="line-layer"
              type="line"
              paint={{
                "line-color": isClose ? primaryPink : "#ffffff",
                "line-width": isClose ? 4 : 2,
                "line-dasharray": [3, 3],
                "line-opacity": 0.3,
              }}
            />
          </Source>
        )}

        {midpoint && (
          <Marker
            longitude={midpoint.lng}
            latitude={midpoint.lat}
            anchor="center"
          >
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="flex flex-col items-center justify-center pointer-events-none"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-md flex items-center justify-center shadow-lg shadow-primary/35 animate-pulse">
                <Heart
                  size={14}
                  className="text-primary fill-primary animate-pulse"
                />
              </div>
              <div className="mt-1 bg-black/60 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded-full text-[6px] font-black uppercase tracking-widest text-white shadow-md">
                Our Center ❤️
              </div>
            </motion.div>
          </Marker>
        )}

        {targetLoc && isValidLoc(targetLoc) && (
          <Marker
            longitude={targetLoc.lng}
            latitude={targetLoc.lat}
            anchor="center"
          >
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [1, 1.2, 1], opacity: 1 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center shadow-lg shadow-primary/30"
            >
              <div className="w-4 h-4 rounded-full bg-primary animate-pulse" />
            </motion.div>
          </Marker>
        )}

        {isValidLoc(userLoc) && (
          <Marker
            longitude={userLoc.lng}
            latitude={userLoc.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center justify-end relative w-24 h-24 pb-2 group z-30">
              {/* Radar Sonar pulsing rings on the ground */}
              {isRadarSweeper && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                  <div
                    className="absolute w-20 h-10 rounded-full border-2 border-primary/40 animate-[pulse-ring_2s_ease-out_infinite] opacity-40 shadow-[0_0_15px_rgba(236,72,153,0.5)]"
                    style={{ transform: "rotateX(60deg)" }}
                  />
                  <div
                    className="absolute w-14 h-7 rounded-full border-2 border-primary/50 animate-[pulse-ring_2s_ease-out_0.6s_infinite] opacity-60 shadow-[0_0_10px_rgba(236,72,153,0.5)]"
                    style={{ transform: "rotateX(60deg)" }}
                  />
                </div>
              )}

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-4 bg-primary/20 blur-md rounded-full shadow-lg" />
              </div>

              {/* Avatar Character */}
              <div className="relative z-10 flex flex-col items-center cursor-pointer transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2">
                {/* Status Bubble */}
                <div className="mb-1.5 bg-white dark:bg-card px-3 py-1.5 rounded-[14px] shadow-lg border border-black/5 dark:border-white/10 flex items-center gap-1.5 transform transition-all">
                  <span className="text-[10px] font-black text-text uppercase tracking-widest">
                    {user?.nickname || "Me"}
                  </span>
                </div>
                {/* The Avatar itself */}
                <div className="w-14 h-14 bg-gradient-to-br from-primary to-rose-400 rounded-full border-[3px] border-white dark:border-[#1a1a2e] shadow-xl flex items-center justify-center text-3xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/20" />
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.perspective === "his" ? "👦🏻" : "👧🏻"
                  )}
                </div>
                {/* Stand / Shadow */}
                <div className="w-8 h-2 bg-black/20 blur-[3px] rounded-full mt-1.5" />
              </div>
            </div>
          </Marker>
        )}

        {isValidLoc(partnerLoc) && (
          <Marker
            longitude={partnerLoc.lng}
            latitude={partnerLoc.lat}
            anchor="bottom"
          >
            <div className="flex flex-col items-center justify-end relative w-24 h-24 pb-2 group z-20">
              {/* Ground Shadow/Pulse */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center justify-center pointer-events-none">
                <div className="w-16 h-4 bg-secondary/30 blur-md rounded-full shadow-lg" />
              </div>

              <div className="relative z-10 flex flex-col items-center cursor-pointer transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-2">
                {/* Status Bubble */}
                <div className="mb-1.5 bg-white dark:bg-card px-3 py-1.5 rounded-[14px] shadow-lg border border-black/5 dark:border-white/10 flex items-center gap-2 transform transition-all relative">
                  <span className="text-[10px] font-black text-text uppercase tracking-widest">
                    {partner?.nickname || "Partner"}
                  </span>
                  <div className="flex items-center gap-1">
                    {(partner?.activity?.batteryLevel || 100) < 20 && (
                      <Battery className="text-rose-500 w-3.5 h-3.5 animate-pulse" />
                    )}
                    {partnerLoc?.weather?.condition === "Rain" && (
                      <CloudRain className="text-blue-400 w-3.5 h-3.5" />
                    )}
                    {partnerLoc?.weather?.condition === "Sunny" && (
                      <Sun className="text-yellow-400 w-3.5 h-3.5" />
                    )}
                  </div>
                </div>

                {/* The Avatar itself */}
                <div className="w-14 h-14 bg-gradient-to-br from-secondary to-indigo-400 rounded-full border-[3px] border-white dark:border-[#1a1a2e] shadow-xl flex items-center justify-center text-3xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-white/20" />
                  {partner?.avatarUrl ? (
                    <img src={partner.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    user?.perspective === "his" ? "👧🏻" : "👦🏻"
                  )}
                </div>
                {/* Stand / Shadow */}
                <div className="w-8 h-2 bg-black/20 blur-[3px] rounded-full mt-1.5" />
              </div>
            </div>
          </Marker>
        )}

        {favPlaces?.map(
          (place: any) =>
            isValidLoc(place) && (
              <Marker
                key={place.id}
                longitude={place.lng}
                latitude={place.lat}
                anchor="bottom"
              >
                <div className="flex flex-col items-center justify-end group cursor-pointer active:scale-95 transition-transform w-20 h-24 pb-2 z-10">
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-12 h-3 bg-black/10 blur-sm rounded-full pointer-events-none" />
                  <div className="relative z-10 flex flex-col items-center group-hover:-translate-y-2 transition-transform duration-300">
                    <div className="w-12 h-12 rounded-[16px] bg-white dark:bg-card border-2 border-primary/30 flex items-center justify-center text-2xl shadow-[0_8px_16px_rgba(0,0,0,0.1)] group-hover:shadow-[0_12px_24px_rgba(236,72,153,0.2)] transition-shadow overflow-hidden bg-gradient-to-br from-white dark:from-card to-primary/5">
                      {place.emoji || "📍"}
                    </div>
                    <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-primary/30 -mt-[2px]" />
                    <div className="mt-1 bg-white/90 dark:bg-card/90 backdrop-blur-md px-3 py-1 rounded-[10px] text-[9px] font-black uppercase tracking-[0.2em] text-text border border-border shadow-md">
                      {place.name}
                    </div>
                  </div>
                </div>
              </Marker>
            ),
        )}

        {user?.homeLocation && (
          <Marker
            longitude={user.homeLocation.lng}
            latitude={user.homeLocation.lat}
            anchor="bottom"
          >
            <div className="relative flex flex-col items-center justify-end group cursor-pointer active:scale-95 transition-transform w-24 h-24 pb-2 z-10">
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-16 h-4 bg-emerald-500/20 blur-md rounded-full pointer-events-none shadow-[0_0_15px_rgba(16,185,129,0.3)]" />
              <div className="relative z-10 flex flex-col items-center group-hover:-translate-y-2 transition-transform duration-300">
                <div className="w-14 h-14 bg-gradient-to-br from-white dark:from-card to-emerald-50 dark:to-emerald-900/20 rounded-[20px] border-[3px] border-emerald-400 shadow-[0_10px_25px_rgba(52,211,153,0.3)] flex items-center justify-center text-3xl transform rotate-3">
                  🏡
                </div>
                <div className="mt-2 bg-emerald-500 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg border border-white/20">
                  Our Home
                </div>
              </div>
            </div>
          </Marker>
        )}
      </Map>
    </div>
  );
}
