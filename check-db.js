// Simple client side script to check users
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app);
const auth = getAuth(app);

async function check() {
  await signInWithEmailAndPassword(auth, "dhruvya@blablu.app", "pukkuukkublablu0501");
  const usersRef = collection(db, 'users');
  const snap = await getDocs(usersRef);
  console.log("Users in DB:");
  snap.forEach(d => {
    console.log(d.id, "=>", d.data());
  });
  
  const pairsRef = collection(db, 'pairs');
  const psnap = await getDocs(pairsRef);
  console.log("\nPairs in DB:");
  psnap.forEach(d => {
    console.log(d.id, "=>", d.data());
  });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
