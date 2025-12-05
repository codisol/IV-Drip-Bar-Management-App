import { useState, useEffect } from 'react';
import { DoctorProfile as DoctorProfileType } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Textarea } from './ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { UserCircle, Building2, MapPin, FileText, Stethoscope, Phone, Mail, Download, AlertTriangle, RefreshCw, History, Clock, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { dumpAllData, forceBackup, getAllBackups, loadBackupByKey, BackupInfo } from '../utils/db';
import { AppData } from '../types';

interface DoctorProfileProps {
  profile?: DoctorProfileType;
  onSaveProfile: (profile: DoctorProfileType) => void;
  onLoadBackup?: (data: AppData) => void;
}

export function DoctorProfile({ profile, onSaveProfile, onLoadBackup }: DoctorProfileProps) {
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
  const [isLoadingBackups, setIsLoadingBackups] = useState(false);
  const [restoringKey, setRestoringKey] = useState<string | null>(null);

  // Load backup list on mount
  useEffect(() => {
    loadBackupList();
  }, []);

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

          {/* Backup Tabs */}
          <Tabs defaultValue="hourly" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="hourly" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Per Jam ({hourlyBackups.length}/24)
              </TabsTrigger>
              <TabsTrigger value="daily" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Per Hari ({dailyBackups.length}/7)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="hourly" className="mt-4">
              <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                {renderBackupList(hourlyBackups, 'Belum ada backup per jam. Backup dibuat otomatis setiap jam pertama ada perubahan.')}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Backup per jam dibuat saat pertama kali ada perubahan di jam tersebut. Tidak akan tertimpa oleh edit2 berikutnya di jam yang sama.
              </p>
            </TabsContent>

            <TabsContent value="daily" className="mt-4">
              <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                {renderBackupList(dailyBackups, 'Belum ada backup harian. Backup dibuat otomatis setiap hari pertama ada perubahan.')}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                💡 Backup harian disimpan 7 hari terakhir. Ini adalah backup yang paling aman untuk recovery jangka panjang.
              </p>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Advanced Data Tools */}
      <Card className="border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-700">
            <AlertTriangle className="w-6 h-6" />
            Alat Data Lanjutan
          </CardTitle>
          <CardDescription>
            Alat darurat untuk rescue data jika backup normal tidak tersedia.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
              <p className="text-sm text-orange-800">
                <strong>Perhatian:</strong> Gunakan "Rescue Data" hanya jika backup normal tidak berfungsi. Fitur ini akan mengunduh SEMUA data mentah dari database.
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={handleRescueData}
            disabled={isRescuing}
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
          >
            <Download className={`w-4 h-4 mr-2 ${isRescuing ? 'animate-bounce' : ''}`} />
            Rescue Data (Unduh Semua)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

