import { BabyEvolution } from '../types';

export interface Milestone {
  id: string;
  babyId: 'ukku' | 'pukku';
  title: string;
  description: string;
  unlockCondition: (ageInMonths: number) => boolean;
  icon: string;
}

export const MILESTONES: Milestone[] = [
  {
    id: 'ukku_1m',
    babyId: 'ukku',
    title: 'First Month!',
    description: 'Ukku is exactly one month old! She is starting to focus her tiny eyes.',
    unlockCondition: (months) => months >= 1,
    icon: '🎀'
  },
  {
    id: 'ukku_first_word',
    babyId: 'ukku',
    title: 'First Word: Mama!',
    description: 'Ukku said her very first word today. It was "Mama"! 🥺',
    unlockCondition: (months) => months >= 6,
    icon: '🗣️'
  },
  {
    id: 'ukku_first_steps',
    babyId: 'ukku',
    title: 'First Steps!',
    description: 'Look at her go! Ukku took her first wobbly steps today.',
    unlockCondition: (months) => months >= 10,
    icon: '👣'
  },
  {
    id: 'pukku_1y',
    babyId: 'pukku',
    title: 'Big Boy Pukku!',
    description: 'Pukku turned 1 year old! He is growing so fast.',
    unlockCondition: (months) => months >= 12,
    icon: '🎂'
  },
  {
    id: 'pukku_running',
    babyId: 'pukku',
    title: 'Zoom Zoom!',
    description: 'Pukku is officially a runner! Good luck catching him now.',
    unlockCondition: (months) => months >= 18,
    icon: '🏃‍♂️'
  },
  {
    id: 'pukku_2y',
    babyId: 'pukku',
    title: 'Terrible Twos?',
    description: 'Pukku is 2! Let the adventures (and the chaos) begin.',
    unlockCondition: (months) => months >= 24,
    icon: '🦖'
  }
];

export function calcAgeInMonths(birthdayMs: number): number {
  const birth = new Date(birthdayMs);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12;
  months -= birth.getMonth();
  months += now.getMonth();
  return months <= 0 ? 0 : months;
}

export function checkNewMilestones(evolution: BabyEvolution): string[] {
  const ukkuMonths = calcAgeInMonths(evolution.ukkuBirthdayMs);
  const pukkuMonths = calcAgeInMonths(evolution.pukkuBirthdayMs);
  
  const newMilestones: string[] = [];
  const currentUnlocked = new Set(evolution.milestones || []);

  MILESTONES.forEach(m => {
    if (currentUnlocked.has(m.id)) return;
    
    const months = m.babyId === 'ukku' ? ukkuMonths : pukkuMonths;
    if (m.unlockCondition(months)) {
      newMilestones.push(m.id);
    }
  });

  return newMilestones;
}

// Tick function to apply passive stat drain.
// This is called periodically (e.g., every few minutes).
// Younger babies (Ukku, 1m) need more sleep/food, so their stats drain faster.
export function applyPassiveDrain(evolution: BabyEvolution, isSleeping: boolean): Partial<BabyEvolution> {
  const ukkuMonths = calcAgeInMonths(evolution.ukkuBirthdayMs);
  const pukkuMonths = calcAgeInMonths(evolution.pukkuBirthdayMs);

  // Drain rates per tick (assume 1 tick = 5 mins of real time, adjusted for gameplay feel)
  // Ukku (1m): Drains hunger and sleepiness fast.
  // Pukku (1.7y): Drains slower, but hygiene drains faster (toddlers are messy).
  
  const ukkuHungerDrain = ukkuMonths < 6 ? 2 : 1;
  const pukkuHungerDrain = pukkuMonths < 24 ? 1.5 : 1;
  
  const ukkuSleepDrain = ukkuMonths < 3 ? 3 : 1; // Needs lots of sleep
  const pukkuSleepDrain = pukkuMonths < 24 ? 1 : 0.5;
  
  const ukkuHygieneDrain = 0.5; // Babies stay relatively clean if just lying there
  const pukkuHygieneDrain = pukkuMonths >= 12 ? 2 : 1; // Toddlers get dirty running around

  let newUkkuHunger = evolution.ukkuHunger;
  let newPukkuHunger = evolution.pukkuHunger;
  let newUkkuSleepiness = evolution.ukkuSleepiness;
  let newPukkuSleepiness = evolution.pukkuSleepiness;
  let newUkkuHygiene = evolution.ukkuHygiene;
  let newPukkuHygiene = evolution.pukkuHygiene;

  if (isSleeping) {
    // Sleeping restores sleepiness, stops hunger/hygiene drain
    newUkkuSleepiness = Math.max(0, evolution.ukkuSleepiness - 5);
    newPukkuSleepiness = Math.max(0, evolution.pukkuSleepiness - 5);
  } else {
    newUkkuHunger = Math.max(0, evolution.ukkuHunger - ukkuHungerDrain);
    newPukkuHunger = Math.max(0, evolution.pukkuHunger - pukkuHungerDrain);
    
    newUkkuSleepiness = Math.min(100, evolution.ukkuSleepiness + ukkuSleepDrain);
    newPukkuSleepiness = Math.min(100, evolution.pukkuSleepiness + pukkuSleepDrain);
    
    newUkkuHygiene = Math.max(0, evolution.ukkuHygiene - ukkuHygieneDrain);
    newPukkuHygiene = Math.max(0, evolution.pukkuHygiene - pukkuHygieneDrain);
  }

  return {
    ukkuHunger: newUkkuHunger,
    pukkuHunger: newPukkuHunger,
    ukkuSleepiness: newUkkuSleepiness,
    pukkuSleepiness: newPukkuSleepiness,
    ukkuHygiene: newUkkuHygiene,
    pukkuHygiene: newPukkuHygiene
  };
}
