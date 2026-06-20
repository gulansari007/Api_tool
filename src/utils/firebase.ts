import { initializeApp, getApps, deleteApp } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import type { FirebaseCredentials } from '../types';

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firebaseDb: Firestore | null = null;

export function isFirebaseEnabled(): boolean {
  return firebaseApp !== null;
}

export function getFirebaseAuth(): Auth | null {
  return firebaseAuth;
}

export function getFirebaseDb(): Firestore | null {
  return firebaseDb;
}

export async function initializeFirebase(creds: FirebaseCredentials): Promise<{ success: boolean; error?: string }> {
  try {
    const apps = getApps();
    for (const app of apps) {
      await deleteApp(app);
    }

    if (!creds.apiKey || !creds.authDomain || !creds.projectId || !creds.appId) {
      firebaseApp = null;
      firebaseAuth = null;
      firebaseDb = null;
      return { success: false, error: 'Missing mandatory configuration values.' };
    }

    // Set optional default attributes if missing
    const fullCreds = {
      ...creds,
      storageBucket: creds.storageBucket || `${creds.projectId}.appspot.com`,
      messagingSenderId: creds.messagingSenderId || '1234567890'
    };

    firebaseApp = initializeApp(fullCreds);
    firebaseAuth = getAuth(firebaseApp);
    firebaseDb = getFirestore(firebaseApp);

    return { success: true };
  } catch (err: any) {
    firebaseApp = null;
    firebaseAuth = null;
    firebaseDb = null;
    return { success: false, error: err.message || err };
  }
}

// Auto-initialize if credentials exist on load
const savedCreds = localStorage.getItem('firebase_creds');
if (savedCreds) {
  try {
    const creds: FirebaseCredentials = JSON.parse(savedCreds);
    initializeFirebase(creds).catch(err => {
      console.warn('Firebase auto-initialization failed:', err);
    });
  } catch (e) {
    console.error('Failed to parse saved Firebase credentials:', e);
  }
}
