const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// Support both standard and macOS double extension file naming
let serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");

if (!fs.existsSync(serviceAccountPath)) {
  const doubleExtPath = path.join(__dirname, "serviceAccountKey.json.json");
  if (fs.existsSync(doubleExtPath)) {
    serviceAccountPath = doubleExtPath;
  }
}

if (!fs.existsSync(serviceAccountPath)) {
  console.log("==========================================================================");
  console.log("❌ Service Account Key Not Found!");
  console.log("==========================================================================");
  console.log("To securely change your Firebase Auth passwords from this script:");
  console.log("1. Go to Firebase Console -> Project Settings -> Service Accounts.");
  console.log("2. Click 'Generate New Private Key' and download the JSON file.");
  console.log("3. Rename it to 'serviceAccountKey.json' and place it in this folder.");
  console.log("4. Run: node update-passwords.cjs");
  console.log("==========================================================================");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const usersToUpdate = [
  {
    email: "anjali@blablu.app",
    password: "ukkupukkublabblu0501"
  },
  {
    email: "dhruvya@blablu.app",
    password: "pukkuukkublablu0501"
  }
];

async function updatePasswords() {
  console.log("🔄 Starting password updates in Firebase Auth...");
  
  for (const u of usersToUpdate) {
    try {
      const userRecord = await admin.auth().getUserByEmail(u.email);
      await admin.auth().updateUser(userRecord.uid, {
        password: u.password
      });
      console.log(`✅ Successfully updated password for: ${u.email}`);
    } catch (error) {
      if (error.code === "auth/user-not-found") {
        try {
          await admin.auth().createUser({
            email: u.email,
            password: u.password
          });
          console.log(`✨ User did not exist. Created user and set password for: ${u.email}`);
        } catch (createErr) {
          console.error(`❌ Failed to create user ${u.email}:`, createErr.message);
        }
      } else {
        console.error(`❌ Failed to update ${u.email}:`, error.message);
      }
    }
  }
  
  console.log("🏁 All password updates processed!");
  process.exit(0);
}

updatePasswords();
