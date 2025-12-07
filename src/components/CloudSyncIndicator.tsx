import { useEffect, useState } from 'react';
import { Button } from './ui/button';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
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
    shouldAllowSync,
    smartMergeAndSync
} from '../utils/googleDrive';
import { AppData } from '../types';

interface CloudSyncIndicatorProps {
    appData: AppData;
    onLoadFromCloud?: (data: AppData) => void;
}

export function CloudSyncIndicator({ appData, onLoadFromCloud }: CloudSyncIndicatorProps) {
    const [isGoogleReady, setIsGoogleReady] = useState(false);
    const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
    const [googleEmail, setGoogleEmail] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);

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
                            setAutoSyncEnabled(true);
                        } else {
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

    // Auto-sync to Google Drive with smart merge for offline additions
    useEffect(() => {
        if (autoSyncEnabled && isGoogleSignedIn) {
            const syncTimeout = setTimeout(async () => {
                const syncCheck = await shouldAllowSync(appData);

                if (!syncCheck.allow) {
                    // Instead of blocking, use smart merge to preserve cloud data + add new local items
                    console.log('Regular sync blocked, attempting smart merge...');
                    const mergeResult = await smartMergeAndSync(appData);

                    if (mergeResult && mergeResult.newItemsCount > 0) {
                        // Update app with merged data
                        if (onLoadFromCloud) {
                            onLoadFromCloud(mergeResult.merged as AppData);
                        }
                        console.log(`Smart merge completed: ${mergeResult.newItemsCount} new items added`);
                    }
                    return;
                }

                setIsSyncing(true);
                const success = await saveToGoogleDrive(appData);
                if (success) {
                    await smartCloudBackup(appData);
                }
                setIsSyncing(false);
            }, 2000);
            return () => clearTimeout(syncTimeout);
        }
    }, [appData, autoSyncEnabled, isGoogleSignedIn, onLoadFromCloud]);

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
                        toast.success(`Terhubung sebagai ${email} • ${mergeResult.newItemsCount} item digabung`);
                    } else {
                        toast.success(`Terhubung sebagai ${email}`);
                    }
                } else {
                    // No cloud data, upload local
                    await saveToGoogleDrive(appData);
                    toast.success(`Terhubung sebagai ${email}`);
                }
            }
        } catch (error) {
            console.error('Google sign in failed:', error);
            toast.error('Gagal masuk ke Google Drive');
        } finally {
            setIsConnecting(false);
        }
    };

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            const success = await saveToGoogleDrive(appData);
            if (success) {
                await smartCloudBackup(appData);
                toast.success('Sync berhasil');
            } else {
                toast.error('Sync gagal');
            }
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSignOut = () => {
        signOutFromGoogle();
        setIsGoogleSignedIn(false);
        setGoogleEmail(null);
        setAutoSyncEnabled(false);
        toast.success('Signed out dari Google Drive');
    };

    // Not ready yet
    if (!isGoogleReady) {
        return (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Loading...</span>
            </div>
        );
    }

    // Signed in
    if (isGoogleSignedIn) {
        return (
            <div className="flex items-center gap-2">
                <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-green-200 bg-green-50 text-xs cursor-pointer hover:bg-green-100"
                    onClick={handleSync}
                    title={`Connected: ${googleEmail}\nKlik untuk sync manual`}
                >
                    {isSyncing ? (
                        <RefreshCw className="w-3 h-3 text-green-600 animate-spin" />
                    ) : (
                        <CheckCircle2 className="w-3 h-3 text-green-600" />
                    )}
                    <span className="text-green-700">
                        {isSyncing ? 'Syncing...' : 'Cloud ✓'}
                    </span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSignOut}
                    className="h-6 px-2 text-xs text-red-600 hover:bg-red-50"
                >
                    Keluar
                </Button>
            </div>
        );
    }

    // Not signed in
    return (
        <Button
            variant="outline"
            size="sm"
            onClick={isConnecting ? () => setIsConnecting(false) : handleGoogleSignIn}
            className="h-7 px-3 text-xs border-blue-300 bg-blue-50 hover:bg-blue-100"
        >
            {isConnecting ? (
                <X className="w-3 h-3 mr-1.5 text-blue-600" />
            ) : (
                <CheckCircle2 className="w-3 h-3 mr-1.5 text-blue-600" />
            )}
            <span className="text-blue-700 font-medium">
                {isConnecting ? 'Batal' : 'Google Drive'}
            </span>
        </Button>
    );
}
