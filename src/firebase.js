import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDBVuYPQCbXNo6Z12Ml2zcWwFiG2sz34YI",
  authDomain: "hotelbar-df17e.firebaseapp.com",
  projectId: "hotelbar-df17e",
  storageBucket: "hotelbar-df17e.firebasestorage.app",
  messagingSenderId: "929058001004",
  appId: "1:929058001004:web:746801cdfbfa709ecf8849",
  measurementId: "G-4XRW4E7LEB"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Lit un document Firestore → retourne sa data ou null */
export async function dbGet(docId) {
  try {
    const snap = await getDoc(doc(db, "hotelbar", docId));
    return snap.exists() ? snap.data().value : null;
  } catch { return null; }
}

/** Écrit un document Firestore */
export async function dbSet(docId, value) {
  try {
    await setDoc(doc(db, "hotelbar", docId), { value });
  } catch (e) { console.error("dbSet error", e); }
}

/** Écoute les changements en temps réel sur un document → appelle cb(data) */
export function dbListen(docId, cb) {
  return onSnapshot(doc(db, "hotelbar", docId), (snap) => {
    if (snap.exists()) cb(snap.data().value);
  });
}
