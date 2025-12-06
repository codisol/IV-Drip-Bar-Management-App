import { useState, useEffect } from 'react';
import { DoctorProfile as DoctorProfileType } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { UserCircle, Building2, MapPin, FileText, Stethoscope, Phone, Mail, Download, AlertTriangle, RefreshCw, History, Clock, Calendar, Upload as CloudUpload } from 'lucide-react';
import { toast } from 'sonner';
import { dumpAllData, forceBackup, getAllBackups, loadBackupByKey, BackupInfo } from '../utils/db';
import { listCloudBackups, restoreFromCloudBackup, CloudBackupInfo, isSignedIn, createCloudBackup } from '../utils/googleDrive';
import { AppData } from '../types';
import { StorageIndicator } from './StorageIndicator';

interface DoctorProfileProps {
  profile?: DoctorProfileType;
  onSaveProfile: (profile: DoctorProfileType) => void;
  onLoadBackup?: (data: AppData) => void;
  appData: AppData;
}

export function DoctorProfile({ profile, onSaveProfile, onLoadBackup, appData }: DoctorProfileProps) {
  const [formData, setFormData] = useState<DoctorProfileType>(
    profile || {
      doctorName: '',
      clinicName: '',
      clinicAddress: '',
      permitCode: '',
      specialization: '',
      phoneNumber: '',
      email: ''
    }
  );
  const [isRescuing, setIsRescuing] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [hourlyBackups, setHourlyBackups] = useState<BackupInfo[]>([]);
  const [dailyBackups, setDailyBackups] = useState<BackupInfo[]>([]);
  const [cloudBackups, setCloudBackups] = useState<CloudBackupInfo[]>([]);
  const [cloudHourlyBackups, setCloudHourlyBackups] = useState<CloudBackupInfo[]>([]);
  const [cloudDailyBackups, setCloudDailyBackups] = useState<CloudBackupInfo[]>([]);
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [isLoadingCloudBackups, setIsLoadingCloudBackups] = useState(false);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Load backup list on mount and poll for cloud connection
  useEffect(() => {
    loadBackupList();
    checkCloudConnection();

    // Poll for cloud connection changes every 3 seconds
    const pollInterval = setInterval(() => {
      const connected = isSignedIn();
      if (connected !== isCloudConnected) {
        setIsCloudConnected(connected);
        if (connected) {
          loadCloudBackupList();
        }
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isCloudConnected]);

  const loadBackupList = async () => {
    setIsLoadingBackups(true);
    try {
      const { hourly, daily } = await getAllBackups();
      setHourlyBackups(hourly);
      setDailyBackups(daily);
    } catch (error) {
      console.error('Failed to load backup list:', error);
    } finally {
      setIsLoadingBackups(false);
    }
  };

  const checkCloudConnection = async () => {
    const connected = isSignedIn();
    setIsCloudConnected(connected);
    if (connected) {
      await loadCloudBackupList();
    }
  };

  const loadCloudBackupList = async () => {
    setIsLoadingCloudBackups(true);
    try {
      const backups = await listCloudBackups();
      setCloudBackups(backups);
      // Separate into hourly and daily
      setCloudHourlyBackups(backups.filter(b => b.type === 'hourly'));
      setCloudDailyBackups(backups.filter(b => b.type === 'daily'));
    } catch (error) {
      console.error('Failed to load cloud backups:', error);
    } finally {
      setIsLoadingCloudBackups(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.doctorName || !formData.clinicName || !formData.clinicAddress || !formData.permitCode) {
      toast.error('Please fill in all required fields');
      return;
    }

    onSaveProfile(formData);
    toast.success('Doctor profile saved successfully');
  };

  const handleChange = (field: keyof DoctorProfileType, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRescueData = async () => {
    setIsRescuing(true);
    try {
      const allData = await dumpAllData();
      const json = JSON.stringify(allData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `iv-drip-bar-RESCUE-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const keys = Object.keys(allData);
      toast.success(`Rescued data with ${keys.length} entries`);
    } catch (error) {
      console.error('Rescue failed:', error);
      toast.error('Failed to rescue data from database');
    } finally {
      setIsRescuing(false);
    }
  };

  const handleForceBackup = async () => {
    setIsBackingUp(true);
    try {
      const success = await forceBackup();
      if (success) {
        toast.success('Backup created successfully!');
        await loadBackupList();
      } else {
        toast.error('Nothing to backup - no data found');
      }
    } catch (error) {
      console.error('Force backup failed:', error);
      toast.error('Failed to create backup');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleForceCloudBackup = async () => {
    setIsBackingUp(true);
    try {
      const success = await createCloudBackup(appData, 'hourly');
      if (success) {
        toast.success('Cloud backup created!');
        await loadCloudBackupList();
      } else {
        toast.error('Failed to create cloud backup');
      }
    } catch (error) {
      console.error('Cloud backup failed:', error);
      toast.error('Cloud backup failed');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestoreBackup = async (key: string, label: string) => {
    if (!onLoadBackup) {
      toast.error('Restore function not available');
      return;
    }

    setRestoringKey(key);
    try {
      const backup = await loadBackupByKey(key);
      if (backup) {
        onLoadBackup(backup);
        toast.success(`Restored to ${label}!`);
      } else {
        toast.error('Backup not found');
      }
    } catch (error) {
      console.error('Restore backup failed:', error);
      toast.error('Failed to restore backup');
    } finally {
      setRestoringKey(null);
    }
  };

  const handleRestoreCloudBackup = async (backup: CloudBackupInfo) => {
    if (!onLoadBackup) {
      toast.error('Restore function not available');
      return;
    }

    setRestoringKey(backup.id);
    try {
      const data = await restoreFromCloudBackup<AppData>(backup.id);
      if (data) {
        onLoadBackup(data);
        toast.success(`Restored from cloud: ${backup.name}`);
      } else {
        toast.error('Failed to load cloud backup');
      }
    } catch (error) {
      console.error('Cloud restore failed:', error);
      toast.error('Failed to restore from cloud');
    } finally {
      setRestoringKey(null);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getTimeAgo = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Baru saja';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    if (diffHours < 24) return `${diffHours} jam lalu`;
    return `${diffDays} hari lalu`;
  };

  const renderBackupList = (backups: BackupInfo[], emptyMessage: string) => {
    if (isLoadingBackups) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
          Memuat daftar backup...
        </div>
      );
    }

    if (backups.length === 0) {
      return (
        <div className="p-4 text-center text-muted-foreground">
          {emptyMessage}
        </div>
      );
    }

    return backups.map((backup) => (
      <div
        key={backup.key}
        className="flex items-center justify-between p-3 hover:bg-gray-50 border-b last:border-b-0"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
            {backup.type === 'hourly' ? (
              <Clock className="w-4 h-4" />
            ) : (
              <Calendar className="w-4 h-4" />
            )}
          </div>
          <div>
            <p className="font-medium text-sm">
              {backup.label}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatDate(backup.timestamp)} • {getTimeAgo(backup.timestamp)}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRestoreBackup(backup.key, backup.label)}
          disabled={restoringKey !== null || !onLoadBackup}
        >
          {restoringKey === backup.key ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            'Restore'
          )}
        </Button>
      </div>
    ));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCircle className="w-6 h-6" />
            Doctor & Clinic Profile
          </CardTitle>
          <CardDescription>
            Register your professional details. This information will be automatically included in all medical documents.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Doctor Information */}
            <div className="space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Stethoscope className="w-5 h-5" />
                Doctor Information
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doctorName">
                    Doctor Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="doctorName"
                    value={formData.doctorName}
                    onChange={(e) => handleChange('doctorName', e.target.value)}
                    placeholder="Dr. John Doe"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="permitCode">
                    Permit Code / License Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="permitCode"
                    value={formData.permitCode}
                    onChange={(e) => handleChange('permitCode', e.target.value)}
                    placeholder="MD-12345"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialization">Specialization</Label>
                  <Input
                    id="specialization"
                    value={formData.specialization || ''}
                    onChange={(e) => handleChange('specialization', e.target.value)}
                    placeholder="General Practice, Internal Medicine, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email || ''}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="doctor@clinic.com"
                  />
                </div>
              </div>
            </div>

            {/* Clinic Information */}
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-medium flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Clinic Information
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="clinicName">
                    Clinic Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="clinicName"
                    value={formData.clinicName}
                    onChange={(e) => handleChange('clinicName', e.target.value)}
                    placeholder="City Medical Center"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="clinicAddress" className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    Clinic Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="clinicAddress"
                    value={formData.clinicAddress}
                    onChange={(e) => handleChange('clinicAddress', e.target.value)}
                    placeholder="123 Main Street, Suite 100&#10;City, State, ZIP Code"
                    rows={3}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber" className="flex items-center gap-1">
                    <Phone className="w-4 h-4" />
                    Clinic Phone Number
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => handleChange('phoneNumber', e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t">
              <Button type="submit" className="w-full md:w-auto">
                <FileText className="w-4 h-4 mr-2" />
                Save Profile
              </Button>
            </div>
          </form>

          {profile && (
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✓ Profile configured. All medical documents will automatically include your professional details.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Status */}
      <StorageIndicator appData={appData} onLoadFromCloud={onLoadBackup} />

      {/* Backup & Restore - Industry Standard GFS */}
      <Card className="border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-700">
            <History className="w-6 h-6" />
            Backup & Restore
          </CardTitle>
          <CardDescription>
            Sistem backup otomatis: 1 backup per jam (simpan 24 jam) + 1 backup per hari (simpan 7 hari)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quick Actions */}
          <div className="flex gap-4 flex-wrap">
            <Button
              variant="outline"
              onClick={handleForceBackup}
              disabled={isBackingUp}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isBackingUp ? 'animate-spin' : ''}`} />
              Buat Backup Sekarang
            </Button>
            <Button
              variant="outline"
              onClick={loadBackupList}
              disabled={isLoadingBackups}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isLoadingBackups ? 'animate-spin' : ''}`} />
              Refresh Daftar
            </Button>
          </div>

          {/* Backup Tabs - 2 main tabs */}
          <Tabs defaultValue="local" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="local" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Lokal ({hourlyBackups.length + dailyBackups.length})
              </TabsTrigger>
              <TabsTrigger value="cloud" className="flex items-center gap-2" disabled={!isCloudConnected}>
                <CloudUpload className="w-4 h-4" />
                ☁️ Cloud ({cloudHourlyBackups.length + cloudDailyBackups.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="local" className="mt-4 space-y-4">
              {/* Local Hourly */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Per Jam ({hourlyBackups.length}/24)
                </h4>
                <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                  {renderBackupList(hourlyBackups, 'Belum ada backup per jam.')}
                </div>
              </div>
              {/* Local Daily */}
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Per Hari ({dailyBackups.length}/7)
                </h4>
                <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                  {renderBackupList(dailyBackups, 'Belum ada backup harian.')}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Backup lokal disimpan di browser (IndexedDB). Bisa hilang jika browser dibersihkan.
              </p>
            </TabsContent>

            <TabsContent value="cloud" className="mt-4 space-y-4">
              {!isCloudConnected ? (
                <div className="p-4 text-center text-muted-foreground border rounded-lg">
                  <CloudUpload className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Login ke Google Drive untuk akses cloud backup.</p>
                  <p className="text-xs mt-1">Lihat "Penyimpanan Data" di atas.</p>
                </div>
              ) : isLoadingCloudBackups ? (
                <div className="p-4 text-center text-muted-foreground">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Memuat backup cloud...
                </div>
              ) : (
                <>
                  {/* Cloud Hourly */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Per Jam ({cloudHourlyBackups.length}/24)
                    </h4>
                    <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                      {cloudHourlyBackups.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">Belum ada backup per jam di cloud.</div>
                      ) : (
                        cloudHourlyBackups.map((backup) => (
                          <div key={backup.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                                <Clock className="w-3 h-3" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{backup.name.replace('backup_hourly_', '').replace('.json', '')}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(backup.timestamp.toISOString())}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleRestoreCloudBackup(backup)} disabled={restoringKey !== null}>
                              {restoringKey === backup.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Restore'}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  {/* Cloud Daily */}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Calendar className="w-4 h-4" /> Per Hari ({cloudDailyBackups.length}/7)
                    </h4>
                    <div className="border rounded-lg overflow-hidden max-h-[200px] overflow-y-auto">
                      {cloudDailyBackups.length === 0 ? (
                        <div className="p-3 text-sm text-muted-foreground text-center">Belum ada backup harian di cloud.</div>
                      ) : (
                        cloudDailyBackups.map((backup) => (
                          <div key={backup.id} className="flex items-center justify-between p-2 hover:bg-gray-50 border-b last:border-b-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center">
                                <Calendar className="w-3 h-3" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{backup.name.replace('backup_daily_', '').replace('.json', '')}</p>
                                <p className="text-xs text-muted-foreground">{formatDate(backup.timestamp.toISOString())}</p>
                              </div>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => handleRestoreCloudBackup(backup)} disabled={restoringKey !== null}>
                              {restoringKey === backup.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : 'Restore'}
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={loadCloudBackupList} disabled={isLoadingCloudBackups || !isCloudConnected}>
                  <RefreshCw className={`w-4 h-4 mr-1 ${isLoadingCloudBackups ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <Button size="sm" variant="outline" onClick={handleForceCloudBackup} disabled={isBackingUp || !isCloudConnected}>
                  <CloudUpload className={`w-4 h-4 mr-1 ${isBackingUp ? 'animate-spin' : ''}`} />
                  Buat Backup
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                ☁️ Backup cloud tersimpan di Google Drive. Data lengkap tanpa limit browser!
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

    </div>
  );
}

