import { AppData } from '../types';

export interface StorageInfo {
    usage: number;
    quota: number;
    usagePercent: number;
    isLow: boolean;       // > 80% used
    isCritical: boolean;  // > 95% used
    isPersisted: boolean; // Storage will not be evicted
    formatted: { usage: string; quota: string };
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

/**
 * Get current storage usage info using the Storage Manager API
 * Returns null if the API is not available (e.g., in tests or very old browsers)
 */
export async function getStorageInfo(): Promise<StorageInfo | null> {
    if (!navigator.storage?.estimate) {
        console.warn('Storage Manager API not available');
        return null;
    }

    try {
        const estimate = await navigator.storage.estimate();
        const usage = estimate.usage ?? 0;
        const quota = estimate.quota ?? 0;
        const usagePercent = quota > 0 ? (usage / quota) * 100 : 0;
        const isPersisted = await navigator.storage.persisted?.() ?? false;

        return {
            usage,
            quota,
            usagePercent,
            isLow: usagePercent > 80,
            isCritical: usagePercent > 95,
            isPersisted,
            formatted: {
                usage: formatBytes(usage),
                quota: formatBytes(quota)
            }
        };
    } catch (error) {
        console.error('Failed to get storage estimate:', error);
        return null;
    }
}

/**
 * Request persistent storage from the browser.
 * This can significantly increase available quota and prevents the browser
 * from automatically evicting data when storage is low.
 * 
 * Returns true if persistence was granted, false otherwise.
 * Note: The browser may auto-grant based on engagement metrics, or prompt the user.
 */
export async function requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage?.persist) {
        console.warn('Persistent storage API not available');
        return false;
    }

    try {
        const granted = await navigator.storage.persist();
        if (granted) {
            console.log('Persistent storage granted - data will not be evicted');
        } else {
            console.log('Persistent storage request was not granted');
        }
        return granted;
    } catch (error) {
        console.error('Failed to request persistent storage:', error);
        return false;
    }
}

/**
 * Estimate the size of AppData in bytes
 */
export function estimateAppDataSize(data: AppData): number {
    try {
        const json = JSON.stringify(data);
        return new Blob([json]).size;
    } catch {
        return 0;
    }
}

/**
 * Check if the browser supports File System Access API for external backups
 */
export function supportsFileSystemAccess(): boolean {
    return 'showSaveFilePicker' in window;
}
