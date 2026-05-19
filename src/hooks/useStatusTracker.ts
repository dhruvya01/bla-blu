import { useEffect } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import { useAppStore } from '../store';
import StatusTracker from '../utils/statusTracker';
import { Capacitor } from '@capacitor/core';

export function useStatusTracker(roomId: string | null, userId: string | null) {
  useEffect(() => {
    if (!roomId || !userId || !Capacitor.isNativePlatform()) return;

    let active = true;
    let musicListener: any = null;
    let credentialInterval: any = null;

    const saveCredentialsToNative = async () => {
      try {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken(false); // Cached fast token
          const role = useAppStore.getState().user?.role === 'boyfriend' ? 'his' : 'her';
          await StatusTracker.saveCredentials({
            idToken,
            roomId,
            userId: currentUser.uid,
            role
          });
        }
      } catch (err) {
        console.warn('[StatusTracker] Failed to save credentials natively:', err);
      }
    };

    const setupListeners = async () => {
      try {
        // Save initial credentials natively right on launch!
        await saveCredentialsToNative();

        // Periodically refresh the token every 10 minutes (Firebase tokens are valid for 60 mins)
        credentialInterval = setInterval(saveCredentialsToNative, 1000 * 60 * 10);

        // Listen to Music Changes only
        musicListener = await StatusTracker.addListener('musicChanged', (data) => {
          if (!active) return;
          const state = useAppStore.getState();
          const role = state.user?.role === 'boyfriend' ? 'his' : 'her';

          updateDoc(doc(db, "pairs", roomId, "mapStatus", "live"), {
            [`${role}.musicTitle`]: data.title || '',
            [`${role}.musicArtist`]: data.artist || '',
            [`${role}.musicAlbumArt`]: data.albumArt || '',
            [`${role}.isListening`]: data.isListening || false,
            [`${role}.lastMusicUpdate`]: Date.now()
          }).catch(console.error);
        });
      } catch (err) {
        console.warn('[StatusTracker] Listener setup failed:', err);
      }
    };

    setupListeners();

    return () => {
      active = false;
      if (musicListener) musicListener.remove();
      if (credentialInterval) clearInterval(credentialInterval);
    };
  }, [roomId, userId]);
}
