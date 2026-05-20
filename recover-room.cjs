const admin = require("firebase-admin");
const path = require("path");

const serviceAccountPath = path.join(__dirname, "serviceAccountKey.json");
if (!require("fs").existsSync(serviceAccountPath)) {
  console.log("No service account");
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function findOldRoom() {
  const db = admin.firestore();
  const pairsSnap = await db.collection("pairs").get();
  
  pairsSnap.forEach(doc => {
    const data = doc.data();
    if (doc.id !== "blablu_nest") {
       if (data.partnerEmails && (data.partnerEmails.includes("anjali@blablu.app") || data.partnerEmails.includes("dhruvya@blablu.app"))) {
           console.log("FOUND OLD ROOM:", doc.id);
           console.log("Data:", data);
       }
    }
  });
  console.log("Done");
  process.exit(0);
}

findOldRoom();
