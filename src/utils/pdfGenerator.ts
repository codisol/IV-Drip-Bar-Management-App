import jsPDF from 'jspdf';
import { Transaction, Patient, DoctorProfile } from '../types';
import { toast } from 'sonner';

// Helper to get patient data from transaction
export const getPatientFromTransaction = (transaction: Transaction, patients: Patient[]) => {
  return patients.find(p => p.id === transaction.patientId);
};

import { formatDate, formatDateTime as formatDateTimeUtil } from './dateFormatter';

// Helpers
const formatDateSafe = (value?: string) => {
  if (!value) return '-';
  return formatDate(value);
};

// Format date-time for display
const formatDateTime = (dateValue: string | Date | undefined): string => {
  if (!dateValue) return '-';
  return formatDateTimeUtil(dateValue);
};

// Draw a patient information block (boxed) - updated for Indonesian
const drawPatientInfoBlock = (
  doc: jsPDF,
  patient: Patient,
  renderedDate: string,
  startY: number
) => {
  const left = 15;
  const width = 180;
  const height = 30; // fixed height works for our short fields
  doc.setDrawColor(180);
  doc.rect(left, startY, width, height);

  const labelFont = () => doc.setFont('helvetica', 'bold');
  const valueFont = () => doc.setFont('helvetica', 'normal');

  let y = startY + 9;
  doc.setFontSize(11);
  // left column
  const lLabelX = left + 6; const lValueX = left + 34;
  // right column
  const rLabelX = left + 100; const rValueX = left + 132;
  labelFont(); doc.text('Pasien:', lLabelX, y); valueFont(); doc.text(patient.name || '-', lValueX, y);
  labelFont(); doc.text('Tanggal:', rLabelX, y); valueFont(); doc.text(renderedDate, rValueX, y);
  y += 7;
  labelFont(); doc.text('ID Pasien:', lLabelX, y); valueFont(); doc.text(patient.id || '-', lValueX, y);
  labelFont(); doc.text('Jenis Kelamin:', rLabelX, y); valueFont(); doc.text(patient.gender === 'Male' ? 'Laki-laki' : patient.gender === 'Female' ? 'Perempuan' : patient.gender || '-', rValueX, y);
  y += 7;
  labelFont(); doc.text('Tgl. Lahir:', lLabelX, y); valueFont(); doc.text(formatDateSafe(patient.dob), lValueX, y);
  labelFont(); doc.text('Telepon:', rLabelX, y); valueFont(); doc.text(patient.phone || '-', rValueX, y);

  return startY + height + 8; // content start Y after the box
};

// New header format (Kop Surat) - centered, for all medical documents
const addKopSurat = (doc: jsPDF, doctorProfile?: DoctorProfile) => {
  const clinicName = doctorProfile?.clinicName || 'Klinik IV Drip Bar';
  const doctorName = doctorProfile?.doctorName;
  const clinicAddress = doctorProfile?.clinicAddress || '';

  let y = 15;

  // Clinic Name (centered)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(clinicName, 105, y, { align: 'center' });
  y += 7;

  // Doctor Name (centered)
  if (doctorName) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text(`dr. ${doctorName}`, 105, y, { align: 'center' });
    y += 6;
  }

  // Clinic Address (centered)
  if (clinicAddress) {
    doc.setFontSize(10);
    doc.text(clinicAddress, 105, y, { align: 'center' });
    y += 6;
  }

  // Separator line
  y += 3;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 0);
  doc.line(15, y, 195, y);

  return y + 5; // Return Y position after header
};

// Common header for all documents (updated to use new kop surat format)
const addDocumentHeader = (doc: jsPDF, title: string, patient: Patient, date: string, doctorProfile?: DoctorProfile) => {
  let y = addKopSurat(doc, doctorProfile);

  // Document title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 105, y, { align: 'center' });
  y += 10;

  // Patient info block
  const yAfterBox = drawPatientInfoBlock(doc, patient, formatDateSafe(date), y);
  return yAfterBox; // Return Y position for content start
};

