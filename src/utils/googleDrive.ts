/**
 * Google Drive API integration for cloud backup
 * Uses Google Identity Services (GIS) for authentication
 */

const CLIENT_ID = '224049552455-f26u60ra5hd7at2cukej821s5c3d0vdc.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';
const APP_FOLDER_NAME = 'IV Drip Bar Backups';
const DATA_FILE_NAME = 'iv-drip-bar-data.json';

// Global state
let tokenClient: google.accounts.oauth2.TokenClient | null = null;
let accessToken: string | null = null;
let isInitialized = false;

/**
 * Check if Drive API is fully ready
 */
export function isDriveReady(): boolean {
    return isInitialized &&
        typeof gapi !== 'undefined' &&
        typeof gapi.client !== 'undefined' &&
        typeof gapi.client.drive !== 'undefined';
}

/**
 * Ensure Drive API is ready, waiting if needed
 */
async function ensureDriveReady(): Promise<boolean> {
    if (isDriveReady()) return true;

    // Try to initialize if not done
    if (!isInitialized) {
        const success = await initGoogleDrive();
        if (!success) return false;
    }

    // Wait up to 3 seconds for drive to be available
    for (let i = 0; i < 30; i++) {
        if (typeof gapi?.client?.drive !== 'undefined') {
            return true;
        }
        await new Promise(r => setTimeout(r, 100));
    }

    console.error('Drive API not available after waiting');
    return false;
}

/**
 * Check if Google APIs are loaded
 */
export function isGoogleApisLoaded(): boolean {
    return typeof google !== 'undefined' &&
        typeof google.accounts !== 'undefined' &&
        typeof gapi !== 'undefined';
}

/**
 * Initialize Google API client
 */
export async function initGoogleDrive(): Promise<boolean> {
    if (isInitialized) return true;

    if (!isGoogleApisLoaded()) {
        console.error('Google APIs not loaded');
        return false;
    }

    return new Promise((resolve) => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({
                    discoveryDocs: [DISCOVERY_DOC],
                });

                tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: CLIENT_ID,
                    scope: SCOPES,
                    callback: (response) => {
                        if (response.access_token) {
                            accessToken = response.access_token;
                        }
                    },
                });

                isInitialized = true;
                resolve(true);
            } catch (error) {
                console.error('Failed to initialize Google Drive:', error);
                resolve(false);
            }
        });
    });
}

/**
 * Sign in with Google
 */
export function signInWithGoogle(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!tokenClient) {
            console.error('Token client not initialized');
            resolve(false);
            return;
        }

        // Timeout to prevent hanging if user closes popup (2 minutes)
        const timeoutId = setTimeout(() => {
            console.warn('Google sign-in timed out');
            resolve(false);
        }, 120000);

        tokenClient.callback = (response) => {
            clearTimeout(timeoutId);
            if (response.error) {
                console.error('Sign in error:', response.error);
                resolve(false);
                return;
            }
            if (response.access_token) {
                accessToken = response.access_token;
                localStorage.setItem('gdrive_token', response.access_token);
                // CRITICAL: Set token on gapi client for API calls
                gapi.client.setToken({ access_token: response.access_token });
                resolve(true);
            }
        };

        // Check if we have a stored token
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            clearTimeout(timeoutId);
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
            resolve(true);
            return;
        }

        // Request a new token
        tokenClient.requestAccessToken({ prompt: 'consent' });
    });
}

/**
 * Refresh the access token if needed
 */
export function refreshToken(): Promise<boolean> {
    return new Promise((resolve) => {
        if (!tokenClient) {
            resolve(false);
            return;
        }

        tokenClient.callback = (response) => {
            if (response.error) {
                console.error('Token refresh error:', response.error);
                resolve(false);
                return;
            }
            if (response.access_token) {
                accessToken = response.access_token;
                localStorage.setItem('gdrive_token', response.access_token);
                gapi.client.setToken({ access_token: response.access_token });
                console.log('Token refreshed successfully');
                resolve(true);
            }
        };

        // Request a new token silently (no prompt)
        tokenClient.requestAccessToken({ prompt: '' });
    });
}

/**
 * Sign out from Google
 */
export function signOutFromGoogle(): void {
    if (accessToken) {
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log('Token revoked');
        });
    }
    accessToken = null;
    localStorage.removeItem('gdrive_token');
    gapi.client.setToken(null);
}

