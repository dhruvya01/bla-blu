import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function extractAvatars() {
  await signInWithEmailAndPassword(auth, "dhruvya@blablu.app", "pukkuukkublablu0501");
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  
  snap.forEach(d => {
      const data = d.data();
      if (data.avatarUrl) {
          const base64Data = data.avatarUrl.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, 'base64');
          fs.writeFileSync(`avatar_${d.id}.jpg`, buffer);
          console.log(`Saved avatar_${d.id}.jpg`);
      } else {
          console.log(`No avatar for ${d.id}`);
      }
  });
}

extractAvatars().then(() => process.exit(0)).catch(e => { console.log(e); process.exit(1); });
