import { useState, useEffect } from 'react';
import { formatDate } from '../../utils/dateFormatter';
import { Transaction, Patient, SickLeave, DoctorProfile } from '../../types';
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
import { generateSickLeavePDF } from '../../utils/pdfGenerator';
import { Alert, AlertDescription } from '../ui/alert';

interface SickLeaveFormProps {
  transactions: Transaction[];
  patients: Patient[];
  sickLeaves: SickLeave[];
  doctorProfile?: DoctorProfile;
  onAdd: (leave: SickLeave) => void;
  onUpdate: (leave: SickLeave) => void;
}

export function SickLeaveForm({ transactions, patients, sickLeaves, doctorProfile, onAdd, onUpdate }: SickLeaveFormProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [selectedTransactionId, setSelectedTransactionId] = useState('');
  const [formData, setFormData] = useState({
    diagnosis: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    recommendations: '',
    doctorName: ''
  });
  const [editReason, setEditReason] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);

  const calculateDays = () => {
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    return diffDays;
  };

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
      diagnosis: '',
      startDate: new Date().toISOString().split('T')[0],
      endDate: new Date().toISOString().split('T')[0],
      recommendations: '',
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
      const existingSickLeave = sickLeaves.find(s => s.transactionId === selectedTransactionId);
      if (existingSickLeave) {
        toast.error('This transaction already has a sick leave certificate. Please edit the existing document instead.');
        return;
      }
    }

    const numberOfDays = calculateDays();

    if (isEditing) {
      const existing = sickLeaves.find(s => s.id === editingId);
      if (!existing) return;

      // If this is the first edit, save the original version with ALL data including attachments
      const versions = existing.versions.length === 0
        ? [{
          editedAt: existing.issueDate,
          diagnosis: existing.diagnosis,
          startDate: existing.startDate,
          endDate: existing.endDate,
          numberOfDays: existing.numberOfDays,
          recommendations: existing.recommendations,
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
        numberOfDays,
        // IMPORTANT: Save attachments snapshot for this version
        attachments: attachments || []
      };

      const updated: SickLeave = {
        ...existing,
        ...formData,
        numberOfDays,
        // Current document uses latest attachments
        attachments,
        versions: [
          ...versions,
          newVersion
        ]
      };
      onUpdate(updated);
      toast.success('Sick leave updated');
    } else {
      const leave: SickLeave = {
        id: `SL-${Date.now()}`,
        transactionId: selectedTransactionId,
        issueDate: new Date().toISOString(),
        ...formData,
        doctorName: doctorProfile?.doctorName || formData.doctorName,
        numberOfDays,
        attachments,
        versions: []
      };
      onAdd(leave);
      toast.success('Sick leave created');
    }

    resetForm();
    setIsDialogOpen(false);
  };

  const handleEdit = (leave: SickLeave) => {
    setIsEditing(true);
    setEditingId(leave.id);
    setSelectedTransactionId(leave.transactionId);
    const transaction = transactions.find(t => t.id === leave.transactionId);
    if (transaction) {
      setSelectedPatientId(transaction.patientId);
    }
    setFormData({
      diagnosis: leave.diagnosis,
      startDate: leave.startDate,
      endDate: leave.endDate,
      recommendations: leave.recommendations,
      doctorName: leave.doctorName
    });
    setAttachments(leave.attachments || []);
    setIsDialogOpen(true);
  };

  const handleDownloadPDF = (leave: SickLeave) => {
    const transaction = transactions.find(t => t.id === leave.transactionId);
    const patient = patients.find(p => p.id === transaction?.patientId);
    if (transaction && patient) {
      generateSickLeavePDF(leave, transaction, patient, doctorProfile);
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
            New Sick Leave
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit' : 'Create'} Sick Leave Certificate</DialogTitle>
            <DialogDescription>
              Issue medical leave documentation for patient
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {!doctorProfile && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  No doctor profile found. Please configure your profile in the Profile tab for auto-populated fields.
                </AlertDescription>
              </Alert>
            )}
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
                  const existingSickLeave = sickLeaves.find(s => s.transactionId === selectedTransactionId);
                  if (existingSickLeave) {
                    return (
                      <Alert className="mt-2 border-orange-200 bg-orange-50">
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-900">
                          <strong>This transaction already has a sick leave certificate.</strong>
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
              <Label>Diagnosis *</Label>
              <Textarea
                value={formData.diagnosis}
                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 rounded">
              <p className="text-sm">Number of Days: <strong>{calculateDays()}</strong></p>
            </div>

            <div>
              <Label>Recommendations *</Label>
              <Textarea
                value={formData.recommendations}
                onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                rows={3}
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
        {sickLeaves.map(leave => {
          const transaction = transactions.find(t => t.id === leave.transactionId);
          return (
            <Card key={leave.id}>
              <CardHeader>
                <CardTitle className="text-sm">{transaction?.patientName || 'Unknown Patient'}</CardTitle>
                <CardDescription>
                  {formatDate(leave.issueDate)} | {leave.numberOfDays} days
                  {leave.versions.length > 0 && ` (${leave.versions.length} revision${leave.versions.length > 1 ? 's' : ''})`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Diagnosis:</strong> {leave.diagnosis.substring(0, 50)}...</p>
                  <p><strong>Period:</strong> {formatDate(leave.startDate)} - {formatDate(leave.endDate)}</p>
                  <p><strong>Doctor:</strong> Dr. {leave.doctorName}</p>
                </div>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => handleEdit(leave)}>
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadPDF(leave)}>
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