/**
 * Check if user is signed in (and token is potentially valid)
 */
export function isSignedIn(): boolean {
    return !!accessToken || !!localStorage.getItem('gdrive_token');
}

/**
 * Get user email from token
 */
export async function getUserEmail(): Promise<string | null> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            return null;
        }
    }

    try {
        const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        });
        if (!response.ok) {
            // Token might be expired
            localStorage.removeItem('gdrive_token');
            accessToken = null;
            return null;
        }
        const data = await response.json();
        return data.email || null;
    } catch (error) {
        console.error('Failed to get user email:', error);
        return null;
    }
}

/**
 * Find or create app folder
 */
async function getOrCreateAppFolder(): Promise<string | null> {
    // Ensure Drive API is ready
    if (!await ensureDriveReady()) {
        console.error('Drive API not ready');
        return null;
    }

    try {
        // Search for existing folder
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        const folders = searchResponse.result.files;
        if (folders && folders.length > 0) {
            return folders[0].id || null;
        }

        // Create new folder
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: APP_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
            },
            fields: 'id',
        });

        return createResponse.result.id || null;
    } catch (error) {
        console.error('Failed to get/create app folder:', error);
        return null;
    }
}

/**
 * Find data file in app folder
 */
async function findDataFile(folderId: string): Promise<string | null> {
    try {
        const response = await gapi.client.drive.files.list({
            q: `name='${DATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime)',
        });

        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0].id || null;
        }
        return null;
    } catch (error) {
        console.error('Failed to find data file:', error);
        return null;
    }
}

/**
 * Save data to Google Drive
 */
export async function saveToGoogleDrive<T>(data: T): Promise<boolean> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            console.error('Not signed in');
            return false;
        }
    }

    try {
        const folderId = await getOrCreateAppFolder();
        if (!folderId) {
            console.error('Failed to get/create folder');
            return false;
        }

        const fileId = await findDataFile(folderId);
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });

        const metadata = {
            name: DATA_FILE_NAME,
            mimeType: 'application/json',
            parents: fileId ? undefined : [folderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

        const response = await fetch(url, {
            method: fileId ? 'PATCH' : 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
            body: form,
        });

        if (!response.ok) {
            const error = await response.json();
            console.error('Upload failed:', error);
            // Token might be expired
            if (response.status === 401) {
                localStorage.removeItem('gdrive_token');
                accessToken = null;
            }
            return false;
        }

        return true;
    } catch (error) {
        console.error('Failed to save to Google Drive:', error);
        return false;
    }
}

/**
 * Load data from Google Drive
 */
export async function loadFromGoogleDrive<T>(): Promise<T | null> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            console.error('Not signed in');
            return null;
        }
    }

    try {
        const folderId = await getOrCreateAppFolder();
        if (!folderId) return null;

        const fileId = await findDataFile(folderId);
        if (!fileId) return null; // File truly doesn't exist, safe to return null

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            }
        );

        if (!response.ok) {
            if (response.status === 401) {
                localStorage.removeItem('gdrive_token');
                accessToken = null;
            }
            throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data as T;
    } catch (error) {
        console.error('Failed to load from Google Drive:', error);
        // CRITICAL: Re-throw error if it's not just "file not found"
        // This prevents smartMerge from assuming "no cloud data" and overwriting it
        throw error;
    }
}

export async function getLastSyncTime(): Promise<Date | null> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            return null;
        }
    }

    try {
        const folderId = await getOrCreateAppFolder();
        if (!folderId) return null;

        const response = await gapi.client.drive.files.list({
            q: `name='${DATA_FILE_NAME}' and '${folderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, modifiedTime)',
        });

        const files = response.result.files;
        if (files && files.length > 0 && files[0].modifiedTime) {
            return new Date(files[0].modifiedTime);
        }
        return null;
    } catch (error) {
        console.error('Failed to get last sync time:', error);
        return null;
    }
}

// ============================================================================
// VERSIONED BACKUP SYSTEM
// Stores hourly and daily snapshots in Google Drive for full restore capability
// ============================================================================

const BACKUP_FOLDER_NAME = 'Backups';
const MAX_HOURLY_BACKUPS = 24; // Keep 24 hourly backups
const MAX_DAILY_BACKUPS = 7;   // Keep 7 daily backups

export interface CloudBackupInfo {
    id: string;
    name: string;
    type: 'hourly' | 'daily';
    timestamp: Date;
    size?: number;
}

