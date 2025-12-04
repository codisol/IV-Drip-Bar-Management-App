import { useState, useEffect, useRef } from 'react';
import { Transaction, Patient, InformedConsent, DeclinationLetter, SickLeave, ReferralLetter, Prescription, FitnessCertificate, DoctorProfile } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { InformedConsentForm } from './documents/InformedConsentForm';
import { DeclinationLetterForm } from './documents/DeclinationLetterForm';
import { SickLeaveForm } from './documents/SickLeaveForm';
import { ReferralLetterForm } from './documents/ReferralLetterForm';
import { PrescriptionForm } from './documents/PrescriptionForm';
import { FitnessCertificateForm } from './documents/FitnessCertificateForm';
import { DocumentHistory } from './documents/DocumentHistory';
import { 
  generateInformedConsentPDF, 
  generateDeclinationLetterPDF,
  generateSickLeavePDF,
  generateReferralLetterPDF,
  generatePrescriptionPDF,
  generateFitnessCertificatePDF
} from '../utils/pdfGenerator';

interface DocumentsProps {
  transactions: Transaction[];
  patients: Patient[];
  informedConsents: InformedConsent[];
  declinationLetters: DeclinationLetter[];
  sickLeaves: SickLeave[];
  referralLetters: ReferralLetter[];
  prescriptions: Prescription[];
  fitnessCertificates: FitnessCertificate[];
  doctorProfile?: DoctorProfile;
  onAddInformedConsent: (consent: InformedConsent) => void;
  onUpdateInformedConsent: (consent: InformedConsent) => void;
  onAddDeclinationLetter: (letter: DeclinationLetter) => void;
  onUpdateDeclinationLetter: (letter: DeclinationLetter) => void;
  onAddSickLeave: (leave: SickLeave) => void;
  onUpdateSickLeave: (leave: SickLeave) => void;
  onAddReferralLetter: (letter: ReferralLetter) => void;
  onUpdateReferralLetter: (letter: ReferralLetter) => void;
  onAddPrescription: (prescription: Prescription) => void;
  onUpdatePrescription: (prescription: Prescription) => void;
  onAddFitnessCertificate: (certificate: FitnessCertificate) => void;
  onUpdateFitnessCertificate: (certificate: FitnessCertificate) => void;
  initialDocumentId?: string;
  initialDocumentType?: string;
  initialFilterDate?: string;
}

