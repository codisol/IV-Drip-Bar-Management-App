import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Patient, SoapNote, Transaction, DoctorProfile } from '../types';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { PatientCombobox } from './PatientCombobox';
import { TransactionCombobox } from './TransactionCombobox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { FileText, Plus, Edit, Download, History, Calendar, X, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { FileUpload } from './documents/FileUpload';
import { AttachmentViewer } from './documents/AttachmentViewer';
import { generateSoapNotePDF, generateMultiSoapNotePDF } from '../utils/pdfGenerator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

interface SoapNotesProps {
  patients: Patient[];
  transactions: Transaction[];
  soapNotes: SoapNote[];
  doctorProfile?: DoctorProfile;
  onAddSoapNote: (note: SoapNote) => void;
  onUpdateSoapNote: (note: SoapNote) => void;
  initialFilterPatientId?: string;
  initialFilterDate?: string;
}

export function SoapNotes({ patients, transactions, soapNotes, doctorProfile, onAddSoapNote, onUpdateSoapNote, initialFilterPatientId, initialFilterDate }: SoapNotesProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    subjective: '',
    objective: '',
    assessment: '',
    plan: ''
  });
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const [filterPatientId, setFilterPatientId] = useState(initialFilterPatientId || '');
  const [dateRange, setDateRange] = useState({ start: initialFilterDate || '', end: initialFilterDate || '' });
  const [showDateFilter, setShowDateFilter] = useState(!!initialFilterDate);
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(new Set());
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [downloadPatientId, setDownloadPatientId] = useState('');
  const [downloadDateRange, setDownloadDateRange] = useState({ start: '', end: '' });
  const [downloadAllPeriod, setDownloadAllPeriod] = useState(false);
  const [downloadTodayPeriod, setDownloadTodayPeriod] = useState(false);
  const patientSectionRef = useRef<HTMLDivElement>(null);

  // Helper function to safely get date string
  const getDateString = (dateValue: string | Date | undefined): string | null => {
    if (!dateValue) return null;
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  };

  // Handle initial filter from navigation
  useEffect(() => {
    if (initialFilterPatientId && initialFilterDate) {
      setFilterPatientId(initialFilterPatientId);
      setDateRange({ start: initialFilterDate, end: initialFilterDate });
      setShowDateFilter(true);

      // Find the transaction that matches this date
      const filterDateStr = getDateString(initialFilterDate);
      if (filterDateStr) {
        const transaction = transactions.find(t => {
          const transactionDate = getDateString(t.time);
          return t.patientId === initialFilterPatientId && transactionDate === filterDateStr;
        });

        if (transaction) {
          // Auto-expand the transaction
          setExpandedTransactions(new Set([transaction.id]));

          // Scroll to patient section after a short delay
          setTimeout(() => {
            patientSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 300);
        }
      }
    }
  }, [initialFilterPatientId, initialFilterDate, transactions]);

  const resetForm = () => {
    setFormData({
      subjective: '',
      objective: '',
      assessment: '',
      plan: ''
    });
    setEditReason('');
    setAttachments([]);
    setSelectedPatientId('');
    setSelectedTransactionId('');
    setIsEditing(false);
    setEditingId('');
  };

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
    setShowDateFilter(true);
  };

  const handleSubmit = () => {
    if (!selectedTransactionId) {
      toast.error('Harap pilih transaksi');
      return;
    }

    // Check if transaction already has a SOAP note (when creating new)
    if (!isEditing) {
      const existingSoapNote = soapNotes.find(s => s.transactionId === selectedTransactionId);
      if (existingSoapNote) {
        toast.error('Transaksi ini sudah memiliki catatan SOAP. Harap edit catatan yang sudah ada.');
        return;
      }
    }

    if (isEditing) {
      const existing = soapNotes.find(s => s.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      // CRITICAL: Ensure we capture ALL attachments from existing document, even if empty array
      const originalVersionAttachments = Array.isArray(existing.attachments)
        ? [...existing.attachments] // Create a copy to avoid reference issues
        : (existing.attachments ? [existing.attachments] : []); // Handle single string or undefined

      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          subjective: existing.subjective,
          objective: existing.objective,
          assessment: existing.assessment,
          plan: existing.plan,
          // IMPORTANT: Save attachments snapshot for original version (ensure it's an array)
          attachments: originalVersionAttachments
        }]
        : [...existing.versions];

      // Create new version with snapshot of current form data including attachments
      // CRITICAL: Ensure we capture ALL attachments from current form state
      const currentVersionAttachments = Array.isArray(attachments)
        ? [...attachments] // Create a copy to avoid reference issues
        : (attachments ? [attachments] : []); // Handle single string or undefined

      const newVersion = {
        editedAt: new Date().toISOString(),
        editReason: editReason || undefined,
        subjective: formData.subjective,
        objective: formData.objective,
        assessment: formData.assessment,
        plan: formData.plan,
        // IMPORTANT: Save attachments snapshot for this version (ensure it's an array)
        attachments: currentVersionAttachments
      };

      const updated: SoapNote = {
        ...existing,
        ...formData,
        // Current document uses latest attachments
        attachments,
        versions: [
          ...versions,
          newVersion
        ]
      };
      onUpdateSoapNote(updated);
      toast.success('Catatan SOAP berhasil diperbarui');
    } else {
      const note: SoapNote = {
        id: `SOAP-${crypto.randomUUID()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        ...formData,
        attachments,
        versions: []
      };
      onAddSoapNote(note);
      toast.success('Catatan SOAP berhasil dibuat');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (note: SoapNote) => {
    setIsEditing(true);
    setEditingId(note.id);
    setSelectedTransactionId(note.transactionId);
    const transaction = transactions.find(t => t.id === note.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      subjective: note.subjective || '',
      objective: note.objective || '',
      assessment: note.assessment || '',
      plan: note.plan || ''
    });
    setAttachments(note.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (note: SoapNote) => {
    const transaction = transactions.find(t => t.id === note.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateSoapNotePDF(note, transaction, patient, doctorProfile);
    }
  };

  const handleDownloadMultiPDF = () => {
    if (!downloadPatientId) {
      toast.error('Pilih pasien terlebih dahulu');
      return;
    }

    const patient = patients.find(p => p.id === downloadPatientId);
    if (!patient) {
      toast.error('Pasien tidak ditemukan');
      return;
    }

    // Determine date range based on selected option
    let startDate: string | undefined;
    let endDate: string | undefined;

    if (downloadAllPeriod) {
      startDate = undefined;
      endDate = undefined;
    } else if (downloadTodayPeriod) {
      // Set to today's date
      const today = new Date().toISOString().split('T')[0];
      startDate = today;
      endDate = today;
    } else {
      startDate = downloadDateRange.start;
      endDate = downloadDateRange.end;
    }

    generateMultiSoapNotePDF(
      soapNotes,
      transactions,
      patient,
      doctorProfile,
      startDate,
      endDate
    );

    setDownloadDialogOpen(false);
    setDownloadPatientId('');
    setDownloadDateRange({ start: '', end: '' });
    setDownloadAllPeriod(false);
    setDownloadTodayPeriod(false);
  };

  const toggleExpanded = (noteId: string) => {
    const newExpanded = new Set(expandedNotes);
    if (newExpanded.has(noteId)) {
      newExpanded.delete(noteId);
    } else {
      newExpanded.add(noteId);
    }
    setExpandedNotes(newExpanded);
  };

  const sortedNotes = useMemo(() => {
    return [...soapNotes].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [soapNotes]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Catatan SOAP</CardTitle>
              <CardDescription>Dokumentasi Subjektif, Objektif, Asesmen, dan Rencana</CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Download className="w-4 h-4 mr-2" />
                    Unduh PDF Multi-Transaksi
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Unduh PDF Catatan SOAP</DialogTitle>
                    <DialogDescription>
                      Unduh catatan SOAP untuk satu pasien dengan rentang tanggal tertentu
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Pasien *</Label>
                      <PatientCombobox
                        patients={patients}
                        value={downloadPatientId}
                        onValueChange={setDownloadPatientId}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="allPeriod"
                          checked={downloadAllPeriod}
                          onChange={(e) => {
                            setDownloadAllPeriod(e.target.checked);
                            if (e.target.checked) {
                              setDownloadDateRange({ start: '', end: '' });
                              setDownloadTodayPeriod(false);
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="allPeriod" className="cursor-pointer">
                          Semua Periode
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="todayPeriod"
                          checked={downloadTodayPeriod}
                          onChange={(e) => {
                            setDownloadTodayPeriod(e.target.checked);
                            if (e.target.checked) {
                              setDownloadDateRange({ start: '', end: '' });
                              setDownloadAllPeriod(false);
                            }
                          }}
                          className="w-4 h-4"
                        />
                        <Label htmlFor="todayPeriod" className="cursor-pointer">
                          Untuk Hari Ini
                        </Label>
                      </div>
                    </div>
                    {!downloadAllPeriod && !downloadTodayPeriod && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Tanggal Mulai</Label>
                          <Input
                            type="date"
                            value={downloadDateRange.start}
                            onChange={(e) => setDownloadDateRange({ ...downloadDateRange, start: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label>Tanggal Akhir</Label>
                          <Input
                            type="date"
                            value={downloadDateRange.end}
                            onChange={(e) => setDownloadDateRange({ ...downloadDateRange, end: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>Batal</Button>
                    <Button onClick={handleDownloadMultiPDF}>Unduh PDF</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={isDialogOpen} onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Catatan SOAP Baru
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{isEditing ? 'Edit' : 'Buat'} Catatan SOAP</DialogTitle>
                    <DialogDescription>
                      Dokumentasikan detail Subjektif, Objektif, Asesmen, dan Rencana pasien
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Pasien *</Label>
                      <PatientCombobox
                        patients={patients}
                        value={selectedPatientId}
                        onValueChange={(patientId) => {
                          setSelectedPatientId(patientId);
                          setSelectedTransactionId('');
                        }}
                      />
                    </div>

                    {selectedPatientId && (
                      <div>
                        <Label>Transaksi *</Label>
                        <TransactionCombobox
                          transactions={transactions}
                          value={selectedTransactionId}
                          onValueChange={setSelectedTransactionId}
                          filterByPatient={selectedPatientId}
                          showOnProgressOnly={!isEditing}
                        />
                        {!isEditing && selectedTransactionId && (() => {
                          const existingSoapNote = soapNotes.find(s => s.transactionId === selectedTransactionId);
                          if (existingSoapNote) {
                            return (
                              <Alert className="mt-2 border-orange-200 bg-orange-50">
                                <AlertCircle className="h-4 w-4 text-orange-600" />
                                <AlertDescription className="text-orange-900">
                                  <strong>Transaksi ini sudah memiliki catatan SOAP.</strong>
                                  <br />
                                  Setiap transaksi sebaiknya hanya memiliki satu catatan SOAP. Jika Anda perlu membuat perubahan, gunakan fungsi Edit pada catatan yang sudah ada.
                                </AlertDescription>
                              </Alert>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    )}

                    {isEditing && (
                      <div>
                        <Label>Alasan Edit (Opsional)</Label>
                        <Textarea
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          rows={2}
                          placeholder="Jelaskan secara singkat mengapa Anda mengedit catatan ini..."
                        />
                      </div>
                    )}

                    <div>
                      <Label>Subjektif</Label>
                      <Textarea
                        value={formData.subjective}
                        onChange={(e) => setFormData({ ...formData, subjective: e.target.value })}
                        rows={3}
                        placeholder="Keluhan utama dan gejala pasien (opsional)..."
                      />
                    </div>

                    <div>
                      <Label>Objektif</Label>
                      <Textarea
                        value={formData.objective}
                        onChange={(e) => setFormData({ ...formData, objective: e.target.value })}
                        rows={3}
                        placeholder="Temuan klinis, tanda vital, hasil pemeriksaan (opsional)..."
                      />
                    </div>

                    <div>
                      <Label>Asesmen *</Label>
                      <Textarea
                        value={formData.assessment}
                        onChange={(e) => setFormData({ ...formData, assessment: e.target.value })}
                        rows={3}
                        placeholder="Diagnosis atau kesan klinis..."
                      />
                    </div>

                    <div>
                      <Label>Rencana *</Label>
                      <Textarea
                        value={formData.plan}
                        onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
                        rows={3}
                        placeholder="Rencana pengobatan, obat-obatan, tindak lanjut..."
                      />
                    </div>

                    <FileUpload
                      label="Lampiran (Opsional)"
                      files={attachments}
                      onFilesChange={setAttachments}
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Batal</Button>
                    <Button onClick={handleSubmit}>{isEditing ? 'Perbarui' : 'Buat'}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>ID Pasien</TableHead>
                  <TableHead>Nama Pasien</TableHead>
                  <TableHead>Transaksi</TableHead>
                  <TableHead>Asesmen</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {soapNotes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                      Belum ada catatan SOAP
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedNotes.map((note) => {
                    const transaction = transactions.find(t => t.id === note.transactionId);
                    const patient = transaction ? patients.find(p => p.id === transaction.patientId) : null;
                    const isExpanded = expandedNotes.has(note.id);

                    return (
                      <React.Fragment key={note.id}>
                        <TableRow>
                          <TableCell className="text-xs">{new Date(note.date).toLocaleString('id-ID')}</TableCell>
                          <TableCell className="text-xs font-mono">{patient?.id || '-'}</TableCell>
                          <TableCell>{transaction?.patientName || 'Tidak Diketahui'}</TableCell>
                          <TableCell className="text-xs font-mono">{transaction?.id}</TableCell>
                          <TableCell className="max-w-xs truncate">{note.assessment}</TableCell>
                          <TableCell>
                            {note.versions.length > 0 && (
                              <Badge variant="outline" className="cursor-pointer" onClick={() => toggleExpanded(note.id)}>
                                <History className="w-3 h-3 mr-1" />
                                {note.versions.length}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                                <Edit className="w-3 h-3" />
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(note)}>
                                <Download className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        {isExpanded && note.versions.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="bg-gray-50">
                              <div className="p-4 space-y-2">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Riwayat Versi ({note.versions.length} versi sebelumnya)</p>
                                {note.versions.map((version, idx) => (
                                  <div key={idx} className="text-xs p-3 bg-white rounded border">
                                    <div className="flex justify-between items-start mb-2">
                                      <div>
                                        <p><strong>Versi {idx + 1}</strong> - Diedit: {new Date(version.editedAt).toLocaleString('id-ID')}</p>
                                        {version.editReason && (
                                          <p className="text-gray-700 mt-1 bg-blue-50 px-2 py-1 rounded"><strong className="text-teal">Alasan:</strong> {version.editReason}</p>
                                        )}
                                      </div>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const transaction = transactions.find(t => t.id === note.transactionId);
                                          const patient = patients.find(p => p.id === transaction?.patientId);
                                          if (transaction && patient) {
                                            const versionNote = { ...note, ...version, id: `${note.id}-v${idx + 1}` };
                                            generateSoapNotePDF(versionNote as SoapNote, transaction, patient, doctorProfile);
                                          }
                                        }}
                                      >
                                        <Download className="w-3 h-3 mr-1" />
                                        PDF
                                      </Button>
                                    </div>
                                    {version.subjective && <p><strong>S:</strong> {version.subjective.length > 100 ? version.subjective.substring(0, 100) + '...' : version.subjective}</p>}
                                    {version.objective && <p><strong>O:</strong> {version.objective.length > 100 ? version.objective.substring(0, 100) + '...' : version.objective}</p>}
                                    <p><strong>A:</strong> {version.assessment.length > 100 ? version.assessment.substring(0, 100) + '...' : version.assessment}</p>
                                    <p><strong>P:</strong> {version.plan.length > 100 ? version.plan.substring(0, 100) + '...' : version.plan}</p>
                                    {/* Show attachments from version snapshot (not from current document) */}
                                    {(() => {
                                      // Get attachments from version, ensuring it's an array
                                      let versionAttachments: string[] = [];
                                      if (version.attachments) {
                                        versionAttachments = Array.isArray(version.attachments)
                                          ? version.attachments
                                          : [version.attachments];
                                      }

                                      // Fallback to note.attachments for old versions that might not have version.attachments
                                      // But only if version.attachments is truly empty (not just missing property)
                                      let attachmentsToShow: string[] = versionAttachments;
                                      if (versionAttachments.length === 0 && !version.hasOwnProperty('attachments')) {
                                        // Version doesn't have attachments property (old data), use note attachments
                                        const noteAttachments = note.attachments || [];
                                        attachmentsToShow = Array.isArray(noteAttachments) ? noteAttachments : [noteAttachments];
                                      }

                                      // Filter out invalid entries
                                      attachmentsToShow = attachmentsToShow.filter(att => att && typeof att === 'string' && att.trim().length > 0);

                                      return attachmentsToShow.length > 0 ? (
                                        <AttachmentViewer attachments={attachmentsToShow} />
                                      ) : null;
                                    })()}
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Patient SOAP History Section */}
      <div ref={patientSectionRef}>
        <Card>
          <CardHeader>
            <CardTitle>Lihat Catatan SOAP per Pasien</CardTitle>
            <CardDescription>Cari dan lihat semua catatan SOAP untuk pasien tertentu</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Pilih Pasien</Label>
                <PatientCombobox
                  patients={patients}
                  value={filterPatientId}
                  onValueChange={setFilterPatientId}
                />
              </div>
              <Button variant="outline" size="sm" onClick={setTodayFilter}>
                <Calendar className="w-4 h-4 mr-2" />
                Hari Ini
              </Button>
              <Input
                type="date"
                placeholder="Tanggal Mulai"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start: e.target.value });
                  setShowDateFilter(true);
                }}
                className="w-40"
              />
              <Input
                type="date"
                placeholder="Tanggal Akhir"
                value={dateRange.end}
                onChange={(e) => {
                  setDateRange({ ...dateRange, end: e.target.value });
                  setShowDateFilter(true);
                }}
                className="w-40"
              />
              {showDateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange({ start: '', end: '' });
                    setShowDateFilter(false);
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>

            {filterPatientId && (() => {
              const patient = patients.find(p => p.id === filterPatientId);
              // Filter transactions by date range if date filter is active
              let patientTransactions = transactions.filter(t => t.patientId === filterPatientId);

              if (showDateFilter) {
                patientTransactions = patientTransactions.filter(t => {
                  const transDate = getDateString(t.time);
                  if (!transDate) return false;
                  if (dateRange.start && transDate < dateRange.start) return false;
                  if (dateRange.end && transDate > dateRange.end) return false;
                  return true;
                });
              }

              // Sort by date - latest first
              patientTransactions = patientTransactions.sort((a, b) =>
                new Date(b.time).getTime() - new Date(a.time).getTime()
              );

              return (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm">
                    <Badge variant="outline">{patient?.name}</Badge>
                    <Badge variant="secondary" className="font-mono text-xs">{patient?.id}</Badge>
                    <span className="text-gray-500">{patientTransactions.length} transaksi</span>
                  </div>

                  {patientTransactions.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Tidak ada transaksi ditemukan untuk pasien ini</p>
                  ) : (
                    <div className="space-y-4">
                      {patientTransactions.map(transaction => {
                        const transactionSoapNotes = soapNotes.filter(n => n.transactionId === transaction.id);
                        const isExpanded = expandedTransactions.has(transaction.id);
                        const transDate = getDateString(transaction.time);
                        const isFiltered = showDateFilter && transDate &&
                          (!dateRange.start || transDate >= dateRange.start) &&
                          (!dateRange.end || transDate <= dateRange.end);

                        return (
                          <Collapsible
                            key={transaction.id}
                            open={isExpanded}
                            onOpenChange={(open) => {
                              setExpandedTransactions(prev => {
                                const newSet = new Set(prev);
                                if (open) {
                                  newSet.add(transaction.id);
                                } else {
                                  newSet.delete(transaction.id);
                                }
                                return newSet;
                              });
                            }}
                          >
                            <Card className={isFiltered ? 'border-2 border-teal shadow-md' : ''}>
                              <CollapsibleTrigger className="w-full">
                                <CardHeader className="cursor-pointer hover:bg-gray-50">
                                  <div className="flex items-center justify-between">
                                    <div className="text-left">
                                      <CardTitle className="text-base">
                                        Transaksi: {transaction.id}
                                      </CardTitle>
                                      <CardDescription className="text-xs">
                                        {new Date(transaction.time).toLocaleString('id-ID')} •
                                        <Badge variant={transaction.status === 'Paid' ? 'default' : 'outline'} className="ml-2 text-xs">
                                          {transaction.status === 'Paid' ? 'Lunas' : 'Dalam Proses'}
                                        </Badge>
                                      </CardDescription>
                                    </div>
                                    <Badge variant="secondary">
                                      {transactionSoapNotes.length} catatan SOAP
                                    </Badge>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0">
                                  {transactionSoapNotes.length === 0 ? (
                                    <p className="text-center text-gray-500 py-4 text-sm">Tidak ada catatan SOAP untuk transaksi ini</p>
                                  ) : (
                                    <div className="space-y-3">
                                      {transactionSoapNotes.map(note => (
                                        <Card key={note.id} className="bg-blue-50">
                                          <CardContent className="pt-4">
                                            <div className="space-y-3">
                                              <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                  <p className="text-xs text-gray-500 mb-2">
                                                    <strong>Versi Terkini {note.versions.length > 0 ? `(Version ${note.versions.length + 1})` : '(Version 1)'}</strong> - Dibuat: {new Date(note.date).toLocaleString('id-ID')}
                                                    {note.versions.length > 0 && (
                                                      <Badge variant="outline" className="ml-2 text-xs">
                                                        <History className="w-3 h-3 mr-1" />
                                                        {note.versions.length} versi sebelumnya
                                                      </Badge>
                                                    )}
                                                  </p>
                                                  {note.subjective && (
                                                    <div className="mb-2">
                                                      <p className="text-xs uppercase tracking-wide text-gray-500">Subjektif</p>
                                                      <p className="text-sm">{note.subjective}</p>
                                                    </div>
                                                  )}
                                                  {note.objective && (
                                                    <div className="mb-2">
                                                      <p className="text-xs uppercase tracking-wide text-gray-500">Objektif</p>
                                                      <p className="text-sm">{note.objective}</p>
                                                    </div>
                                                  )}
                                                  <div className="mb-2">
                                                    <p className="text-xs uppercase tracking-wide text-gray-500">Asesmen</p>
                                                    <p className="text-sm">{note.assessment}</p>
                                                  </div>
                                                  <div className="mb-2">
                                                    <p className="text-xs uppercase tracking-wide text-gray-500">Rencana</p>
                                                    <p className="text-sm">{note.plan}</p>
                                                  </div>
                                                  {note.attachments && note.attachments.length > 0 && (
                                                    <AttachmentViewer attachments={note.attachments} />
                                                  )}
                                                </div>
                                                <div className="flex gap-2 ml-4">
                                                  <Button size="sm" variant="outline" onClick={() => handleEdit(note)}>
                                                    <Edit className="w-3 h-3" />
                                                  </Button>
                                                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(note)}>
                                                    <Download className="w-3 h-3" />
                                                  </Button>
                                                </div>
                                              </div>

                                              {/* Version History */}
                                              {note.versions.length > 0 && (
                                                <Collapsible>
                                                  <CollapsibleTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full mt-2">
                                                      <History className="w-3 h-3 mr-2" />
                                                      Lihat {note.versions.length} Versi Sebelumnya
                                                    </Button>
                                                  </CollapsibleTrigger>
                                                  <CollapsibleContent className="mt-3 space-y-2">
                                                    {note.versions.map((version, vIdx) => (
                                                      <Card key={vIdx} className="bg-white">
                                                        <CardContent className="pt-3">
                                                          <div className="flex items-start justify-between mb-2">
                                                            <div>
                                                              <p className="text-xs text-gray-500">
                                                                <strong>Versi {vIdx + 1}</strong> - Versi dari: {new Date(version.editedAt).toLocaleString('id-ID')}
                                                              </p>
                                                              {version.editReason && (
                                                                <p className="text-xs text-gray-700 mt-1 bg-blue-50 px-2 py-1 rounded">
                                                                  <strong className="text-teal">Alasan Edit:</strong> {version.editReason}
                                                                </p>
                                                              )}
                                                            </div>
                                                            <Button
                                                              size="sm"
                                                              variant="outline"
                                                              onClick={() => {
                                                                const versionNote = { ...note, ...version, id: `${note.id}-v${vIdx + 1}` };
                                                                generateSoapNotePDF(versionNote as SoapNote, transaction, patient!, doctorProfile);
                                                              }}
                                                            >
                                                              <Download className="w-3 h-3 mr-1" />
                                                              PDF
                                                            </Button>
                                                          </div>
                                                          {version.subjective && (
                                                            <div className="mb-1">
                                                              <p className="text-xs uppercase tracking-wide text-gray-500">Subjektif</p>
                                                              <p className="text-xs">{version.subjective}</p>
                                                            </div>
                                                          )}
                                                          {version.objective && (
                                                            <div className="mb-1">
                                                              <p className="text-xs uppercase tracking-wide text-gray-500">Objektif</p>
                                                              <p className="text-xs">{version.objective}</p>
                                                            </div>
                                                          )}
                                                          <div className="mb-1">
                                                            <p className="text-xs uppercase tracking-wide text-gray-500">Asesmen</p>
                                                            <p className="text-xs">{version.assessment}</p>
                                                          </div>
                                                          <div>
                                                            <p className="text-xs uppercase tracking-wide text-gray-500">Rencana</p>
                                                            <p className="text-xs">{version.plan}</p>
                                                          </div>
                                                          {/* Show attachments from version snapshot (not from current document) */}
                                                          {(() => {
                                                            // Get attachments from version, ensuring it's an array
                                                            let versionAttachments: string[] = [];
                                                            if (version.attachments) {
                                                              versionAttachments = Array.isArray(version.attachments)
                                                                ? version.attachments
                                                                : [version.attachments];
                                                            }

                                                            // Fallback to note.attachments for old versions that might not have version.attachments
                                                            // But only if version.attachments is truly empty (not just missing property)
                                                            let attachmentsToShow: string[] = versionAttachments;
                                                            if (versionAttachments.length === 0 && !version.hasOwnProperty('attachments')) {
                                                              // Version doesn't have attachments property (old data), use note attachments
                                                              const noteAttachments = note.attachments || [];
                                                              attachmentsToShow = Array.isArray(noteAttachments) ? noteAttachments : [noteAttachments];
                                                            }

                                                            // Filter out invalid entries
                                                            attachmentsToShow = attachmentsToShow.filter(att => att && typeof att === 'string' && att.trim().length > 0);

                                                            return attachmentsToShow.length > 0 ? (
                                                              <div className="mt-2">
                                                                <AttachmentViewer attachments={attachmentsToShow} />
                                                              </div>
                                                            ) : null;
                                                          })()}
                                                        </CardContent>
                                                      </Card>
                                                    ))}
                                                  </CollapsibleContent>
                                                </Collapsible>
                                              )}
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