/**
 * Get or create backups subfolder
 */
async function getOrCreateBackupFolder(): Promise<string | null> {
    try {
        const appFolderId = await getOrCreateAppFolder();
        if (!appFolderId) return null;

        // Search for existing backup folder
        const searchResponse = await gapi.client.drive.files.list({
            q: `name='${BACKUP_FOLDER_NAME}' and '${appFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name)',
        });

        const folders = searchResponse.result.files;
        if (folders && folders.length > 0) {
            return folders[0].id || null;
        }

        // Create new backup folder
        const createResponse = await gapi.client.drive.files.create({
            resource: {
                name: BACKUP_FOLDER_NAME,
                mimeType: 'application/vnd.google-apps.folder',
                parents: [appFolderId],
            },
            fields: 'id',
        });

        return createResponse.result.id || null;
    } catch (error) {
        console.error('Failed to get/create backup folder:', error);
        return null;
    }
}

/**
 * Create a timestamped backup in Google Drive
 * Called automatically during sync - creates hourly/daily snapshots
 */
export async function createCloudBackup<T>(data: T, type: 'hourly' | 'daily'): Promise<boolean> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            return false;
        }
    }

    try {
        const backupFolderId = await getOrCreateBackupFolder();
        if (!backupFolderId) return false;

        const now = new Date();
        const timestamp = type === 'hourly'
            ? now.toISOString().slice(0, 13).replace('T', '_') // 2024-12-06_20
            : now.toISOString().slice(0, 10); // 2024-12-06

        const fileName = `backup_${type}_${timestamp}.json`;
        const content = JSON.stringify(data, null, 2);
        const blob = new Blob([content], { type: 'application/json' });

        const metadata = {
            name: fileName,
            mimeType: 'application/json',
            parents: [backupFolderId],
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', blob);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form,
        });

        if (!response.ok) return false;

        // Cleanup old backups
        await cleanupOldBackups(type);
        return true;
    } catch (error) {
        console.error('Failed to create cloud backup:', error);
        return false;
    }
}

/**
 * Cleanup old backups beyond retention limit
 */
async function cleanupOldBackups(type: 'hourly' | 'daily'): Promise<void> {
    try {
        const backupFolderId = await getOrCreateBackupFolder();
        if (!backupFolderId) return;

        const maxBackups = type === 'hourly' ? MAX_HOURLY_BACKUPS : MAX_DAILY_BACKUPS;

        const response = await gapi.client.drive.files.list({
            q: `name contains 'backup_${type}_' and '${backupFolderId}' in parents and trashed=false`,
            spaces: 'drive',
            fields: 'files(id, name, createdTime)',
            pageSize: 100,
        });

        const files = response.result.files || [];
        if (files.length <= maxBackups) return;

        // Sort by creation time, oldest first
        files.sort((a, b) => {
            const timeA = a.modifiedTime ? new Date(a.modifiedTime).getTime() : 0;
            const timeB = b.modifiedTime ? new Date(b.modifiedTime).getTime() : 0;
            return timeA - timeB;
        });

        // Delete oldest files beyond limit
        const toDelete = files.slice(0, files.length - maxBackups);
        for (const file of toDelete) {
            if (file.id) {
                await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
            }
        }
    } catch (error) {
        console.error('Failed to cleanup old backups:', error);
    }
}

/**
 * List all cloud backups
 */
export async function listCloudBackups(): Promise<CloudBackupInfo[]> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            return [];
        }
    }

    try {
        const backupFolderId = await getOrCreateBackupFolder();
        if (!backupFolderId) return [];

        const response = await gapi.client.drive.files.list({
            q: `'${backupFolderId}' in parents and trashed=false and mimeType='application/json'`,
            spaces: 'drive',
            fields: 'files(id, name, modifiedTime, size)',
            pageSize: 100,
        });

        const files = response.result.files || [];
        return files
            .filter(f => f.name?.startsWith('backup_'))
            .map(f => {
                const isHourly = f.name?.includes('_hourly_');
                // Cast to include size since we request it in fields but TypeScript doesn't know
                const fileWithSize = f as typeof f & { size?: string };
                return {
                    id: f.id || '',
                    name: f.name || '',
                    type: isHourly ? 'hourly' as const : 'daily' as const,
                    timestamp: new Date(f.modifiedTime || ''),
                    size: fileWithSize.size ? parseInt(fileWithSize.size) : undefined,
                };
            })
            .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    } catch (error) {
        console.error('Failed to list cloud backups:', error);
        return [];
    }
}

/**
 * Restore from a specific cloud backup
 */
export async function restoreFromCloudBackup<T>(backupId: string): Promise<T | null> {
    if (!accessToken) {
        const storedToken = localStorage.getItem('gdrive_token');
        if (storedToken) {
            accessToken = storedToken;
            gapi.client.setToken({ access_token: storedToken });
        } else {
            return null;
        }
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${backupId}?alt=media`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
            }
        );

        if (!response.ok) return null;
        return await response.json() as T;
    } catch (error) {
        console.error('Failed to restore from cloud backup:', error);
        return null;
    }
}

