import { useState, useEffect, useRef, useCallback } from 'react';
import { AppData, Patient, SoapNote, InventoryItem, InventoryTransaction, InformedConsent, DeclinationLetter, SickLeave, ReferralLetter, Prescription, FitnessCertificate, TriageEntry, Transaction, DoctorProfile as DoctorProfileType } from './types';
import { saveToFile, loadFromFile, getInitialData } from './utils/storage';
import { saveToDB, loadFromDB, dumpAllData, forceBackup, loadBackupFromDB } from './utils/db';
import { PatientManagement } from './components/PatientManagement';
import { SoapNotes } from './components/SoapNotes';
import { InventoryManagement } from './components/InventoryManagement';
import { Documents } from './components/Documents';
import { Triage } from './components/Triage';
import { Transactions } from './components/Transactions';
import { FinancialReports } from './components/FinancialReports';
import { DoctorProfile } from './components/DoctorProfile';
import { PatientTransactionTrace } from './components/PatientTransactionTrace';
import { Analytics } from './components/Analytics';
import { Button } from './components/ui/button';
import { CloudSyncIndicator } from './components/CloudSyncIndicator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { toast, Toaster } from 'sonner';
import { Save, Upload, Users, FileText, Package, Activity, FileCheck2, ClipboardList, DollarSign, Cake, UserCircle, SearchCheck, BarChart3, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function App() {
  const [appData, setAppData] = useState<AppData>(getInitialData());
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showTransactionTrace, setShowTransactionTrace] = useState(false);
  const [inventoryTabState, setInventoryTabState] = useState<{ tab: string; filterId?: string; filterDate?: string }>({ tab: 'inventory' });
  const [soapNotesFilter, setSoapNotesFilter] = useState<{ patientId?: string; date?: string }>({});
  const [documentsFilter, setDocumentsFilter] = useState<{ documentId?: string; documentType?: string; date?: string }>({});

  // Database save status tracking
  const [dbSaveStatus, setDbSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveFailCountRef = useRef(0);
  const hasTriggeredAutoDownloadRef = useRef(false);

  // Auto-download backup when saves fail repeatedly
  const triggerEmergencyBackup = useCallback(() => {
    if (hasTriggeredAutoDownloadRef.current) return;
    hasTriggeredAutoDownloadRef.current = true;

    toast.error('CRITICAL: Auto-saving your data to file due to repeated database failures!', {
      duration: 10000,
    });

    // Force download current data
    saveToFile(appData);
  }, [appData]);

  // Load from IndexedDB on mount (with cloud-first logic if signed in)
  useEffect(() => {
    const initData = async () => {
      try {
        // First, load from IndexedDB (cache)
        let localData = await loadFromDB();

        // Apply migrations to local data
        if (localData) {
          if (!localData.transactions) localData.transactions = [];
          if (!localData.referralLetters) localData.referralLetters = [];
          if (!localData.prescriptions) localData.prescriptions = [];
          if (!localData.fitnessCertificates) localData.fitnessCertificates = [];
          if (!localData.doctorProfile) localData.doctorProfile = undefined;
          if (localData.inventory) {
            localData.inventory = localData.inventory.map((item: InventoryItem & { genericName?: string }) => ({
              ...item,
              brandName: item.brandName || item.genericName || 'N/A'
            }));
          }
        }

        // Check if we should merge with Google Drive (if signed in)
        // This runs after a short delay to let Google APIs initialize
        setTimeout(async () => {
          try {
            const { isSignedIn, smartMergeAndSync } = await import('./utils/googleDrive');

            if (isSignedIn()) {
              // Use smart merge: cloud as base + add new local items
              const mergeResult = await smartMergeAndSync(localData || {});

              if (mergeResult) {
                const mergedData = mergeResult.merged as AppData;

                // Apply migrations to merged data
                if (!mergedData.transactions) mergedData.transactions = [];
                if (!mergedData.referralLetters) mergedData.referralLetters = [];
                if (!mergedData.prescriptions) mergedData.prescriptions = [];
                if (!mergedData.fitnessCertificates) mergedData.fitnessCertificates = [];
                if (!mergedData.doctorProfile) mergedData.doctorProfile = undefined;

                setAppData(mergedData);

                // Show appropriate message based on what happened
                if (mergeResult.newItemsCount > 0) {
                  toast.success(`Sync: ${mergeResult.newItemsCount} item lokal baru digabung ke cloud`);
                } else {
                  console.log('Smart merge: no new local items, using cloud data');
                }

                // Also update IndexedDB cache with merged data
                await saveToDB(mergedData);
              }
            }
          } catch (err) {
            console.error('Cloud sync failed:', err);
          }
        }, 2000); // Wait for Google APIs to init

        if (localData) {
          setAppData(localData);
          setDbSaveStatus('saved');
          toast.success('Session loaded');
        }
      } catch (error) {
        console.error('Failed to load saved data', error);
        toast.error('Failed to load session data');
      } finally {
        setIsLoaded(true);
      }
    };

    initData();
  }, []);

  // Auto-save to IndexedDB with error handling
  useEffect(() => {
    if (isLoaded) {
      setDbSaveStatus('saving');
      saveToDB(appData)
        .then(() => {
          setDbSaveStatus('saved');
          saveFailCountRef.current = 0; // Reset fail count on success
          hasTriggeredAutoDownloadRef.current = false; // Allow future auto-downloads
        })
        .catch(err => {
          console.error('Auto-save failed:', err);
          setDbSaveStatus('error');
          saveFailCountRef.current += 1;

          if (saveFailCountRef.current >= 3) {
            triggerEmergencyBackup();
          } else {
            toast.error(
              <div className="flex flex-col gap-2">
                <span>Failed to save to browser database! ({saveFailCountRef.current}/3)</span>
                <Button size="sm" variant="destructive" onClick={() => saveToFile(appData)}>
                  Download Backup Now
                </Button>
              </div>,
              { duration: 10000 }
            );
          }
        });
    }
  }, [appData, isLoaded, triggerEmergencyBackup]);

  // Reset state when navigating away
  useEffect(() => {
    if (activeTab !== 'inventory') {
      setInventoryTabState({ tab: 'inventory' });
    }
    if (activeTab !== 'soap') {
      setSoapNotesFilter({});
    }
    if (activeTab !== 'documents') {
      setDocumentsFilter({});
    }
  }, [activeTab]);

  const handleSaveToFile = () => {
    saveToFile(appData);
    toast.success('Data exported successfully');
  };

  const handleLoadFromFile = async () => {
    try {
      const data = await loadFromFile();
      setAppData(data);
      toast.success('Data imported successfully');
    } catch (error) {
      toast.error('Failed to import data');
    }
  };

  const handleAddPatient = (patient: Patient) => {
    setAppData(prev => ({
      ...prev,
      patients: [...prev.patients, patient]
    }));
  };

  const handleUpdatePatient = (patient: Patient) => {
    setAppData(prev => ({
      ...prev,
      patients: prev.patients.map(p => p.id === patient.id ? patient : p)
    }));
  };

  const handleAddTransaction = (transaction: Transaction) => {
    setAppData(prev => ({
      ...prev,
      transactions: [...prev.transactions, transaction]
    }));
  };

  const handleUpdateTransaction = (transaction: Transaction) => {
    setAppData(prev => ({
      ...prev,
      transactions: prev.transactions.map(t => t.id === transaction.id ? transaction : t)
    }));
  };

  const handleStockOut = (inventoryItemId: string, quantity: number, transactionId: string, batchNumber: string) => {
    // Update inventory quantity
    setAppData(prev => ({
      ...prev,
      inventory: prev.inventory.map(item =>
        item.id === inventoryItemId
          ? { ...item, quantity: item.quantity - quantity }
          : item
      ),
      inventoryTransactions: [
        ...prev.inventoryTransactions,
        {
          id: crypto.randomUUID(),
          inventoryItemId,
          type: 'OUT',
          quantity,
          date: new Date().toISOString(),
          transactionId,
          batchNumber
        }
      ]
    }));
  };

  const handleAddSoapNote = (note: SoapNote) => {
    setAppData(prev => ({
      ...prev,
      soapNotes: [...prev.soapNotes, note]
    }));
  };

  const handleUpdateSoapNote = (note: SoapNote) => {
    setAppData(prev => ({
      ...prev,
      soapNotes: prev.soapNotes.map(s => s.id === note.id ? note : s)
    }));
  };

  const handleAddInventoryItem = (item: InventoryItem) => {
    setAppData(prev => ({
      ...prev,
      inventory: [...prev.inventory, item]
    }));
  };

  const handleUpdateInventoryItem = (item: InventoryItem) => {
    setAppData(prev => ({
      ...prev,
      inventory: prev.inventory.map(i => i.id === item.id ? item : i)
    }));
  };

  const handleAddInventoryTransaction = (transaction: InventoryTransaction) => {
    setAppData(prev => ({
      ...prev,
      inventoryTransactions: [...prev.inventoryTransactions, transaction]
    }));
  };

  const handleAddInformedConsent = (consent: InformedConsent) => {
    setAppData(prev => ({
      ...prev,
      informedConsents: [...prev.informedConsents, consent]
    }));
  };

  const handleUpdateInformedConsent = (consent: InformedConsent) => {
    setAppData(prev => ({
      ...prev,
      informedConsents: prev.informedConsents.map(c => c.id === consent.id ? consent : c)
    }));
  };

  const handleAddDeclinationLetter = (letter: DeclinationLetter) => {
    setAppData(prev => ({
      ...prev,
      declinationLetters: [...prev.declinationLetters, letter]
    }));
  };

  const handleUpdateDeclinationLetter = (letter: DeclinationLetter) => {
    setAppData(prev => ({
      ...prev,
      declinationLetters: prev.declinationLetters.map(l => l.id === letter.id ? letter : l)
    }));
  };

  const handleAddSickLeave = (leave: SickLeave) => {
    setAppData(prev => ({
      ...prev,
      sickLeaves: [...prev.sickLeaves, leave]
    }));
  };

  const handleUpdateSickLeave = (leave: SickLeave) => {
    setAppData(prev => ({
      ...prev,
      sickLeaves: prev.sickLeaves.map(l => l.id === leave.id ? leave : l)
    }));
  };

  const handleAddReferralLetter = (letter: ReferralLetter) => {
    setAppData(prev => ({
      ...prev,
      referralLetters: [...prev.referralLetters, letter]
    }));
  };

  const handleUpdateReferralLetter = (letter: ReferralLetter) => {
    setAppData(prev => ({
      ...prev,
      referralLetters: prev.referralLetters.map(l => l.id === letter.id ? letter : l)
    }));
  };

  const handleAddPrescription = (prescription: Prescription) => {
    setAppData(prev => ({
      ...prev,
      prescriptions: [...prev.prescriptions, prescription]
    }));
  };

  const handleUpdatePrescription = (prescription: Prescription) => {
    setAppData(prev => ({
      ...prev,
      prescriptions: prev.prescriptions.map(p => p.id === prescription.id ? prescription : p)
    }));
  };

  const handleAddFitnessCertificate = (certificate: FitnessCertificate) => {
    setAppData(prev => ({
      ...prev,
      fitnessCertificates: [...prev.fitnessCertificates, certificate]
    }));
  };

  const handleUpdateFitnessCertificate = (certificate: FitnessCertificate) => {
    setAppData(prev => ({
      ...prev,
      fitnessCertificates: prev.fitnessCertificates.map(c => c.id === certificate.id ? certificate : c)
    }));
  };

  const handleAddTriage = (triage: TriageEntry) => {
    setAppData(prev => ({
      ...prev,
      triageQueue: [...prev.triageQueue, triage]
    }));
  };

  const handleUpdateTriage = (id: string, updates: Partial<TriageEntry>) => {
    setAppData(prev => ({
      ...prev,
      triageQueue: prev.triageQueue.map(t => t.id === id ? { ...t, ...updates } : t)
    }));
  };

  const handleSaveDoctorProfile = (profile: DoctorProfileType) => {
    setAppData(prev => ({
      ...prev,
      doctorProfile: profile
    }));
  };

  const getLowStockCount = () => {
    return appData.inventory.filter(item => item.quantity <= item.reorderLevel).length;
  };

  const getTodaySoapCount = () => {
    const today = new Date().toISOString().split('T')[0];
    return appData.soapNotes.filter(note => note.date.startsWith(today)).length;
  };

  const getExpiringItems = () => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return appData.inventory.filter(item => {
      if (!item.expiryDate) return false;
      if (item.quantity <= 0) return false; // Only show expiring items with stock
      const expiryDate = new Date(item.expiryDate);
      return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
    });
  };

  const getExpiredItems = () => {
    return appData.inventory.filter(item => {
      if (!item.expiryDate) return false;
      if (item.quantity <= 0) return false; // Only show expired items with stock
      const expiryDate = new Date(item.expiryDate);
      return expiryDate <= new Date();
    });
  };

  const getBirthdayPatients = () => {
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    return appData.patients.filter(patient => {
      if (!patient.dob) return false;
      const dob = new Date(patient.dob);
      return dob.getMonth() === todayMonth && dob.getDate() === todayDate;
    });
  };

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading application data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      <Toaster position="top-right" />

      {/* Header with calming gradient */}
      <header className="bg-gradient-to-r from-card via-background to-card border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground">IV Drip Bar Management System</h1>
              <p className="text-muted-foreground">Comprehensive practice management solution</p>
            </div>
            <div className="flex gap-3 items-center">
              {/* Database Save Status Indicator */}
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border text-xs">
                {dbSaveStatus === 'saving' && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                    <span className="text-yellow-600">Menyimpan...</span>
                  </>
                )}
                {dbSaveStatus === 'saved' && (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    <span className="text-green-600">Tersimpan</span>
                  </>
                )}
                {dbSaveStatus === 'error' && (
                  <>
                    <AlertTriangle className="w-3 h-3 text-red-600" />
                    <span className="text-red-600">Gagal Simpan!</span>
                  </>
                )}
                {dbSaveStatus === 'idle' && (
                  <>
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <span className="text-gray-500">Idle</span>
                  </>
                )}
              </div>
              <CloudSyncIndicator appData={appData} onLoadFromCloud={(d) => setAppData(d)} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-10 mb-6">
            <TabsTrigger value="dashboard">
              <Activity className="w-4 h-4 mr-2" />
              Dasbor
            </TabsTrigger>
            <TabsTrigger value="triage">
              <ClipboardList className="w-4 h-4 mr-2" />
              Triage
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <DollarSign className="w-4 h-4 mr-2" />
              Transaksi
            </TabsTrigger>
            <TabsTrigger value="patients">
              <Users className="w-4 h-4 mr-2" />
              Pasien
            </TabsTrigger>
            <TabsTrigger value="soap">
              <FileText className="w-4 h-4 mr-2" />
              Catatan SOAP
            </TabsTrigger>
            <TabsTrigger value="documents">
              <FileCheck2 className="w-4 h-4 mr-2" />
              Dokumen Medis
            </TabsTrigger>
            <TabsTrigger value="inventory">
              <Package className="w-4 h-4 mr-2" />
              Inventori
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="w-4 h-4 mr-2" />
              Analitik
            </TabsTrigger>
            <TabsTrigger value="financial">
              <DollarSign className="w-4 h-4 mr-2" />
              Keuangan
            </TabsTrigger>
            <TabsTrigger value="profile">
              <UserCircle className="w-4 h-4 mr-2" />
              Profile
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card className="card-hover hover:border-primary/50 transition-all duration-300 bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <CardDescription>Triage Queue</CardDescription>
                  <CardTitle className="text-foreground">{appData.triageQueue.filter(t => t.status === 'Waiting').length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Patients waiting</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover hover:border-primary/50 transition-all duration-300 bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <CardDescription>Total Patients</CardDescription>
                  <CardTitle className="text-foreground">{appData.patients.length}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Registered</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover hover:border-primary/50 transition-all duration-300 bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <CardDescription>Today's SOAP Notes</CardDescription>
                  <CardTitle className="text-foreground">{getTodaySoapCount()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">Consultations</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="card-hover hover:border-primary/50 transition-all duration-300 bg-gradient-to-br from-card to-secondary/20">
                <CardHeader className="pb-3">
                  <CardDescription>Low Stock Alerts</CardDescription>
                  <CardTitle className="text-foreground">{getLowStockCount()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-destructive" />
                    <span className="text-muted-foreground">Requires attention</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Cake className="w-5 h-5" />
                    Birthdays Today
                  </CardTitle>
                  <CardDescription>Patients celebrating today</CardDescription>
                </CardHeader>
                <CardContent>
                  {getBirthdayPatients().length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No birthdays today</p>
                  ) : (
                    <div className="space-y-3">
                      {getBirthdayPatients().map(patient => (
                        <div key={patient.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <div>
                            <p>{patient.name}</p>
                            <p className="text-gray-600">{patient.phone}</p>
                          </div>
                          <Cake className="w-5 h-5 text-blue-600" />
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Latest 5 transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  {appData.transactions.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">No transactions yet</p>
                  ) : (
                    <div className="space-y-3">
                      {appData.transactions.slice(-5).reverse().map(transaction => (
                        <div key={transaction.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <p>{transaction.patientName}</p>
                            <p className="text-gray-600 text-xs">{new Date(transaction.time).toLocaleString()}</p>
                          </div>
                          <div className="text-right">
                            <p>Rp {transaction.totalPayment.toLocaleString()}</p>
                            <p className="text-xs text-gray-600">{transaction.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Inventory Alerts</CardTitle>
                  <CardDescription>Items at risk of expiry or depletion</CardDescription>
                </CardHeader>
                <CardContent>
                  {getExpiredItems().length === 0 && getExpiringItems().length === 0 && getLowStockCount() === 0 ? (
                    <p className="text-gray-500 text-center py-8">No alerts</p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {getExpiredItems().map(item => (
                        <div key={`expired-${item.id}`} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-red-900">{item.genericName}</p>
                              <p className="text-red-700 text-xs">Batch: {item.batchNumber}</p>
                              <p className="text-red-600 text-xs">EXPIRED: {new Date(item.expiryDate).toLocaleDateString()}</p>
                            </div>
                            <span className="px-2 py-1 bg-red-600 text-white rounded text-xs">EXPIRED</span>
                          </div>
                        </div>
                      ))}
                      {getExpiringItems().map(item => (
                        <div key={`expiring-${item.id}`} className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="text-orange-900">{item.genericName}</p>
                              <p className="text-orange-700 text-xs">Batch: {item.batchNumber}</p>
                              <p className="text-orange-600 text-xs">Expires: {new Date(item.expiryDate).toLocaleDateString()}</p>
                            </div>
                            <span className="px-2 py-1 bg-orange-600 text-white rounded text-xs">EXPIRING</span>
                          </div>
                        </div>
                      ))}
                      {appData.inventory
                        .filter(item => item.quantity > 0 && item.quantity <= item.reorderLevel && !getExpiredItems().includes(item) && !getExpiringItems().includes(item))
                        .map(item => (
                          <div key={`lowstock-${item.id}`} className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-yellow-900">{item.genericName}</p>
                                <p className="text-yellow-700 text-xs">Batch: {item.batchNumber}</p>
                                <p className="text-yellow-600 text-xs">Stock: {item.quantity} (Reorder at: {item.reorderLevel})</p>
                              </div>
                              <span className="px-2 py-1 bg-yellow-600 text-white rounded text-xs">LOW STOCK</span>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Button className="h-20" onClick={() => setActiveTab('triage')}>
                  <ClipboardList className="w-5 h-5 mr-2" />
                  Add to Triage
                </Button>
                <Button className="h-20" onClick={() => setActiveTab('patients')}>
                  <Users className="w-5 h-5 mr-2" />
                  Register New Patient
                </Button>
                <Button className="h-20" onClick={() => setActiveTab('transactions')}>
                  <DollarSign className="w-5 h-5 mr-2" />
                  New Transaction
                </Button>
                <Button className="h-20" onClick={() => setActiveTab('inventory')}>
                  <Package className="w-5 h-5 mr-2" />
                  Manage Inventory
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="triage">
            <Triage
              triageQueue={appData.triageQueue}
              patients={appData.patients}
              onAddTriage={handleAddTriage}
              onUpdateTriage={handleUpdateTriage}
              onQuickRegisterPatient={handleAddPatient}
              onCreateTransaction={handleAddTransaction}
            />
          </TabsContent>

          <TabsContent value="transactions">
            <Transactions
              transactions={appData.transactions}
              patients={appData.patients}
              inventory={appData.inventory}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onStockOut={handleStockOut}
            />
          </TabsContent>

          <TabsContent value="patients">
            <PatientManagement
              patients={appData.patients}
              onAddPatient={handleAddPatient}
              onUpdatePatient={handleUpdatePatient}
            />
          </TabsContent>

          <TabsContent value="soap">
            <SoapNotes
              patients={appData.patients}
              transactions={appData.transactions}
              soapNotes={appData.soapNotes}
              doctorProfile={appData.doctorProfile}
              onAddSoapNote={handleAddSoapNote}
              onUpdateSoapNote={handleUpdateSoapNote}
              initialFilterPatientId={soapNotesFilter.patientId}
              initialFilterDate={soapNotesFilter.date}
            />
          </TabsContent>

          <TabsContent value="documents">
            <Documents
              transactions={appData.transactions}
              patients={appData.patients}
              informedConsents={appData.informedConsents}
              declinationLetters={appData.declinationLetters}
              sickLeaves={appData.sickLeaves}
              referralLetters={appData.referralLetters}
              prescriptions={appData.prescriptions}
              fitnessCertificates={appData.fitnessCertificates}
              doctorProfile={appData.doctorProfile}
              onAddInformedConsent={handleAddInformedConsent}
              onUpdateInformedConsent={handleUpdateInformedConsent}
              onAddDeclinationLetter={handleAddDeclinationLetter}
              onUpdateDeclinationLetter={handleUpdateDeclinationLetter}
              onAddSickLeave={handleAddSickLeave}
              onUpdateSickLeave={handleUpdateSickLeave}
              onAddReferralLetter={handleAddReferralLetter}
              onUpdateReferralLetter={handleUpdateReferralLetter}
              onAddPrescription={handleAddPrescription}
              onUpdatePrescription={handleUpdatePrescription}
              onAddFitnessCertificate={handleAddFitnessCertificate}
              onUpdateFitnessCertificate={handleUpdateFitnessCertificate}
              initialDocumentId={documentsFilter.documentId}
              initialDocumentType={documentsFilter.documentType}
              initialFilterDate={documentsFilter.date}
            />
          </TabsContent>

          <TabsContent value="inventory">
            <InventoryManagement
              inventory={appData.inventory}
              transactions={appData.inventoryTransactions}
              onAddInventoryItem={handleAddInventoryItem}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              onAddTransaction={handleAddInventoryTransaction}
              initialTab={inventoryTabState.tab}
              filterTransactionId={inventoryTabState.filterId}
              filterDate={inventoryTabState.filterDate}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <Analytics
              transactions={appData.transactions}
              patients={appData.patients}
              inventory={appData.inventory}
              soapNotes={appData.soapNotes}
            />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialReports transactions={appData.transactions} />
          </TabsContent>

          <TabsContent value="profile">
            <DoctorProfile
              profile={appData.doctorProfile}
              onSaveProfile={handleSaveDoctorProfile}
              appData={appData}
              onLoadBackup={(data) => {
                setAppData(data);
                toast.success('Backup restored! Your data has been rolled back.');
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Floating Action Button for Transaction Trace */}
      <Button
        onClick={() => setShowTransactionTrace(true)}
        className="fixed bottom-8 right-8 h-16 w-16 rounded-full shadow-2xl hover:shadow-primary/50 hover:scale-110 transition-all duration-300 z-40 p-0 glow-teal"
        size="icon"
        title="Patient Transaction Trace"
      >
        <SearchCheck className="h-8 w-8" />
      </Button>

      {/* Patient Transaction Trace Dialog */}
      <PatientTransactionTrace
        open={showTransactionTrace}
        onOpenChange={setShowTransactionTrace}
        patients={appData.patients}
        transactions={appData.transactions}
        soapNotes={appData.soapNotes}
        inventory={appData.inventory}
        inventoryTransactions={appData.inventoryTransactions}
        informedConsents={appData.informedConsents}
        declinationLetters={appData.declinationLetters}
        sickLeaves={appData.sickLeaves}
        referralLetters={appData.referralLetters}
        prescriptions={appData.prescriptions}
        fitnessCertificates={appData.fitnessCertificates}
        triageQueue={appData.triageQueue}
        onNavigateToSection={(section, filterId) => {
          // Helper function to safely get date string
          const getDateString = (dateValue: string | Date | undefined): string | undefined => {
            if (!dateValue) return undefined;
            try {
              const date = new Date(dateValue);
              if (isNaN(date.getTime())) return undefined;
              return date.toISOString().split('T')[0];
            } catch {
              return undefined;
            }
          };

          if (section === 'inventory' && filterId) {
            // Find the transaction to get its date
            const transaction = appData.transactions.find(t => t.id === filterId);
            const filterDate = transaction ? getDateString(transaction.time) : undefined;
            // Set the inventory tab to stock-movement and pass the transaction ID and date filter
            setInventoryTabState({ tab: 'stock-movement', filterId, filterDate });
            setActiveTab('inventory');
          } else if (section === 'soap' && filterId) {
            // Find the SOAP note and extract patient ID and date
            const soapNote = appData.soapNotes.find(s => s.id === filterId);
            if (soapNote) {
              const transaction = appData.transactions.find(t => t.id === soapNote.transactionId);
              if (transaction) {
                const filterDate = getDateString(transaction.time);
                setSoapNotesFilter({
                  patientId: transaction.patientId,
                  date: filterDate
                });
              }
            }
            setActiveTab('soap');
          } else if (section === 'documents' && filterId) {
            // filterId format: "documentType:documentId"
            const [documentType, documentId] = filterId.split(':');
            // Find the document to get its transaction date
            let filterDate: string | undefined = undefined;
            const allDocuments = [
              ...appData.informedConsents.map(d => ({ ...d, type: 'informed_consent' })),
              ...appData.declinationLetters.map(d => ({ ...d, type: 'declination_letter' })),
              ...appData.sickLeaves.map(d => ({ ...d, type: 'sick_leave' })),
              ...appData.referralLetters.map(d => ({ ...d, type: 'referral_letter' })),
              ...appData.prescriptions.map(d => ({ ...d, type: 'prescription' })),
              ...appData.fitnessCertificates.map(d => ({ ...d, type: 'fitness_certificate' }))
            ];
            const doc = allDocuments.find(d => d.id === documentId && d.type === documentType);
            if (doc) {
              const transaction = appData.transactions.find(t => t.id === doc.transactionId);
              if (transaction) {
                filterDate = getDateString(transaction.time);
              }
            }
            setDocumentsFilter({
              documentId,
              documentType,
              date: filterDate
            });
            setActiveTab('documents');
          } else {
            setActiveTab(section);
          }
          setShowTransactionTrace(false);
          toast.info(`Navigating to ${section}${filterId ? ` - filtering results` : ''}`);
        }}
      />
    </div>
  );
}
