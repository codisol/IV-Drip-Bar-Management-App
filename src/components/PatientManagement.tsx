import { useState } from 'react';
import { Patient } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Search, UserPlus, Edit, Phone, Calendar, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface PatientManagementProps {
  patients: Patient[];
  onAddPatient: (patient: Patient) => void;
  onUpdatePatient: (patient: Patient) => void;
}

export function PatientManagement({ patients, onAddPatient, onUpdatePatient }: PatientManagementProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: 'Male' as 'Male' | 'Female' | 'Other',
    dob: ''
  });
  const [duplicateWarning, setDuplicateWarning] = useState<Patient | null>(null);

  // Check if a patient with same name and DOB exists
  const findDuplicatePatient = () => {
    const trimmedName = formData.name.toLowerCase().trim();
    return patients.find(p =>
      p.name.toLowerCase().trim() === trimmedName && p.dob === formData.dob
    );
  };

  const createAndAddPatient = () => {
    const newPatient: Patient = {
      id: crypto.randomUUID(),
      ...formData,
      createdAt: new Date().toISOString(),
      isQuickRegistration: false
    };
    onAddPatient(newPatient);
    toast.success('Pasien berhasil didaftarkan');
    setIsDialogOpen(false);
    setEditingPatient(null);
    setFormData({ name: '', phone: '', gender: 'Male', dob: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name || !formData.phone || !formData.dob) {
      toast.error('Harap isi semua field yang wajib');
      return;
    }

    if (editingPatient) {
      onUpdatePatient({
        ...editingPatient,
        ...formData,
        // Mark as complete if all fields are filled
        isQuickRegistration: false
      });
      toast.success('Pasien berhasil diperbarui');
      setIsDialogOpen(false);
      setEditingPatient(null);
      setFormData({ name: '', phone: '', gender: 'Male', dob: '' });
    } else {
      // Check for duplicate before adding
      const duplicate = findDuplicatePatient();
      if (duplicate) {
        setDuplicateWarning(duplicate);
        return; // Don't add yet, show warning dialog
      }
      createAndAddPatient();
    }
  };

  const handleEdit = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name,
      phone: patient.phone,
      gender: patient.gender,
      dob: patient.dob
    });
    setIsDialogOpen(true);
  };

  const filteredPatients = patients.filter(patient =>
    patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.phone.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Manajemen Pasien</CardTitle>
          <CardDescription>Daftarkan dan kelola informasi pasien</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Cari berdasarkan nama atau telepon..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingPatient(null);
                setFormData({ name: '', phone: '', gender: 'Male', dob: '' });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Daftarkan Pasien
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingPatient ? 'Edit Pasien' : 'Daftarkan Pasien Baru'}</DialogTitle>
                  <DialogDescription>
                    {editingPatient ? 'Perbarui informasi pasien' : 'Masukkan informasi pasien untuk mendaftar'}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Lengkap *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nama Lengkap"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Nomor Telepon *</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+628123456789"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Jenis Kelamin *</Label>
                    <Select value={formData.gender} onValueChange={(value: 'Male' | 'Female' | 'Other') => setFormData({ ...formData, gender: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Laki-laki</SelectItem>
                        <SelectItem value="Female">Perempuan</SelectItem>
                        <SelectItem value="Other">Lainnya</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dob">Tanggal Lahir *</Label>
                    <Input
                      id="dob"
                      type="date"
                      value={formData.dob}
                      onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    {editingPatient ? 'Perbarui Pasien' : 'Daftarkan Pasien'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID Pasien</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Telepon</TableHead>
                  <TableHead>Jenis Kelamin</TableHead>
                  <TableHead>Tgl. Lahir</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500">
                      Tidak ada pasien ditemukan
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPatients.map((patient) => (
                    <TableRow key={patient.id}>
                      <TableCell className="font-mono text-xs">{patient.id}</TableCell>
                      <TableCell>{patient.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-gray-400" />
                          {patient.phone}
                        </div>
                      </TableCell>
                      <TableCell>{patient.gender === 'Male' ? 'Laki-laki' : patient.gender === 'Female' ? 'Perempuan' : patient.gender}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          {patient.dob}
                        </div>
                      </TableCell>
                      <TableCell>
                        {patient.isQuickRegistration ? (
                          <Badge variant="outline">Tidak Lengkap</Badge>
                        ) : (
                          <Badge>Lengkap</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(patient)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Duplicate Patient Warning Dialog */}
      <Dialog open={duplicateWarning !== null} onOpenChange={(open) => !open && setDuplicateWarning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Pasien Mungkin Sudah Ada
            </DialogTitle>
            <DialogDescription>
              Pasien dengan nama dan tanggal lahir yang sama sudah terdaftar:
            </DialogDescription>
          </DialogHeader>
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
              <p><strong>Nama:</strong> {duplicateWarning.name}</p>
              <p><strong>Tgl. Lahir:</strong> {duplicateWarning.dob}</p>
              <p><strong>ID:</strong> <span className="font-mono text-xs">{duplicateWarning.id}</span></p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDuplicateWarning(null)}>
              Batal
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDuplicateWarning(null);
                createAndAddPatient();
              }}
            >
              Tetap Daftarkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