// Track last backup times
let lastHourlyBackup: Date | null = null;
let lastDailyBackup: Date | null = null;

/**
 * Smart backup - automatically creates hourly/daily backups as needed
 * Call this during regular sync operations
 */
export async function smartCloudBackup<T>(data: T): Promise<void> {
    const now = new Date();

    // Check if hourly backup needed (different hour)
    if (!lastHourlyBackup || now.getHours() !== lastHourlyBackup.getHours() ||
        now.getDate() !== lastHourlyBackup.getDate()) {
        await createCloudBackup(data, 'hourly');
        lastHourlyBackup = now;
    }

    // Check if daily backup needed (different day)
    if (!lastDailyBackup || now.getDate() !== lastDailyBackup.getDate() ||
        now.getMonth() !== lastDailyBackup.getMonth()) {
        await createCloudBackup(data, 'daily');
        lastDailyBackup = now;
    }
}

// ============================================================================
// DATA INTEGRITY SAFEGUARDS
// Prevent incomplete IndexedDB data from overwriting complete cloud data
// ============================================================================

export interface DataStats {
    patientCount: number;
    transactionCount: number;
    inventoryCount: number;
    lastModified: Date | null;
}

export interface SyncDecision {
    allow: boolean;
    reason?: string;
    localStats: DataStats;
    cloudStats?: DataStats;
}

/**
 * Get stats from cloud data without loading full data
 */
export async function getCloudDataStats(): Promise<DataStats | null> {
    if (!isSignedIn()) return null;

    try {
        const data = await loadFromGoogleDrive<{
            patients?: unknown[];
            transactions?: unknown[];
            inventory?: unknown[];
        }>();

        if (!data) return null;

        return {
            patientCount: data.patients?.length || 0,
            transactionCount: data.transactions?.length || 0,
            inventoryCount: data.inventory?.length || 0,
            lastModified: await getLastSyncTime(),
        };
    } catch (error) {
        console.error('Failed to get cloud data stats:', error);
        return null;
    }
}

/**
 * Calculate stats from local app data
 */
export function getLocalDataStats(appData: {
    patients?: unknown[];
    transactions?: unknown[];
    inventory?: unknown[];
}): DataStats {
    return {
        patientCount: appData.patients?.length || 0,
        transactionCount: appData.transactions?.length || 0,
        inventoryCount: appData.inventory?.length || 0,
        lastModified: new Date(),
    };
}

/**
 * Check if local data should be allowed to sync to cloud
 * Returns false if local data appears incomplete compared to cloud
 */
export async function shouldAllowSync(localAppData: {
    patients?: unknown[];
    transactions?: unknown[];
    inventory?: unknown[];
}): Promise<SyncDecision> {
    const localStats = getLocalDataStats(localAppData);

    // If not signed in, always allow (nothing to compare)
    if (!isSignedIn()) {
        return { allow: true, localStats };
    }

    const cloudStats = await getCloudDataStats();

    // If no cloud data yet, allow (first sync)
    if (!cloudStats) {
        return { allow: true, localStats, cloudStats: undefined };
    }

    // Check if local data is significantly smaller than cloud
    const patientRatio = cloudStats.patientCount > 0
        ? localStats.patientCount / cloudStats.patientCount
        : 1;
    const transactionRatio = cloudStats.transactionCount > 0
        ? localStats.transactionCount / cloudStats.transactionCount
        : 1;

    // If local has less than 80% of cloud data, block sync
    if (patientRatio < 0.8 || transactionRatio < 0.8) {
        return {
            allow: false,
            reason: `⚠️ Data lokal tampak tidak lengkap!\n\nLokal: ${localStats.patientCount} pasien, ${localStats.transactionCount} transaksi\nCloud: ${cloudStats.patientCount} pasien, ${cloudStats.transactionCount} transaksi\n\nSync diblokir untuk mencegah kehilangan data.`,
            localStats,
            cloudStats,
        };
    }

    return { allow: true, localStats, cloudStats };
}

