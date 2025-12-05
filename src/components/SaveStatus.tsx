import { useEffect, useRef, useState } from 'react';
import { AppData } from '../types';
import { Button } from './ui/button';
import { pickSaveFile, pickExistingJson, writeToHandle, readFromHandle, getAutosaveHandle, setAutosaveHandle } from '../utils/storage';
import { loadFromDB, forceBackup } from '../utils/db';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, FileText } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface SaveStatusProps {
  appData: AppData;
  onLoadFromFile: (data: AppData) => void;
}

// Helper to estimate data "timestamp" based on content
const estimateDataTimestamp = (data: AppData): Date | null => {
  const timestamps: number[] = [];

  // Collect all timestamps from various sources
  data.patients?.forEach(p => {
    if (p.createdAt) timestamps.push(new Date(p.createdAt).getTime());
  });
  data.transactions?.forEach(t => {
    if (t.createdAt) timestamps.push(new Date(t.createdAt).getTime());
    if (t.paidAt) timestamps.push(new Date(t.paidAt).getTime());
  });
  data.soapNotes?.forEach(s => {
    if (s.date) timestamps.push(new Date(s.date).getTime());
    s.versions?.forEach(v => {
      if (v.editedAt) timestamps.push(new Date(v.editedAt).getTime());
    });
  });
  data.inventoryTransactions?.forEach(it => {
    if (it.date) timestamps.push(new Date(it.date).getTime());
  });

  if (timestamps.length === 0) return null;

  // Return the most recent timestamp
  return new Date(Math.max(...timestamps.filter(t => !isNaN(t))));
};

// Format date for display
const formatDate = (date: Date): string => {
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export function SaveStatus({ appData, onLoadFromFile }: SaveStatusProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'disconnected'>('disconnected');
  const debounceRef = useRef<number | null>(null);

  // Confirmation dialog state
  const [showWarning, setShowWarning] = useState(false);
  const [pendingFileData, setPendingFileData] = useState<AppData | null>(null);
  const [pendingHandle, setPendingHandle] = useState<FileSystemFileHandle | null>(null);
  const [warningDetails, setWarningDetails] = useState<{ fileDate: string; currentDate: string } | null>(null);

  useEffect(() => {
    if (!getAutosaveHandle()) {
      setStatus('disconnected');
      return;
    }
    // debounce writes to reduce churn
    setStatus('saving');
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const handle = getAutosaveHandle();
        if (handle) {
          await writeToHandle(handle, appData);
          setStatus('saved');
        }
      } catch {
        setStatus('disconnected');
      }
    }, 800);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [appData]);

  const connectNewFile = async () => {
    try {
      const handle = await pickSaveFile();
      setAutosaveHandle(handle);
      await writeToHandle(handle, appData);
      setStatus('saved');
      toast.success('Connected to new save file');
    } catch {/* cancelled */ }
  };

  const connectExisting = async () => {
    try {
      // Step 1: Pick the file
      const handle = await pickExistingJson();
      const fileData = await readFromHandle(handle);

      // Step 2: ALWAYS create backup of current IndexedDB data FIRST
      toast.loading('Creating safety backup...', { id: 'backup' });
      const backupSuccess = await forceBackup();
      if (backupSuccess) {
        toast.success('Safety backup created', { id: 'backup' });
      } else {
        toast.info('No existing data to backup', { id: 'backup' });
      }

      // Step 3: Compare timestamps
      const currentData = await loadFromDB();

      if (currentData) {
        const fileTimestamp = estimateDataTimestamp(fileData);
        const currentTimestamp = estimateDataTimestamp(currentData);

        if (fileTimestamp && currentTimestamp && fileTimestamp < currentTimestamp) {
          // FILE IS OLDER - Show warning dialog!
          setPendingFileData(fileData);
          setPendingHandle(handle);
          setWarningDetails({
            fileDate: formatDate(fileTimestamp),
            currentDate: formatDate(currentTimestamp)
          });
          setShowWarning(true);
          return; // Wait for user confirmation
        }
      }

      // Step 4: If no warning needed, proceed normally
      setAutosaveHandle(handle);
      onLoadFromFile(fileData);
      setStatus('saved');
      toast.success('File loaded successfully');

    } catch (err) {
      // User cancelled or error
      console.error('Failed to open file:', err);
    }
  };

  const confirmLoadOlderFile = () => {
    if (pendingFileData && pendingHandle) {
      setAutosaveHandle(pendingHandle);
      onLoadFromFile(pendingFileData);
      setStatus('saved');
      toast.success('Older file loaded (backup saved)');
    }
    setShowWarning(false);
    setPendingFileData(null);
    setPendingHandle(null);
    setWarningDetails(null);
  };

  const cancelLoadOlderFile = () => {
    setShowWarning(false);
    setPendingFileData(null);
    setPendingHandle(null);
    setWarningDetails(null);
    toast.info('File load cancelled');
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {status === 'saved' && <span className="text-green-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />All changes saved</span>}
        {status === 'saving' && <span className="text-orange-600 text-sm">Saving…</span>}
        {status === 'disconnected' && <span className="text-gray-600 text-sm">Not connected</span>}
        <Button size="sm" variant="outline" onClick={connectNewFile}>Choose Save File</Button>
        <Button size="sm" variant="ghost" onClick={connectExisting}>Open Existing</Button>
      </div>

      {/* Warning Dialog for Older File */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <FileText className="w-5 h-5" />
              File Lebih Lama Terdeteksi!
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-orange-800">
                    <p className="font-medium">File yang Anda pilih lebih LAMA dari data saat ini!</p>
                    <p className="mt-1">Memuat file ini akan menggantikan data terbaru Anda.</p>
                  </div>
                </div>

                {warningDetails && (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-muted-foreground">File yang dipilih:</span>
                      <span className="font-medium text-orange-600">{warningDetails.fileDate}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-gray-50 rounded">
                      <span className="text-muted-foreground">Data saat ini:</span>
                      <span className="font-medium text-green-600">{warningDetails.currentDate}</span>
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-800">
                    <strong>Backup otomatis sudah dibuat.</strong> Anda bisa restore dari menu Profile → Backup & Restore jika perlu.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={cancelLoadOlderFile}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLoadOlderFile}
              className="bg-orange-600 hover:bg-orange-700"
            >
              Tetap Muat File Lama
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

