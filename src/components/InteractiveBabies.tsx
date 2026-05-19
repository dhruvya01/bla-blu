import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useSpring, useTransform } from 'framer-motion';
const Pukku = (props: any) => <div className={`flex items-center justify-center ${props.className || ''}`}><img src="/pet.png" className="w-[140px] h-[140px] object-contain drop-shadow-md" alt="Baby" draggable={false} /></div>;
const Ukku = (props: any) => <div className={`flex items-center justify-center ${props.className || ''}`}><img src="/pet.png" className="w-[95px] h-[95px] object-contain drop-shadow-md scale-x-[-1]" alt="Baby" draggable={false} /></div>;

import { useAppStore } from '../store';
import { doc, onSnapshot, setDoc, updateDoc, increment } from 'firebase/firestore';
import { db, handleFirestoreError } from '../firebase/config';
import { BabyMood, BabyState } from '../types';
import { sensory } from '../utils/sensory';
import { cn } from '../utils';
import { Moon, Star } from 'lucide-react';

// Shared real-human-age calculator (must match BabyGameScreen's logic exactly)
function calcAge(birthdayMs: number): { years: number; months: number; days: number } {
  const birth = new Date(birthdayMs);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  let days = now.getDate() - birth.getDate();
  if (days < 0) { months -= 1; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
  if (months < 0) { years -= 1; months += 12; }
  return { years, months, days };
}
function getAgeShort(ms: number): string {
  const { years, months, days } = calcAge(ms);
  if (years > 0 && months > 0) return `${years}y ${months}m`;
  if (years > 0) return `${years}y`;
  if (months > 0 && days > 0) return `${months}m ${days}d`;
  if (months > 0) return `${months}m`;
  return `${days}d`;
}

// Canonical birthdays — must match store/index.ts
const PUKKU_BIRTHDAY_MS = new Date('2024-10-13T00:00:00+05:30').getTime();
const UKKU_BIRTHDAY_MS  = new Date('2026-04-14T00:00:00+05:30').getTime();

// ─── Types ───────────────────────────────────────────────────────────────────
type MoodState = BabyMood;

interface BurstParticle {
  id: number;
  startX: number;
  startY: number;
  angle: number;
  distance: number;
  type: 'heart' | 'sparkle' | 'bubble' | 'emoji';
  emoji?: string;
  color: string;
  size: number;
  duration: number;
  delay: number;
  spin: number;
  yBias: number;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

// ─── Static Data ─────────────────────────────────────────────────────────────
const MOOD_AURA: Record<MoodState, [string, string]> = {
  happy:   ['var(--primary-alpha-20)', 'rgba(var(--primary-rgb), 0.4)'],
  sleepy:  ['rgba(129,140,248,0.2)',  'rgba(99,102,241,0.3)'],
  hungry:  ['rgba(251,146,60,0.3)',   'rgba(249,115,22,0.4)'],
  playful: ['rgba(244,114,182,0.4)',  'rgba(236,72,153,0.55)'],
  sad:     ['rgba(125,211,252,0.38)', 'rgba(56,189,248,0.52)'],
  crying:  ['rgba(239,68,68,0.3)',    'rgba(220,38,38,0.4)'],
};

const getBabyMessages = (babyId: 'pukku'|'ukku', mood: MoodState, birthdayMs: number): string[] => {
  const now = new Date();
  const hour = now.getHours();
  const birth = new Date(birthdayMs);
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  
  // Night time logic (After 8 PM)
  if (hour >= 20 || hour < 5) {
    return ['Papa sleepy... 🌙', 'Mumma ninni... 😴', 'Time to dream? ✨', '*yawn* ☁️'];
  }

  if (babyId === 'ukku') {
    // Ukku is a 1-month-old newborn girl
    if (months < 6) {
      return {
        happy:   ['Vroooo! ✨', '*coos*', 'Gurgle! 🎀', '*tiny smile*', 'Hehe!', 'Mama I love you! 💕', 'Papa see me! ✨', '*squeal* 🌸', 'You are the best Mama! 💖', 'Yay Papa! 🌟', 'Happy baby! 🎈', 'Mummy give kissie! 😘', 'Papa up up! ☁️', 'Haha! 🎉'],
        sleepy:  ['*yawn*... ☁️', 'M-ma...?', 'P-pa...', 'Zzz... 😴', 'Sleepy baby... 🧸', 'Hug me? 🌙', 'Sweet dreams... ✨', 'Night night Mama 😴', '*rubs eyes* 🥺', 'Hold me Papa 🧸'],
        hungry:  ['🍼', '🍼🍼', 'Waaaa! 🥺', '*smacks lips*', 'Milk please! 🍼', 'Mumma hungry! 🥺', 'Papa snack! 🥪', 'I need milkie! 🍼', 'Mummy food! 🥺', 'Nom nom! 🍓'],
        playful: ['Vroo vroo! 🎀', 'Woooo! ✨', '*jiggles*', 'Play play! 🎈', 'Peek-a-boo! 🫣', 'Catch me Mama! 🏃‍♀️', 'Papa tickle! 😂', 'Up up! ☁️', 'Papa diasor! 🦖', '*giggles* ✨'],
        sad:     ['P-pa? 🥺', '*sniffle* 💧', 'M-ma...', 'Waaa...', 'Hold me... 💔', 'Don\'t go... 🌫️', 'I miss you! 🥺', '*pouts* 🥺', 'Waaa 💧'],
        crying:  ['WAAAAAAAAA! 😭', 'WAAAA! 💔', '🍼!!!', 'Waaa waaa!', 'Mumma! 😭', 'PAPA HELP! 🥺', 'I want huggy! 💔'],
      }[mood];
    }
    return {
      happy:   ['Mama! Papa! *coos*', 'I love you! 💖', 'Gurgle! ✨', '*giggles*', 'Happy baby girl! 🎀', 'Look at me! 🌟', 'Yay! 🎉', 'Mummy give kissie! 😘', 'Papa funny! 😂'],
      sleepy:  ['*yawn*... 🌙', 'Cuddle me? 🥺', 'Nap time... ☁️', 'Zzz... 😴', 'Tired girl... 🧸', 'Sing for me? 🎵', '*rubs eyes* 🥺'],
      hungry:  ['Milk please! 🍼', 'Hungry baby... 🍓', 'Waaa! 🥺', '*smacks lips* 🌸', 'Hungry for Mama! 🍎', 'Papa cookie? 🍪', 'Mummy food! 🥺', 'Nom nom! 🍓'],
      playful: ['Peek-a-boo! 🫣', 'Woooo! 🎀', 'Dance! ✨', '*jiggles*', 'Spin me! 🌪️', 'Go go go! 🚀', 'Papa diasor! 🦖', 'Catch me! 🏃‍♀️'],
      sad:     ['Mama? Papa? 🥺', '*sniffle* 💧', 'Where are you? 🌫️', 'Huggy... 💕', 'Lonely... 🌧️', '*pouts* 🥺'],
      crying:  ['WAAAAAAAAA! 😭', 'I need you! 💔', '*sad baby sounds*', 'HELP! 🍼', 'Waaaa! 😭😭'],
    }[mood];
  } else {
    // Pukku is almost 2 years old, getting responsible
    return {
      happy:   ['I help sissy! 🦸‍♂️', 'Look! I big brother! 🌟', 'Yay!! 💙', 'I love Ukku! 🎀', 'Fun fun fun! 🦖', 'Papa look! ✨', 'Mumma I did it! 🎉', 'I big boy now! 🏃‍♂️', 'Love you Mumma! 💕', 'Love you Papa! 💙', 'Give me kissie! 😘', 'Woooooo! 🚗'],
      sleepy:  ['Ukku sleepy too... 🧸', 'Bed time! 💤', 'I protect sissy... 🌙', 'Night night! 😴', 'Tired boy... 🥱', 'Dreaming of dinos... 💤', 'Stay with me Papa 🥺', 'Read me story Mummy 📚', '*yawns big* 🥱'],
      hungry:  ['Big snack! 🍎', 'I feed Ukku? 🍼', 'Hungry boy! 🦖', 'Yum yum! 🥺', 'Mumma food please! 🍽️', 'Papa sandwich! 🥪', 'I want pizza! 🍕', 'More strawberries! 🍓', 'Mummy food! 🥺', 'Num num num! 😋'],
      playful: ['Catch me! 🏃‍♂️', 'I teach Ukku play! ⚡', 'Vroom vroom! 🚗', 'Study time! 📚', 'Dinosaur roar! 🦖', 'Hide and seek! 🫣', 'I drive the car! 🏎️', 'Super Pukku! 🦸‍♂️', 'Papa diasor! 🦖', 'Rawrrrr! 🦖', 'Tickle tickle! 😂'],
      sad:     ['Where is sissy? 🥺', 'Hug for me? 💧', 'Lonely boy... 🌧️', '*sniff* 🌫️', 'Papa come back... 🥺', 'I want Mama... 🌫️', 'Waaa 🥺'],
      crying:  ['HMPHHH! 😭', 'Ukku crying too! 💔', 'WAAAA! 🦖', 'Bad mood! 🍼', 'Mumma! 😭', 'I WANT IT NOW! 😡', 'WAAAA! 😭😭'],
    }[mood];
  }
};

const BURST_EMOJIS = ['💕','⭐','✨','💫','🌸','🎀','🦋','🌟','🎵','🍀','🌺','💝','🎈','🌈'];
const BURST_COLORS = ['#fda4af','#f9a8d4','#c4b5fd','#93c5fd','#6ee7b7','#fde68a','#fbcfe8','#a5f3fc','#d8b4fe'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function generateBurst(count: number, startX: number, startY: number): BurstParticle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const roll = Math.random();
    const type: BurstParticle['type'] =
      roll < 0.3 ? 'heart' :
      roll < 0.6 ? 'sparkle' : 'bubble';
    return {
      id: Math.random() * 1000000,
      startX,
      startY,
      angle,
      distance: 50 + Math.random() * 80,
      type,
      emoji: undefined,
      color: BURST_COLORS[Math.floor(Math.random() * BURST_COLORS.length)],
      size: 10 + Math.random() * 10,
      duration: 0.7 + Math.random() * 0.5,
      delay: Math.random() * 0.05,
      spin: (Math.random() - 0.5) * 360,
      yBias: -10 - Math.random() * 15,
    };
  });
}