/**
 * Check if we should load from cloud instead of local
 * Returns true if cloud has more data than local (potential data loss detected)
 */
export async function shouldLoadFromCloud(localAppData: {
    patients?: unknown[];
    transactions?: unknown[];
    inventory?: unknown[];
}): Promise<{ loadFromCloud: boolean; reason?: string; cloudStats?: DataStats }> {
    if (!isSignedIn()) {
        return { loadFromCloud: false };
    }

    const cloudStats = await getCloudDataStats();
    if (!cloudStats) {
        return { loadFromCloud: false };
    }

    const localStats = getLocalDataStats(localAppData);

    // If cloud has significantly more data, suggest loading from cloud
    if (cloudStats.patientCount > localStats.patientCount * 1.2 ||
        cloudStats.transactionCount > localStats.transactionCount * 1.2) {
        return {
            loadFromCloud: true,
            reason: `Cloud memiliki lebih banyak data (${cloudStats.patientCount} pasien vs ${localStats.patientCount} lokal). Muat dari cloud?`,
            cloudStats,
        };
    }

    return { loadFromCloud: false, cloudStats };
}

/**
 * Smart merge: Load from cloud, add new local items, sync back
 * This is for when local IndexedDB is incomplete but user has added NEW data while offline
 * 
 * Strategy:
 * 1. Load complete data from cloud
 * 2. Find items in local that don't exist in cloud (by ID)
 * 3. Add those new items to cloud data
 * 4. Sync merged result back to cloud
 * 5. Return merged data for app to use
 */
