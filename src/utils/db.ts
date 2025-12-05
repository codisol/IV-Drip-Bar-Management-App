import { AppData } from '../types';

const DB_NAME = 'IVDripBarDB';
const DB_VERSION = 1;
const STORE_NAME = 'appState';
const KEY = 'latest';

// GFS (Grandfather-Father-Son) Backup Strategy
// Hourly: 1 backup per hour, keep last 24 hours
// Daily: 1 backup per day, keep last 7 days
const MAX_HOURLY_BACKUPS = 24;
const MAX_DAILY_BACKUPS = 7;

// Backup entry with metadata
export interface BackupEntry {
    data: AppData;
    timestamp: string;
    type: 'hourly' | 'daily';
    label: string; // e.g., "2024-12-05 09:00" or "2024-12-05"
}

export interface BackupInfo {
    key: string;
    timestamp: string;
    type: 'hourly' | 'daily';
    label: string;
}

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

/**
 * Gets the current hour label (e.g., "2024-12-05T09")
 */
const getHourLabel = (date: Date = new Date()): string => {
    return date.toISOString().slice(0, 13); // "2024-12-05T09"
};

/**
 * Gets the current day label (e.g., "2024-12-05")
 */
const getDayLabel = (date: Date = new Date()): string => {
    return date.toISOString().slice(0, 10); // "2024-12-05"
};

/**
 * Saves data to IndexedDB with GFS tiered backup.
 * - Creates hourly backup if this is the first save of the hour
 * - Creates daily backup if this is the first save of the day
 */
export const saveToDB = async (data: AppData): Promise<void> => {
    const db = await initDB();
    const now = new Date();
    const hourLabel = getHourLabel(now);
    const dayLabel = getDayLabel(now);

    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // Get current data for backup
        const getRequest = store.get(KEY);

        getRequest.onsuccess = async () => {
            const currentData = getRequest.result;

            if (currentData) {
                // Check if we need to create hourly backup
                const hourlyKey = `hourly_${hourLabel}`;
                const existingHourly = await getEntry(store, hourlyKey);

                if (!existingHourly) {
                    // Create hourly backup
                    const hourlyEntry: BackupEntry = {
                        data: currentData,
                        timestamp: now.toISOString(),
                        type: 'hourly',
                        label: hourLabel
                    };
                    store.put(hourlyEntry, hourlyKey);

                    // Cleanup old hourly backups
                    await cleanupOldBackups(store, 'hourly', MAX_HOURLY_BACKUPS);
                }

                // Check if we need to create daily backup
                const dailyKey = `daily_${dayLabel}`;
                const existingDaily = await getEntry(store, dailyKey);

                if (!existingDaily) {
                    // Create daily backup - this is the FIRST save of the day
                    const dailyEntry: BackupEntry = {
                        data: currentData,
                        timestamp: now.toISOString(),
                        type: 'daily',
                        label: dayLabel
                    };
                    store.put(dailyEntry, dailyKey);

                    // Cleanup old daily backups
                    await cleanupOldBackups(store, 'daily', MAX_DAILY_BACKUPS);
                }
            }

            // Save the new data
            const putRequest = store.put(data, KEY);
            putRequest.onerror = () => reject(putRequest.error);
            putRequest.onsuccess = () => resolve();
        };

        getRequest.onerror = () => {
            const putRequest = store.put(data, KEY);
            putRequest.onerror = () => reject(putRequest.error);
            putRequest.onsuccess = () => resolve();
        };

        transaction.onerror = () => reject(transaction.error);
    });
};

/**
 * Helper to get an entry from the store
 */
const getEntry = (store: IDBObjectStore, key: string): Promise<BackupEntry | undefined> => {
    return new Promise((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
    });
};

/**
 * Cleanup old backups, keeping only the most recent N
 */
const cleanupOldBackups = async (store: IDBObjectStore, type: 'hourly' | 'daily', maxKeep: number): Promise<void> => {
    const prefix = `${type}_`;
    const keys: string[] = [];

    return new Promise((resolve) => {
        const cursorRequest = store.openCursor();

        cursorRequest.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
            if (cursor) {
                const key = String(cursor.key);
                if (key.startsWith(prefix)) {
                    keys.push(key);
                }
                cursor.continue();
            } else {
                // Sort by key (which includes timestamp) descending
                keys.sort().reverse();

                // Delete keys beyond maxKeep
                for (let i = maxKeep; i < keys.length; i++) {
                    store.delete(keys[i]);
                }
                resolve();
            }
        };

        cursorRequest.onerror = () => resolve();
    });
};