function getMoodAnimation(mood: MoodState) {
  switch (mood) {
    case 'playful': return { y: [0, -12, 0], scale: [1, 1.05, 1], rotate: [0, -3, 3, 0] };
    case 'happy':   return { y: [0, -8, 0], scale: [1, 1.03, 1] };
    case 'sleepy':  return { y: [0, -3, 0], scale: [1, 0.98, 1], opacity: [1, 0.7, 1] };
    case 'hungry':  return { x: [-2, 2, -2], scale: [1, 1.02, 1] };
    case 'sad':     return { y: [0, 5, 0], scale: [1, 0.97, 1] };
    case 'crying':  return { y: [-3, 3, -3], rotate: [-2, 2, -2], scale: [1, 1.05, 1] };
    default:        return { y: [0, -5, 0] };
  }
}

function getMoodTransition(mood: MoodState) {
  const base = { repeat: Infinity as const, ease: 'easeInOut' as const };
  switch (mood) {
    case 'playful': return { ...base, duration: 2.2 };
    case 'happy':   return { ...base, duration: 2.8 };
    case 'sleepy':  return { ...base, duration: 5.0 };
    case 'hungry':  return { ...base, duration: 3.5 };
    case 'sad':     return { ...base, duration: 4.0 };
    case 'crying':  return { ...base, duration: 0.6 };
    default:        return { ...base, duration: 4 };
  }
}