export async function smartMergeAndSync<T extends {
    patients?: Array<{ id: string; createdAt?: string }>;
    soapNotes?: Array<{ id: string; date?: string }>;
    transactions?: Array<{ id: string; createdAt?: string }>;
    inventory?: Array<{ id: string }>;
    inventoryTransactions?: Array<{ id: string; date?: string }>;
    informedConsents?: Array<{ id: string }>;
    declinationLetters?: Array<{ id: string }>;
    sickLeaves?: Array<{ id: string }>;
    referralLetters?: Array<{ id: string }>;
    prescriptions?: Array<{ id: string }>;
    fitnessCertificates?: Array<{ id: string }>;
    triageEntries?: Array<{ id: string }>;
    doctorProfile?: unknown;
}>(localData: T): Promise<{ merged: T; newItemsCount: number; skippedDuplicates: number; remappedReferences: number } | null> {
    if (!isSignedIn()) {
        console.log('Not signed in, cannot merge');
        return null;
    }

    try {
        // Step 1: Load complete data from cloud
        const cloudData = await loadFromGoogleDrive<T>();
        if (!cloudData) {
            console.log('No cloud data found, will upload local data');
            await saveToGoogleDrive(localData);
            return { merged: localData, newItemsCount: 0, skippedDuplicates: 0, remappedReferences: 0 };
        }

        // Step 2: Build patient ID remapping (local ID → cloud ID for duplicates)
        const patientIdRemap = new Map<string, string>(); // localId → cloudId
        let newItemsCount = 0;
        let skippedDuplicates = 0;
        let remappedReferences = 0;
        const merged = { ...cloudData } as T;

        // HIPAA-compliant patient merge with ID remapping
        // Includes Intra-Batch Deduplication (Simulated Re-entry):
        // As we process local patients, we add newly accepted ones to the lookup.
        // This catches duplicates created offline against each other, not just vs cloud.
        const mergePatients = (
            cloudPatients: Array<{ id: string; name?: string; fullName?: string; dob?: string; dateOfBirth?: string }> | undefined,
            localPatients: Array<{ id: string; name?: string; fullName?: string; dob?: string; dateOfBirth?: string }> | undefined
        ) => {
            if (!localPatients || localPatients.length === 0) return cloudPatients || [];
            if (!cloudPatients || cloudPatients.length === 0) return localPatients;

            // Create lookup: content key → patient ID (starts with cloud, grows with accepted local)
            const patientByKey = new Map<string, string>();
            cloudPatients.forEach(p => {
                const key = `${(p.name || p.fullName || '').toLowerCase().trim()}|${p.dob || p.dateOfBirth || ''}`;
                patientByKey.set(key, p.id);
            });

            const existingIds = new Set(cloudPatients.map(p => p.id));

            const newPatients: typeof localPatients = [];

            localPatients.forEach(p => {
                // Skip if ID already exists
                if (existingIds.has(p.id)) return;

                // Check for content duplicate (against cloud AND previously processed local)
                const key = `${(p.name || p.fullName || '').toLowerCase().trim()}|${p.dob || p.dateOfBirth || ''}`;
                const existingId = patientByKey.get(key);

                if (existingId) {
                    // Content duplicate! Create ID remapping
                    patientIdRemap.set(p.id, existingId);
                    console.log(`Patient remap: ${p.id} → ${existingId} (${p.name || p.fullName})`);
                    skippedDuplicates++;
                } else {
                    // Truly new patient - accept it
                    newPatients.push(p);
                    newItemsCount++;
                    // CRITICAL: Add to lookup for intra-batch deduplication
                    patientByKey.set(key, p.id);
                    existingIds.add(p.id);
                }
            });

            return [...cloudPatients, ...newPatients];
        };

        // Inventory deduplication by drugName + batchNumber
        const mergeInventory = (
            cloudInv: Array<{ id: string; drugName?: string; batchNumber?: string }> | undefined,
            localInv: Array<{ id: string; drugName?: string; batchNumber?: string }> | undefined
        ) => {
            if (!localInv || localInv.length === 0) return cloudInv || [];
            if (!cloudInv || cloudInv.length === 0) return localInv;

            // Create lookup: drugName|batchNumber → exists
            const cloudInvKeys = new Set(
                cloudInv.map(i => `${(i.drugName || '').toLowerCase().trim()}|${i.batchNumber || ''}`)
            );
            const cloudIds = new Set(cloudInv.map(i => i.id));

            const newItems = localInv.filter(i => {
                if (cloudIds.has(i.id)) return false;

                const key = `${(i.drugName || '').toLowerCase().trim()}|${i.batchNumber || ''}`;
                if (cloudInvKeys.has(key)) {
                    console.log(`Skipping duplicate inventory: ${i.drugName} batch ${i.batchNumber}`);
                    skippedDuplicates++;
                    return false;
                }
                return true;
            });

            newItemsCount += newItems.length;
            return [...cloudInv, ...newItems];
        };

        // Helper to remap patientId in records and merge
        const mergeWithPatientRemap = <I extends { id: string; patientId?: string }>(
            cloudArr: I[] | undefined,
            localArr: I[] | undefined
        ): I[] => {
            if (!localArr || localArr.length === 0) return cloudArr || [];
            if (!cloudArr || cloudArr.length === 0) {
                // Remap patient IDs in local data
                return localArr.map(item => {
                    if (item.patientId && patientIdRemap.has(item.patientId)) {
                        remappedReferences++;
                        return { ...item, patientId: patientIdRemap.get(item.patientId) };
                    }
                    return item;
                }) as I[];
            }

            const cloudIds = new Set(cloudArr.map(item => item.id));

            const newItems = localArr
                .filter(item => !cloudIds.has(item.id))
                .map(item => {
                    // Remap patientId if needed
                    if (item.patientId && patientIdRemap.has(item.patientId)) {
                        remappedReferences++;
                        return { ...item, patientId: patientIdRemap.get(item.patientId) };
                    }
                    return item;
                }) as I[];

            newItemsCount += newItems.length;
            return [...cloudArr, ...newItems];
        };

        // Helper for simple ID-based merge (no patientId)
        const mergeArrayById = <I extends { id: string }>(
            cloudArr: I[] | undefined,
            localArr: I[] | undefined
        ): I[] => {
            if (!localArr || localArr.length === 0) return cloudArr || [];
            if (!cloudArr || cloudArr.length === 0) return localArr;

            const cloudIds = new Set(cloudArr.map(item => item.id));
            const newItems = localArr.filter(item => !cloudIds.has(item.id));
            newItemsCount += newItems.length;

            return [...cloudArr, ...newItems];
        };

        // ============ MERGE ORDER MATTERS! ============
        // 1. First merge patients to build the ID remap
        if (localData.patients) {
            merged.patients = mergePatients(
                cloudData.patients as Array<{ id: string; name?: string; fullName?: string; dob?: string; dateOfBirth?: string }>,
                localData.patients as Array<{ id: string; name?: string; fullName?: string; dob?: string; dateOfBirth?: string }>
            ) as T['patients'];
        }

        // 2. Merge inventory with content-based deduplication
        if (localData.inventory) {
            merged.inventory = mergeInventory(
                cloudData.inventory as Array<{ id: string; drugName?: string; batchNumber?: string }>,
                localData.inventory as Array<{ id: string; drugName?: string; batchNumber?: string }>
            ) as T['inventory'];
        }

        // 3. Merge all patient-linked data WITH patientId remapping
        if (localData.soapNotes) {
            merged.soapNotes = mergeWithPatientRemap(
                cloudData.soapNotes as Array<{ id: string; patientId?: string }>,
                localData.soapNotes as Array<{ id: string; patientId?: string }>
            ) as T['soapNotes'];
        }
        if (localData.transactions) {
            merged.transactions = mergeWithPatientRemap(
                cloudData.transactions as Array<{ id: string; patientId?: string }>,
                localData.transactions as Array<{ id: string; patientId?: string }>
            ) as T['transactions'];
        }
        if (localData.informedConsents) {
            merged.informedConsents = mergeWithPatientRemap(
                cloudData.informedConsents as Array<{ id: string; patientId?: string }>,
                localData.informedConsents as Array<{ id: string; patientId?: string }>
            ) as T['informedConsents'];
        }
        if (localData.declinationLetters) {
            merged.declinationLetters = mergeWithPatientRemap(
                cloudData.declinationLetters as Array<{ id: string; patientId?: string }>,
                localData.declinationLetters as Array<{ id: string; patientId?: string }>
            ) as T['declinationLetters'];
        }
        if (localData.sickLeaves) {
            merged.sickLeaves = mergeWithPatientRemap(
                cloudData.sickLeaves as Array<{ id: string; patientId?: string }>,
                localData.sickLeaves as Array<{ id: string; patientId?: string }>
            ) as T['sickLeaves'];
        }
        if (localData.referralLetters) {
            merged.referralLetters = mergeWithPatientRemap(
                cloudData.referralLetters as Array<{ id: string; patientId?: string }>,
                localData.referralLetters as Array<{ id: string; patientId?: string }>
            ) as T['referralLetters'];
        }
        if (localData.prescriptions) {
            merged.prescriptions = mergeWithPatientRemap(
                cloudData.prescriptions as Array<{ id: string; patientId?: string }>,
                localData.prescriptions as Array<{ id: string; patientId?: string }>
            ) as T['prescriptions'];
        }
        if (localData.fitnessCertificates) {
            merged.fitnessCertificates = mergeWithPatientRemap(
                cloudData.fitnessCertificates as Array<{ id: string; patientId?: string }>,
                localData.fitnessCertificates as Array<{ id: string; patientId?: string }>
            ) as T['fitnessCertificates'];
        }
        if (localData.triageEntries) {
            merged.triageEntries = mergeWithPatientRemap(
                cloudData.triageEntries as Array<{ id: string; patientId?: string }>,
                localData.triageEntries as Array<{ id: string; patientId?: string }>
            ) as T['triageEntries'];
        }

        // 4. Merge inventory transactions (no patient link, just ID-based)
        if (localData.inventoryTransactions) {
            merged.inventoryTransactions = mergeArrayById(
                cloudData.inventoryTransactions,
                localData.inventoryTransactions
            ) as T['inventoryTransactions'];
        }

        // Keep cloud's doctorProfile (don't overwrite)
        if (cloudData.doctorProfile) {
            merged.doctorProfile = cloudData.doctorProfile;
        }
        // Step 3: If there are new items, sync merged data back to cloud
        if (newItemsCount > 0 || remappedReferences > 0) {
            console.log(`Smart merge: ${newItemsCount} new, ${skippedDuplicates} duplicates skipped, ${remappedReferences} references remapped`);
            await saveToGoogleDrive(merged);

            // Step 4: Create versioned backup (hourly/daily)
            await smartCloudBackup(merged as unknown as Record<string, unknown>);
        }

        return { merged, newItemsCount, skippedDuplicates, remappedReferences };
    } catch (error) {
        console.error('Smart merge failed:', error);
        return null;
    }
}
