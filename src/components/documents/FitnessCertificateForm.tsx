import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, FitnessCertificate, DoctorProfile } from '../../types';
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
import { generateFitnessCertificatePDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface FitnessCertificateFormProps {
  transactions: Transaction[];
  patients: Patient[];
  certificates: FitnessCertificate[];
  doctorProfile?: DoctorProfile;
  onAdd: (certificate: FitnessCertificate) => void;
  onUpdate: (certificate: FitnessCertificate) => void;
}

export function FitnessCertificateForm({ transactions, patients, certificates, doctorProfile, onAdd, onUpdate }: FitnessCertificateFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    purpose: '',
    fitForActivity: true,
    limitations: '',
    validUntil: '',
    doctorName: ''
  });
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  // Auto-populate doctor name from profile
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
      purpose: '',
      fitForActivity: true,
      limitations: '',
      validUntil: '',
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
      const existingCertificate = certificates.find(c => c.transactionId === selectedTransactionId);
      if (existingCertificate) {
        toast.error('This transaction already has a fitness certificate. Please edit the existing document instead.');
        return;
      }
    }

    if (isEditing) {
      const existing = certificates.find(c => c.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.date,
          purpose: existing.purpose,
          fitForActivity: existing.fitForActivity,
          limitations: existing.limitations,
          validUntil: existing.validUntil,
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

      const updated: FitnessCertificate = {
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
      toast.success('Fitness certificate updated');
    } else {
      const certificate: FitnessCertificate = {
        id: `FC-${Date.now()}`,
        transactionId: selectedTransactionId,
        date: new Date().toISOString(),
        ...formData,
        doctorName: doctorProfile?.doctorName || formData.doctorName,
        attachments,
        versions: []
      };
      onAdd(certificate);
      toast.success('Fitness certificate created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (certificate: FitnessCertificate) => {
    setIsEditing(true);
    setEditingId(certificate.id);
    setSelectedTransactionId(certificate.transactionId);
    const transaction = transactions.find(t => t.id === certificate.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      purpose: certificate.purpose,
      fitForActivity: certificate.fitForActivity,
      limitations: certificate.limitations || '',
      validUntil: certificate.validUntil,
      doctorName: certificate.doctorName
    });
    setAttachments(certificate.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (certificate: FitnessCertificate) => {
    const transaction = transactions.find(t => t.id === certificate.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateFitnessCertificatePDF(certificate, transaction, patient, doctorProfile);
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
            New Fitness Certificate
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Fitness Certificate</DialogTitle>
            <DialogDescription>
              Issue medical fitness certificate for work or activities
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
                  const existingCertificate = certificates.find(c => c.transactionId === selectedTransactionId);
                  if (existingCertificate) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has a fitness certificate.</strong>
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
              <Label>Purpose *</Label>
              <Textarea
                value={formData.purpose}
                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                rows={2}
                placeholder="e.g., Employment, Sports, School"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                checked={formData.fitForActivity}
                onCheckedChange={(checked) => setFormData({ ...formData, fitForActivity: checked })}
              />
              <Label>Fit for Activity</Label>
            </div>

            {!formData.fitForActivity && (
              <div>
                <Label>Limitations</Label>
                <Textarea
                  value={formData.limitations}
                  onChange={(e) => setFormData({ ...formData, limitations: e.target.value })}
                  rows={3}
                />
              </div>
            )}

            <div>
              <Label>Valid Until *</Label>
              <Input
                type="date"
                value={formData.validUntil}
                onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
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
        {certificates.map(certificate => {
          const transaction = transactions.find(t => t.id === certificate.transactionId);
          return (
            <Card key={certificate.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(certificate.date)}
                  {certificate.versions.length > 0 && ` (${certificate.versions.length} revision${certificate.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Purpose:</strong> {certificate.purpose}</p>
                  <p><strong>Status:</strong> {certificate.fitForActivity ? 'Fit' : 'Not Fit'}</p>
                  <p><strong>Valid Until:</strong> {formatDate(certificate.validUntil)}</p>
                  <p><strong>Doctor:</strong> Dr. {certificate.doctorName}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(certificate)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(certificate)}>
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
