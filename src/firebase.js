import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, deleteDoc, writeBatch,
} from "firebase/firestore";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBVuYPQCbXNo6Z12Ml2zcWwFiG2sz34YI",
  authDomain: "hotelbar-df17e.firebaseapp.com",
  projectId: "hotelbar-df17e",
  storageBucket: "hotelbar-df17e.firebasestorage.app",
  messagingSenderId: "929058001004",
  appId: "1:929058001004:web:746801cdfbfa709ecf8849",
  measurementId: "G-4XRW4E7LEB"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Données du bar ───────────────────────────────────────────────────────────

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
  return onSnapshot(
    doc(db, "hotelbar", docId),
    (snap) => { if (snap.exists()) cb(snap.data().value); },
    (err) => console.error("dbListen error", docId, err)
  );
}

// ── Authentification ─────────────────────────────────────────────────────────

let pending = null; // création de compte en cours (évite la "course" avec onAuthStateChanged)
export const waitPending = () => pending || Promise.resolve();

export const watchAuth = (cb) => onAuthStateChanged(auth, cb);
export const login  = (email, pw) => signInWithEmailAndPassword(auth, email.trim(), pw);
export const logout = () => signOut(auth);
export const resetPassword = (email) => sendPasswordResetEmail(auth, email.trim());

/** Profil (nom + rôle) d'un utilisateur, ou null s'il n'a pas d'accès */
export async function getProfile(uid) {
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? snap.data() : null;
  } catch { return null; }
}

/** true si le compte administrateur a déjà été créé */
export async function isSetupDone() {
  try {
    const snap = await getDoc(doc(db, "meta", "setup"));
    return snap.exists();
  } catch { return true; }
}

/** Première utilisation : crée le compte administrateur (une seule fois) */
export function setupAdmin(name, email, password) {
  const p = (async () => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    const batch = writeBatch(db);
    batch.set(doc(db, "users", cred.user.uid), {
      name: name.trim(), email: email.trim(), role: "admin", createdAt: new Date().toISOString(),
    });
    batch.set(doc(db, "meta", "setup"), { by: cred.user.uid, at: new Date().toISOString() });
    await batch.commit();
  })();
  pending = p;
  p.catch(() => {}).finally(() => { if (pending === p) pending = null; });
  return p;
}

// ── Gestion des utilisateurs (admin uniquement) ──────────────────────────────

/** Crée un compte sans déconnecter l'admin (utilise une 2e instance Firebase) */
export async function createUserAccount({ name, email, password, role }) {
  const secondary = getApps().find((a) => a.name === "secondary") || initializeApp(firebaseConfig, "secondary");
  const sAuth = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(sAuth, email.trim(), password);
  await signOut(sAuth);
  await setDoc(doc(db, "users", cred.user.uid), {
    name: name.trim(), email: email.trim(), role, createdAt: new Date().toISOString(),
  });
}

export async function listUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

export const setUserRole = (uid, data) => setDoc(doc(db, "users", uid), data);
export const removeUser  = (uid) => deleteDoc(doc(db, "users", uid));
