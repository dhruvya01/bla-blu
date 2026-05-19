import { create } from "zustand";
import { doc, updateDoc, setDoc, getDoc } from "firebase/firestore";
import { db, handleFirestoreError } from "../firebase/config";
import {
  User,
  HealthData,
  Message,
  ViewType,
  CareTabType,
  ThemeType,
  CareAlert,
  Pair,
  CycleRecord,
  CustomHabit,
  HabitLog,
  BabyEvolution,
  BabyPhoto,
  ActivityState,
  FavoritePlace,
  SafeArrival,
  LoveTrailPoint,
} from "../types";

export const INITIAL_HEALTH: HealthData = {
  lastPeriodStart: null,
  cycleLength: 28,
  periodLength: 5,
  medicalHistory: [],
  history: [],
  events: [],
};

interface AppStore {
  user: User | null;
  partner: User | null;
  pair: Pair | null;
  health: HealthData;
  messages: Message[];
  alerts: CareAlert[];
  periodLogs: CycleRecord[];
  calendarEvents: any[];
  envelopes: any[];
  timelineEntries: any[];
  habits: CustomHabit[];
  habitLogs: HabitLog[];
  babyEvolution: BabyEvolution;
  roomId: string | null;
  view: ViewType;
  careTab: CareTabType;
  theme: ThemeType;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  privacyModeEnabled: boolean;
  speedingNotificationsEnabled: boolean;
  customNotificationSound: string | null;
  error: string | null;
  locationEnabled: boolean;
  userLoc: {
    lat: number;
    lng: number;
    speed?: number;
    updatedAt: number;
  } | null;
  partnerLoc: {
    lat: number;
    lng: number;
    speed?: number;
    updatedAt: number;
    weather?: any;
  } | null;
  favPlaces: FavoritePlace[];
  safeArrivals: SafeArrival[];
  loveTrail: LoveTrailPoint[];
  speedingHistory: any[];
  healthIssues: any[];
  appIcon: "cat" | "penguin";
  loading: boolean;
  isPartnerTyping: boolean;
  latestPing: { id: number; type: "heartbeat" | "hug" | "sparkle" } | null;
  debugBirthday: string | null;
  e2eReady: boolean;

  // Actions
  setE2eReady: (ready: boolean) => void;
  setDebugBirthday: (name: string | null) => void;
  setUser: (u: User | null) => void;
  setPartner: (p: User | null) => void;
  setPair: (p: Pair | null) => void;
  setHealth: (h: Partial<HealthData>) => void;
  setMessages: (m: Message[]) => void;
  setAlerts: (a: CareAlert[]) => void;
  setPeriodLogs: (logs: CycleRecord[]) => void;
  setCalendarEvents: (events: any[]) => void;
  setEnvelopes: (envelopes: any[]) => void;
  setTimelineEntries: (timelineEntries: any[]) => void;
  setHabits: (habits: CustomHabit[]) => void;
  setHabitLogs: (logs: HabitLog[]) => void;
  setBabyEvolution: (baby: Partial<BabyEvolution>) => void;
  setRoomId: (id: string | null) => void;
  setView: (v: ViewType) => void;
  setCareTab: (t: CareTabType) => void;
  setTheme: (t: ThemeType) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setPrivacyModeEnabled: (enabled: boolean) => void;
  setSpeedingNotificationsEnabled: (enabled: boolean) => void;
  setCustomNotificationSound: (sound: string | null) => void;
  setError: (e: string | null) => void;
  setLocationEnabled: (enabled: boolean) => void;
  setUserLoc: (
    loc: { lat: number; lng: number; speed?: number; updatedAt: number } | null,
  ) => void;
  setPartnerLoc: (
    loc: {
      lat: number;
      lng: number;
      speed?: number;
      updatedAt: number;
      weather?: any;
    } | null,
  ) => void;
  setFavPlaces: (places: FavoritePlace[]) => void;
  setSafeArrivals: (arrivals: SafeArrival[]) => void;
  setLoveTrail: (trail: LoveTrailPoint[]) => void;
  setSpeedingHistory: (history: any[]) => void;
  setIsPartnerTyping: (t: boolean) => void;
  setLatestPing: (
    p: { id: number; type: "heartbeat" | "hug" | "sparkle" } | null,
  ) => void;
  setHealthIssues: (issues: any[]) => void;
  setAppIcon: (icon: "cat" | "penguin") => void;
  setLoading: (l: boolean) => void;
  addCoins: (amount: number) => void;
  addPairXp: (amount: number) => Promise<void>;
  purchaseItem: (cost: number, accessoryId?: string) => boolean;
  feedBaby: (babyId: "ukku" | "pukku", amount: number) => void;
  cleanBaby: (babyId: "ukku" | "pukku", amount: number) => void;
  updateSleepiness: (babyId: "ukku" | "pukku", amount: number) => void;
  tickBabyLogic: (isSleeping: boolean) => void;
  addBabyPhoto: (photo: BabyPhoto) => void;
  updateActivity: (activity: Partial<ActivityState>) => void;
  saveProfile: (userData: User) => Promise<void>;
  setHomeLocation: (lat: number | null, lng: number | null) => Promise<void>;
}

