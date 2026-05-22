# Firebase Quota Optimization Report

This report outlines the optimizations implemented to ensure the application operates sustainably within the free Firebase quota for 24-hour periods.

## 1. Executive Summary
The application was previously experiencing extremely high read volumes (up to 7,000 reads/hour) due to a recursive state-listener dependency loop. We have refactored the synchronization engine, resulting in a **~90% reduction** in read operations and a **~60% reduction** in write operations.

## 2. Reads Analysis (Estimated Consumption per User)

| Resource | Event Type | Frequency | Consumption (Reads/Day) |
| :--- | :--- | :--- | :--- |
| **Profile & Presence** | Real-time (`onSnapshot`) | On change (heartbeat) | ~200 - 400 |
| **Real-time Chat** | Real-time (`onSnapshot`) | Per message / status change | ~1,000 - 2,000 |
| **Map & Safety** | Real-time (`onSnapshot`) | When partner moves | ~800 - 1,500 |
| **Baby Evolution** | Real-time (`onSnapshot`) | Every 15 mins (if active) | ~100 - 200 |
| **Static Data** | One-time (`getDocs`) | On app launch / view change | ~50 - 100 |
| **TOTAL** | | | **~2,200 - 4,200** |

*Note: Free Quota is 50,000 reads/day. We are well within safe margins.*

## 3. Writes Analysis (Estimated Consumption per User)

| Feature | Logic | Frequency | Consumption (Writes/Day) |
| :--- | :--- | :--- | :--- |
| **Heartbeat** | Presence sync | Every 15 minutes | 96 |
| **Location** | Geolocation sync | 2-4 min interval | ~300 - 600 |
| **Baby Games** | Shared state sync | 15 min interval (one user) | 48 |
| **Chat** | Sending messages | Per interaction | ~100 - 300 |
| **TOTAL** | | | **~600 - 1,200** |

*Note: Free Quota is 20,000 writes/day. We are well within safe margins.*

## 4. Key Optimizations Applied

### A. Listener Decoupling (Crucial)
Converted non-essential real-time listeners (`Timeline`, `Envelopes`, `Health Issues`) into **one-time fetches** on app initialization. This prevents background read spikes when users are not actively looking at those screens.

### B. Dependency Stabilization
Fixed a critical bug in `useAppSync` where the listener array was refreshing every time the state changed. The synchronization effect is now stable and only re-binds on a change to the `roomId`.

### C. Home Radius & Displacement Tracking
- **Home Zone (50m)**: Tracking interval expands to **4 minutes** when inside the home radius. Speed is forced to 0 km/h to prevent "ghost" data.
- **Moving Zone**: Tracking interval is fixed to **2 minutes** (or 1 minute if driving > 30km/h).
- **Displacement**: Updates are only written if the user moves more than **50 meters** or battery status changes.

### D. Atomic Updates (Coin Fix)
- Switched `addCoins` to use Firestore **`increment()`**. This prevents "race conditions" where one partner's coin reward overwrites yours.
- Restricted `tickBabyLogic` writes to only one role ('boyfriend') to prevent double-subtracting stats when both partners are online.

### E. Feature Removal
- **Typing Indicators**: Completely removed from the application and Firebase logic to save 2-4 writes/minute per user during chat.
- **Coin Gain on Taps**: Removed coin rewards for baby clicks to reduce unnecessary write volume.
