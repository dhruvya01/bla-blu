# Blablu: Couples App Setup & Remix Guide

If you are setting up this app in a new environment or "remixing" it, follow this comprehensive guide to ensure authentication and features work correctly.

## 1. Project Overview
**Blablu** is an intimate app for long-distance couples.
- **Virtual Pet/Family Game**: "Our Family" page with virtual babies (Ukku & Pukku).
- **Habit Tracker**: Earn "Babies' Money" (BM) by completing daily habits.
- **Locked Photo Vault**: Secure storage for private memories.
- **Shared Journey**: Journaling and timeline features.
- **PWA Ready**: Can be installed on mobile devices.

## 2. Authentication Setup (Crucial)
The app uses **Firebase Authentication** (Email/Password). Hardcoded passwords have been removed for security.

### Setting Up Firebase
1.  **Create a Firebase Project**: Go to [Firebase Console](https://console.firebase.google.com/).
2.  **Enable Authentication**: Go to "Authentication" -> "Get Started" -> Enable "Email/Password".
3.  **Enable Firestore Database**: Go to "Firestore Database" -> "Create Database".
4.  **Generate Config**: Go to Project Settings (gear icon) -> Scroll to "Your apps" -> Add Web App. Copy the `firebaseConfig` object.
5.  **Create `firebase-applet-config.json`**: In the root directory, create this file with your config:
    ```json
    {
      "apiKey": "YOUR_API_KEY",
      "authDomain": "YOUR_PROJECT.firebaseapp.com",
      "projectId": "YOUR_PROJECT_ID",
      "storageBucket": "YOUR_PROJECT.appspot.com",
      "messagingSenderId": "YOUR_SENDER_ID",
      "appId": "YOUR_APP_ID"
    }
    ```

### Managing Passwords
Since passwords aren't in the code, use the Administrative script:
1.  **Service Account**: Go to Firebase Console -> Project Settings -> Service Accounts -> "Generate new private key".
2.  **Save as**: Rename the JSON file to `serviceAccountKey.json` and place it in the project root.
3.  **Run Update**:
    - Open `update-passwords.js`.
    - Set your desired passwords for `dhruvya@blablu.app` and `anjali@blablu.app`.
    - Run `node update-passwords.js` in your terminal. This creates/updates the accounts in Firebase Auth.

## 3. Database Security Rules
Apply these rules in your Firebase Console -> Firestore -> Rules tab:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() { return request.auth != null; }
    function isPart(partnerIds) { return request.auth.uid in partnerIds; }

    match /users/{userId} {
      allow write: if isAuthenticated() && request.auth.uid == userId;
      allow read: if isAuthenticated();
    }

    match /pairs/{roomId} {
      allow read: if isAuthenticated() && isPart(resource.data.partnerIds);
      allow create: if isAuthenticated() && isPart(request.resource.data.partnerIds);
      allow update, delete: if isAuthenticated() && isPart(resource.data.partnerIds);
      
      match /{document=**} {
        allow read, write: if isAuthenticated() && isPart(get(/databases/$(database)/documents/pairs/$(roomId)).data.partnerIds);
      }
    }
  }
}
```

## 4. Key Gameplay Features
- **Babies' Money (BM)**: Earn 10 BM for every habit completed in the "Jabit Tracker".
- **Random Drops**: Ukku and Pukku get hungry and dirty randomly throughout the day (scaled by a random multiplier in the state store).
- **Timed Tasks**:
    - **Cooking**: Takes **90 seconds** (1:30 min). Uses kitchen supplies.
    - **Bathing**: Takes **60 seconds** (1 min). Increases hygiene status.
- **PWA Installation**: Open the app URL in Safari (iOS) -> "Add to Home Screen" or Chrome (Android) -> "Install App".

## 5. Development Environment
- **Port**: 3000
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Animations**: Framer Motion
