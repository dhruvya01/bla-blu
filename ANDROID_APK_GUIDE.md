# Deploying Blablu to Android APK

Since you are using Vite and React, setting up Android via Capacitor is straight-forward. Follow these steps carefully in your local environment.

## 1. Prerequisites
- **Android Studio**: Ensure it's installed and updated to the latest version.
- **Node.js**: Installed on your local machine.

## 2. Syncing the Web Project to Android

Capacitor is already configured for this project (`capacitor.config.ts`). Once you've downloaded the source code to your machine, follow these steps to build the web code and inject it into the Android template:

```bash
# 1. Install all dependencies
npm i

# 2. Build the Vite React app (creates the /dist folder)
npm run build

# 3. Add the Android platform (if not already added)
npx cap add android

# 4. Sync the web assets into the Android Studio project
npx cap sync android
```

## 3. Opening in Android Studio

```bash
# 5. Open the project in Android Studio automatically
npx cap open android
```
*(If the command fails, just launch Android Studio, select "Open an existing project", and choose the `android` folder located inside the Blablu project root).*

## 4. Building the APK in Android Studio

Once Android Studio opens:
1. Wait for Gradle to finish syncing (look at the progress bar at the bottom right).
2. Go to the top menu: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. Wait for the build to finish.
4. A small popup will appear in the bottom right corner saying "Build APK(s) successfully". Click the **"locate"** link in that popup to open the folder containing your `app-debug.apk` file.

**For Production / Release (Google Play):**
Instead of `Build APK(s)`, you must go to **Build > Generate Signed Bundle / APK...** and follow the prompts to create a keystore.

## Note on Firebase Rules / Environment Variables
- Ensure your `.env` file containing your Firebase Config is present during the `npm run build` step. Since it is bundled into the client, Capacitor will automatically bundle the environment variables into the Android app. 
- You do NOT need a `google-services.json` file for the JS web SDK unless you decided to swap to `@capacitor-firebase` native plugins. The default web SDK will work as long as your Firebase domains remain unrestricted or you white-list `localhost` for Capacitor.
