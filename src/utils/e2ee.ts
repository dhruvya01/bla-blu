export const ENCRYPTION_ALGORITHM = 'AES-GCM';
const PBKDF2_ITERATIONS = 100000;

let sharedKey: CryptoKey | null = null;

export const initE2E = async (secret: string) => {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  
  sharedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('blablu_nest_e2ee_salt_999'), // Fixed salt
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: ENCRYPTION_ALGORITHM, length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  
  localStorage.setItem('blablu_e2ee_secret', secret);
  window.dispatchEvent(new Event('e2ee-ready'));
};

export const restoreE2E = async () => {
    const secret = localStorage.getItem('blablu_e2ee_secret');
    if (secret) {
        await initE2E(secret);
        return true;
    }
    return false;
}

export const clearE2E = () => {
  sharedKey = null;
  localStorage.removeItem('blablu_e2ee_secret');
}

export const isE2EEnabled = () => sharedKey !== null;

export const useE2EReady = () => {
  return true; // Not strictly needed for a hook but can be added if needed
};

export const encryptData = async (text: string): Promise<string> => {
  if (!sharedKey || !text) return text;
  try {
      const enc = new TextEncoder();
      const iv = window.crypto.getRandomValues(new Uint8Array(12));
      const encodedToEncrypt = enc.encode(text);
      
      const cipher = await window.crypto.subtle.encrypt(
        { name: ENCRYPTION_ALGORITHM, iv },
        sharedKey,
        encodedToEncrypt
      );
      
      const cipherBytes = new Uint8Array(cipher);
      const result = new Uint8Array(iv.length + cipherBytes.length);
      result.set(iv, 0);
      result.set(cipherBytes, iv.length);
      
      // Convert to base64
      let binary = '';
      for (let i = 0; i < result.byteLength; i++) {
        binary += String.fromCharCode(result[i]);
      }
      return 'E2EE:' + btoa(binary);
  } catch (e) {
      console.error("Encryption failed", e);
      return text;
  }
};

export const decryptData = async (cipherText: string): Promise<string> => {
  if (!cipherText || !cipherText.startsWith('E2EE:')) return cipherText;
  if (!sharedKey) return "🔒 Encrypted Message - Enter E2EE Key to view";
  
  try {
    const rawData = atob(cipherText.substring(5));
    const dataBytes = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) {
      dataBytes[i] = rawData.charCodeAt(i);
    }
    
    const iv = dataBytes.slice(0, 12);
    const cipher = dataBytes.slice(12);
    
    const decrypted = await window.crypto.subtle.decrypt(
      { name: ENCRYPTION_ALGORITHM, iv },
      sharedKey,
      cipher
    );
    
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (e) {
    console.error("Decryption failed", e);
    return "🔒 Encrypted Message - Verification Failed";
  }
};
