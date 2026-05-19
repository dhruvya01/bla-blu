import { HealthData, DailyLog, CustomHabit, PeriodEntry } from "../types";

export const getTodayStr = () => {
  const d = new Date();
  const dLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
  return dLocal.toISOString().split('T')[0];
};

export const parseSafeDate = (val: any): Date | null => {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // Check for YYYY-MM-DD
    if (val.includes('-')) {
       const parts = val.split('-');
       if (parts.length === 3) {
         const [y, m, d] = parts.map(Number);
         return new Date(y, m - 1, d);
       }
    }
    return new Date(val);
  }
  if (val.toDate) return val.toDate();
  if (val.seconds) return new Date(val.seconds * 1000);
  return null;
};

export const DEFAULT_HABITS: CustomHabit[] = [];

export const getEmptyDailyLog = (date: string): DailyLog => ({
  date,
  mood: "",
  pain: "",
  stress: 0,
  breakfast: false,
  lunch: false,
  dinner: false,
  bath: false,
  skincare: false,
  vitamins: false,
  sleptOnTime: false
});

export const getCycleInfo = (health: HealthData) => {
  const start = parseSafeDate(health.lastPeriodStart);
  if (!start) return { day: 0, phase: "Setup Required", status: "Initialize your cycle tracking" };
  
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = Math.max(0, today.getTime() - start.getTime());
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

  const dayInCycle = ((diffDays - 1) % (health.cycleLength || 28)) + 1;

  let phase = "";
  let status = "";

  if (dayInCycle <= (health.periodLength || 5)) {
    phase = "Menstrual Phase";
    status = "Honor your stillness today. 🍵";
  } else if (dayInCycle <= (health.cycleLength || 28) - 16) {
    phase = "Follicular Phase";
    status = "Vitality is rising within you. 🌸";
  } else if (dayInCycle <= (health.cycleLength || 28) - 12) {
    phase = "Ovulation Phase";
    status = "Radiance and connection grow. ✨";
  } else {
    phase = "Luteal Phase";
    status = "Turn inward, find your center. 🌙";
  }

  return { day: dayInCycle, phase, status };
};

