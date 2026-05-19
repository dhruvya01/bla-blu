
// Global polyfill for certain libraries
if (typeof (window as any).global === 'undefined') {
  (window as any).global = window;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerSW } from 'virtual:pwa-register';

// Error Boundary for early crashes
window.addEventListener('error', (event) => {
  console.error('[BLABLU CRASH]', event.error);
  // Optional: show an alert for debugging on physical devices
  // alert('App Error: ' + event.message);
});

// Emergency Bypass removed for debugging
window.addEventListener('load', () => {
  console.log('[BLABLU] Window Loaded');
});

registerSW({ immediate: true });

try {
  createRoot(document.getElementById("root")!).render(<App />);
  // Hide debug div if successful
  const debugDiv = document.getElementById('debug-status');
  if (debugDiv) debugDiv.style.display = 'none';
} catch (err) {
  console.error('[BLABLU RENDER ERROR]', err);
}
