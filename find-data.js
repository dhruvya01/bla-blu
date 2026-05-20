import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function findData() {
  await signInWithEmailAndPassword(auth, "dhruvya@blablu.app", "pukkuukkublablu0501");
  const pairsRef = collection(db, 'pairs');
  const psnap = await getDocs(pairsRef);
  
  for (const d of psnap.docs) {
      const msgs = await getDocs(collection(db, 'pairs', d.id, 'chatMessages'));
      console.log("Room", d.id, "has", msgs.size, "messages.");
      
      const timeline = await getDocs(collection(db, 'pairs', d.id, 'timeline'));
      console.log("Room", d.id, "has", timeline.size, "timeline items.");
      
      const vault = await getDocs(collection(db, 'pairs', d.id, 'vaultPhotos'));
      console.log("Room", d.id, "has", vault.size, "vault items.");
  }
}

findData().then(() => process.exit(0)).catch(e => { console.log(e); process.exit(1); });
