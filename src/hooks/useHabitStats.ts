import { useMemo } from "react";
import { useAppStore } from "../store";
import { useShallow } from "zustand/react/shallow";

export function useHabitStats(_pairId: string | null) {
  const { habits, logs } = useAppStore(useShallow(state => ({
    habits: state.habits,
    logs: state.habitLogs
  })));

  const stats = useMemo(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Today's Progress
    const todayLogsCount = logs.filter(l => l.date === todayStr).length;
    const totalHabits = habits.length;
    const progressPct = totalHabits === 0 ? 0 : Math.round((todayLogsCount / totalHabits) * 100);

    // Weekly comparison
    const getWeekCompletions = (weeksAgo: number) => {
      const start = new Date();
      start.setDate(start.getDate() - (7 * (weeksAgo + 1)));
      const end = new Date();
      end.setDate(end.getDate() - (7 * weeksAgo));
      
      return (logs || []).filter(l => {
        if (!l?.date) return false;
        const d = new Date(l.date);
        return d >= start && d <= end;
      }).length;
    };

    const thisWeek = getWeekCompletions(0);
    const lastWeek = getWeekCompletions(1);
    const growth = lastWeek === 0 ? (thisWeek > 0 ? 100 : 0) : Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

    // Streak calculation (max across all habits)
    const calculateMaxStreak = () => {
      if (habits.length === 0 || logs.length === 0) return 0;
      let maxStreak = 0;
      
      habits.forEach(habit => {
        let streak = 0;
        const d = new Date();
        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(d);
          checkDate.setDate(d.getDate() - i);
          const dateStr = checkDate.toISOString().split('T')[0];
          const hasLog = (logs || []).some(l => l.habitId === habit.id && l.date === dateStr);
          if (hasLog) {
            streak++;
          } else {
            // Only break if it's not today's missing log (streak continues from yesterday)
            if (i > 0) break;
          }
        }
        if (streak > maxStreak) maxStreak = streak;
      });
      return maxStreak;
    };

    const maxStreak = calculateMaxStreak();

    return {
      progressPct,
      growth,
      totalHabits,
      todayLogsCount,
      maxStreak,
      logs,
      habits
    };
  }, [habits, logs]);

  return stats;
}
