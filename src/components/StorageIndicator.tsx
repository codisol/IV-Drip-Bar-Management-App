import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Package, Upload, CheckCircle2, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { toast } from 'sonner';
import { estimateAppDataSize, formatBytes } from '../utils/storageQuota';
import {
    initGoogleDrive,
    isGoogleApisLoaded,
    signInWithGoogle,
    signOutFromGoogle,
    smartCloudBackup,
    isSignedIn,
    getUserEmail,
    saveToGoogleDrive,
    loadFromGoogleDrive,
    getLastSyncTime,
    shouldAllowSync,
    smartMergeAndSync,
    SyncDecision
} from '../utils/googleDrive';
import { pickSaveFile, writeToHandle, getAutosaveHandle, setAutosaveHandle } from '../utils/storage';
import { AppData } from '../types';

interface StorageIndicatorProps {
    appData: AppData;
    onLoadFromCloud?: (data: AppData) => void;
}

export function StorageIndicator({ appData, onLoadFromCloud }: StorageIndicatorProps) {
    const [isConnecting, setIsConnecting] = useState(false);
    const [hasExternalFile, setHasExternalFile] = useState(false);
    const [dataSize, setDataSize] = useState<string>('0 KB');

    // Google Drive state
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
    const [googleEmail, setGoogleEmail] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
    const [syncWarning, setSyncWarning] = useState<SyncDecision | null>(null);

    // Initialize Google APIs
    useEffect(() => {
        const initGoogle = async () => {
            const checkGoogleLoaded = setInterval(async () => {
                if (isGoogleApisLoaded()) {
                    clearInterval(checkGoogleLoaded);
                    const success = await initGoogleDrive();
                    setIsGoogleReady(success);

                    if (success && isSignedIn()) {
                        const email = await getUserEmail();
                        if (email) {
                            setIsGoogleSignedIn(true);
                            setGoogleEmail(email);
                            const syncTime = await getLastSyncTime();
                            setLastSyncTime(syncTime);
                            setAutoSyncEnabled(true);
                        } else {
                            // Token invalid, ensure signed out state
                            setIsGoogleSignedIn(false);
                            setGoogleEmail(null);
                        }
                    }
                }
            }, 500);
            setTimeout(() => clearInterval(checkGoogleLoaded), 10000);
        };
        initGoogle();
    }, []);

    // Check file handle and data size
    useEffect(() => {
        setHasExternalFile(!!getAutosaveHandle());
        const size = estimateAppDataSize(appData);
        setDataSize(formatBytes(size));
    }, [appData]);

    // Auto-sync to Google Drive with versioned backups (with integrity check)
    useEffect(() => {
        if (autoSyncEnabled && isGoogleSignedIn) {
            const syncTimeout = setTimeout(async () => {
                // Check data integrity before syncing
                const syncCheck = await shouldAllowSync(appData);

                if (!syncCheck.allow) {
                    // Data appears incomplete - attempt Smart Merge instead of blocking
                    console.log('Regular sync blocked, attempting smart merge...');
                    const mergeResult = await smartMergeAndSync(appData);

                    if (mergeResult) {
                        const localSize = estimateAppDataSize(appData);
                        const cloudSize = estimateAppDataSize(mergeResult.merged as AppData);
                        const isHuge = cloudSize > localSize * 1.5 && cloudSize > 5 * 1024 * 1024; // > 1.5x and > 5MB

                        if (onLoadFromCloud) {
                            if (isHuge) {
                                toast.success(
                                    <div className="space-y-2">
                                        <p className="font-bold">Sync Berhasil (Cloud Update)</p>
                                        <p className="text-xs">
                                            Data cloud ({formatBytes(cloudSize)}) jauh lebih besar dari lokal ({formatBytes(localSize)}).
                                            <br />Unduh semua data riwayat?
                                        </p>
                                        <div className="flex gap-2">
                                            <Button size="sm" variant="outline" onClick={() => {
                                                onLoadFromCloud(mergeResult.merged as AppData);
                                                toast.dismiss();
                                                toast.success('Data riwayat lengkap diunduh');
                                            }}>
                                                Unduh Semua
                                            </Button>
                                            <Button size="sm" variant="default" onClick={() => {
                                                toast.dismiss();
                                                toast.info('Menyimpan mode "Lite" (Hanya Upload)');
                                            }}>
                                                Biarkan Lokal Ringan
                                            </Button>
                                        </div>
                                    </div>,
                                    { duration: 15000 }
                                );
                            } else {
                                // Always update app with merged data (unless huge)
                                onLoadFromCloud(mergeResult.merged as AppData);

                                // Show appropriate success message
                                if (mergeResult.newItemsCount > 0 || mergeResult.remappedReferences > 0) {
                                    toast.success(
                                        <div className="space-y-1">
                                            <p className="font-bold">Smart Merge Berhasil</p>
                                            <p className="text-xs">
                                                {mergeResult.newItemsCount} item baru digabung ke cloud.<br />
                                                {mergeResult.remappedReferences > 0 && `${mergeResult.remappedReferences} referensi diperbaiki.`}
                                            </p>
                                        </div>
                                    );
                                } else {
                                    // Just a silent update or minimal toast if needed, but for now silent is better for auto-sync
                                    // unless it was a manual trigger? 
                                    // Actually, let's show a small toast if data count changed significantly
                                    // For now, let's just log it
                                    console.log('App updated with cloud data (no new local items)');
                                }
                            }
                        }
                    }
                    return;
                }

                setSyncWarning(null);
                setIsSyncing(true);
                const success = await saveToGoogleDrive(appData);
                if (success) {
                    setLastSyncTime(new Date());
                    await smartCloudBackup(appData);
                }
                setIsSyncing(false);
            }, 2000);
            return () => clearTimeout(syncTimeout);
        }
    }, [appData, autoSyncEnabled, isGoogleSignedIn]);

    const handleGoogleSignIn = async () => {
        setIsConnecting(true);
        try {
            const success = await signInWithGoogle();
            if (success) {
                setIsGoogleSignedIn(true);
                const email = await getUserEmail();
                setGoogleEmail(email);
                setAutoSyncEnabled(true);

                // Automatically merge local and cloud data (no dialog)
                const mergeResult = await smartMergeAndSync(appData);
                if (mergeResult && onLoadFromCloud) {
                    onLoadFromCloud(mergeResult.merged as AppData);

                    if (mergeResult.newItemsCount > 0) {
                        toast.success(`Terhubung sebagai ${email} • ${mergeResult.newItemsCount} item lokal digabung`);
                    } else {
                        toast.success(`Terhubung ke Google Drive sebagai ${email}`);
                    }
                } else {
                    // No cloud data yet, just upload local
                    await saveToGoogleDrive(appData);
                    setLastSyncTime(new Date());
                    toast.success(`Terhubung ke Google Drive sebagai ${email}`);
                }
            }
        } catch (error) {
            console.error('Google sign in failed:', error);
            toast.error('Gagal masuk ke Google Drive');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleGoogleSignOut = () => {
        signOutFromGoogle();
        setIsGoogleSignedIn(false);
        setGoogleEmail(null);
        setAutoSyncEnabled(false);
        setLastSyncTime(null);
        toast.success('Keluar dari Google Drive');
    };

    const handleManualSync = async (forceSync = false) => {
        setIsSyncing(true);
        try {
            // Check integrity unless forced
            if (!forceSync) {
                const syncCheck = await shouldAllowSync(appData);
                if (!syncCheck.allow) {
                    setSyncWarning(syncCheck);
                    toast.warning(
                        <div className="space-y-2">
                            <p><strong>⚠️ Data Tidak Lengkap Terdeteksi</strong></p>
                            <p className="text-sm">Lokal: {syncCheck.localStats.patientCount} pasien</p>
                            <p className="text-sm">Cloud: {syncCheck.cloudStats?.patientCount || 0} pasien</p>
                            <div className="flex gap-2 mt-2">
                                <Button size="sm" variant="default" onClick={async () => {
                                    toast.dismiss();
                                    const mergeResult = await smartMergeAndSync(appData);
                                    if (mergeResult && onLoadFromCloud) {
                                        onLoadFromCloud(mergeResult.merged as AppData);
                                        toast.success('Smart Merge Berhasil');
                                    }
                                }}>
                                    Smart Merge (Aman)
                                </Button>
                                <Button size="sm" variant="outline" onClick={async () => {
                                    toast.dismiss();
                                    // Load from cloud instead
                                    const cloudData = await loadFromGoogleDrive<AppData>();
                                    if (cloudData && onLoadFromCloud) {
                                        onLoadFromCloud(cloudData);
                                        toast.success('Data dimuat dari cloud');
                                    }
                                }}>
                                    Timpa Lokal
                                </Button>
                            </div>
                        </div>,
                        { duration: 30000 }
                    );
                    setIsSyncing(false);
                    return;
                }
            }

            setSyncWarning(null);
            const success = await saveToGoogleDrive(appData);
            if (success) {
                setLastSyncTime(new Date());
                await smartCloudBackup(appData);
                toast.success('Data berhasil disinkronkan');
            } else {
                toast.error('Gagal menyinkronkan data');
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const handleConnectLocalFile = async () => {
        setIsConnecting(true);
        try {
            const handle = await pickSaveFile(`iv-drip-bar-data-${new Date().toISOString().split('T')[0]}.json`);
            setAutosaveHandle(handle);
            await writeToHandle(handle, appData);
            setHasExternalFile(true);
            toast.success('Terhubung ke file lokal');
        } catch {
            // User cancelled
        } finally {
            setIsConnecting(false);
        }
    };

    const formatSyncTime = (date: Date) => {
        return date.toLocaleString('id-ID', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const supportsFileSystem = 'showSaveFilePicker' in window;

    return (
        <Card className={isGoogleSignedIn ? 'border-green-300' : hasExternalFile ? 'border-blue-300' : 'border-gray-200'}>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Package className="w-5 h-5" />
                        Penyimpanan Data
                    </CardTitle>
                    <span className="text-sm font-medium text-muted-foreground">
                        {dataSize}
                    </span>
                </div>
                <CardDescription>
                    {isGoogleSignedIn ? (
                        <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="w-4 h-4" />
                            Google Drive ({googleEmail})
                        </span>
                    ) : hasExternalFile ? (
                        <span className="flex items-center gap-1 text-blue-600">
                            <CheckCircle2 className="w-4 h-4" />
                            File Lokal
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 text-orange-600">
                            <AlertTriangle className="w-4 h-4" />
                            Hanya di browser (berisiko hilang)
                        </span>
                    )}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Google Drive - Primary Option */}
                {isGoogleReady && !isGoogleSignedIn && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-6 h-6 mt-0.5 flex-shrink-0" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8H0c0 1.55.4 3.1 1.2 4.5l5.4 9.35z" fill="#0066da" />
                                <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.35c-.8 1.4-1.2 2.95-1.2 4.5h27.5L43.65 25z" fill="#00ac47" />
                                <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8L73.55 76.8z" fill="#ea4335" />
                                <path d="M43.65 25L57.4 1.2c-1.35-.8-2.9-1.2-4.5-1.2H34.35c-1.6 0-3.15.45-4.45 1.2L43.65 25z" fill="#00832d" />
                                <path d="M59.8 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.5 1.2h50.85c1.6 0 3.15-.45 4.45-1.2L59.8 53z" fill="#2684fc" />
                                <path d="M73.4 26.5l-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25l16.15 28h27.5c0-1.55-.4-3.1-1.2-4.5l-12.7-22z" fill="#ffba00" />
                            </svg>
                            <div className="flex-1">
                                <p className="text-sm text-blue-800 font-medium">Simpan ke Google Drive</p>
                                <p className="text-xs text-blue-700 mt-1 mb-3">
                                    Data otomatis disinkronkan dengan backup hourly & daily di cloud.
                                </p>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={isConnecting ? () => setIsConnecting(false) : handleGoogleSignIn}
                                    className="bg-white hover:bg-blue-50 border-blue-300 text-blue-700 hover:text-blue-800"
                                >
                                    {isConnecting ? (
                                        <X className="w-4 h-4 mr-2 text-blue-600" />
                                    ) : (
                                        <Upload className="w-4 h-4 mr-2 text-blue-600" />
                                    )}
                                    <span className="font-medium">
                                        {isConnecting ? 'Batal' : 'Masuk dengan Google'}
                                    </span>
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Google Drive Connected */}
                {isGoogleSignedIn && (
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-sm text-green-800 font-medium">
                                    {isSyncing ? 'Menyinkronkan...' : 'Google Drive Aktif'}
                                </p>
                                <p className="text-xs text-green-700 mt-1">
                                    {lastSyncTime ? `Sync: ${formatSyncTime(lastSyncTime)} • Backup otomatis aktif` : 'Auto-sync & backup aktif'}
                                </p>
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleManualSync()}
                                        disabled={isSyncing}
                                        className="border-green-300 text-green-700 hover:bg-green-50"
                                    >
                                        <RefreshCw className={`w-4 h-4 mr-1 ${isSyncing ? 'animate-spin' : ''}`} />
                                        Sync
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleGoogleSignOut}
                                        className="text-red-600 hover:bg-red-50"
                                    >
                                        <X className="w-4 h-4 mr-1" />
                                        Keluar
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Loading Google APIs */}
                {!isGoogleReady && (
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-2 text-gray-600">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-sm">Memuat Google Drive API...</span>
                        </div>
                    </div>
                )}


                {/* Info */}
                <p className="text-xs text-muted-foreground">
                    💡 Google Drive menyimpan 24 backup per-jam + 7 backup harian di cloud.
                </p>
            </CardContent>
        </Card>
    );
}
