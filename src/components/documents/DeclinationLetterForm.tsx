import { useState } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, DeclinationLetter, DoctorProfile } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { PatientCombobox } from '../PatientCombobox';
import { TransactionCombobox } from '../TransactionCombobox';
import { FileUpload } from './FileUpload';
import { Plus, Download, Edit, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateDeclinationLetterPDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface DeclinationLetterFormProps {
  transactions: Transaction[];
  patients: Patient[];
  letters: DeclinationLetter[];
  doctorProfile?: DoctorProfile;
  onAdd: (letter: DeclinationLetter) => void;
  onUpdate: (letter: DeclinationLetter) => void;
}

export function DeclinationLetterForm({ transactions, patients, letters, doctorProfile, onAdd, onUpdate }: DeclinationLetterFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    treatmentDeclined: '',
    reasonForDeclination: '',
    risksExplained: '',
    signatureDate: new Date().toISOString().split('T')[0]
  });
  const [editReason, setEditReason] = useState('');
  const [medicalRecords, setMedicalRecords] = useState<string[]>([]);
  const [prescriptions, setPrescriptions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);

  const resetForm = () => {
    setFormData({
      treatmentDeclined: '',
      reasonForDeclination: '',
      risksExplained: '',
      signatureDate: new Date().toISOString().split('T')[0]
    });
    setEditReason('');
    setMedicalRecords([]);
    setPrescriptions([]);
    setAttachments([]);
    setSelectedPatientId('');
    setSelectedTransactionId('');
    setIsEditing(false);
    setEditingId('');
  };

  const handleSubmit = () => {
    if (!selectedTransactionId) {
      toast.error('Please select a transaction');
      return;
    }

    // Check if transaction already has a document (when creating new)
    if (!isEditing) {
      const existingLetter = letters.find(l => l.transactionId === selectedTransactionId);
      if (existingLetter) {
        toast.error('This transaction already has a declination letter. Please edit the existing document instead.');
        return;
      }
    }

    if (isEditing) {
      const existing = letters.find(l => l.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          treatmentDeclined: existing.treatmentDeclined,
          reasonForDeclination: existing.reasonForDeclination,
          risksExplained: existing.risksExplained,
          // IMPORTANT: Save attachments snapshot for original version
          medicalRecords: existing.medicalRecords || [],
          prescriptions: existing.prescriptions || [],
          attachments: existing.attachments || []
        }]
        : [...existing.versions];

      // Create new version with snapshot of current form data including attachments
      const newVersion = {
        editedAt: new Date().toISOString(),
        editReason: editReason || undefined,
        treatmentDeclined: formData.treatmentDeclined,
        reasonForDeclination: formData.reasonForDeclination,
        risksExplained: formData.risksExplained,
        // IMPORTANT: Save attachments snapshot for this version
        medicalRecords: medicalRecords || [],
        prescriptions: prescriptions || [],
        attachments: attachments || []
      };

      const updated: DeclinationLetter = {
        ...existing,
        ...formData,
        // Current document uses latest attachments
        medicalRecords,
        prescriptions,
        attachments,
        versions: [
          ...versions,
          newVersion
        ]
      };
      onUpdate(updated);
      toast.success('Declination letter updated');
    } else {
      const letter: DeclinationLetter = {
        id: `DL-${Date.now()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        ...formData,
        medicalRecords,
        prescriptions,
        attachments,
        versions: []
      };
      onAdd(letter);
      toast.success('Declination letter created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (letter: DeclinationLetter) => {
    setIsEditing(true);
    setEditingId(letter.id);
    setSelectedTransactionId(letter.transactionId);
    const transaction = transactions.find(t => t.id === letter.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      treatmentDeclined: letter.treatmentDeclined,
      reasonForDeclination: letter.reasonForDeclination,
      risksExplained: letter.risksExplained,
      signatureDate: letter.signatureDate
    });
    setMedicalRecords(letter.medicalRecords || []);
    setPrescriptions(letter.prescriptions || []);
    setAttachments(letter.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (letter: DeclinationLetter) => {
    const transaction = transactions.find(t => t.id === letter.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateDeclinationLetterPDF(letter, transaction, patient, doctorProfile);
    }
  };

  return (
    <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogTrigger asChild>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            New Declination Letter
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Declination Letter</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update declination letter (creates new version)' : 'Create a new declination letter'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Patient *</Label>
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
                <Label>Transaction *</Label>
                <TransactionCombobox
                  transactions={transactions}
                  value={selectedTransactionId}
                  onValueChange={setSelectedTransactionId}
                  filterByPatient={selectedPatientId}
                  showOnProgressOnly={!isEditing}
                />
                {!isEditing && selectedTransactionId && (() => {
                  const existingLetter = letters.find(l => l.transactionId === selectedTransactionId);
                  if (existingLetter) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has a declination letter.</strong>
                          <br />
                          Each transaction should only have one document. If you need to make changes, please use the Edit function on the existing document.
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
                <Label>Edit Reason (Optional)</Label>
                <Textarea
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  rows={2}
                  placeholder="Briefly describe why you're editing this document..."
                />
              </div>
            )}

            <div>
              <Label>Treatment Declined *</Label>
              <Textarea
                value={formData.treatmentDeclined}
                onChange={(e) => setFormData({ ...formData, treatmentDeclined: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Reason for Declination *</Label>
              <Textarea
                value={formData.reasonForDeclination}
                onChange={(e) => setFormData({ ...formData, reasonForDeclination: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Risks Explained *</Label>
              <Textarea
                value={formData.risksExplained}
                onChange={(e) => setFormData({ ...formData, risksExplained: e.target.value })}
                rows={3}
              />
            </div>

            <FileUpload label="Medical Records (Optional)" files={medicalRecords} onFilesChange={setMedicalRecords} />
            <FileUpload label="Prescriptions (Optional)" files={prescriptions} onFilesChange={setPrescriptions} />
            <FileUpload label="Additional Attachments (Optional)" files={attachments} onFilesChange={setAttachments} />

            <div>
              <Label>Signature Date *</Label>
              <Input
                type="date"
                value={formData.signatureDate}
                onChange={(e) => setFormData({ ...formData, signatureDate: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{isEditing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {letters.map(letter => {
          const transaction = transactions.find(t => t.id === letter.transactionId);
          return (
            <Card key={letter.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(letter.date)}
                  {letter.versions.length > 0 && ` (${letter.versions.length} revision${letter.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Treatment:</strong> {letter.treatmentDeclined.substring(0, 50)}...</p>
                  <p><strong>Reason:</strong> {letter.reasonForDeclination.substring(0, 50)}...</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(letter)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(letter)}>
                    <Download className="w-4 h-4 mr-1" />
                    PDF
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
