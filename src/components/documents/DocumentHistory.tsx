import { useState, useEffect, useRef } from 'react';
import { Transaction, Patient, DoctorProfile } from '../../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { PatientCombobox } from '../PatientCombobox';
import { Label } from '../ui/label';
import { Badge } from '../ui/badge';
import { History, ChevronDown, ChevronUp, Download, Eye, Calendar, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { AttachmentViewer } from './AttachmentViewer';

interface DocumentHistoryProps {
  transactions: Transaction[];
  patients: Patient[];
  documents: any[];
  documentType: string;
  doctorProfile?: DoctorProfile;
  onDownloadPDF?: (doc: any, transaction: Transaction, patient: Patient, doctorProfile?: DoctorProfile) => void;
  renderDocumentDetails?: (doc: any) => React.ReactNode;
  initialFilterDocumentId?: string;
  initialFilterDate?: string;
  forwardedRef?: React.RefObject<HTMLDivElement | null>;
}

export function DocumentHistory({ 
  transactions, 
  patients, 
  documents, 
  documentType,
  doctorProfile,
  onDownloadPDF,
  renderDocumentDetails,
  initialFilterDocumentId,
  initialFilterDate,
  forwardedRef
}: DocumentHistoryProps) {
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [dateRange, setDateRange] = useState({ start: initialFilterDate || '', end: initialFilterDate || '' });
  const [showDateFilter, setShowDateFilter] = useState(!!initialFilterDate);
  const [expandedDocs, setExpandedDocs] = useState<Set<string>>(new Set());
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const localRef = useRef<HTMLDivElement>(null);
  const cardRef = forwardedRef || localRef;
  const highlightedDocRef = useRef<HTMLDivElement>(null);

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
    if (initialFilterDocumentId) {
      const doc = documents.find(d => d.id === initialFilterDocumentId);
      if (doc) {
        const transaction = transactions.find(t => t.id === doc.transactionId);
        if (transaction) {
          setSelectedPatientId(transaction.patientId);
          setExpandedDocs(new Set([doc.id]));
          // Scroll to highlighted document after a delay
          setTimeout(() => {
            highlightedDocRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 500);
        }
      }
    }
  }, [initialFilterDocumentId, documents, transactions]);

  const setTodayFilter = () => {
    const today = new Date().toISOString().split('T')[0];
    setDateRange({ start: today, end: today });
    setShowDateFilter(true);
  };

  const toggleExpanded = (docId: string) => {
    const newExpanded = new Set(expandedDocs);
    if (newExpanded.has(docId)) {
      newExpanded.delete(docId);
    } else {
      newExpanded.add(docId);
    }
    setExpandedDocs(newExpanded);
  };

  const toggleVersionExpanded = (versionKey: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(versionKey)) {
      newExpanded.delete(versionKey);
    } else {
      newExpanded.add(versionKey);
    }
    setExpandedVersions(newExpanded);
  };

  // Filter documents by selected patient and date range
  const filteredDocuments = documents.filter(doc => {
    const transaction = transactions.find(t => t.id === doc.transactionId);
    if (!transaction) return false;
    
    // Filter by patient
    if (selectedPatientId && transaction.patientId !== selectedPatientId) return false;
    
    // Filter by date range if active
    if (showDateFilter) {
      const transDate = getDateString(transaction.time);
      if (!transDate) return false;
      if (dateRange.start && transDate < dateRange.start) return false;
      if (dateRange.end && transDate > dateRange.end) return false;
    }
    
    return true;
  });

  // Group by patient
  const documentsByPatient: { [key: string]: any[] } = {};
  filteredDocuments.forEach(doc => {
    const transaction = transactions.find(t => t.id === doc.transactionId);
    if (transaction) {
      if (!documentsByPatient[transaction.patientId]) {
        documentsByPatient[transaction.patientId] = [];
      }
      documentsByPatient[transaction.patientId].push({ ...doc, transaction });
    }
  });

  // Sort documents within each patient group by date - latest first
  Object.keys(documentsByPatient).forEach(patientId => {
    documentsByPatient[patientId].sort((a, b) => 
      new Date(b.transaction.time).getTime() - new Date(a.transaction.time).getTime()
    );
  });

  const handleDownloadVersion = (doc: any, version: any, versionIndex: number) => {
    if (onDownloadPDF) {
      const transaction = transactions.find(t => t.id === doc.transactionId);
      const patient = patients.find(p => p.id === transaction?.patientId);
      if (transaction && patient) {
        // Create a document object from the version
        const versionDoc = {
          ...doc,
          ...version,
          id: `${doc.id}-v${versionIndex + 1}`
        };
        onDownloadPDF(versionDoc, transaction, patient);
      }
    }
  };

  const renderVersionDetails = (version: any, doc?: any) => {
    if (!version) return null;
    
    // Check if this is a document (not a version) by checking for document-specific fields
    const isDocument = version.hasOwnProperty('transactionId') || version.hasOwnProperty('id');
    
    // For versions, use version attachments if available, otherwise fall back to document attachments
    // For documents, use document attachments directly
    const attachments = isDocument ? (version.attachments || []) : (version.attachments || doc?.attachments || []);
    const medicalRecords = isDocument ? (version.medicalRecords || []) : (version.medicalRecords || doc?.medicalRecords || []);
    const prescriptions = isDocument ? (version.prescriptions || []) : (version.prescriptions || doc?.prescriptions || []);
    
    // Fields to exclude from display
    const excludeFields = ['editedAt', 'editReason', 'attachments', 'medicalRecords', 'prescriptions', 'id', 'transactionId', 'date', 'issueDate', 'signatureDate', 'versions', 'createdAt'];
    
    return (
      <div className="space-y-2 text-sm">
        {version.editReason && (
          <div className="p-2 bg-blue-50 rounded">
            <p className="text-blue-900"><strong>Edit Reason:</strong> {version.editReason}</p>
          </div>
        )}
        {Object.entries(version)
          .filter(([key]) => !excludeFields.includes(key))
          .map(([key, value]) => (
            <div key={key} className="border-b pb-2">
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </p>
              <p className="text-gray-800">
                {typeof value === 'object' && !Array.isArray(value)
                  ? JSON.stringify(value, null, 2) 
                  : String(value)}
              </p>
            </div>
          ))}
        
        {/* Show medical records if available (for Informed Consent) */}
        {medicalRecords && medicalRecords.length > 0 && (
          <AttachmentViewer attachments={medicalRecords} title="Medical Records" />
        )}
        
        {/* Show prescriptions if available (for Informed Consent) */}
        {prescriptions && prescriptions.length > 0 && (
          <AttachmentViewer attachments={prescriptions} title="Prescriptions" />
        )}
        
        {/* Show attachments */}
        {attachments && attachments.length > 0 && (
          <AttachmentViewer attachments={attachments} title="Attachments" />
        )}
      </div>
    );
  };

  return (
    <div ref={cardRef}>
      <Card className="mt-6">
        <CardHeader>
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  {documentType} History
                </CardTitle>
                <CardDescription>View all {documentType.toLowerCase()}s by patient</CardDescription>
              </div>
            </div>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label>Filter by Patient</Label>
                <PatientCombobox
                  patients={patients}
                  value={selectedPatientId}
                  onValueChange={setSelectedPatientId}
                  placeholder="All patients"
                />
              </div>
              <Button variant="outline" size="sm" onClick={setTodayFilter}>
                <Calendar className="w-4 h-4 mr-2" />
                Today
              </Button>
              <Input
                type="date"
                placeholder="Start Date"
                value={dateRange.start}
                onChange={(e) => {
                  setDateRange({ ...dateRange, start: e.target.value });
                  setShowDateFilter(true);
                }}
                className="w-40"
              />
              <Input
                type="date"
                placeholder="End Date"
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
          </div>
        </CardHeader>
      <CardContent>
        {Object.keys(documentsByPatient).length === 0 ? (
          <p className="text-center text-gray-500 py-8">No {documentType.toLowerCase()}s found</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(documentsByPatient).map(([patientId, docs]) => {
              const patient = patients.find(p => p.id === patientId);
              return (
                <Card key={patientId}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">{patient?.name || 'Unknown Patient'}</CardTitle>
                    <CardDescription>{docs.length} document(s)</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {docs.map(doc => {
                        const transaction = transactions.find(t => t.id === doc.transactionId);
                        const patient = patients.find(p => p.id === transaction?.patientId);
                        const isHighlighted = initialFilterDocumentId === doc.id;
                        
                        return (
                          <div 
                            key={doc.id}
                            ref={isHighlighted ? highlightedDocRef : null}
                            className={`border rounded-lg ${isHighlighted ? 'border-2 border-teal shadow-md' : ''}`}
                          >
                            <div className={`p-3 ${isHighlighted ? 'bg-teal/10' : 'bg-gray-50'}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm">
                                      <strong>Transaction:</strong> {doc.transaction.id}
                                    </p>
                                    {isHighlighted && (
                                      <Badge className="!bg-[#5dade2] !text-white text-xs">
                                        ✓ Filtered Result
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600">
                                    Created: {new Date(doc.date || doc.issueDate).toLocaleString()}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Dialog>
                                    <DialogTrigger asChild>
                                      <Button variant="outline" size="sm">
                                        <Eye className="w-3 h-3 mr-1" />
                                        View Full
                                      </Button>
                                    </DialogTrigger>
                                              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                <DialogHeader>
                                                  <DialogTitle>
                                                    {documentType} - Current Version {doc.versions.length > 0 ? `(Version ${doc.versions.length + 1})` : '(Version 1)'}
                                                  </DialogTitle>
                                                </DialogHeader>
                                                {renderVersionDetails(doc, doc)}
                                              </DialogContent>
                                  </Dialog>
                                  {onDownloadPDF && transaction && patient && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onDownloadPDF(doc, transaction, patient, doctorProfile)}
                                    >
                                      <Download className="w-3 h-3 mr-1" />
                                      PDF
                                    </Button>
                                  )}
                                  {doc.versions && doc.versions.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => toggleExpanded(doc.id)}
                                    >
                                      {expandedDocs.has(doc.id) ? (
                                        <>
                                          <ChevronUp className="w-4 h-4 mr-1" />
                                          Hide {doc.versions.length} version(s)
                                        </>
                                      ) : (
                                        <>
                                          <ChevronDown className="w-4 h-4 mr-1" />
                                          Show {doc.versions.length} version(s)
                                        </>
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {expandedDocs.has(doc.id) && doc.versions && doc.versions.length > 0 && (
                              <div className="p-3 space-y-3 border-t">
                                <p className="text-xs uppercase tracking-wide text-gray-500 mb-2">
                                  Past Versions ({doc.versions.length})
                                </p>
                                {doc.versions.map((version: any, idx: number) => {
                                  const versionKey = `${doc.id}-v${idx}`;
                                  const isVersionExpanded = expandedVersions.has(versionKey);
                                  
                                  return (
                                    <div key={idx} className="border rounded bg-white">
                                      <div className="p-3 bg-gray-50 border-b">
                                        <div className="flex items-center justify-between">
                                          <div className="flex-1">
                                            <p className="text-sm">
                                              <strong>Version {idx + 1}</strong>
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              Edited: {new Date(version.editedAt).toLocaleString()}
                                            </p>
                                            {version.editReason && (
                                              <p className="text-xs text-gray-700 mt-1 bg-blue-50 px-2 py-1 rounded">
                                                <strong className="text-teal">Reason:</strong> {version.editReason}
                                              </p>
                                            )}
                                          </div>
                                          <div className="flex gap-2">
                                            <Dialog>
                                              <DialogTrigger asChild>
                                                <Button variant="outline" size="sm">
                                                  <Eye className="w-3 h-3 mr-1" />
                                                  View Full
                                                </Button>
                                              </DialogTrigger>
                                              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                                                <DialogHeader>
                                                  <DialogTitle>
                                                    {documentType} - Version {idx + 1}
                                                  </DialogTitle>
                                                </DialogHeader>
                                                {renderVersionDetails(version, doc)}
                                              </DialogContent>
                                            </Dialog>
                                            {onDownloadPDF && transaction && patient && (
                                              <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDownloadVersion(doc, version, idx)}
                                              >
                                                <Download className="w-3 h-3 mr-1" />
                                                PDF
                                              </Button>
                                            )}
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              onClick={() => toggleVersionExpanded(versionKey)}
                                            >
                                              {isVersionExpanded ? (
                                                <ChevronUp className="w-4 h-4" />
                                              ) : (
                                                <ChevronDown className="w-4 h-4" />
                                              )}
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                      {isVersionExpanded && (
                                        <div className="p-3">
                                          {renderVersionDetails(version, doc)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}
