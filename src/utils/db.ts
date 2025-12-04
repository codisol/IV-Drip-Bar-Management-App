import { AppData } from '../types';

const DB_NAME = 'IVDripBarDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';
const KEY = 'latest';

export const initDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
    });
};

export const saveToDB = async (data: AppData): Promise<void> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(data, KEY);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    } catch (error) {
        console.error('Failed to save to IndexedDB:', error);
        throw error;
    }
};

export const loadFromDB = async (): Promise<AppData | null> => {
    try {
        const db = await initDB();
        const data = await new Promise<AppData | undefined>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(KEY);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });

        if (data) {
            return data;
        }

        // Fallback: Check localStorage (Migration)
        const localData = localStorage.getItem('iv-drip-bar-data');
        if (localData) {
            try {
                const parsed = JSON.parse(localData);
                console.log('Migrating data from localStorage to IndexedDB...');
                await saveToDB(parsed); // Save to DB
                // Optional: localStorage.removeItem('iv-drip-bar-data'); // Keep for safety for now
                return parsed;
            } catch (e) {
                console.error('Failed to parse localStorage data:', e);
            }
        }

        return null;
    } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
        return null;
    }
};