export function Documents({
  transactions,
  patients,
  informedConsents,
  declinationLetters,
  sickLeaves,
  referralLetters,
  prescriptions,
  fitnessCertificates,
  doctorProfile,
  onAddInformedConsent,
  onUpdateInformedConsent,
  onAddDeclinationLetter,
  onUpdateDeclinationLetter,
  onAddSickLeave,
  onUpdateSickLeave,
  onAddReferralLetter,
  onUpdateReferralLetter,
  onAddPrescription,
  onUpdatePrescription,
  onAddFitnessCertificate,
  onUpdateFitnessCertificate,
  initialDocumentId,
  initialDocumentType,
  initialFilterDate
}: DocumentsProps) {
  const [activeTab, setActiveTab] = useState('informed-consent');
  const documentHistoryRef = useRef<HTMLDivElement>(null);

  // Map document types to their tab values
  const documentTypeToTab: { [key: string]: string } = {
    'informed_consent': 'informed-consent',
    'declination_letter': 'declination',
    'sick_leave': 'sick-leave',
    'referral_letter': 'referral',
    'prescription': 'prescription',
    'fitness_certificate': 'fitness'
  };

  // Handle initial document navigation
  useEffect(() => {
    if (initialDocumentId && initialDocumentType) {
      const tabValue = documentTypeToTab[initialDocumentType];
      if (tabValue) {
        setActiveTab(tabValue);
        // Scroll to document history section after a short delay
        setTimeout(() => {
          documentHistoryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }, [initialDocumentId, initialDocumentType]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dokumen Medis</CardTitle>
        <CardDescription>Buat dan kelola dokumen medis pasien</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="informed-consent">Persetujuan IC</TabsTrigger>
            <TabsTrigger value="declination">Penolakan</TabsTrigger>
            <TabsTrigger value="sick-leave">Surat Sakit</TabsTrigger>
            <TabsTrigger value="referral">Rujukan</TabsTrigger>
            <TabsTrigger value="prescription">Resep</TabsTrigger>
            <TabsTrigger value="fitness">Surat Sehat</TabsTrigger>
          </TabsList>

          <TabsContent value="informed-consent">
            <InformedConsentForm
              transactions={transactions}
              patients={patients}
              consents={informedConsents}
              doctorProfile={doctorProfile}
              onAdd={onAddInformedConsent}
              onUpdate={onUpdateInformedConsent}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={informedConsents}
              documentType="Informed Consent"
              doctorProfile={doctorProfile}
              onDownloadPDF={generateInformedConsentPDF}
              initialFilterDocumentId={initialDocumentType === 'informed_consent' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'informed_consent' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>

          <TabsContent value="declination">
            <DeclinationLetterForm
              transactions={transactions}
              patients={patients}
              letters={declinationLetters}
              doctorProfile={doctorProfile}
              onAdd={onAddDeclinationLetter}
              onUpdate={onUpdateDeclinationLetter}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={declinationLetters}
              documentType="Declination Letter"
              doctorProfile={doctorProfile}
              onDownloadPDF={generateDeclinationLetterPDF}
              initialFilterDocumentId={initialDocumentType === 'declination_letter' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'declination_letter' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>

          <TabsContent value="sick-leave">
            <SickLeaveForm
              transactions={transactions}
              patients={patients}
              sickLeaves={sickLeaves}
              doctorProfile={doctorProfile}
              onAdd={onAddSickLeave}
              onUpdate={onUpdateSickLeave}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={sickLeaves}
              documentType="Sick Leave"
              doctorProfile={doctorProfile}
              onDownloadPDF={generateSickLeavePDF}
              initialFilterDocumentId={initialDocumentType === 'sick_leave' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'sick_leave' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>

          <TabsContent value="referral">
            <ReferralLetterForm
              transactions={transactions}
              patients={patients}
              referrals={referralLetters}
              doctorProfile={doctorProfile}
              onAdd={onAddReferralLetter}
              onUpdate={onUpdateReferralLetter}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={referralLetters}
              documentType="Referral Letter"
              doctorProfile={doctorProfile}
              onDownloadPDF={generateReferralLetterPDF}
              initialFilterDocumentId={initialDocumentType === 'referral_letter' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'referral_letter' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>

          <TabsContent value="prescription">
            <PrescriptionForm
              transactions={transactions}
              patients={patients}
              prescriptions={prescriptions}
              doctorProfile={doctorProfile}
              onAdd={onAddPrescription}
              onUpdate={onUpdatePrescription}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={prescriptions}
              documentType="Prescription"
              doctorProfile={doctorProfile}
              onDownloadPDF={generatePrescriptionPDF}
              initialFilterDocumentId={initialDocumentType === 'prescription' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'prescription' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>

          <TabsContent value="fitness">
            <FitnessCertificateForm
              transactions={transactions}
              patients={patients}
              certificates={fitnessCertificates}
              doctorProfile={doctorProfile}
              onAdd={onAddFitnessCertificate}
              onUpdate={onUpdateFitnessCertificate}
            />
            <DocumentHistory
              transactions={transactions}
              patients={patients}
              documents={fitnessCertificates}
              documentType="Fitness Certificate"
              doctorProfile={doctorProfile}
              onDownloadPDF={generateFitnessCertificatePDF}
              initialFilterDocumentId={initialDocumentType === 'fitness_certificate' ? initialDocumentId : undefined}
              initialFilterDate={initialDocumentType === 'fitness_certificate' ? initialFilterDate : undefined}
              forwardedRef={documentHistoryRef}
            />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
