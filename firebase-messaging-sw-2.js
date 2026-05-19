importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// [DEBUG] SW Initialization
console.log('[SW] Service Worker Starting...');

// Values from firebaseConfig (User must ensure these match)
const firebaseConfig = {
  // Config will be injected or used from standard project
};

try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    console.log('[SW] Background Message Received:', payload);
    
    const notificationTitle = payload.notification?.title || 'blablu';
    const notificationOptions = {
      body: payload.notification?.body || 'New message!',
      icon: '/favicon.ico',
      tag: 'chat-notification',
      data: payload.data
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
  console.log('[SW] Messaging Initialized');
} catch (e) {
  console.error('[SW] Initialization Error:', e);
}
