import { useAppStore } from '../store';
import { useShallow } from 'zustand/react/shallow';

export const useCareIntelligence = () => {
  const { health, alerts } = useAppStore(
    useShallow((state) => ({
      health: state.health,
      alerts: state.alerts,
    }))
  );

  // Simple intelligence logic
  const getDailyStatus = () => {
    if (alerts.length > 0) return "Feeling a bit overwhelmed? I'm here for you! ❤️";
    return "Everything looks stable and sweet today! ✨";
  };

  return {
    status: getDailyStatus(),
    isHighStress: false, // Placeholder
  };
};