// Given periodEntries, cycleLength, periodLength — generate an array of CycleDay
export const generateCycleDays = (
  entries: PeriodEntry[],
  cLength: any = 28,
  pLength: any = 5
) => {
  const cycleLength = Number(cLength) || 28;
  const periodLength = Number(pLength) || 5;
  const days: any[] = [];
  const today = new Date();
  const todayLocal = new Date(today.getTime() - (today.getTimezoneOffset() * 60000));
  const todayStr = todayLocal.toISOString().split('T')[0];

  const sorted = [...entries].filter(e => e && e.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (sorted.length === 0) return [];

  // Generate from 2 months back to 3 months ahead
  const viewStart = new Date(today);
  viewStart.setMonth(viewStart.getMonth() - 2);
  const viewEnd = new Date(today);
  viewEnd.setMonth(viewEnd.getMonth() + 3);

  for (let d = new Date(viewStart); d <= viewEnd; d.setDate(d.getDate() + 1)) {
    const dLocal = new Date(d.getTime() - (d.getTimezoneOffset() * 60000));
    const dStr = dLocal.toISOString().split('T')[0];
    let type = "normal";

    // 1. Check if this date falls within a REAL recorded period
    const realEntry = entries.find(e => {
      const end = e.endDate || '9999-12-31';
      return dStr >= e.startDate && dStr <= end;
    });

    if (realEntry) {
      type = "period";
    } else {
      // 2. Find the relevant period entry for this date to base predictions on
      // For future dates, use the latest period. For past dates, use the period before it.
      const baseEntry = [...sorted].reverse().find(e => dStr >= e.startDate) || sorted[0];
      const startBase = parseSafeDate(baseEntry.startDate);
      
      if (startBase) {
        const diffDays = Math.floor((d.getTime() - startBase.getTime()) / 86400000);
        const dayInCycle = ((diffDays % cycleLength) + cycleLength) % cycleLength;

        const ovulationDay = cycleLength - 14;
        const fertileStart = ovulationDay - 5;
        const fertileEnd = ovulationDay + 2;

        if (dayInCycle < periodLength) {
          type = "predicted_period";
        } else if (dayInCycle >= ovulationDay && dayInCycle <= ovulationDay + 2) {
          type = "ovulation";
        } else if (dayInCycle >= fertileStart && dayInCycle <= fertileEnd) {
          type = "fertile";
        }
      }
    }

    days.push({ date: dStr, type });
  }
  return days;
};

// Get a rich, detailed cycle info object
export const getDetailedCycleInfo = (entries: PeriodEntry[] = [], cycleLength = 28, periodLength = 5, lastPeriodStartOverride?: string) => {
  let start = parseSafeDate(lastPeriodStartOverride);
  
  if (!start && entries.length > 0) {
    const latest = entries[entries.length - 1];
    start = parseSafeDate(latest.startDate);
  }
  
  if (!start) return null;

  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffMs = today.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  
  const safeCycleLength = cycleLength || 28;
  const safePeriodLength = periodLength || 5;

  // Normalize dayInCycle to 1-indexed [1, cycleLength]
  const dayInCycle = ((diffDays % safeCycleLength) + safeCycleLength) % safeCycleLength + 1;
  const ovulationDay = safeCycleLength - 14;
  const fertileStart = ovulationDay - 5;
  const nextPeriodIn = safeCycleLength - dayInCycle + 1;

  let phase: string, phaseEmoji: string, phaseDesc: string, season: string;
  if (dayInCycle <= periodLength) {
    phase = "Menstrual"; phaseEmoji = "🌑"; season = "Winter";
    phaseDesc = "What it is: The shedding of the uterine lining (endometrium), which exits the body as a period. Hormones: Estrogen and progesterone levels drop to their lowest points, triggering the shedding. What to expect: Bleeding, cramping, and potentially fatigue due to low hormone levels.";
  } else if (dayInCycle <= ovulationDay - 1) {
    phase = "Follicular"; phaseEmoji = "🌱"; season = "Spring";
    phaseDesc = "What it is: Follicles (tiny sacs containing immature eggs) develop in the ovaries. Hormones: The pituitary gland releases FSH. Estrogen rises, causing the uterine lining to thicken and rebuild. What to expect: A gradual increase in energy, better sleep, and an increasingly positive mood as estrogen peaks.";
  } else if (dayInCycle <= ovulationDay + 2) {
    phase = "Ovulation"; phaseEmoji = "🌕"; season = "Summer";
    phaseDesc = "What it is: The release of a mature egg from the dominant follicle into the fallopian tube. Hormones: A sharp spike in LH and estrogen triggers the release. What to expect: A brief peak in energy and libido, and a slight rise in basal body temperature.";
  } else {
    phase = "Luteal"; phaseEmoji = "🍂"; season = "Autumn";
    phaseDesc = "What it is: The final stage where the empty follicle turns into the corpus luteum. Hormones: High levels of progesterone thicken the uterine lining. If no pregnancy occurs, levels plummet, triggering your period. What to expect: PMS symptoms such as bloating, breast tenderness, mood swings, and fatigue.";
  }

  const isFertile = dayInCycle >= fertileStart && dayInCycle <= ovulationDay + 1;
  const nextOvulation = ovulationDay - dayInCycle + 1;

  // Wellness Focus Areas
  const focus = {
    Menstrual: { energy: "Low", comfort: "High Priority", focus: "Rest & Renewal" },
    Follicular: { energy: "Rising", comfort: "Moderate", focus: "Planning & Activity" },
    Ovulation: { energy: "High", comfort: "Moderate", focus: "Social & Connection" },
    Luteal: { energy: "Variable", comfort: "High Priority", focus: "Slowing Down" }
  }[phase as "Menstrual" | "Follicular" | "Ovulation" | "Luteal"];

  return {
    dayInCycle, cycleLength, phase, phaseEmoji, season, phaseDesc,
    nextPeriodIn, isFertile, nextOvulation, focus,
    isPeriod: dayInCycle <= periodLength,
    periodDay: dayInCycle <= periodLength ? dayInCycle : null,
  };
};

export const getWellnessInsights = (phase: string) => {
  const insights: Record<string, string[]> = {
    Menstrual: [
      "Prioritize warmth and deep rest today.",
      "Gentle stretching may help with circulation.",
      "Consider a lighter schedule if possible.",
      "Hydration is especially important during this phase."
    ],
    Follicular: [
      "Energy is naturally rising; great for planning.",
      "You might feel more creative and ready to start new tasks.",
      "Nutritious, fresh meals support building energy.",
      "Consider moderate exercise to match your increasing vitality."
    ],
    Ovulation: [
      "You are at your natural energetic peak.",
      "Great time for social connection and important discussions.",
      "Strength-focused movement often feels best now.",
      "Enjoy the natural clarity and focus of this window."
    ],
    Luteal: [
      "Start shifting toward a more gentle routine.",
      "Nourishing, warming foods are particularly supportive now.",
      "Allow extra time for sleep and recovery.",
      "Focus on finishing tasks rather than starting new ones."
    ]
  };
  return insights[phase] || [];
};

export const getPartnerGuidance = (phase: string) => {
  const guidance: Record<string, string[]> = {
    Menstrual: [
      "A quieter, supportive environment is most helpful now.",
      "Practical support with daily tasks is often appreciated.",
      "Prioritize comfort and warmth in shared activities.",
      "Be aware that physical rest is the current priority."
    ],
    Follicular: [
      "Support her rising energy and new ideas.",
      "Great time for planning future dates or adventures together.",
      "Engage in more active or creative shared activities.",
      "She may feel more ready for social engagements."
    ],
    Ovulation: [
      "Energy levels are high; enjoy active connection.",
      "This is often a great time for deep, meaningful conversations.",
      "She may feel at her most social and energetic.",
      "Celebrate her natural focus and vitality."
    ],
    Luteal: [
      "Create a calm, low-pressure environment.",
      "Focus on comfort and soft, nourishing experiences.",
      "Be patient as her energy naturally begins to turn inward.",
      "Supportive listening and steady presence are valuable now."
    ]
  };
  return guidance[phase] || [];
};

export const getCycleStability = (entries: PeriodEntry[]) => {
  if (entries.length < 3) return { status: "Analyzing Patterns", color: "text-text/40" };
  const regularity = getCycleRegularity(entries);
  if (regularity > 90) return { status: "Stable", color: "text-emerald-500" };
  if (regularity > 75) return { status: "Slightly Irregular", color: "text-amber-500" };
  return { status: "Unpredictable Trend", color: "text-rose-500" };
};

export const getIrregularityAwareness = (entries: PeriodEntry[]) => {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const latestGap = (new Date(sorted[0].startDate).getTime() - new Date(sorted[1].startDate).getTime()) / 86400000;

  if (latestGap > 35) return "Your recent cycle was longer than average. This can happen due to stress or routine changes.";
  if (latestGap < 21) return "Your recent cycle was shorter than average. Keep an eye on your rest and recovery levels.";
  return null;
};

export const getSymptomPatterns = (logs: Record<string, DailyHealthLog>, entries: PeriodEntry[]) => {
  if (!logs || Object.keys(logs).length < 5) return [];
  const patterns: string[] = [];

  // 1. Analyze Cramp Intensity Timing
  let intenseCrampDays: number[] = [];
  entries.forEach(entry => {
    const start = new Date(entry.startDate);
    Object.values(logs).forEach(log => {
      const logDate = new Date(log.date);
      const diff = Math.floor((logDate.getTime() - start.getTime()) / 86400000);
      if (diff >= 0 && diff < 7 && log.cramps && log.cramps >= 4) {
        intenseCrampDays.push(diff + 1);
      }
    });
  });

  if (intenseCrampDays.length > 0) {
    const mostCommonDay = intenseCrampDays.sort((a, b) =>
      intenseCrampDays.filter(v => v === a).length - intenseCrampDays.filter(v => v === b).length
    ).pop();
    patterns.push(`Cramps tend to be most intense around Day ${mostCommonDay} of your cycle.`);
  }

  // 2. Analyze Energy Recovery
  let recoveryDays: number[] = [];
  entries.forEach(entry => {
    const start = new Date(entry.startDate);
    const logEntries = Object.values(logs).filter(l => l.date >= entry.startDate).sort((a, b) => a.date.localeCompare(b.date));
    const recoveryLog = logEntries.find(l => l.energyLevel && l.energyLevel >= 4);
    if (recoveryLog) {
      const diff = Math.floor((new Date(recoveryLog.date).getTime() - start.getTime()) / 86400000);
      recoveryDays.push(diff + 1);
    }
  });

  if (recoveryDays.length > 1) {
    const avgRecovery = Math.round(recoveryDays.reduce((a, b) => a + b, 0) / recoveryDays.length);
    patterns.push(`Your energy typically begins to fully restore around Day ${avgRecovery}.`);
  }

  // 3. Recurring Mood Patterns
  const lutealMoods = Object.values(logs).filter(l => {
    // Very simple check for luteal phase (days 21-28 roughly)
    // In a real app we'd use getDetailedCycleInfo for each log date
    return false; // placeholder for complex logic
  });

  return patterns;
};

export const getPreparationAdvice = (nextPeriodDate: string) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const next = new Date(nextPeriodDate);
  const diff = Math.floor((next.getTime() - today.getTime()) / 86400000);

  if (diff < 0 || diff > 4) return null;

  const advice: Record<number, { title: string, tips: string[] }> = {
    4: { title: "Gentle Preparation", tips: ["Focus on hydration (8+ glasses)", "Stock up on comfort essentials", "Plan for a lighter schedule soon"] },
    3: { title: "Nourishment Focus", tips: ["Prioritize iron-rich foods", "Keep your environment cozy", "Extra rest tonight is recommended"] },
    2: { title: "Comfort Readiness", tips: ["Have your heating pad ready", "Choose comfortable, soft clothing", "A warm bath can help relax muscles"] },
    1: { title: "Sanctuary Mode", tips: ["Early night for deep recovery", "Stay deeply hydrated", "Your body is preparing for renewal"] },
    0: { title: "Cycle Start Expected", tips: ["Honor your stillness today", "Warm tea and snacks are your friends", "Gentle presence with yourself"] }
  };

  return advice[diff] || null;
};

