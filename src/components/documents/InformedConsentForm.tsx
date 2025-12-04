import { useState } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, InformedConsent, DoctorProfile } from '../../types';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Switch } from '../ui/switch';
import { PatientCombobox } from '../PatientCombobox';
import { TransactionCombobox } from '../TransactionCombobox';
import { FileUpload } from './FileUpload';
import { Plus, Download, Edit, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { generateInformedConsentPDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface InformedConsentFormProps {
  transactions: Transaction[];
  patients: Patient[];
  consents: InformedConsent[];
  doctorProfile?: DoctorProfile;
  onAdd: (consent: InformedConsent) => void;
  onUpdate: (consent: InformedConsent) => void;
}

export function InformedConsentForm({ transactions, patients, consents, doctorProfile, onAdd, onUpdate }: InformedConsentFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    procedureDescription: '',
    risks: '',
    benefits: '',
    alternatives: '',
    consentGiven: false,
    signatureDate: new Date().toISOString().split('T')[0]
  });
  const [editReason, setEditReason] = useState('');
  const [medicalRecords, setMedicalRecords] = useState<string[]>([]);
  const [prescriptions, setPrescriptions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<string[]>([]);

  const resetForm = () => {
    setFormData({
      procedureDescription: '',
      risks: '',
      benefits: '',
      alternatives: '',
      consentGiven: false,
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
      const existingConsent = consents.find(c => c.transactionId === selectedTransactionId);
      if (existingConsent) {
        toast.error('This transaction already has an informed consent document. Please edit the existing document instead.');
        return;
      }
    }

    if (isEditing) {
      const existing = consents.find(c => c.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          procedureDescription: existing.procedureDescription,
          risks: existing.risks,
          benefits: existing.benefits,
          alternatives: existing.alternatives,
          consentGiven: existing.consentGiven,
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
        procedureDescription: formData.procedureDescription,
        risks: formData.risks,
        benefits: formData.benefits,
        alternatives: formData.alternatives,
        consentGiven: formData.consentGiven,
        // IMPORTANT: Save attachments snapshot for this version
        medicalRecords: medicalRecords || [],
        prescriptions: prescriptions || [],
        attachments: attachments || []
      };

      const updated: InformedConsent = {
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
      toast.success('Informed consent updated');
    } else {
      const consent: InformedConsent = {
        id: `IC-${Date.now()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        ...formData,
        medicalRecords,
        prescriptions,
        attachments,
        versions: []
      };
      onAdd(consent);
      toast.success('Informed consent created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (consent: InformedConsent) => {
    setIsEditing(true);
    setEditingId(consent.id);
    setSelectedTransactionId(consent.transactionId);
    const transaction = transactions.find(t => t.id === consent.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      procedureDescription: consent.procedureDescription,
      risks: consent.risks,
      benefits: consent.benefits,
      alternatives: consent.alternatives,
      consentGiven: consent.consentGiven,
      signatureDate: consent.signatureDate
    });
    setMedicalRecords(consent.medicalRecords || []);
    setPrescriptions(consent.prescriptions || []);
    setAttachments(consent.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (consent: InformedConsent) => {
    const transaction = transactions.find(t => t.id === consent.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateInformedConsentPDF(consent, transaction, patient, doctorProfile);
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
            New Informed Consent
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Informed Consent</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update informed consent (creates new version)' : 'Create a new informed consent form'}
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
                  const existingConsent = consents.find(c => c.transactionId === selectedTransactionId);
                  if (existingConsent) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has an informed consent document.</strong>
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
              <Label>Procedure Description *</Label>
              <Textarea
                value={formData.procedureDescription}
                onChange={(e) => setFormData({ ...formData, procedureDescription: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Risks *</Label>
              <Textarea
                value={formData.risks}
                onChange={(e) => setFormData({ ...formData, risks: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Benefits *</Label>
              <Textarea
                value={formData.benefits}
                onChange={(e) => setFormData({ ...formData, benefits: e.target.value })}
                rows={3}
              />
            </div>

            <div>
              <Label>Alternatives *</Label>
              <Textarea
                value={formData.alternatives}
                onChange={(e) => setFormData({ ...formData, alternatives: e.target.value })}
                rows={3}
              />
            </div>

            <FileUpload
              label="Medical Records (Optional)"
              files={medicalRecords}
              onFilesChange={setMedicalRecords}
            />

            <FileUpload
              label="Prescriptions (Optional)"
              files={prescriptions}
              onFilesChange={setPrescriptions}
            />

            <FileUpload
              label="Additional Attachments (Optional)"
              files={attachments}
              onFilesChange={setAttachments}
            />

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.consentGiven}
                onCheckedChange={(checked) => setFormData({ ...formData, consentGiven: checked })}
              />
              <Label>Consent Given</Label>
            </div>

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
        {consents.map(consent => {
          const transaction = transactions.find(t => t.id === consent.transactionId);
          return (
            <Card key={consent.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(consent.date)}
                  {consent.versions.length > 0 && ` (${consent.versions.length} revision${consent.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Procedure:</strong> {consent.procedureDescription.substring(0, 50)}...</p>
                  <p><strong>Consent:</strong> {consent.consentGiven ? 'Given' : 'Not Given'}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(consent)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(consent)}>
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
