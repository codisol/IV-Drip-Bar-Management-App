import { useEffect, useRef, useState } from 'react';
import { AppData } from '../types';
import { Button } from './ui/button';
import { pickSaveFile, pickExistingJson, writeToHandle, readFromHandle, getAutosaveHandle, setAutosaveHandle } from '../utils/storage';

interface SaveStatusProps {
  appData: AppData;
  onLoadFromFile: (data: AppData) => void;
}

export function SaveStatus({ appData, onLoadFromFile }: SaveStatusProps) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'disconnected'>('disconnected');
  const debounceRef = useRef<number | null>(null);

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
    } catch {/* cancelled */}
  };

  const connectExisting = async () => {
    try {
      const handle = await pickExistingJson();
      setAutosaveHandle(handle);
      const data = await readFromHandle(handle);
      onLoadFromFile(data);
      setStatus('saved');
    } catch {/* cancelled */}
  };

  return (
    <div className="flex items-center gap-2">
      {status === 'saved' && <span className="text-green-600 text-sm">All changes saved</span>}
      {status === 'saving' && <span className="text-orange-600 text-sm">Saving…</span>}
      {status === 'disconnected' && <span className="text-gray-600 text-sm">Not connected</span>}
      <Button size="sm" variant="outline" onClick={connectNewFile}>Choose Save File</Button>
      <Button size="sm" variant="ghost" onClick={connectExisting}>Open Existing</Button>
    </div>
  );
}