// Helpers
const parseJSON = (key: string, fallback: any) => {
  try {
    const val = localStorage.getItem(key);
    if (!val || val === "undefined" || val === "null") return fallback;
    return JSON.parse(val);
  } catch (e) {
    return fallback;
  }
};

const cachedUserUid = localStorage.getItem("blablu_user_uid");
const lastRoomId = localStorage.getItem("blablu_last_room");
const cachedTheme =
  (localStorage.getItem("blablu_theme") as ThemeType) || "pink";

const enrichState = (
  state: AppStore,
  newPair?: any,
  newUser?: any,
  newPartner?: any,
) => {
  const p = newPair !== undefined ? newPair : state.pair;
  const u = newUser !== undefined ? newUser : state.user;
  const part = newPartner !== undefined ? newPartner : state.partner;

  if (!u) return { pair: p, user: u, partner: part };

  let myNickname = p?.nicknames?.[u.uid];
  if (!myNickname && part) myNickname = p?.nicknames?.[`${part.uid}_partner`];
  if (!myNickname) myNickname = p?.nicknames?.[`${u.uid}_self`];

  let partnerNickname = part ? p?.nicknames?.[part.uid] : undefined;
  if (!partnerNickname) partnerNickname = p?.nicknames?.[`${u.uid}_partner`];
  if (!partnerNickname && part)
    partnerNickname = p?.nicknames?.[`${part.uid}_self`];

  const enrichedUser = {
    ...u,
    nickname:
      (typeof myNickname === "string" && myNickname.trim() !== ""
        ? myNickname
        : null) || u.name,
  };
  const enrichedPartner = part
    ? {
        ...part,
        nickname:
          (typeof partnerNickname === "string" && partnerNickname.trim() !== ""
            ? partnerNickname
            : null) || part.name,
      }
    : null;

  return { pair: p, user: enrichedUser, partner: enrichedPartner };
};

