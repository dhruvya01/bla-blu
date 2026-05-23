export interface CareAlert {
  id: string;
  type: string;
  message: string;
  severity: "low" | "medium" | "high";
  date: string;
  createdAt: any;
  read: boolean;
}

export interface ActivityState {
  isActive: boolean; // True if using phone
  currentApp?: string; // App name if available
  isForeground: boolean; // True if Blablu is the active app
  isOnCall?: boolean; // True if on a phone call
  batteryLevel?: number; // 0-100
  isCharging?: boolean;
  lastChanged: number;
}

export interface User {
  uid: string;
  email?: string;
  name: string;
  nickname: string;
  petName?: string;
  perspective: "her" | "his";
  role: "boyfriend" | "girlfriend";
  roomId: string; // The pairId
  pairId?: string; // Same as roomId for now
  phoneNumber?: string;
  avatarUrl?: string;
  lastActive?: number;
  notificationsEnabled?: boolean;
  theme?: ThemeType;
  activity?: ActivityState;
  isDeepSyncEnabled?: boolean;
  isLiveSyncing?: boolean;
  location?: {
    lat: number;
    lng: number;
    speed?: number;
    updatedAt: number;
    weather?: {
      temp: number;
      condition: string;
      icon: string;
    };
  };
  fcmToken?: string;
  tokenType?: string;
  tokenUpdatedAt?: number;
  homeLocation?: { lat: number; lng: number };
  createdAt?: number;
}

export interface Pair {
  id: string; // pairId
  inviteCode: string;
  partnerIds: string[]; // [uid1, uid2]
  partnerEmails?: string[]; // [email1, email2]
  createdAt: number;
  locked: boolean;
  anniversary?: string;
  relationshipQuote?: string;
  backdropImageUrl?: string;
  backdropOpacity?: number; // 0-1
  backdropBlur?: number;    // in px
  nicknames?: Record<string, string>; // userId -> the nickname their partner gave them
  sharedSettings?: {
    theme?: ThemeType;
    notificationsEnabled?: boolean;
  };
  level?: number;
  xp?: number;
}

export interface CycleRecord {
  id?: string;
  startDate: string; // ISO string
  endDate: string;   // ISO string
  days: number;
  label: string;
  cramps?: "none" | "mild" | "moderate" | "severe";
  mood?: string;
}

export type HabitCategory = 'health' | 'selfcare' | 'study' | 'routine' | 'emotional' | 'custom';

export interface CalendarEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: "reminder" | "appointment" | "notable";
  icon?: string;
  notes?: string;
  createdAt: any;
}

export interface CustomHabit {
  id: string;
  name: string;
  emoji: string;
  goal: number; // monthly goal
  category: HabitCategory;
  description?: string;
  isPrivate?: boolean;
  createdAt: number;
}

export interface HabitLog {
  id: string; // YYYY-MM-DD_habitId
  date: string; // YYYY-MM-DD
  habitId: string;
  completed: boolean;
  notes?: string;
  missedReason?: string;
  moodAtTime?: string;
  timestamp: number;
}

export type HabitLogsMap = Record<string, Record<string, number>>; // date -> habitId -> count

export interface DailyLog {
  date: string; // YYYY-MM-DD
  breakfast?: boolean;
  lunch?: boolean;
  dinner?: boolean;
  waterGlasses?: number;
  medicine?: boolean;
  bath?: boolean;
  exercise?: boolean;
  skincare?: boolean;
  sleptOnTime?: boolean;
  vitamins?: boolean;
  mood?: string; // emoji
  pain?: string; // icon name or string
  stress?: number; // 0-100
}

export type PlannerCategory = "relationship" | "health" | "personal" | "reminder" | "important";

export interface PlannerEvent {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  category: PlannerCategory;
  notes?: string;
  createdBy: string; // userId
  createdAt: any;
}

export interface HealthIssue {
  id: string;
  date: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'recovered';
  suggestion?: string;
  createdAt: any;
}

export interface HealthData {
  lastPeriodStart: string | null; // ISO string
  cycleLength: number;           // Default 28
  periodLength: number;          // Default 5
  medicalHistory: string[];
  careTip?: string;
  history: CycleRecord[];
  events: CalendarEvent[];
  
  // Daily Logging
  currentDailyLog?: DailyLog;
  pastLogs?: DailyLog[];
  customHabits?: CustomHabit[];
  habitLogs?: HabitLogsMap;
  lastCompletedDate?: string | null;
  lastMetAt?: number;
  periodEntries?: PeriodEntry[];
  dailyHealthLogs?: Record<string, DailyHealthLog>;
}

