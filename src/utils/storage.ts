import { AppData } from '../types';

export const saveToFile = (data: AppData) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `iv-drip-bar-data-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const loadFromFile = (): Promise<AppData> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    };
    
    input.click();
  });
};

export const getInitialData = (): AppData => {
  return {
    patients: [],
    transactions: [],
    soapNotes: [],
    inventory: [],
    inventoryTransactions: [],
    informedConsents: [],
    declinationLetters: [],
    sickLeaves: [],
    referralLetters: [],
    prescriptions: [],
    fitnessCertificates: [],
    triageQueue: [],
    doctorProfile: undefined,
    version: '2.0.0'
  };
};

// ===== File System Access API (Autosave) =====
// Works on secure contexts (https or localhost) in Chromium-based browsers

type FileHandle = FileSystemFileHandle;

async function verifyPermission(handle: FileHandle, readWrite: boolean) {
  const opts: any = readWrite ? { mode: 'readwrite' } : {};
  // @ts-ignore
  const q = await handle.queryPermission(opts);
  // @ts-ignore
  if (q === 'granted') return true;
  // @ts-ignore
  const r = await handle.requestPermission(opts);
  return r === 'granted';
}

export async function pickSaveFile(initialName = 'iv-drip-bar-data.json'): Promise<FileHandle> {
  // @ts-ignore
  const handle: FileHandle = await window.showSaveFilePicker({
    suggestedName: initialName,
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
  });
  await verifyPermission(handle, true);
  return handle;
}

export async function pickExistingJson(): Promise<FileHandle> {
  // @ts-ignore
  const [handle]: FileHandle[] = await window.showOpenFilePicker({
    multiple: false,
    types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
  });
  await verifyPermission(handle, true);
  return handle;
}

export async function writeToHandle(handle: FileHandle, data: AppData) {
  const writable = await handle.createWritable();
  await writable.write(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  await writable.close();
}

export async function readFromHandle(handle: FileHandle): Promise<AppData> {
  const file = await handle.getFile();
  const text = await file.text();
  return JSON.parse(text);
}

// Session-scoped handle cache
let cachedHandle: FileHandle | null = null;
export function setAutosaveHandle(h: FileHandle) { cachedHandle = h; }
export function getAutosaveHandle(): FileHandle | null { return cachedHandle; }