export const useAppStore = create<AppStore>()((set, get) => ({
  user: parseJSON(
    cachedUserUid ? `blablu_user_${cachedUserUid}` : "none",
    null,
  ),
  partner: null,
  pair: null,
  health: INITIAL_HEALTH,
  messages: [],
  alerts: [],
  periodLogs: [],
  calendarEvents: [],
  envelopes: [],
  timelineEntries: [],
  habits: [],
  habitLogs: [],
  babyEvolution: (() => {
    const PUKKU_BIRTHDAY = new Date(2024, 9, 13).getTime();
    const UKKU_BIRTHDAY = new Date(2026, 3, 14).getTime();
    const saved = localStorage.getItem("blablu_baby_evolution");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          lovePoints: 0,
          coins: 50,
          level: 1,
          stage: "baby",
          accessories: [],
          milestones: [],
          photos: [],
          ukkuHunger: 80,
          pukkuHunger: 80,
          ukkuSleepiness: 10,
          pukkuSleepiness: 10,
          ukkuHygiene: 90,
          pukkuHygiene: 90,
          ...parsed,
          ukkuBirthdayMs: UKKU_BIRTHDAY,
          pukkuBirthdayMs: PUKKU_BIRTHDAY,
        } as BabyEvolution;
      } catch (e) {}
    }
    return {
      lovePoints: 0,
      coins: 50,
      level: 1,
      stage: "baby",
      accessories: [],
      milestones: [],
      photos: [],
      ukkuHunger: 80,
      pukkuHunger: 80,
      ukkuSleepiness: 10,
      pukkuSleepiness: 10,
      ukkuHygiene: 90,
      pukkuHygiene: 90,
      ukkuBirthdayMs: UKKU_BIRTHDAY,
      pukkuBirthdayMs: PUKKU_BIRTHDAY,
    } as BabyEvolution;
  })(),
  roomId: lastRoomId || null,
  view: (() => {
    const v = localStorage.getItem("blablu_view");
    if (v === "map" || v === "journey") return "home";
    return (v as ViewType) || "login";
  })(),
  careTab:
    (localStorage.getItem("blablu_care_tab") as CareTabType) || "summary",
  theme: cachedTheme,
  soundEnabled: localStorage.getItem("blablu_sound_enabled") !== "false",
  hapticsEnabled: localStorage.getItem("blablu_haptics_enabled") !== "false",
  privacyModeEnabled: localStorage.getItem("blablu_privacy_mode") === "true",
  speedingNotificationsEnabled:
    localStorage.getItem("blablu_speeding_notif") !== "false",
  customNotificationSound: localStorage.getItem(
    "blablu_custom_notification_sound",
  ),
  appIcon:
    (localStorage.getItem("blablu_app_icon") as "cat" | "penguin") || "cat",
  loading: !cachedUserUid,
  isPartnerTyping: false,
  latestPing: null,
  debugBirthday: null,
  error: null,
  locationEnabled: false,
  userLoc: null,
  partnerLoc: null,
  favPlaces: [],
  safeArrivals: [],
  loveTrail: [],
  speedingHistory: [],
  healthIssues: [],
  e2eReady: typeof window !== "undefined" ? !!localStorage.getItem("blablu_e2ee_secret") : false,

  // Actions
  setE2eReady: (ready) => set({ e2eReady: ready }),
  setDebugBirthday: (name) => set({ debugBirthday: name }),
  setUser: (user) =>
    set((state) => enrichState(state, undefined, user, undefined)),
  setPartner: (partner) =>
    set((state) => enrichState(state, undefined, undefined, partner)),
  setPair: (pair) =>
    set((state) => enrichState(state, pair, undefined, undefined)),
  setHealth: (health) =>
    set((state) => ({ health: { ...state.health, ...health } })),
  setMessages: (messages) => set({ messages }),
  setAlerts: (alerts) => set({ alerts }),
  setPeriodLogs: (periodLogs) => set({ periodLogs }),
  setCalendarEvents: (calendarEvents) => set({ calendarEvents }),
  setEnvelopes: (envelopes) => set({ envelopes }),
  setTimelineEntries: (timelineEntries) => set({ timelineEntries }),
  setHabits: (habits) => set({ habits }),
  setHabitLogs: (habitLogs) => set({ habitLogs }),
  setBabyEvolution: (diff) =>
    set((state) => {
      const next = { ...state.babyEvolution, ...diff };
      localStorage.setItem("blablu_baby_evolution", JSON.stringify(next));
      return { babyEvolution: next };
    }),
  setRoomId: (roomId) => {
    if (roomId) localStorage.setItem("blablu_last_room", roomId);
    else localStorage.removeItem("blablu_last_room");
    set({ roomId });
  },
  setView: (view) => {
    localStorage.setItem("blablu_view", view);
    set({ view });
  },
  setCareTab: (careTab) => {
    localStorage.setItem("blablu_care_tab", careTab);
    set({ careTab });
  },
  setLoading: (loading) => set({ loading }),
  setSpeedingHistory: (speedingHistory) => set({ speedingHistory }),
  setIsPartnerTyping: (isPartnerTyping) => set({ isPartnerTyping }),
  setLatestPing: (latestPing) => set({ latestPing }),
  setLocationEnabled: (locationEnabled) => set({ locationEnabled }),
  setUserLoc: (userLoc) => set({ userLoc }),
  setPartnerLoc: (partnerLoc) => set({ partnerLoc }),
  setFavPlaces: (favPlaces) => set({ favPlaces }),
  setSafeArrivals: (safeArrivals) => set({ safeArrivals }),
  setLoveTrail: (loveTrail) => set({ loveTrail }),
  setTheme: (theme) => {
    localStorage.setItem("blablu_theme", theme);
    document.body.className = `theme-${theme}`;
    document.documentElement.className = `theme-${theme}`;
    set({ theme });
  },
  setSoundEnabled: (soundEnabled) => {
    localStorage.setItem("blablu_sound_enabled", String(soundEnabled));
    set({ soundEnabled });
  },
  setHapticsEnabled: (hapticsEnabled) => {
    localStorage.setItem("blablu_haptics_enabled", String(hapticsEnabled));
    set({ hapticsEnabled });
  },
  setPrivacyModeEnabled: (privacyModeEnabled) => {
    localStorage.setItem("blablu_privacy_mode", String(privacyModeEnabled));
    set({ privacyModeEnabled });
  },
  setSpeedingNotificationsEnabled: (speedingNotificationsEnabled) => {
    localStorage.setItem(
      "blablu_speeding_notif",
      String(speedingNotificationsEnabled),
    );
    set({ speedingNotificationsEnabled });
  },
  setCustomNotificationSound: (customNotificationSound) => {
    localStorage.setItem(
      "blablu_custom_notification_sound",
      customNotificationSound || "",
    );
    set({ customNotificationSound });
  },
  setError: (error) => set({ error }),
  setHealthIssues: (healthIssues) => set({ healthIssues }),
  setAppIcon: (appIcon) => {
    localStorage.setItem("blablu_app_icon", appIcon);
    set({ appIcon });
  },
  addCoins: (amount) =>
    set((state) => {
      const next = state.babyEvolution.coins + amount;
      const nextEvolution = { ...state.babyEvolution, coins: next };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  addPairXp: async (amount: number) => {
    const state = get();
    if (!state.pair || !state.roomId) return;
    
    let currentXp = state.pair.xp || 0;
    let currentLevel = state.pair.level || 1;
    
    // Calculate new XP and Level
    // Simple levelling system: 100 XP per level, or progressive, e.g. level * 100
    let nextXp = currentXp + amount;
    let nextLevel = currentLevel;
    
    while (nextXp >= (100 * nextLevel)) {
      nextXp -= (100 * nextLevel);
      nextLevel++;
    }
    
    const updatedPair = { ...state.pair, xp: nextXp, level: nextLevel };
    
    // Optimistic update
    set({ pair: updatedPair });
    
    // Update firestore
    try {
      await updateDoc(doc(db, "pairs", state.roomId), {
        xp: nextXp,
        level: nextLevel
      });
    } catch (e) {
      console.error("Failed to update pair XP: ", e);
      // Revert if needed, but we'll let real-time listener catch it anyway if available
    }
  },
  purchaseItem: (cost, accessoryId) => {
    const state = get();
    if (state.babyEvolution.coins < cost) return false;
    const nextAccessories = accessoryId
      ? [...state.babyEvolution.accessories, accessoryId]
      : state.babyEvolution.accessories;
    const nextEvolution = {
      ...state.babyEvolution,
      coins: state.babyEvolution.coins - cost,
      accessories: nextAccessories,
    };
    localStorage.setItem(
      "blablu_baby_evolution",
      JSON.stringify(nextEvolution),
    );
    set({ babyEvolution: nextEvolution });
    return true;
  },
  feedBaby: (babyId, amount) =>
    set((state) => {
      const field = babyId === "ukku" ? "ukkuHunger" : "pukkuHunger";
      const nextVal = Math.min(100, state.babyEvolution[field] + amount);
      const nextEvolution = { ...state.babyEvolution, [field]: nextVal };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  cleanBaby: (babyId, amount) =>
    set((state) => {
      const field = babyId === "ukku" ? "ukkuHygiene" : "pukkuHygiene";
      const nextVal = Math.min(100, state.babyEvolution[field] + amount);
      const nextEvolution = { ...state.babyEvolution, [field]: nextVal };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  updateSleepiness: (babyId, amount) =>
    set((state) => {
      const field = babyId === "ukku" ? "ukkuSleepiness" : "pukkuSleepiness";
      const nextVal = Math.max(
        0,
        Math.min(100, state.babyEvolution[field] + amount),
      );
      const nextEvolution = { ...state.babyEvolution, [field]: nextVal };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  tickBabyLogic: (isSleeping) =>
    set((state) => {
      const {
        ukkuHunger,
        pukkuHunger,
        ukkuSleepiness,
        pukkuSleepiness,
        ukkuHygiene,
        pukkuHygiene,
      } = state.babyEvolution;
      const hungerRate = (isSleeping ? 1 : 2) + Math.random() * 2;
      const hygieneRate = 1 + Math.random() * 1;
      const sleepinessRate = isSleeping ? -5 : 2;
      const nextEvolution = {
        ...state.babyEvolution,
        ukkuHunger: Math.max(0, ukkuHunger - hungerRate),
        pukkuHunger: Math.max(0, pukkuHunger - hungerRate),
        ukkuSleepiness: Math.max(
          0,
          Math.min(100, ukkuSleepiness + sleepinessRate),
        ),
        pukkuSleepiness: Math.max(
          0,
          Math.min(100, pukkuSleepiness + sleepinessRate),
        ),
        ukkuHygiene: Math.max(0, ukkuHygiene - hygieneRate),
        pukkuHygiene: Math.max(0, pukkuHygiene - hygieneRate),
      };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  addBabyPhoto: (photo) =>
    set((state) => {
      const nextPhotos = [...(state.babyEvolution.photos || []), photo];
      const nextEvolution = { ...state.babyEvolution, photos: nextPhotos };
      localStorage.setItem(
        "blablu_baby_evolution",
        JSON.stringify(nextEvolution),
      );
      return { babyEvolution: nextEvolution };
    }),
  updateActivity: (activity) => {
    const { user } = get();
    if (!user) return;
    const updatedUser = {
      ...user,
      activity: { ...user.activity, ...activity, lastChanged: Date.now() },
    };
    set({ user: updatedUser as any });
    updateDoc(doc(db, "users", user.uid), { activity: updatedUser.activity });
  },
  saveProfile: async (userData) => {
    try {
      await setDoc(doc(db, "users", userData.uid), userData);
      set({ user: userData, roomId: userData.roomId, view: "home" });
      localStorage.setItem(
        `blablu_user_${userData.uid}`,
        JSON.stringify(userData),
      );
      localStorage.setItem("blablu_user_uid", userData.uid);
      localStorage.setItem("blablu_last_room", userData.roomId);
    } catch (err) {
      handleFirestoreError(err, "write", `users/${userData.uid}`);
      throw err;
    }
  },
  setHomeLocation: async (lat, lng) => {
    const { user } = get();
    if (!user) return;
    try {
      const location = lat === null ? null : { lat, lng };
      await updateDoc(doc(db, "users", user.uid), { homeLocation: location });
      set({ user: { ...user, homeLocation: location as any } });
    } catch (e) {
      console.error(e);
    }
  },
}));
