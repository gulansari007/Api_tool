import type { SavedConfig } from '../types';
import { getFirebaseDb } from './firebase';
import { doc, collection, setDoc, deleteDoc, getDocs } from 'firebase/firestore';

// Fetch configs: LocalStorage for guest, Firestore for logged in user
export async function fetchSavedConfigs(userId?: string): Promise<SavedConfig[]> {
  const db = getFirebaseDb();
  if (db && userId) {
    try {
      const colRef = collection(db, 'users', userId, 'configs');
      const snap = await getDocs(colRef);
      const configs: SavedConfig[] = [];
      snap.forEach((doc) => {
        configs.push(doc.data() as SavedConfig);
      });
      return configs.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (err) {
      console.error('Failed to fetch configs from Firestore:', err);
      // Fallback to local configs if Firestore fails
    }
  }

  // Local fallback
  const local = localStorage.getItem('local_configs');
  if (local) {
    try {
      const parsed: SavedConfig[] = JSON.parse(local);
      return parsed.sort((a, b) => b.updatedAt - a.updatedAt);
    } catch (e) {
      console.error('Failed to parse local configs:', e);
    }
  }
  return [];
}

// Save config
export async function saveSavedConfig(
  config: Omit<SavedConfig, 'id' | 'updatedAt'>,
  configId?: string,
  userId?: string
): Promise<SavedConfig> {
  const id = configId || Date.now().toString();
  const savedConfig: SavedConfig = {
    ...config,
    id,
    updatedAt: Date.now()
  };

  const db = getFirebaseDb();
  if (db && userId) {
    try {
      const docRef = doc(db, 'users', userId, 'configs', id);
      await setDoc(docRef, savedConfig);
      return savedConfig;
    } catch (err) {
      console.error('Failed to save config to Firestore:', err);
      // Fallback to saving locally
    }
  }

  // Local storage save
  const current = await fetchSavedConfigs();
  const filtered = current.filter((c) => c.id !== id);
  const updated = [savedConfig, ...filtered];
  localStorage.setItem('local_configs', JSON.stringify(updated));
  return savedConfig;
}

// Delete config
export async function deleteSavedConfig(configId: string, userId?: string): Promise<boolean> {
  const db = getFirebaseDb();
  if (db && userId) {
    try {
      const docRef = doc(db, 'users', userId, 'configs', configId);
      await deleteDoc(docRef);
      return true;
    } catch (err) {
      console.error('Failed to delete config from Firestore:', err);
    }
  }

  // Local delete
  const current = await fetchSavedConfigs();
  const updated = current.filter((c) => c.id !== configId);
  localStorage.setItem('local_configs', JSON.stringify(updated));
  return true;
}