/**
 * Loads the main data from IndexedDB.
 */
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
                await saveToDB(parsed);
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

/**
 * Gets all available backups organized by type.
 */
export const getAllBackups = async (): Promise<{ hourly: BackupInfo[]; daily: BackupInfo[] }> => {
    try {
        const db = await initDB();
        const hourly: BackupInfo[] = [];
        const daily: BackupInfo[] = [];

        await new Promise<void>((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    const key = String(cursor.key);
                    const entry = cursor.value as BackupEntry;

                    if (key.startsWith('hourly_') && entry?.timestamp) {
                        hourly.push({
                            key,
                            timestamp: entry.timestamp,
                            type: 'hourly',
                            label: entry.label || key.replace('hourly_', '')
                        });
                    } else if (key.startsWith('daily_') && entry?.timestamp) {
                        daily.push({
                            key,
                            timestamp: entry.timestamp,
                            type: 'daily',
                            label: entry.label || key.replace('daily_', '')
                        });
                    }
                    cursor.continue();
                } else {
                    resolve();
                }
            };

            cursorRequest.onerror = () => resolve();
        });

        // Sort by timestamp descending (newest first)
        hourly.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        daily.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return { hourly, daily };
    } catch (error) {
        console.error('Failed to get backups:', error);
        return { hourly: [], daily: [] };
    }
};

/**
 * Loads a specific backup by key.
 */
export const loadBackupByKey = async (key: string): Promise<AppData | null> => {
    try {
        const db = await initDB();
        return new Promise<AppData | null>((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entry = request.result as BackupEntry | undefined;
                resolve(entry?.data || null);
            };
        });
    } catch (error) {
        console.error('Failed to load backup:', error);
        return null;
    }
};

/**
 * Legacy function - loads the most recent backup.
 */
export const loadBackupFromDB = async (): Promise<AppData | null> => {
    const backups = await getAllBackups();
    if (backups.hourly.length > 0) {
        return loadBackupByKey(backups.hourly[0].key);
    }
    if (backups.daily.length > 0) {
        return loadBackupByKey(backups.daily[0].key);
    }
    return null;
};

/**
 * Dumps ALL data from the IndexedDB store.
 */
export const dumpAllData = async (): Promise<Record<string, unknown>> => {
    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const result: Record<string, unknown> = {};

            const cursorRequest = store.openCursor();

            cursorRequest.onsuccess = (event) => {
                const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
                if (cursor) {
                    result[String(cursor.key)] = cursor.value;
                    cursor.continue();
                } else {
                    resolve(result);
                }
            };

            cursorRequest.onerror = () => reject(cursorRequest.error);
        });
    } catch (error) {
        console.error('Failed to dump data from IndexedDB:', error);
        return {};
    }
};

/**
 * Manually creates a backup (hourly slot for current hour).
 */
export const forceBackup = async (): Promise<boolean> => {
    try {
        const currentData = await loadFromDB();
        if (!currentData) {
            return false;
        }

        const db = await initDB();
        const now = new Date();
        const hourLabel = getHourLabel(now);
        const hourlyKey = `hourly_${hourLabel}`;

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const hourlyEntry: BackupEntry = {
                data: currentData,
                timestamp: now.toISOString(),
                type: 'hourly',
                label: hourLabel
            };

            const request = store.put(hourlyEntry, hourlyKey);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(true);
        });
    } catch (error) {
        console.error('Failed to force backup:', error);
        return false;
    }
};

// Legacy exports for backward compatibility
export const loadBackupByIndex = async (index: number): Promise<AppData | null> => {
    const backups = await getAllBackups();
    const allBackups = [...backups.hourly, ...backups.daily];
    if (index >= 0 && index < allBackups.length) {
        return loadBackupByKey(allBackups[index].key);
    }
    return null;
};
