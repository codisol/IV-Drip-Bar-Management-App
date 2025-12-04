import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, Prescription, DoctorProfile } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { PatientCombobox } from '../PatientCombobox';
import { TransactionCombobox } from '../TransactionCombobox';
import { FileUpload } from './FileUpload';
import { Plus, Download, Edit, Trash2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generatePrescriptionPDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface PrescriptionFormProps {
  transactions: Transaction[];
  patients: Patient[];
  prescriptions: Prescription[];
  doctorProfile?: DoctorProfile;
  onAdd: (prescription: Prescription) => void;
  onUpdate: (prescription: Prescription) => void;
}

export function PrescriptionForm({ transactions, patients, prescriptions, doctorProfile, onAdd, onUpdate }: PrescriptionFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [medications, setMedications] = useState<Array<{
    drugName: string;
    strength: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
  }>>([]);
  const [currentMed, setCurrentMed] = useState({
    drugName: '',
    strength: '',
    dosage: '',
    frequency: '',
    duration: '',
    quantity: 0
  });
  const [instructions, setInstructions] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  // Auto-populate doctor name from profile
  useEffect(() => {
    if (doctorProfile && !isEditing) {
      setDoctorName(doctorProfile.doctorName);
    }
  }, [doctorProfile, isEditing]);

  const resetForm = () => {
    setMedications([]);
    setCurrentMed({
      drugName: '',
      strength: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 0
    });
    setInstructions('');
    setDoctorName(doctorProfile?.doctorName || '');
    setEditReason('');
    setAttachments([]);
    setSelectedPatientId('');
    setSelectedTransactionId('');
    setIsEditing(false);
    setEditingId('');
  };

  const handleAddMedication = () => {
    if (!currentMed.drugName || !currentMed.dosage) {
      toast.error('Please fill drug name and dosage');
      return;
    }
    setMedications([...medications, currentMed]);
    setCurrentMed({
      drugName: '',
      strength: '',
      dosage: '',
      frequency: '',
      duration: '',
      quantity: 0
    });
  };

  const handleRemoveMedication = (index: number) => {
    setMedications(medications.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!selectedTransactionId) {
      toast.error('Please select a transaction');
      return;
    }

    // Medications are now optional - validate only if instructions is also empty
    if (medications.length === 0 && !instructions.trim()) {
      toast.error('Please add at least one medication or provide instructions');
      return;
    }

    // Check if transaction already has a document (when creating new)
    if (!isEditing) {
      const existingPrescription = prescriptions.find(p => p.transactionId === selectedTransactionId);
      if (existingPrescription) {
        toast.error('This transaction already has a prescription. Please edit the existing document instead.');
        return;
      }
    }

    if (isEditing) {
      const existing = prescriptions.find(p => p.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          medications: existing.medications,
          instructions: existing.instructions,
          doctorName: existing.doctorName,
          // IMPORTANT: Save attachments snapshot for original version
          attachments: existing.attachments || []
        }]
        : [...existing.versions];

      // Create new version with snapshot of current form data including attachments
      const newVersion = {
        editedAt: new Date().toISOString(),
        editReason: editReason || undefined,
        medications,
        instructions,
        doctorName,
        // IMPORTANT: Save attachments snapshot for this version
        attachments: attachments || []
      };

      const updated: Prescription = {
        ...existing,
        medications,
        instructions,
        doctorName,
        // Current document uses latest attachments
        attachments,
        versions: [
          ...versions,
          newVersion
        ]
      };
      onUpdate(updated);
      toast.success('Prescription updated');
    } else {
      const prescription: Prescription = {
        id: `RX-${Date.now()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        medications,
        instructions,
        doctorName,
        attachments,
        versions: []
      };
      onAdd(prescription);
      toast.success('Prescription created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (prescription: Prescription) => {
    setIsEditing(true);
    setEditingId(prescription.id);
    setSelectedTransactionId(prescription.transactionId);
    const transaction = transactions.find(t => t.id === prescription.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setMedications(prescription.medications);
    setInstructions(prescription.instructions);
    setDoctorName(prescription.doctorName);
    setAttachments(prescription.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (prescription: Prescription) => {
    const transaction = transactions.find(t => t.id === prescription.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generatePrescriptionPDF(prescription, transaction, patient, doctorProfile);
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
            New Prescription
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Prescription</DialogTitle>
            <DialogDescription>
              Create prescription for medications and treatment
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
                  const existingPrescription = prescriptions.find(p => p.transactionId === selectedTransactionId);
                  if (existingPrescription) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has a prescription.</strong>
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

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <Label>Add Medications (Optional)</Label>
                <span className="text-xs text-muted-foreground">You can create a prescription with just instructions</span>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <Input placeholder="Drug Name" value={currentMed.drugName} onChange={(e) => setCurrentMed({ ...currentMed, drugName: e.target.value })} />
                <Input placeholder="Strength" value={currentMed.strength} onChange={(e) => setCurrentMed({ ...currentMed, strength: e.target.value })} />
                <Input placeholder="Dosage" value={currentMed.dosage} onChange={(e) => setCurrentMed({ ...currentMed, dosage: e.target.value })} />
                <Input placeholder="Frequency" value={currentMed.frequency} onChange={(e) => setCurrentMed({ ...currentMed, frequency: e.target.value })} />
                <Input placeholder="Duration" value={currentMed.duration} onChange={(e) => setCurrentMed({ ...currentMed, duration: e.target.value })} />
                <Input type="number" placeholder="Quantity" value={currentMed.quantity || ''} onChange={(e) => setCurrentMed({ ...currentMed, quantity: parseInt(e.target.value) || 0 })} />
              </div>
              <Button onClick={handleAddMedication} className="mt-2 w-full" type="button" variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Medication
              </Button>

              {medications.length > 0 && (
                <div className="mt-4 space-y-2">
                  {medications.map((med, index) => (
                    <div key={index} className="flex items-start justify-between p-3 bg-gray-50 rounded border">
                      <div className="flex-1">
                        <p><strong>{med.drugName}</strong> {med.strength}</p>
                        <p className="text-sm text-gray-600">{med.dosage} | {med.frequency} | {med.duration} | Qty: {med.quantity}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRemoveMedication(index)}>
                        <Trash2 className="w-4 h-4 text-red-600" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label>Instructions</Label>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={3}
                placeholder="Enter prescription instructions (required if no medications are added)"
              />
            </div>

            <div>
              <Label>Doctor Name *</Label>
              <Input
                value={doctorName}
                onChange={(e) => setDoctorName(e.target.value)}
              />
            </div>

            <FileUpload label="Attachments (Optional)" files={attachments} onFilesChange={setAttachments} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit}>{isEditing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {prescriptions.map(prescription => {
          const transaction = transactions.find(t => t.id === prescription.transactionId);
          return (
            <Card key={prescription.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(prescription.date)} | {prescription.medications.length > 0 ? `${prescription.medications.length} medication(s)` : 'Instructions only'}
                  {prescription.versions.length > 0 && ` (${prescription.versions.length} revision${prescription.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  {prescription.medications.length > 0 ? (
                    <>
                      {prescription.medications.slice(0, 2).map((med, idx) => (
                        <p key={idx}>• {med.drugName} - {med.dosage}</p>
                      ))}
                      {prescription.medications.length > 2 && <p className="text-gray-500">+ {prescription.medications.length - 2} more</p>}
                    </>
                  ) : (
                    <p className="text-muted-foreground italic">No medications listed</p>
                  )}
                  {prescription.instructions && prescription.medications.length === 0 && (
                    <p className="text-sm line-clamp-2">{prescription.instructions}</p>
                  )}
                  <p><strong>Doctor:</strong> Dr. {prescription.doctorName}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(prescription)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(prescription)}>
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
