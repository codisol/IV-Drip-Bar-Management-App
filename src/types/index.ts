export interface Patient {
  id: string;
  name: string;
  phone: string;
  gender: 'Male' | 'Female' | 'Other';
  dob: string;
  createdAt: string;
  isQuickRegistration?: boolean;
}

export interface Transaction {
  id: string;
  patientId: string;
  patientName: string;
  time: string;
  totalPayment: number;
  status: 'On Progress' | 'Paid';
  drugsUsed: Array<{
    drugId: string;
    drugName: string;
    batchNumber: string;
    quantity: number;
  }>;
  createdAt: string;
  paidAt?: string;
}

export interface SoapNote {
  id: string;
  transactionId: string;
  date: string;
  subjective?: string;
  objective?: string;
  assessment: string;
  plan: string;
  attachments?: string[]; // base64 encoded files (images/pdfs)
  versions: Array<{
    editedAt: string;
    editReason?: string;
    subjective?: string;
    objective?: string;
    assessment: string;
    plan: string;
    attachments?: string[]; // base64 encoded files (images/pdfs) - snapshot per version
  }>;
}

export interface InformedConsent {
  id: string;
  transactionId: string;
  date: string;
  procedureDescription: string;
  risks: string;
  benefits: string;
  alternatives: string;
  medicalRecords: string[]; // base64 encoded images
  prescriptions: string[]; // base64 encoded images
  attachments?: string[]; // base64 encoded files (images/pdfs)
  consentGiven: boolean;
  signatureDate: string;
  versions: Array<{
    editedAt: string;
    editReason?: string;
    procedureDescription: string;
    risks: string;
    benefits: string;
    alternatives: string;
    consentGiven: boolean;
  }>;
}

export interface DeclinationLetter {
  id: string;
  transactionId: string;
  date: string;
  treatmentDeclined: string;
  reasonForDeclination: string;
  risksExplained: string;
  medicalRecords: string[]; // base64 encoded images
  prescriptions: string[]; // base64 encoded images
  attachments?: string[]; // base64 encoded files (images/pdfs)
  signatureDate: string;
  versions: Array<{
    editedAt: string;
    editReason?: string;
    treatmentDeclined: string;
    reasonForDeclination: string;
    risksExplained: string;
  }>;
}

export interface SickLeave {
  id: string;
  transactionId: string;
  issueDate: string;
  diagnosis: string;
  startDate: string;
  endDate: string;
  numberOfDays: number;
  recommendations: string;
  doctorName: string;
  attachments?: string[]; // base64 encoded files (images/pdfs)
  versions: Array<{
    editedAt: string;
    editReason?: string;
    diagnosis: string;
    startDate: string;
    endDate: string;
    numberOfDays: number;
    recommendations: string;
    doctorName: string;
  }>;
}

export interface ReferralLetter {
  id: string;
  transactionId: string;
  date: string;
  referringTo: string;
  specialty: string;
  reasonForReferral: string;
  relevantHistory: string;
  currentMedications: string;
  urgency: 'Routine' | 'Urgent' | 'Emergency';
  doctorName: string;
  attachments?: string[]; // base64 encoded files (images/pdfs)
  versions: Array<{
    editedAt: string;
    editReason?: string;
    referringTo: string;
    specialty: string;
    reasonForReferral: string;
    relevantHistory: string;
    currentMedications: string;
    urgency: 'Routine' | 'Urgent' | 'Emergency';
  }>;
}

export interface Prescription {
  id: string;
  transactionId: string;
  date: string;
  medications: Array<{
    drugName: string;
    strength: string;
    dosage: string;
    frequency: string;
    duration: string;
    quantity: number;
  }>;
  instructions: string;
  doctorName: string;
  attachments?: string[]; // base64 encoded files (images/pdfs)
  versions: Array<{
    editedAt: string;
    editReason?: string;
    medications: Array<{
      drugName: string;
      strength: string;
      dosage: string;
      frequency: string;
      duration: string;
      quantity: number;
    }>;
    instructions: string;
    doctorName?: string;
  }>;
}

export interface FitnessCertificate {
  id: string;
  transactionId: string;
  date: string;
  purpose: string;
  fitForActivity: boolean;
  limitations?: string;
  validUntil: string;
  doctorName: string;
  attachments?: string[]; // base64 encoded files (images/pdfs)
  versions: Array<{
    editedAt: string;
    editReason?: string;
    purpose: string;
    fitForActivity: boolean;
    limitations?: string;
    validUntil: string;
  }>;
}

export interface InventoryItem {
  id: string;
  genericName: string;
  brandName: string;
  strength: string;
  batchNumber: string;
  quantity: number;
  expiryDate: string;
  expirationDate?: string; // Alias for compatibility
  dateReceived: string;
  storageLocation: string;
  drugClass: string;
  reorderLevel: number;
  notes?: string;
}

export interface InventoryTransaction {
  id: string;
  inventoryItemId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  date: string;
  reason?: string;
  performedBy?: string;
  transactionId?: string; // Link to main Transaction for OUT operations
  patientId?: string;
  batchNumber: string;
}

export interface TriageEntry {
  id: string;
  patientId: string;
  patientName: string;
  level: 'Priority' | 'Standard' | 'Wellness';
  chiefComplaint?: string;
  arrivalTime: string;
  vitals?: {
    bloodPressure?: string;
    heartRate?: string;
    temperature?: string;
    oxygenSaturation?: string;
  };
  notes?: string;
  status: 'Waiting' | 'In Progress' | 'Completed';
  completedAt?: string;
  transactionId?: string; // optional link to the created Transaction (when triage created transaction)
}

export interface DoctorProfile {
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  permitCode: string;
  specialization?: string;
  phoneNumber?: string;
  email?: string;
}

export interface AppData {
  patients: Patient[];
  transactions: Transaction[];
  soapNotes: SoapNote[];
  inventory: InventoryItem[];
  inventoryTransactions: InventoryTransaction[];
  informedConsents: InformedConsent[];
  declinationLetters: DeclinationLetter[];
  sickLeaves: SickLeave[];
  referralLetters: ReferralLetter[];
  prescriptions: Prescription[];
  fitnessCertificates: FitnessCertificate[];
  triageQueue: TriageEntry[];
  doctorProfile?: DoctorProfile;
  version: string;
}
