/**
 * Global configuration for the Blablu app.
 * Replace the SERVER_URL with your deployed Render/Railway URL.
 */
// Get the origin dynamically for web. For mobile apps (Capacitor), you will need to hardcode your production backend URL.
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin !== 'null' && !window.location.origin.includes('localhost')) {
    return window.location.origin;
  }
  return 'https://blabluu-production.up.railway.app'; // Fallback for native mobile
};

export const CONFIG = {
  // Uses current origin on web, fallback to prod on mobile
  SERVER_URL: getBaseUrl(),

  // App Metadata
  APP_NAME: 'Blablu',
  VERSION: '1.0.0',
};