export function InteractiveBabies({ showControls = true }: { showControls?: boolean }) {
  const { user, roomId, partner, addCoins, setBabyEvolution, babyEvolution, health } = useAppStore();
  const [babyState, setBabyState] = useState<BabyState | null>(null);
  const mood = babyState?.mood || 'happy';
  const isSleeping = babyState?.isSleeping || false;
  
  const [excitement, setExcitement] = useState(0);
  const [activeBubble, setActiveBubble] = useState<{ id: 'pukku'|'ukku', msg: string, x: number, y: number } | null>(null);
  const [burstParticles, setBurstParticles] = useState<BurstParticle[]>([]);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const [isStreakActive, setIsStreakActive] = useState(false);
  const [showTags, setShowTags] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const moodTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const wasLongPressRef = useRef(false);

  // Excitement Decay Logic
  useEffect(() => {
    if (excitement > 0) {
      const timer = setInterval(() => {
        setExcitement(prev => Math.max(0, prev - 0.5));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [excitement]);

  const getSmartGreeting = useCallback(() => {
    const hour = new Date().getHours();
    const isHer = user?.perspective === 'her';
    if (hour < 10) return isHer ? "Morning good Mama! ✨" : "Morning good Papa! ☀️";
    if (hour > 22) return "Time to sleep? 🌙";
    return isHer ? "We missed you Mama! 💖" : "Play with us Papa! 🦖";
  }, [user]);

  // ─── Separate 3D Physics ──────────────────────────────────────────────────
  // Pukku Physics
  const mouseX1 = useMotionValue(0);
  const mouseY1 = useMotionValue(0);
  const springX1 = useSpring(mouseX1, { damping: 35, stiffness: 200, mass: 0.5 });
  const springY1 = useSpring(mouseY1, { damping: 35, stiffness: 200, mass: 0.5 });
  const rotateZ1 = useTransform(springX1, [-38, 38], [-10, 10]);

  // Ukku Physics (Softer & smoother)
  const mouseX2 = useMotionValue(0);
  const mouseY2 = useMotionValue(0);
  const springX2 = useSpring(mouseX2, { damping: 40, stiffness: 180, mass: 0.4 });
  const springY2 = useSpring(mouseY2, { damping: 40, stiffness: 180, mass: 0.4 });
  const rotateZ2 = useTransform(springX2, [-38, 38], [-15, 15]);

  const [flashColor, setFlashColor] = useState<string | null>(null);
  const FLASH_COLORS = ['rgba(251,207,232,0.4)', 'rgba(191,219,254,0.4)', 'rgba(187,247,208,0.4)'];

  // Handle Mouse Movement with Delay/Lag for 2nd Baby
  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        const dx = clientX - rect.left - rect.width / 2;
        const dy = clientY - rect.top - rect.height / 2;
        
        // Pukku (Direct)
        mouseX1.set(dx * 0.15);
        mouseY1.set(dy * 0.15);

        // Ukku (More sensitive & reactive)
        setTimeout(() => {
          mouseX2.set(dx * 0.18);
          mouseY2.set(dy * 0.18);
        }, 80);
      }
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('touchmove', handleMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
    };
  }, []);

  // Firestore Sync
  useEffect(() => {
    if (!roomId) return;
    const unsub = onSnapshot(doc(db, "pairs", roomId, "babyState", "current"), (snap) => {
      if (snap.exists()) {
        setBabyState(snap.data() as BabyState);
      }
    });
    return unsub;
  }, [roomId]);

  // Clear bubbles when entering sleep
  useEffect(() => {
    if (isSleeping) {
      setActiveBubble(null);
    }
  }, [isSleeping]);

  // Notification / Night Logic
  useEffect(() => {
    const checkTime = () => {
      const activePeriod = health.periodEntries?.find(e => !e.endDate);
      const isAnjaliOnPeriod = !!activePeriod;
      const isAnjali = user?.perspective === 'her';

      const now = new Date();
      const hour = now.getHours();
      // Indian Time 8pm - 10pm
      if (hour >= 20 || hour < 5) {
        if (!babyState?.isSleeping && !activeBubble) {
           // If Anjali is on period, babies disturb Dhruvya more, stay quiet for her
           if (isAnjaliOnPeriod && isAnjali) return; 

           const babyId = Math.random() > 0.5 ? 'ukku' : 'pukku';
           const msg = Math.random() > 0.5 ? 'Papa sleepy... 🌙' : 'Mumma ninni... 😴';
           setActiveBubble({ id: babyId, msg, x: 0, y: 0 }); // Pos handled in render
           setTimeout(() => setActiveBubble(null), 5000);
        }
      }
    };
    const timer = setInterval(checkTime, 1000 * 60 * 15);
    checkTime();
    return () => clearInterval(timer);
  }, [babyState?.isSleeping, activeBubble, health.periodEntries, user?.perspective]);

  const handleSleepClick = async () => {
    if (!roomId || !user) return;
    const isHer = user.perspective === 'her';
    const field = isHer ? 'anjaliReadyToSleep' : 'dhruvyaReadyToSleep';
    const timeField = isHer ? 'anjaliLastClick' : 'dhruvyaLastClick';
    const now = Date.now();
    
    sensory.play('pop');
    try {
      await updateDoc(doc(db, "pairs", roomId, "babyState", "current"), {
        [field]: true,
        [timeField]: now
      });
      
      // Check if both ready and clicked within last 30 seconds
      if (babyState) {
        const otherReady = isHer ? babyState.dhruvyaReadyToSleep : babyState.anjaliReadyToSleep;
        const otherLastClick = isHer ? (babyState as any).dhruvyaLastClick : (babyState as any).anjaliLastClick;
        const isPartnerFresh = otherLastClick && (now - otherLastClick < 30000); // 30s window

        if (otherReady && isPartnerFresh) {
          await updateDoc(doc(db, "pairs", roomId, "babyState", "current"), {
            isSleeping: true,
            mood: 'sleepy',
            anjaliReadyToSleep: false,
            dhruvyaReadyToSleep: false,
            anjaliLastClick: 0,
            dhruvyaLastClick: 0
          });
          sensory.important();
        }
      }
    } catch (e) {
      handleFirestoreError(e, 'write', `pairs/${roomId}/babyState/current`);
    }
  };

  const handleWakeUp = async () => {
    if (!roomId) return;
    try {
      await updateDoc(doc(db, "pairs", roomId, "babyState", "current"), {
        isSleeping: false,
        mood: 'happy',
        anjaliReadyToSleep: false,
        dhruvyaReadyToSleep: false
      });
      sensory.play('levelUp');
    } catch (e) {}
  };

  const handlePointerDown = () => {
    wasLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      setShowTags(true);
      wasLongPressRef.current = true;
      sensory.play('pop');
    }, 500);
  };

  const handlePointerUp = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    setShowTags(false);
    setTimeout(() => { wasLongPressRef.current = false; }, 50);
  };

  const handleTap = useCallback(async (babyId: 'pukku'|'ukku', e: React.MouseEvent<HTMLDivElement> | React.PointerEvent) => {
    e.stopPropagation();
    if (!roomId || isSleeping) return;
    if (wasLongPressRef.current) return;

    let originX = 0, originY = 0;
    let tapX = 0, tapY = 0;
    
    if (containerRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const containerRect = containerRef.current.getBoundingClientRect();
      tapX = e.clientX - containerRect.left;
      tapY = e.clientY - containerRect.top;
      originX = (rect.left + rect.width / 2) - containerRect.left;
      originY = (rect.top + rect.height / 2) - containerRect.top;
    }

    // Clear previous bubble clear timeout
    if ((window as any).bubbleTimeout) clearTimeout((window as any).bubbleTimeout);

    // Trigger Smart Greeting occasionally
    if (excitement === 0 && Math.random() > 0.8) {
      const msg = getSmartGreeting();
      setActiveBubble({ id: babyId, msg, x: 0, y: 0 });
      (window as any).bubbleTimeout = setTimeout(() => setActiveBubble(null), 4000);
    }

    setExcitement(prev => Math.min(10, prev + 1));
    sensory.play('pop');
    sensory.tap();
    
    // Streak Logic
    setIsStreakActive(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setIsStreakActive(false), 2000);

    const rid = Date.now() + Math.random() * 500;
    setRipples(prev => [...prev, { id: rid, x: tapX, y: tapY }]);
    setTimeout(() => setRipples(prev => prev.filter(r => r.id !== rid)), 2400);

    setFlashColor(FLASH_COLORS[Math.floor(Math.random() * FLASH_COLORS.length)]);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashColor(null), 800);

    const activePeriod = health.periodEntries?.find(e => !e.endDate);
    const isAnjaliOnPeriod = !!activePeriod;
    const isAnjali = user?.perspective === 'her';
    const moodPool: MoodState[] = ['happy', 'playful'];
    const newMood = moodPool[Math.floor(Math.random() * moodPool.length)];

    if (isAnjaliOnPeriod && isAnjali) {
      const cuddleMsgs = ["I love you Mama! 🌸", "Stay cozy! ✨", "Cuddle time? 🧸", "We are being quiet for you 🤫", "You're doing great Mommy! 💕"];
      const msg = cuddleMsgs[Math.floor(Math.random() * cuddleMsgs.length)];
      setActiveBubble({ id: babyId, msg, x: originX, y: originY - (babyId === 'pukku' ? 70 : 50) });
      sensory.play('sparkle');
    } else if (isAnjaliOnPeriod && !isAnjali) {
      const guardianMsgs = ["Shh... Mommy is resting 🤫", "Send her a treat! 🍫", "Be extra gentle today! ✨", "We're taking care of her! 🛡️"];
      const msg = guardianMsgs[Math.floor(Math.random() * guardianMsgs.length)];
      setActiveBubble({ id: babyId, msg, x: originX, y: originY - (babyId === 'pukku' ? 70 : 50) });
      sensory.play('swoosh');
    } else {
      const bday = babyId === 'ukku' ? UKKU_BIRTHDAY_MS : PUKKU_BIRTHDAY_MS;
      const msgs = getBabyMessages(babyId, newMood, bday);
      const msg = msgs[Math.floor(Math.random() * msgs.length)];
      setActiveBubble({ id: babyId, msg, x: originX, y: originY - (babyId === 'pukku' ? 70 : 50) });
      sensory.play('pop');
    }
    
    (window as any).bubbleTimeout = setTimeout(() => setActiveBubble(null), 4000);

    // LOVE POINTS ONLY (NO COINS ON TAP)
    const tapKey = 'blablu_baby_taps';
    const taps = parseInt(localStorage.getItem(tapKey) || '0') + 1;
    localStorage.setItem(tapKey, String(taps));
    
    if (taps % 15 === 0) {
      setBabyEvolution({ lovePoints: (babyEvolution.lovePoints || 0) + 1 });
      sensory.play('levelUp');
    }

    await updateDoc(doc(db, "pairs", roomId, "babyState", "current"), {
      mood: newMood,
      lastInteraction: Date.now()
    }).catch(() => {});

    const count = newMood === 'playful' ? 12 : 8;
    const particles = generateBurst(count, originX, originY);
    setBurstParticles(prev => [...prev, ...particles]);
    setTimeout(() => {
      setBurstParticles(prev => prev.filter(p => !particles.some(bp => bp.id === p.id)));
    }, 1500);

    if (moodTimerRef.current) clearTimeout(moodTimerRef.current);
    moodTimerRef.current = setTimeout(() => setActiveBubble(null), 2800);
  }, [roomId, user, isSleeping, babyEvolution, addCoins, setBabyEvolution, excitement, getSmartGreeting]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full flex flex-col items-center justify-center transition-all duration-1000 overflow-hidden")}>
      
      {/* Background Aura */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        {!isSleeping && (
          <motion.div 
            animate={{ 
              scale: [1, 1.1 + (excitement * 0.05), 1],
              opacity: [0.2, 0.4 + (excitement * 0.04), 0.2]
            }}
            transition={{ 
              duration: Math.max(0.5, 3 - (excitement * 0.2)), 
              repeat: Infinity, 
              ease: "easeInOut" 
            }}
            style={{ backgroundColor: MOOD_AURA[mood][0] }}
            className="absolute w-64 h-64 rounded-full blur-[60px] pointer-events-none transition-colors duration-1000"
          />
        )}
      </div>

      {/* ── RIPPLE RINGS ───────────────────────────────────────────── */}
      {ripples.map(ripple =>
        [0, 1, 2].map(i => (
          <motion.div
            key={`${ripple.id}-${i}`}
            className="absolute rounded-full pointer-events-none z-20"
            style={{
              left: ripple.x,
              top: ripple.y,
              translateX: '-50%',
              translateY: '-50%',
              border: `${i === 0 ? 2 : 1.5}px solid ${
                i === 0 ? 'rgba(244,114,182,0.5)' :
                i === 1 ? 'rgba(196,181,253,0.4)' :
                          'rgba(147,197,253,0.3)'
              }`,
            }}
            initial={{ width: 10, height: 10, opacity: 0.9 }}
            animate={{ width: 120 + i * 40, height: 120 + i * 40, opacity: 0 }}
            transition={{ duration: 1.2 + i * 0.25, delay: i * 0.12, ease: 'easeOut' }}
          />
        ))
      )}

      {/* ── BURST PARTICLES ────────────────────────────────────────── */}
      <AnimatePresence>
        {burstParticles.map(p => {
          const endX = Math.cos(p.angle) * p.distance;
          const endY = Math.sin(p.angle) * p.distance + p.yBias;
          return (
            <motion.div
              key={p.id}
              className="absolute pointer-events-none"
              style={{ zIndex: 35, left: p.startX, top: p.startY }}
              initial={{ x: 0, y: 0, scale: 0, opacity: 1, rotate: 0 }}
              animate={{
                x: endX,
                y: endY,
                scale: [0, 1.5, 1.1, 0],
                opacity: [1, 1, 0.75, 0],
                rotate: p.spin,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: [0.22, 0.61, 0.28, 1.0],
              }}
            >
              {p.type === 'heart' && (
                <svg width={p.size} height={p.size} viewBox="0 0 24 24">
                  <path
                    d="M12 21.593c-5.63-5.539-11-10.297-11-14.402 0-3.791 3.068-5.191 5.281-5.191 1.312 0 4.151.501 5.719 4.457 1.59-3.968 4.464-4.447 5.726-4.447 2.54 0 5.274 1.621 5.274 5.181 0 4.069-5.136 8.625-11 14.402z"
                    fill={p.color}
                  />
                </svg>
              )}
              {p.type === 'sparkle' && (
                <svg width={p.size} height={p.size} viewBox="0 0 24 24">
                  <path
                    d="M12 0L14.9 9.1L24 12L14.9 14.9L12 24L9.1 14.9L0 12L9.1 9.1Z"
                    fill={p.color}
                  />
                </svg>
              )}
              {p.type === 'bubble' && (
                <div
                  style={{
                    width: p.size,
                    height: p.size,
                    borderRadius: '50%',
                    background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.88), ${p.color})`,
                    boxShadow: `0 2px 14px ${p.color}55, inset 0 1px 0 rgba(255,255,255,0.6)`,
                  }}
                />
              )}
              {p.type === 'emoji' && (
                <svg width={p.size} height={p.size} viewBox="0 0 24 24">
                  <path
                    d="M12 2L13.5 8.5L20 10L13.5 11.5L12 18L10.5 11.5L4 10L10.5 8.5Z"
                    fill={p.color} opacity="0.9"
                  />
                  <circle cx="12" cy="10" r="2" fill="white" opacity="0.6" />
                </svg>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      <AnimatePresence>
        {isSleeping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-indigo-900/20 backdrop-blur-[2px] pointer-events-none z-10 flex items-center justify-center">
             <div className="flex gap-4">
                <motion.span animate={{ y: [-10, 10, -10], opacity: [0.5, 1, 0.5] }} transition={{ duration: 3, repeat: Infinity }} className="text-4xl">💤</motion.span>
                <motion.span animate={{ y: [10, -10, 10], opacity: [1, 0.5, 1] }} transition={{ duration: 3.5, repeat: Infinity }} className="text-4xl">💤</motion.span>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(activeBubble && !isSleeping) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.45, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.45, y: -10 }}
            transition={{ type: 'spring', stiffness: 520, damping: 24 }}
            className="absolute z-40 pointer-events-none"
            style={{ left: activeBubble.id === 'pukku' ? '40%' : '60%', top: '35%', transform: 'translate(-50%, -100%)' }}
          >
            <div className="px-[18px] py-[9px] rounded-full relative bg-card backdrop-blur-xl border border-border shadow-xl shadow-primary/10">
              <span className="text-[0.75rem] font-black tracking-wide whitespace-nowrap text-primary uppercase">
                {activeBubble.msg}
              </span>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-[42%] w-[10px] h-[10px] rotate-45 bg-card border-r border-b border-border" />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative w-full flex-1 flex items-center justify-center pointer-events-none z-20">
        <div className="flex items-end justify-center gap-2 w-full translate-y-6">
          {/* Pukku */}
          <motion.div
            drag={!isSleeping} 
            whileDrag={{ scale: 1.1 }} 
            whileTap={{ scale: 1.25, rotate: [0, -12, 12, -6, 6, 0] }} 
            style={{ cursor: isSleeping ? 'default' : 'grab', pointerEvents: 'auto', x: springX1, y: springY1, rotate: rotateZ1 }}
            onClick={(e) => handleTap('pukku', e)} 
            onPointerDown={handlePointerDown} 
            onPointerUp={handlePointerUp}
            animate={isSleeping ? { y: [0, 4, 0], scale: 0.95 } : getMoodAnimation(mood)} 
            transition={isSleeping ? { duration: 4, repeat: Infinity } : getMoodTransition(mood)}
            className="relative w-[150px] h-[150px] flex items-center justify-center"
          >
            <Pukku />
            <AnimatePresence>
              {showTags && (
                <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="absolute -top-7 left-1/2 -translate-x-1/2 bg-text/80 text-bg text-[9px] font-black px-3 py-1 rounded-full whitespace-nowrap tracking-wider"
                >
                  Pukku · {getAgeShort(PUKKU_BIRTHDAY_MS)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Ukku */}
          <motion.div
            drag={!isSleeping} 
            whileDrag={{ scale: 1.1 }} 
            whileTap={{ scale: 1.35, rotate: [0, 15, -15, 8, -8, 0] }} 
            style={{ cursor: isSleeping ? 'default' : 'grab', pointerEvents: 'auto', x: springX2, y: springY2, rotate: rotateZ2 }}
            onClick={(e) => handleTap('ukku', e)} 
            onPointerDown={handlePointerDown} 
            onPointerUp={handlePointerUp}
            animate={isSleeping ? { y: [0, 3, 0], scale: 0.65 } : { ...getMoodAnimation(mood), scale: 0.75 }} 
            transition={isSleeping ? { duration: 4.5, repeat: Infinity } : getMoodTransition(mood)}
            className="relative w-[100px] h-[100px] flex items-center justify-center -ml-6 origin-bottom"
          >
            <Ukku />
            <AnimatePresence>
              {showTags && (
                <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                  className="absolute -top-5 left-1/2 -translate-x-1/2 bg-primary/90 text-white text-[9px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap tracking-wider"
                >
                  Ukku · {getAgeShort(UKKU_BIRTHDAY_MS)}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* Cooperative Sleep UI */}
      {showControls && (
        <div className="absolute bottom-4 z-30 flex flex-col items-center gap-3">
          {!isSleeping ? (
             <div className="flex flex-col items-center gap-2">
                 <div className="flex gap-2">
                    {(() => {
                      const now = Date.now();
                      const anjaliFresh = babyState?.anjaliReadyToSleep && (now - ((babyState as any).anjaliLastClick || 0) < 30000);
                      const dhruvyaFresh = babyState?.dhruvyaReadyToSleep && (now - ((babyState as any).dhruvyaLastClick || 0) < 30000);
                      return (
                        <>
                          <div className={cn("w-2 h-2 rounded-full transition-all duration-500", anjaliFresh ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-text/10")} />
                          <div className={cn("w-2 h-2 rounded-full transition-all duration-500", dhruvyaFresh ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : "bg-text/10")} />
                        </>
                      );
                    })()}
                 </div>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleSleepClick}
                  className={cn(
                    "px-6 py-2.5 rounded-full flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all",
                    (user?.perspective === 'her' ? babyState?.anjaliReadyToSleep : babyState?.dhruvyaReadyToSleep)
                      ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
                      : "bg-card backdrop-blur-md text-text/60 border border-border"
                  )}
                >
                  <Moon size={14} />
                  { (user?.perspective === 'her' ? babyState?.anjaliReadyToSleep : babyState?.dhruvyaReadyToSleep) ? "Waiting for Partner..." : "Put to Sleep" }
                </motion.button>
             </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={handleWakeUp}
              className="px-6 py-2.5 rounded-full bg-amber-400 text-amber-900 text-[10px] font-black uppercase tracking-widest shadow-xl shadow-amber-500/20 flex items-center gap-2"
            >
              <Star size={14} /> Wake Up
            </motion.button>
          )}
        </div>
      )}

    </div>
  );
}
