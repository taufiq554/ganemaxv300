import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore/lite';
import fs from 'fs';
import path from 'path';

let firestoreInstance: Firestore | null = null;

const DEFAULT_FIREBASE_CONFIG = {
  projectId: 'ganemaxbot',
  appId: '1:823985455254:web:63a92196b87cf3ba6802b7',
  apiKey: 'AIzaSyCOQgB5AmzTqz0EJPTuLXuEq1Vs2YEbMdM',
  authDomain: 'ganemaxbot.firebaseapp.com',
  firestoreDatabaseId: '(default)',
  storageBucket: 'ganemaxbot.firebasestorage.app',
  messagingSenderId: '823985455254',
  measurementId: 'G-X4J90FND0Q',
};

export function getFirestoreDb(): Firestore | null {
  if (firestoreInstance) return firestoreInstance;

  try {
    let config = DEFAULT_FIREBASE_CONFIG;
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');

    if (process.env.FIREBASE_CONFIG) {
      try {
        config = JSON.parse(process.env.FIREBASE_CONFIG);
      } catch (_) {}
    } else if (fs.existsSync(configPath)) {
      try {
        const raw = fs.readFileSync(configPath, 'utf8');
        config = JSON.parse(raw);
      } catch (_) {}
    }

    const app = getApps().length === 0 ? initializeApp(config) : getApp();
    const dbId =
      config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)'
        ? config.firestoreDatabaseId
        : undefined;
    firestoreInstance = dbId ? getFirestore(app, dbId) : getFirestore(app);
    console.log('[Firebase] Firestore initialized for project:', config.projectId, 'database:', dbId || '(default)');
    return firestoreInstance;
  } catch (err) {
    console.error('[Firebase] Failed to initialize Firestore:', err);
    return null;
  }
}