export interface CycleDay {
  date: string; // YYYY-MM-DD
  type: "period" | "predicted_period" | "fertile" | "ovulation" | "predicted_fertile" | "normal";
  flow?: "light" | "medium" | "heavy";
}

export interface DailyHealthLog {
  date: string; // YYYY-MM-DD
  flow?: "none" | "light" | "medium" | "heavy";
  cramps?: 0 | 1 | 2 | 3 | 4 | 5; // 0=none 5=severe
  bloating?: boolean;
  headache?: boolean;
  backPain?: boolean;
  breastTenderness?: boolean;
  nausea?: boolean;
  mood?: "happy" | "sad" | "anxious" | "irritable" | "calm" | "romantic" | "tired" | "energetic";
  energyLevel?: 1 | 2 | 3 | 4 | 5;
  stressLevel?: 1 | 2 | 3 | 4 | 5;
  sleep?: number; // hours
  water?: number; // glasses
  exercise?: boolean;
  notes?: string;
  updatedAt: number;
}

export interface PeriodEntry {
  id?: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD (optional, set when period ends)
  flow: "light" | "medium" | "heavy";
  notes?: string;
  createdAt: any;
}


export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: any; // Firestore Timestamp
  status?: "sent" | "delivered" | "seen";
  replyTo?: string;
  isCareBtn?: boolean;
  careType?: "eat" | "water" | "medicine";
  reactions?: Record<string, string>; // userId -> emoji
  read: boolean;
}

export type BabyMood = 'happy' | 'sleepy' | 'hungry' | 'playful' | 'sad' | 'crying';

export interface BabyState {
  mood: BabyMood;
  lastInteraction: number;
  lastFedAt?: number;
  streakActive?: boolean;
  // Sleep cooperative logic
  isSleeping: boolean;
  anjaliReadyToSleep: boolean;
  dhruvyaReadyToSleep: boolean;
  ukkuSleepiness: number; // 0-100
  pukkuSleepiness: number; // 0-100
  ukkuHygiene: number; // 0-100
  pukkuHygiene: number; // 0-100
}

export interface BabyPhoto {
  id: string;
  url: string;
  type: 'photo' | 'note';
  babyId: 'ukku' | 'pukku' | 'both';
  date: number;
  caption?: string;
  stickers?: TimelineSticker[];
}

export interface BabyEvolution {
  lovePoints: number;
  coins: number;
  level: number;
  stage: "egg" | "chick" | "baby" | "child" | "teen" | "adult";
  accessories: string[];
  milestones: string[];
  photos?: BabyPhoto[];
  ukkuHunger: number;
  pukkuHunger: number;
  ukkuSleepiness: number; 
  pukkuSleepiness: number;
  ukkuHygiene: number;
  pukkuHygiene: number;
  ukkuBirthdayMs: number; 
  pukkuBirthdayMs: number;
  lastGiftSentAt?: number;
  lastTick?: number;
}

export interface Envelope {
  id: string;
  senderId: string;
  recipientId: string;
  text: string;
  opened: boolean;
  createdAt: any;
  scheduledFor?: number | null;
  theme?: string;
  type?: "quick" | "letter";
}

export interface TimelineSticker {
  id: string;
  emoji: string;
  x: number; // percentage
  y: number; // percentage
  rotation: number;
  scale: number;
}

export interface TimelineEntry {
  id: string;
  type: 'photo' | 'note' | 'ticket';
  content: string; // URL for photo, text for note
  caption?: string;
  date: string; // YYYY-MM-DD
  createdAt: any;
  createdBy: string;
  stickers?: TimelineSticker[];
  x?: number; // Added
  y?: number; // Added
  color?: string; // Added
}
export interface FavoritePlace {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: "home" | "cafe" | "date" | "college" | "work" | "gym" | "other";
  icon: string;
  color?: string;
  createdAt?: number;
}

export interface SafeArrival {
  id: string;
  userId: string;
  placeName: string;
  timestamp: number;
  location: { lat: number, lng: number };
}

export interface LoveTrailPoint {
  lat: number;
  lng: number;
  timestamp: number;
  wasTogether: boolean;
}

export type ViewType = "home" | "habits" | "period" | "chat" | "settings" | "login" | "calendar" | "history" | "planner" | "timeline" | "jar" | "babygame" | "pulse" | "map" | "journey" | "sanctuary" | "vault" | "doodle" | "reels" | "mistakes" | "spotify";
export type CareTabType = "summary" | "period" | "calendar" | "history" | "planner" | "map";
export type ThemeType = "pink" | "lavender" | "dark" | "amoled" | "mint" | "peach" | "ocean" | "honey" | "rose" | "midnight" | "aurora" | "mocha" | "berry" | "amoled-cyan" | "amoled-gold" | "amoled-violet" | "amoled-ruby";
