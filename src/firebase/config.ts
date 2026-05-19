import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging } from "firebase/messaging";
import firebaseConfig from "../../firebase-applet-config.json";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = (() => {
  try {
    return typeof window !== "undefined" ? getMessaging(app) : null;
  } catch (e) {
    console.warn("Firebase Messaging not supported in this environment", e);
    return null;
  }
})();

// Ensure persistence is set
setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err));

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string | null;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: any[];
  }
}

export function handleFirestoreError(error: any, operation: FirestoreErrorInfo['operationType'], path: string | null): never {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error?.message || String(error) || "Unknown Firestore error",
    operationType: operation,
    path: path,
    authInfo: {
      userId: user?.uid || "unauthenticated",
      email: user?.email || null,
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData || []
    }
  };
  console.error("[BLABLU] Firestore Error:", JSON.stringify(errorInfo, null, 2));
  console.error("[BLABLU] Raw error:", error);
  throw error;
}