// Common signature/footer - updated for Indonesian
const addDoctorSignature = (doc: jsPDF, y: number, doctorProfile?: DoctorProfile) => {
  y += 15;
  doc.setFontSize(10);
  doc.text('______________________________', 20, y);
  y += 5;
  const name = doctorProfile?.doctorName ? `dr. ${doctorProfile.doctorName}` : 'Dokter Penanggung Jawab';
  doc.text(name, 20, y);
  if (doctorProfile?.permitCode) {
    y += 5;
    doc.text(`SIP: ${doctorProfile.permitCode}`, 20, y);
  }
  return y + 10;
};

// Combined signatures area (patient + doctor side-by-side) - updated for Indonesian
const addPatientAndDoctorSignatures = (
  doc: jsPDF,
  y: number,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  y += 20;
  const lineWidth = 70;
  const patientX = 20;
  const doctorX = 120;
  doc.setFontSize(10);
  // patient signature line
  doc.text('______________________________', patientX, y);
  // doctor signature line
  doc.text('______________________________', doctorX, y);
  y += 5;
  doc.text(patient.name || 'Pasien', patientX, y);
  const docName = doctorProfile?.doctorName ? `dr. ${doctorProfile.doctorName}` : 'Dokter Penanggung Jawab';
  doc.text(docName, doctorX, y);
  if (doctorProfile?.permitCode) {
    y += 5;
    doc.text(`SIP: ${doctorProfile.permitCode}`, doctorX, y);
  }
  return y + 10;
};

