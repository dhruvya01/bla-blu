# Blablu Login System & Security

## Overview
We have removed hardcoded passwords from the application code for better security. Passwords are now managed directly in **Firebase Authentication**.

## How to Manage Passwords
If you want to change or set passwords for **Anjali** or **Dhruvya**, use the provided admin script:

1.  **Script**: `update-passwords.js`
2.  **Configuration**: Modify the `usersToUpdate` array in `update-passwords.js` with the desired emails and passwords.
3.  **Requirements**: You need a `serviceAccountKey.json` from your Firebase Console (Project Settings -> Service Accounts) placed in the root directory.
4.  **Execution**: Run `node update-passwords.js` from your terminal.

## Login Flow
- The `LoginScreen.tsx` attempts to sign in via standard Firebase Email/Password authentication.
- Authentication errors (like "Wrong Password") are now explicitly displayed instead of being masked.
- If a user is not found in the Auth database, the system will attempt to provision them exactly once if the credentials are correct.

## Prompt / Context for External Tools
If you are using this app in a separate environment or another AI tool (like "Reix"), use this description to explain how to handle login issues:
"The Blablu app uses Firebase Auth for login. Emails are dhruvya@blablu.app and anjali@blablu.app. Passwords are set via an admin script (update-passwords.js) using the Firebase Admin SDK. Hardcoded passwords have been removed from the source code for safety."
