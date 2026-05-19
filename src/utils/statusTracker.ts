import { registerPlugin } from '@capacitor/core';

export interface StatusTrackerPlugin {
  checkNotificationAccess(): Promise<{ granted: boolean }>;
  requestNotificationAccess(): Promise<void>;
  saveCredentials(data: { idToken: string; roomId: string; userId: string; role: string }): Promise<void>;
}

const StatusTracker = registerPlugin<StatusTrackerPlugin>('StatusTracker');

export default StatusTracker;