export const generateInformedConsentPDF = (
  consent: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'PERSETUJUAN INFORMED CONSENT', patient, consent.date, doctorProfile);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Deskripsi Prosedur:', 20, y);
  y += 7;
  const procedureLines = doc.splitTextToSize(consent.procedureDescription, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(procedureLines, 20, y);
  y += procedureLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Risiko:', 20, y);
  y += 7;
  const risksLines = doc.splitTextToSize(consent.risks, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(risksLines, 20, y);
  y += risksLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Manfaat:', 20, y);
  y += 7;
  const benefitsLines = doc.splitTextToSize(consent.benefits, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(benefitsLines, 20, y);
  y += benefitsLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Alternatif:', 20, y);
  y += 7;
  const alternativesLines = doc.splitTextToSize(consent.alternatives, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(alternativesLines, 20, y);
  y += alternativesLines.length * 5 + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Persetujuan Diberikan: ${consent.consentGiven ? 'YA' : 'TIDAK'}`, 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Tanggal Tanda Tangan: ${new Date(consent.signatureDate).toLocaleDateString('id-ID')}`, 20, y);
  y += 10;
  doc.setFontSize(10);
  const stmt = 'Saya menyatakan telah membaca dan memahami informasi di atas, memiliki kesempatan untuk bertanya, dan memberikan persetujuan secara sukarela untuk prosedur yang diusulkan dan prosedur tambahan yang diperlukan.';
  const stmtLines = doc.splitTextToSize(stmt, 170);
  doc.text(stmtLines, 20, y);
  y += stmtLines.length * 5;
  addPatientAndDoctorSignatures(doc, y, patient, doctorProfile);

  doc.save(`Persetujuan_IC_${patient.name}_${new Date(consent.date).toISOString().split('T')[0]}.pdf`);
};

export const generateDeclinationLetterPDF = (
  letter: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'SURAT PENOLAKAN PERAWATAN MEDIS', patient, letter.date, doctorProfile);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Pengobatan yang Ditolak:', 20, y);
  y += 7;
  const treatmentLines = doc.splitTextToSize(letter.treatmentDeclined, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(treatmentLines, 20, y);
  y += treatmentLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Alasan Penolakan:', 20, y);
  y += 7;
  const reasonLines = doc.splitTextToSize(letter.reasonForDeclination, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(reasonLines, 20, y);
  y += reasonLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Risiko yang Dijelaskan:', 20, y);
  y += 7;
  const risksLines = doc.splitTextToSize(letter.risksExplained, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(risksLines, 20, y);
  y += risksLines.length * 5 + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Tanggal Tanda Tangan: ${new Date(letter.signatureDate).toLocaleDateString('id-ID')}`, 20, y);
  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const stmt2 = 'Saya menyatakan telah diberitahu tentang pengobatan yang direkomendasikan dan risiko material dari penolakan, alternatif telah dibahas, dan saya tetap menolak pengobatan yang direkomendasikan.';
  const stmt2Lines = doc.splitTextToSize(stmt2, 170);
  doc.text(stmt2Lines, 20, y);
  y += stmt2Lines.length * 5;
  addPatientAndDoctorSignatures(doc, y, patient, doctorProfile);

  doc.save(`Surat_Penolakan_${patient.name}_${new Date(letter.date).toISOString().split('T')[0]}.pdf`);
};

export const generateSickLeavePDF = (
  sickLeave: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'SURAT KETERANGAN SAKIT', patient, sickLeave.issueDate, doctorProfile);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Diagnosis:', 20, y);
  y += 7;
  const diagnosisLines = doc.splitTextToSize(sickLeave.diagnosis, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(diagnosisLines, 20, y);
  y += diagnosisLines.length * 5 + 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Periode Istirahat: ${new Date(sickLeave.startDate).toLocaleDateString('id-ID')} hingga ${new Date(sickLeave.endDate).toLocaleDateString('id-ID')}`, 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Jumlah Hari: ${sickLeave.numberOfDays}`, 20, y);
  y += 10;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Rekomendasi:', 20, y);
  y += 7;
  const recommendationsLines = doc.splitTextToSize(sickLeave.recommendations, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(recommendationsLines, 20, y);
  y += recommendationsLines.length * 5 + 10;

  y = addDoctorSignature(doc, y, doctorProfile);

  doc.save(`Surat_Keterangan_Sakit_${patient.name}_${new Date(sickLeave.issueDate).toISOString().split('T')[0]}.pdf`);
};

export const generateReferralLetterPDF = (
  referral: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'SURAT RUJUKAN', patient, referral.date, doctorProfile);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Dirujuk ke: ${referral.referringTo}`, 20, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.text(`Spesialisasi: ${referral.specialty}`, 20, y);
  y += 7;
  const urgencyText = referral.urgency === 'Routine' ? 'Rutin' : referral.urgency === 'Urgent' ? 'Mendesak' : referral.urgency === 'Emergency' ? 'Gawat Darurat' : referral.urgency;
  doc.text(`Ked urgency: ${urgencyText}`, 20, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  doc.text('Alasan Rujukan:', 20, y);
  y += 7;
  const reasonLines = doc.splitTextToSize(referral.reasonForReferral, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(reasonLines, 20, y);
  y += reasonLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Riwayat Medis yang Relevan:', 20, y);
  y += 7;
  const historyLines = doc.splitTextToSize(referral.relevantHistory, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(historyLines, 20, y);
  y += historyLines.length * 5 + 5;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Obat yang Sedang Dikonsumsi:', 20, y);
  y += 7;
  const medsLines = doc.splitTextToSize(referral.currentMedications, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(medsLines, 20, y);
  y += medsLines.length * 5 + 10;

  y = addDoctorSignature(doc, y, doctorProfile);

  doc.save(`Surat_Rujukan_${patient.name}_${new Date(referral.date).toISOString().split('T')[0]}.pdf`);
};

export const generatePrescriptionPDF = (
  prescription: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'RESEP', patient, prescription.date, doctorProfile);

  // Only show medications section if there are medications
  if (prescription.medications && prescription.medications.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Obat-obatan:', 20, y);
    y += 7;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    prescription.medications.forEach((med: any, index: number) => {
      doc.text(`${index + 1}. ${med.drugName} ${med.strength}`, 25, y);
      y += 5;
      doc.text(`   Dosis: ${med.dosage}`, 25, y);
      y += 5;
      doc.text(`   Frekuensi: ${med.frequency}`, 25, y);
      y += 5;
      doc.text(`   Durasi: ${med.duration}`, 25, y);
      y += 5;
      doc.text(`   Jumlah: ${med.quantity}`, 25, y);
      y += 8;
    });

    y += 5; // Add some spacing before instructions
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Instruksi:', 20, y);
  y += 7;
  const instructionsLines = doc.splitTextToSize(prescription.instructions || 'Tidak ada instruksi khusus yang diberikan.', 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(instructionsLines, 20, y);
  y += instructionsLines.length * 5 + 10;

  y = addDoctorSignature(doc, y, doctorProfile);

  doc.save(`Resep_${patient.name}_${new Date(prescription.date).toISOString().split('T')[0]}.pdf`);
};

export const generateFitnessCertificatePDF = (
  certificate: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'SURAT KETERANGAN SEHAT', patient, certificate.date, doctorProfile);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Tujuan:', 20, y);
  y += 7;
  const purposeLines = doc.splitTextToSize(certificate.purpose, 170);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(purposeLines, 20, y);
  y += purposeLines.length * 5 + 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`LAYAK UNTUK AKTIVITAS: ${certificate.fitForActivity ? 'YA' : 'TIDAK'}`, 20, y);
  y += 10;

  if (certificate.limitations) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Keterbatasan:', 20, y);
    y += 7;
    const limitationsLines = doc.splitTextToSize(certificate.limitations, 170);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(limitationsLines, 20, y);
    y += limitationsLines.length * 5 + 10;
  }

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Berlaku Hingga: ${new Date(certificate.validUntil).toLocaleDateString('id-ID')}`, 20, y);
  doc.setFont('helvetica', 'normal');
  y = addDoctorSignature(doc, y, doctorProfile);

  doc.save(`Surat_Keterangan_Sehat_${patient.name}_${new Date(certificate.date).toISOString().split('T')[0]}.pdf`);
};

// New function: Generate multi-transaction SOAP PDF with date range
export const generateMultiSoapNotePDF = (
  soapNotes: any[],
  transactions: Transaction[],
  patient: Patient,
  doctorProfile?: DoctorProfile,
  startDate?: string,
  endDate?: string
) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = 210;
  const leftMargin = 15;
  const rightMargin = 15;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const signatureY = 270;

  let isFirstPage = true;
  let y = 0;

  // Helper to add header on new page
  const addPageHeader = () => {
    if (!isFirstPage) {
      doc.addPage();
    }
    isFirstPage = false;
    y = addKopSurat(doc, doctorProfile);

    // Patient info box (without date, with ID) - using same format as other medical documents
    // Calculate box height dynamically based on ID Pasien wrapping
    const labelFont = () => doc.setFont('helvetica', 'bold');
    const valueFont = () => doc.setFont('helvetica', 'normal');

    doc.setFontSize(11);
    // left column
    const lLabelX = leftMargin + 6; const lValueX = leftMargin + 34;
    // right column
    const rLabelX = leftMargin + 100; const rValueX = leftMargin + 132;

    // Check if ID Pasien needs wrapping
    const patientId = patient.id || '-';
    const maxIdWidthMM = leftMargin + usableWidth - rValueX - 6; // Available width in mm
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    const idLines = doc.splitTextToSize(patientId, maxIdWidthMM);
    const idLineHeight = 4.5; // Height per line for ID
    const idHeight = idLines.length > 1 ? (idLines.length * idLineHeight) : idLineHeight;

    // Calculate box height: base 30mm + extra height if ID wraps
    const baseBoxHeight = 30;
    const extraHeight = idLines.length > 1 ? (idLines.length - 1) * idLineHeight : 0;
    const boxHeight = baseBoxHeight + extraHeight;

    doc.setDrawColor(180);
    doc.rect(leftMargin, y, usableWidth, boxHeight);

    let boxY = y + 9;
    doc.setFontSize(11);

    // Row 1: Pasien (left), ID Pasien (right) - ID Pasien can wrap to multiple lines
    labelFont(); doc.text('Pasien:', lLabelX, boxY);
    valueFont(); doc.text(patient.name || '-', lValueX, boxY);
    labelFont(); doc.text('ID Pasien:', rLabelX, boxY);
    valueFont();
    // ID Pasien: wrap to multiple lines if too long (no truncation)
    if (idLines.length > 1) {
      // Multi-line: render each line
      let idY = boxY;
      idLines.forEach((line: string, idx: number) => {
        doc.text(line, rValueX, idY);
        if (idx < idLines.length - 1) {
          idY += idLineHeight;
        }
      });
    } else {
      doc.text(patientId, rValueX, boxY);
    }

    // Adjust boxY for next row based on ID height
    boxY = y + 9 + Math.max(7, idHeight);

    // Row 2: Jenis Kelamin (left), Tgl. Lahir (right)
    labelFont(); doc.text('Jenis Kelamin:', lLabelX, boxY);
    valueFont();
    const gender = patient.gender === 'Male' ? 'Laki-laki' : patient.gender === 'Female' ? 'Perempuan' : patient.gender || '-';
    doc.text(gender, lValueX, boxY);
    labelFont(); doc.text('Tgl. Lahir:', rLabelX, boxY);
    valueFont(); doc.text(formatDateSafe(patient.dob), rValueX, boxY);

    boxY += 7;
    // Row 3: Telepon (left)
    labelFont(); doc.text('Telepon:', lLabelX, boxY);
    valueFont(); doc.text(patient.phone || '-', lValueX, boxY);

    y += boxHeight + 8;
  };

  // Filter and sort SOAP notes by date
  let filteredNotes = soapNotes.filter(note => {
    const transaction = transactions.find(t => t.id === note.transactionId);
    if (!transaction || transaction.patientId !== patient.id) return false;

    if (startDate || endDate) {
      const noteDate = new Date(note.date).toISOString().split('T')[0];
      if (startDate && noteDate < startDate) return false;
      if (endDate && noteDate > endDate) return false;
    }
    return true;
  });

  filteredNotes.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  if (filteredNotes.length === 0) {
    toast.error('Tidak ada catatan SOAP untuk periode yang dipilih');
    return;
  }

  // Column configuration: Tanggal-Jam (25mm), then 4 SOAP columns (no ID Pasien column)
  const dateColumnWidth = 25;
  const soapColumnWidth = (usableWidth - dateColumnWidth - (4 - 1) * 3) / 4;
  const columnGap = 3;

  const colX = [
    leftMargin, // Tanggal-Jam
    leftMargin + dateColumnWidth + columnGap, // Subjective
    leftMargin + dateColumnWidth + soapColumnWidth + columnGap * 2, // Objective
    leftMargin + dateColumnWidth + soapColumnWidth * 2 + columnGap * 3, // Assessment
    leftMargin + dateColumnWidth + soapColumnWidth * 3 + columnGap * 4 // Plan
  ];

  addPageHeader();

  // Draw table headers
  const headerHeight = 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, y, usableWidth, headerHeight, 'F');

  doc.text('Tanggal-Jam', colX[0] + dateColumnWidth / 2, y + 5, { align: 'center' });
  doc.text('SUBJEKTIF', colX[1] + soapColumnWidth / 2, y + 5, { align: 'center' });
  doc.text('OBJEKTIF', colX[2] + soapColumnWidth / 2, y + 5, { align: 'center' });
  doc.text('ASESMEN', colX[3] + soapColumnWidth / 2, y + 5, { align: 'center' });
  doc.text('RENCANA', colX[4] + soapColumnWidth / 2, y + 5, { align: 'center' });

  // Draw vertical lines
  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  for (let i = 1; i < 5; i++) {
    doc.line(colX[i] - columnGap / 2, y, colX[i] - columnGap / 2, signatureY - 5);
  }
  doc.line(leftMargin, y + headerHeight, leftMargin + usableWidth, y + headerHeight);

  y += headerHeight + 3;

  // Helper function to render a SOAP row
  const renderSoapRow = (dateTimeLabel: string, subjective: string, objective: string, assessment: string, plan: string, versionLabel?: string) => {
    // Check if we need a new page
    if (y > 250) {
      addPageHeader();

      // Redraw headers
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, y, usableWidth, headerHeight, 'F');

      doc.text('Tanggal-Jam', colX[0] + dateColumnWidth / 2, y + 5, { align: 'center' });
      doc.text('SUBJEKTIF', colX[1] + soapColumnWidth / 2, y + 5, { align: 'center' });
      doc.text('OBJEKTIF', colX[2] + soapColumnWidth / 2, y + 5, { align: 'center' });
      doc.text('ASESMEN', colX[3] + soapColumnWidth / 2, y + 5, { align: 'center' });
      doc.text('RENCANA', colX[4] + soapColumnWidth / 2, y + 5, { align: 'center' });

      // Redraw vertical lines
      for (let i = 1; i < 5; i++) {
        doc.line(colX[i] - columnGap / 2, y, colX[i] - columnGap / 2, signatureY - 5);
      }
      doc.line(leftMargin, y + headerHeight, leftMargin + usableWidth, y + headerHeight);
      y += headerHeight + 3;
    }

    // Add version label to date if provided
    const dateTimeWithVersion = versionLabel ? `${dateTimeLabel}\n[${versionLabel}]` : dateTimeLabel;

    const rowData = [
      dateTimeWithVersion, // Tanggal-Jam (with optional version label)
      subjective || '(Tidak ada)',
      objective || '(Tidak ada)',
      assessment || '(Tidak ada)',
      plan || '(Tidak ada)'
    ];

    const columnWidths = [dateColumnWidth, soapColumnWidth, soapColumnWidth, soapColumnWidth, soapColumnWidth];

    // Pre-calculate all text lines for each column to prevent overlap
    // Since unit is 'mm', use mm directly - no conversion needed
    const textLines: string[][] = [];
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    rowData.forEach((text, colIdx) => {
      if (colIdx === 0) {
        // Date column - can be multi-line if version label is included
        // Calculate available width: column width minus padding (1mm on each side = 2mm total)
        const availableWidthMM = columnWidths[colIdx] - 2;
        const lines = doc.splitTextToSize(text, availableWidthMM);
        textLines.push(lines);
      } else {
        // SOAP columns - multi-line with width in mm (no conversion)
        // Calculate available width: column width minus padding (1mm on each side = 2mm total)
        const availableWidthMM = columnWidths[colIdx] - 2;
        const lines = doc.splitTextToSize(text, availableWidthMM);
        textLines.push(lines);
      }
    });

    // Find maximum number of lines across all columns
    const maxLines = Math.max(...textLines.map(lines => lines.length));

    // Calculate proportional line height based on font size
    // Formula: lineHeight = fontSize * 0.35 * 1.5 (1pt = 0.3528mm)
    const fontSize = 8;
    const lineHeight = fontSize * 0.3528 * 1.5; // ~4.23mm per line
    const startRowY = y;

    // Draw row content - render each line independently
    // Each line renders one line from each column at the same y position
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');

    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      // Debug line to visualize row spacing
      // doc.setDrawColor(200, 200, 200);
      // doc.line(leftMargin, y, leftMargin + usableWidth, y);

      // Render date column - can be multi-line (with version label)
      if (lineIdx < textLines[0].length && textLines[0][lineIdx]) {
        const dateText = textLines[0][lineIdx];
        const dateX = colX[0] + columnWidths[0] / 2;
        doc.text(dateText, dateX, y, { align: 'center' });
      }

      // Render each SOAP column independently - one line per column
      for (let colIdx = 1; colIdx < rowData.length; colIdx++) {
        const lines = textLines[colIdx];
        if (lineIdx < lines.length && lines[lineIdx]) {
          // Calculate x position: start of column + 1mm padding
          const xPos = colX[colIdx] + 1;
          // Render the line - already split, so use mm directly
          doc.text(lines[lineIdx], xPos, y);
        }
      }

      // Move to next line with proportional spacing
      y += lineHeight;

      // Check if next line would exceed page (check before rendering next iteration)
      if (y > 250 && lineIdx < maxLines - 1) {
        addPageHeader();
        // Redraw headers
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setFillColor(240, 240, 240);
        doc.rect(leftMargin, y, usableWidth, headerHeight, 'F');
        doc.text('Tanggal-Jam', colX[0] + dateColumnWidth / 2, y + 5, { align: 'center' });
        doc.text('SUBJEKTIF', colX[1] + soapColumnWidth / 2, y + 5, { align: 'center' });
        doc.text('OBJEKTIF', colX[2] + soapColumnWidth / 2, y + 5, { align: 'center' });
        doc.text('ASESMEN', colX[3] + soapColumnWidth / 2, y + 5, { align: 'center' });
        doc.text('RENCANA', colX[4] + soapColumnWidth / 2, y + 5, { align: 'center' });
        for (let i = 1; i < 5; i++) {
          doc.line(colX[i] - columnGap / 2, y, colX[i] - columnGap / 2, signatureY - 5);
        }
        doc.line(leftMargin, y + headerHeight, leftMargin + usableWidth, y + headerHeight);
        y += headerHeight + 3;

        // Reset font for continuation
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', 'normal');
      }
    }

    // Draw horizontal line after each row
    doc.setDrawColor(200);
    doc.line(leftMargin, y, leftMargin + usableWidth, y);
    y += 2;
  };

  // Draw each SOAP note and all its versions in chronological order
  filteredNotes.forEach((note, noteIndex) => {
    const transaction = transactions.find(t => t.id === note.transactionId);
    const baseDate = transaction ? new Date(transaction.time) : new Date(note.date);

    // Create array of all versions (current + historical) with dates for sorting
    const allVersions: Array<{
      date: Date;
      dateTime: string;
      subjective?: string;
      objective?: string;
      assessment: string;
      plan: string;
      versionNumber: number;
    }> = [];

    // Add historical versions first
    if (note.versions && note.versions.length > 0) {
      note.versions.forEach((version: any, vIdx: number) => {
        allVersions.push({
          date: new Date(version.editedAt),
          dateTime: formatDateTime(version.editedAt),
          subjective: version.subjective,
          objective: version.objective,
          assessment: version.assessment,
          plan: version.plan,
          versionNumber: vIdx + 1 // Versi 1, 2, 3, ...
        });
      });
    }

    // Add current version
    allVersions.push({
      date: baseDate,
      dateTime: formatDateTime(baseDate.toISOString()),
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      versionNumber: note.versions.length > 0 ? note.versions.length + 1 : 1 // Versi terakhir
    });

    // Sort all versions by date (oldest first)
    allVersions.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Render all versions in chronological order with sequential numbering
    allVersions.forEach((version, idx) => {
      // After sorting, assign sequential version numbers (1, 2, 3, ...)
      const versionLabel = `Versi ${idx + 1}`;
      renderSoapRow(
        version.dateTime,
        version.subjective || '(Tidak ada)',
        version.objective || '(Tidak ada)',
        version.assessment || '(Tidak ada)',
        version.plan || '(Tidak ada)',
        versionLabel
      );
    });
  });

  // Add signature at the bottom (only once, on last page)
  if (y > signatureY - 20) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.text('______________________________', leftMargin, signatureY);
  const name = doctorProfile?.doctorName ? `dr. ${doctorProfile.doctorName}` : 'Dokter Penanggung Jawab';
  doc.text(name, leftMargin, signatureY + 5);
  if (doctorProfile?.permitCode) {
    doc.text(`SIP: ${doctorProfile.permitCode}`, leftMargin, signatureY + 10);
  }

  // Generate filename based on date range
  let fileName: string;
  if (!startDate || !endDate) {
    fileName = `SOAP_${patient.name}_Semua_Periode.pdf`;
  } else if (startDate === endDate) {
    // Same date (today) - use "Hari_Ini" or the date
    fileName = `SOAP_${patient.name}_Hari_Ini_${startDate}.pdf`;
  } else {
    // Date range
    fileName = `SOAP_${patient.name}_${startDate}_${endDate}.pdf`;
  }
  doc.save(fileName);
};

// Original single SOAP note PDF (kept for backward compatibility, updated to Indonesian)
export const generateSoapNotePDF = (
  soapNote: any,
  transaction: Transaction,
  patient: Patient,
  doctorProfile?: DoctorProfile
) => {
  const doc = new jsPDF();
  let y = addDocumentHeader(doc, 'CATATAN SOAP', patient, soapNote.date, doctorProfile);

  // Column configuration for horizontal layout
  const pageWidth = 210;
  const leftMargin = 15;
  const rightMargin = 15;
  const usableWidth = pageWidth - leftMargin - rightMargin;
  const columnCount = 4;
  const columnGap = 3;
  const columnWidth = (usableWidth - (columnCount - 1) * columnGap) / columnCount;

  const colX: number[] = [];
  for (let i = 0; i < columnCount; i++) {
    colX.push(leftMargin + i * (columnWidth + columnGap));
  }

  const headers = ['SUBJEKTIF', 'OBJEKTIF', 'ASESMEN', 'RENCANA'];
  const headerHeight = 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(240, 240, 240);
  doc.rect(leftMargin, y, usableWidth, headerHeight, 'F');

  headers.forEach((header, index) => {
    doc.text(header, colX[index] + columnWidth / 2, y + 5, { align: 'center' });
  });

  const signatureY = 270;
  const verticalLineEnd = signatureY - 5;

  doc.setDrawColor(200);
  doc.setLineWidth(0.5);
  for (let i = 1; i < columnCount; i++) {
    doc.line(colX[i] - columnGap / 2, y, colX[i] - columnGap / 2, verticalLineEnd);
  }

  doc.line(leftMargin, y + headerHeight, leftMargin + usableWidth, y + headerHeight);
  y += headerHeight + 5;

  const contents = [
    soapNote.subjective || '(Tidak ada)',
    soapNote.objective || '(Tidak ada)',
    soapNote.assessment || '(Tidak ada)',
    soapNote.plan || '(Tidak ada)'
  ];

  const columnTexts: string[][] = [];
  const columnWidthPoints = columnWidth * 2.83;

  contents.forEach((content) => {
    const textLines = doc.splitTextToSize(content, columnWidthPoints);
    columnTexts.push(textLines);
  });

  const lineHeight = 5;
  const contentPadding = 2;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  let currentLineIndices = [0, 0, 0, 0];

  while (currentLineIndices.some((idx, colIdx) => idx < columnTexts[colIdx].length)) {
    if (y + lineHeight > 250) {
      doc.addPage();
      y = 20;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(240, 240, 240);
      doc.rect(leftMargin, y, usableWidth, headerHeight, 'F');

      headers.forEach((header, index) => {
        doc.text(header, colX[index] + columnWidth / 2, y + 5, { align: 'center' });
      });

      doc.setDrawColor(200);
      doc.setLineWidth(0.5);
      const verticalLineEndNewPage = signatureY - 5;
      for (let i = 1; i < columnCount; i++) {
        doc.line(colX[i] - columnGap / 2, y, colX[i] - columnGap / 2, verticalLineEndNewPage);
      }

      doc.line(leftMargin, y + headerHeight, leftMargin + usableWidth, y + headerHeight);
      y += headerHeight + 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
    }

    columnTexts.forEach((textLines, colIndex) => {
      if (currentLineIndices[colIndex] < textLines.length) {
        const textLine = textLines[currentLineIndices[colIndex]];
        doc.text(textLine, colX[colIndex] + contentPadding, y);
      }
    });

    y += lineHeight;
    currentLineIndices = currentLineIndices.map((idx, colIdx) => idx + 1);
  }

  if (y > signatureY - 20) {
    doc.addPage();
  }

  doc.setFontSize(10);
  doc.text('______________________________', leftMargin, signatureY);
  const name = doctorProfile?.doctorName ? `dr. ${doctorProfile.doctorName}` : 'Dokter Penanggung Jawab';
  doc.text(name, leftMargin, signatureY + 5);
  if (doctorProfile?.permitCode) {
    doc.text(`SIP: ${doctorProfile.permitCode}`, leftMargin, signatureY + 10);
  }

  doc.save(`SOAP_${patient.name}_${new Date(soapNote.date).toISOString().split('T')[0]}.pdf`);
};
