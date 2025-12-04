import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, ReferralLetter, DoctorProfile } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { PatientCombobox } from '../PatientCombobox';
import { TransactionCombobox } from '../TransactionCombobox';
import { FileUpload } from './FileUpload';
import { Plus, Download, Edit, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateReferralLetterPDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface ReferralLetterFormProps {
  transactions: Transaction[];
  patients: Patient[];
  referrals: ReferralLetter[];
  doctorProfile?: DoctorProfile;
  onAdd: (letter: ReferralLetter) => void;
  onUpdate: (letter: ReferralLetter) => void;
}

export function ReferralLetterForm({ transactions, patients, referrals, doctorProfile, onAdd, onUpdate }: ReferralLetterFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    referringTo: '',
    specialty: '',
    reasonForReferral: '',
    relevantHistory: '',
    currentMedications: '',
    urgency: 'Routine' as 'Routine' | 'Urgent' | 'Emergency',
    doctorName: ''
  });
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  useEffect(() => {
    if (doctorProfile && !isEditing) {
      setFormData(prev => ({
        ...prev,
        doctorName: doctorProfile.doctorName
      }));
    }
  }, [doctorProfile, isEditing]);

  const resetForm = () => {
    setFormData({
      referringTo: '',
      specialty: '',
      reasonForReferral: '',
      relevantHistory: '',
      currentMedications: '',
      urgency: 'Routine',
      doctorName: doctorProfile?.doctorName || ''
    });
    setEditReason('');
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
      const existingReferral = referrals.find(r => r.transactionId === selectedTransactionId);
      if (existingReferral) {
        toast.error('This transaction already has a referral letter. Please edit the existing document instead.');
        return;
      }
    }

    if (isEditing) {
      const existing = referrals.find(r => r.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          referringTo: existing.referringTo,
          specialty: existing.specialty,
          reasonForReferral: existing.reasonForReferral,
          relevantHistory: existing.relevantHistory,
          currentMedications: existing.currentMedications,
          urgency: existing.urgency,
          doctorName: existing.doctorName,
          // IMPORTANT: Save attachments snapshot for original version
          attachments: existing.attachments || []
        }]
        : [...existing.versions];

      // Create new version with snapshot of current form data including attachments
      const newVersion = {
        editedAt: new Date().toISOString(),
        editReason: editReason || undefined,
        ...formData,
        // IMPORTANT: Save attachments snapshot for this version
        attachments: attachments || []
      };

      const updated: ReferralLetter = {
        ...existing,
        ...formData,
        // Current document uses latest attachments
        attachments,
        versions: [
          ...versions,
          newVersion
        ]
      };
      onUpdate(updated);
      toast.success('Referral letter updated');
    } else {
      const letter: ReferralLetter = {
        id: `RL-${Date.now()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        ...formData,
        doctorName: doctorProfile?.doctorName || formData.doctorName,
        attachments,
        versions: []
      };
      onAdd(letter);
      toast.success('Referral letter created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (letter: ReferralLetter) => {
    setIsEditing(true);
    setEditingId(letter.id);
    setSelectedTransactionId(letter.transactionId);
    const transaction = transactions.find(t => t.id === letter.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      referringTo: letter.referringTo,
      specialty: letter.specialty,
      reasonForReferral: letter.reasonForReferral,
      relevantHistory: letter.relevantHistory,
      currentMedications: letter.currentMedications,
      urgency: letter.urgency,
      doctorName: letter.doctorName
    });
    setAttachments(letter.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (letter: ReferralLetter) => {
    const transaction = transactions.find(t => t.id === letter.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateReferralLetterPDF(letter, transaction, patient, doctorProfile);
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
            New Referral Letter
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Referral Letter</DialogTitle>
            <DialogDescription>
              Refer patient to specialist or other healthcare provider
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
                  const existingReferral = referrals.find(r => r.transactionId === selectedTransactionId);
                  if (existingReferral) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has a referral letter.</strong>
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Referring To *</Label>
                <Input
                  value={formData.referringTo}
                  onChange={(e) => setFormData({ ...formData, referringTo: e.target.value })}
                  placeholder="Doctor/Hospital name"
                />
              </div>
              <div>
                <Label>Specialty *</Label>
                <Input
                  value={formData.specialty}
                  onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                  placeholder="e.g., Cardiology, Neurology"
                />
              </div>
            </div>

            <div>
              <Label>Urgency *</Label>
              <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v as any })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Routine">Routine</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                  <SelectItem value="Emergency">Emergency</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason for Referral *</Label>
              <Textarea
                value={formData.reasonForReferral}
                onChange={(e) => setFormData({ ...formData, reasonForReferral: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Relevant Medical History *</Label>
              <Textarea
                value={formData.relevantHistory}
                onChange={(e) => setFormData({ ...formData, relevantHistory: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Current Medications *</Label>
              <Textarea
                value={formData.currentMedications}
                onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                rows={2}
              />
            </div>

            {doctorProfile && (
              <div className="p-3 bg-teal/10 rounded border border-teal/20">
                <p className="text-sm text-gray-700">
                  <strong>Doctor:</strong> {doctorProfile.doctorName}
                  {doctorProfile.specialization && ` | ${doctorProfile.specialization}`}
                </p>
              </div>
            )}

            <FileUpload label="Attachments (Optional)" files={attachments} onFilesChange={setAttachments} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{isEditing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {referrals.map(letter => {
          const transaction = transactions.find(t => t.id === letter.transactionId);
          return (
            <Card key={letter.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(letter.date)} | {letter.urgency}
                  {letter.versions.length > 0 && ` (${letter.versions.length} revision${letter.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>To:</strong> {letter.referringTo} ({letter.specialty})</p>
                  <p><strong>Reason:</strong> {letter.reasonForReferral.substring(0, 50)}...</p>
                  <p><strong>Doctor:</strong> Dr. {letter.doctorName}</p>
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