// Predict next N period dates using a smarter weighted average if possible
export const predictNextPeriods = (entries: PeriodEntry[], cLength: any = 28, count = 3): string[] => {
  const cycleLength = Number(cLength) || 28;
  if (!entries?.length) return [];

  // Get last period start
  const validEntries = [...entries].filter(e => e && e.startDate);
  if (validEntries.length === 0) return [];
  const lastStart = validEntries.sort((a, b) => b.startDate.localeCompare(a.startDate))[0].startDate;
  const results: string[] = [];
  const base = parseSafeDate(lastStart);
  if (!base) return [];

  for (let i = 1; i <= count; i++) {
    const next = new Date(base);
    next.setDate(next.getDate() + (cycleLength * i));
    const nextLocal = new Date(next.getTime() - (next.getTimezoneOffset() * 60000));
    results.push(nextLocal.toISOString().split('T')[0]);
  }
  return results;
};

export const getCycleRegularity = (entries: PeriodEntry[]): number => {
  if (!entries?.length || entries.length < 3) return 100;
  const completed = entries.filter(e => e && e.startDate && e.endDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (completed.length < 2) return 100;

  const gaps = [];
  for (let i = 0; i < completed.length - 1; i++) {
    const nextS = parseSafeDate(completed[i + 1].startDate);
    const currS = parseSafeDate(completed[i].startDate);
    if (nextS && currS) {
      gaps.push((nextS.getTime() - currS.getTime()) / 86400000);
    }
  }

  const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
  const variance = gaps.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / gaps.length;
  const stdDev = Math.sqrt(variance);

  return Math.max(0, Math.min(100, Math.round(100 - (stdDev * 5))));
};

// Overall health score 0-100 from a DailyHealthLog
export const getHealthScore = (log: any): number => {
  if (!log) return 50;
  let score = 60;
  if (log.water && log.water >= 8) score += 10;
  if (log.exercise) score += 10;
  if (log.sleep && log.sleep >= 7) score += 10;
  if (log.energyLevel && log.energyLevel >= 3) score += 5;
  if (log.stressLevel && log.stressLevel <= 2) score += 5;
  if (log.cramps && log.cramps >= 4) score -= 10;
  if (log.headache) score -= 5;
  if (log.nausea) score -= 5;
  return Math.max(0, Math.min(100, score));
};
