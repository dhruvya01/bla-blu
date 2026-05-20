/**
 * Global configuration for the Blablu app.
 */
// Get the origin dynamically for web. For mobile apps (Capacitor), this uses the deployed app URL as fallback.
const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.origin !== 'null' && !window.location.origin.includes('localhost') && !window.location.origin.includes('capacitor')) {
    return window.location.origin;
  }
  return 'https://ais-pre-sbw6oyr6yv4xjx2nydz7os-361246541562.asia-southeast1.run.app'; // Fallback for native mobile
};

export const CONFIG = {
  // Uses current origin on web, fallback to prod on mobile
  SERVER_URL: getBaseUrl(),

  // App Metadata
  APP_NAME: 'Blablu',
  VERSION: '1.0.0',
};
