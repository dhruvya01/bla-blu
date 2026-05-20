import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function checkE2E() {
  await signInWithEmailAndPassword(auth, "dhruvya@blablu.app", "pukkuukkublablu0501");
  const msgs = await getDocs(collection(db, 'pairs', 'blablu_nest', 'chatMessages'));
  let enc = 0, plain = 0;
  msgs.forEach(m => {
    if ((m.data().text && m.data().text.startsWith('E2EE:')) || (m.data().image && m.data().image.startsWith('E2EE:'))) enc++;
    else plain++;
  });
  console.log("Encrypted:", enc, "Plain:", plain);
}

checkE2E().then(() => process.exit(0)).catch(e => { console.log(e); process.exit(1); });
