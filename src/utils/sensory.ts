import { useAppStore } from "../store";

type SoundType = 'pop' | 'ding' | 'tick' | 'swoosh' | 'urgent' | 'notification' | 'sparkle' | 'levelUp';

const SOUNDS: Record<SoundType, string> = {
  pop: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
  ding: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
  tick: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3",
  swoosh: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  urgent: "https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3",
  notification: "https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3",
  sparkle: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
  levelUp: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
};

const CUSTOM_SOUNDS: Record<string, string> = {
  pop: "https://assets.mixkit.co/active_storage/sfx/2354/2354-preview.mp3",
  chime: "https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3",
  meow: "https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3", // Note: Need a meow sound, using tick for now
  sparkle: "https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3",
  snap: "https://assets.mixkit.co/active_storage/sfx/2359/2359-preview.mp3"
};

class SensoryManager {
  private audioCache: Map<SoundType, HTMLAudioElement> = new Map();

  constructor() {
    // Pre-load sounds
    if (typeof window !== 'undefined') {
      Object.entries(SOUNDS).forEach(([key, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.audioCache.set(key as SoundType, audio);
      });
    }
  }

  play(type: SoundType | 'custom_notification') {
    const { soundEnabled, customNotificationSound } = useAppStore.getState();
    if (!soundEnabled) return;

    if (type === 'notification' || type === 'custom_notification') {
      if (customNotificationSound && CUSTOM_SOUNDS[customNotificationSound]) {
        const audio = new Audio(CUSTOM_SOUNDS[customNotificationSound]);
        audio.volume = 0.5;
        audio.play().catch(e => console.warn('Custom audio playback failed:', e));
        return;
      }
    }

    const audio = this.audioCache.get(type as SoundType);
    if (audio) {
      audio.currentTime = 0;
      audio.volume = 0.5; // Premium minimal volume
      audio.play().catch(e => console.warn('Audio playback failed:', e));
    }
  }

  vibrate(pattern: number | number[]) {
    const { hapticsEnabled } = useAppStore.getState();
    if (!hapticsEnabled || !navigator.vibrate) return;
    
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      console.warn('Haptics failed:', e);
    }
  }

  // Specific haptic styles
  tap() {
    this.vibrate(10);
  }

  important() {
    this.vibrate([20, 50, 20]); // Double pulse
  }

  alert() {
    this.vibrate([100, 50, 100, 50, 100]); // Long urgent
  }

  success() {
    this.play('ding');
    this.vibrate([10, 30, 10]);
  }
}

export const sensory = new SensoryManager();
