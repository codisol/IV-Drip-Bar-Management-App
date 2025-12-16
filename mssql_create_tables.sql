/*
 * MSSQL Schema for IV Drip Bar Management App
 * Generated based on TypeScript interfaces in src/types/index.ts
 */

-- Create Database (Optional, comment out if running in existing DB)
-- CREATE DATABASE IVDripBarDB;
-- GO
-- USE IVDripBarDB;
-- GO

-- Users / Profile
CREATE TABLE DoctorProfile (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DoctorName NVARCHAR(255) NOT NULL,
    ClinicName NVARCHAR(255) NOT NULL,
    ClinicAddress NVARCHAR(MAX) NOT NULL,
    PermitCode NVARCHAR(100), -- Made nullable
    Specialization NVARCHAR(255), -- Optional in TS
    PhoneNumber NVARCHAR(50),    -- Optional in TS
    Email NVARCHAR(255)          -- Optional in TS
);
GO

-- Patients
CREATE TABLE Patients (
    Id NVARCHAR(50) PRIMARY KEY, -- Using NVARCHAR to match 'string' ID from frontend (UUID)
    Name NVARCHAR(255) NOT NULL,
    Phone NVARCHAR(50), -- Made nullable for Quick Registration
    Gender NVARCHAR(20) CHECK (Gender IN ('Male', 'Female', 'Other')), -- Made nullable
    Dob DATETIME2, -- Made nullable for Quick Registration
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    IsQuickRegistration BIT DEFAULT 0 -- Optional in TS, logical default
);
GO

-- Inventory
CREATE TABLE InventoryItems (
    Id NVARCHAR(50) PRIMARY KEY,
    GenericName NVARCHAR(255) NOT NULL,
    BrandName NVARCHAR(255) NOT NULL,
    Strength NVARCHAR(100) NOT NULL,
    BatchNumber NVARCHAR(100) NOT NULL,
    Quantity INT NOT NULL DEFAULT 0,
    ExpiryDate DATETIME2 NOT NULL,
    DateReceived DATETIME2 NOT NULL,
    StorageLocation NVARCHAR(255) NOT NULL,
    DrugClass NVARCHAR(100) NOT NULL,
    ReorderLevel INT NOT NULL DEFAULT 0,
    Notes NVARCHAR(MAX) -- Optional in TS
);
GO

CREATE TABLE InventoryTransactions (
    Id NVARCHAR(50) PRIMARY KEY,
    InventoryItemId NVARCHAR(50) NOT NULL,
    Type NVARCHAR(10) NOT NULL CHECK (Type IN ('IN', 'OUT')),
    Quantity INT NOT NULL,
    Date DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    Reason NVARCHAR(MAX),      -- Optional in TS
    PerformedBy NVARCHAR(255), -- Optional in TS
    TransactionId NVARCHAR(50),-- Optional (linked to OUT transaction)
    PatientId NVARCHAR(50),    -- Optional
    BatchNumber NVARCHAR(100) NOT NULL,
    CONSTRAINT FK_InvTrans_Item FOREIGN KEY (InventoryItemId) REFERENCES InventoryItems(Id)
    -- Note: We generally don't FK TransactionId/PatientId strictly here to allow loose coupling or deletion of old records without cascading everywhere if not desired, 
    -- but for strict integrity you would uncomment:
    -- , CONSTRAINT FK_InvTrans_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);
GO

-- Clinical Transactions (Visits/Sales)
CREATE TABLE Transactions (
    Id NVARCHAR(50) PRIMARY KEY,
    PatientId NVARCHAR(50) NOT NULL,
    PatientName NVARCHAR(255) NOT NULL, -- Denormalized for snapshots
    Time DATETIME2 NOT NULL,
    TotalPayment DECIMAL(18, 2) NOT NULL DEFAULT 0,
    Status NVARCHAR(50) NOT NULL CHECK (Status IN ('On Progress', 'Paid')),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    PaidAt DATETIME2, -- Optional in TS
    CONSTRAINT FK_Transaction_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);
GO

CREATE TABLE TransactionItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    DrugId NVARCHAR(50) NOT NULL,
    DrugName NVARCHAR(255) NOT NULL,
    BatchNumber NVARCHAR(100) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_TransItem_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
    -- CONSTRAINT FK_TransItem_Drug FOREIGN KEY (DrugId) REFERENCES InventoryItems(Id) -- Optional strict link
);
GO

-- Attachments (Centralized storage for base64 files from various documents)
CREATE TABLE Attachments (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ParentId NVARCHAR(50) NOT NULL,
    ParentType NVARCHAR(50) NOT NULL, -- e.g., 'SoapNote', 'SoapNoteVersion', 'InformedConsent', etc.
    Content NVARCHAR(MAX) NOT NULL, -- Base64 strong
    CreatedAt DATETIME2 DEFAULT SYSDATETIME()
);
GO
CREATE INDEX IX_Attachments_Parent ON Attachments(ParentId, ParentType);
GO

-- SOAP Notes
CREATE TABLE SoapNotes (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    Subjective NVARCHAR(MAX), -- Optional in TS
    Objective NVARCHAR(MAX),  -- Optional in TS
    Assessment NVARCHAR(MAX) NOT NULL,
    [Plan] NVARCHAR(MAX) NOT NULL, -- Plan is a keyword
    CONSTRAINT FK_SoapNote_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE SoapNoteVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SoapNoteId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional in TS
    Subjective NVARCHAR(MAX), -- Optional
    Objective NVARCHAR(MAX),  -- Optional
    Assessment NVARCHAR(MAX) NOT NULL,
    [Plan] NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_SoapVer_Note FOREIGN KEY (SoapNoteId) REFERENCES SoapNotes(Id) ON DELETE CASCADE
);
GO

-- Informed Consent
CREATE TABLE InformedConsents (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    ProcedureDescription NVARCHAR(MAX) NOT NULL,
    Risks NVARCHAR(MAX) NOT NULL,
    Benefits NVARCHAR(MAX) NOT NULL,
    Alternatives NVARCHAR(MAX) NOT NULL,
    ConsentGiven BIT NOT NULL DEFAULT 0,
    SignatureDate DATETIME2 NOT NULL,
    CONSTRAINT FK_Consent_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

-- For arrays like medicalRecords/prescriptions images in Consents, we use the Attachments table 
-- with ParentType='InformedConsent_MedicalRecord' or 'InformedConsent_Prescription'

CREATE TABLE InformedConsentVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    InformedConsentId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    ProcedureDescription NVARCHAR(MAX) NOT NULL,
    Risks NVARCHAR(MAX) NOT NULL,
    Benefits NVARCHAR(MAX) NOT NULL,
    Alternatives NVARCHAR(MAX) NOT NULL,
    ConsentGiven BIT NOT NULL,
    CONSTRAINT FK_ConsentVer_main FOREIGN KEY (InformedConsentId) REFERENCES InformedConsents(Id) ON DELETE CASCADE
);
GO

-- Declination Letters
CREATE TABLE DeclinationLetters (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    TreatmentDeclined NVARCHAR(MAX) NOT NULL,
    ReasonForDeclination NVARCHAR(MAX) NOT NULL,
    RisksExplained NVARCHAR(MAX) NOT NULL,
    SignatureDate DATETIME2 NOT NULL,
    CONSTRAINT FK_Declination_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE DeclinationLetterVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DeclinationLetterId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    TreatmentDeclined NVARCHAR(MAX) NOT NULL,
    ReasonForDeclination NVARCHAR(MAX) NOT NULL,
    RisksExplained NVARCHAR(MAX) NOT NULL,
    CONSTRAINT FK_DeclinationVer_Main FOREIGN KEY (DeclinationLetterId) REFERENCES DeclinationLetters(Id) ON DELETE CASCADE
);
GO

-- Sick Leaves
CREATE TABLE SickLeaves (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    IssueDate DATETIME2 NOT NULL,
    Diagnosis NVARCHAR(MAX) NOT NULL,
    StartDate DATETIME2 NOT NULL,
    EndDate DATETIME2 NOT NULL,
    NumberOfDays INT NOT NULL,
    Recommendations NVARCHAR(MAX) NOT NULL,
    DoctorName NVARCHAR(255) NOT NULL,
    CONSTRAINT FK_SickLeave_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE SickLeaveVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    SickLeaveId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    Diagnosis NVARCHAR(MAX) NOT NULL,
    StartDate DATETIME2 NOT NULL,
    EndDate DATETIME2 NOT NULL,
    NumberOfDays INT NOT NULL,
    Recommendations NVARCHAR(MAX) NOT NULL,
    DoctorName NVARCHAR(255) NOT NULL,
    CONSTRAINT FK_SickLeaveVer_Main FOREIGN KEY (SickLeaveId) REFERENCES SickLeaves(Id) ON DELETE CASCADE
);
GO

-- Referral Letters
CREATE TABLE ReferralLetters (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    ReferringTo NVARCHAR(255), -- Made nullable
    Specialty NVARCHAR(255), -- Made nullable
    ReasonForReferral NVARCHAR(MAX) NOT NULL,
    RelevantHistory NVARCHAR(MAX), -- Made nullable
    CurrentMedications NVARCHAR(MAX), -- Made nullable
    Urgency NVARCHAR(50) NOT NULL CHECK (Urgency IN ('Routine', 'Urgent', 'Emergency')),
    DoctorName NVARCHAR(255) NOT NULL,
    CONSTRAINT FK_Referral_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE ReferralLetterVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ReferralLetterId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    ReferringTo NVARCHAR(255), -- Made nullable
    Specialty NVARCHAR(255), -- Made nullable
    ReasonForReferral NVARCHAR(MAX) NOT NULL,
    RelevantHistory NVARCHAR(MAX), -- Made nullable
    CurrentMedications NVARCHAR(MAX), -- Made nullable
    Urgency NVARCHAR(50) NOT NULL CHECK (Urgency IN ('Routine', 'Urgent', 'Emergency')),
    CONSTRAINT FK_ReferralVer_Main FOREIGN KEY (ReferralLetterId) REFERENCES ReferralLetters(Id) ON DELETE CASCADE
);
GO

-- Prescriptions
CREATE TABLE Prescriptions (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    Instructions NVARCHAR(MAX) NOT NULL,
    DoctorName NVARCHAR(255) NOT NULL,
    CONSTRAINT FK_Prescription_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE PrescriptionItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PrescriptionId NVARCHAR(50) NOT NULL,
    DrugName NVARCHAR(255) NOT NULL,
    Strength NVARCHAR(100) NOT NULL,
    Dosage NVARCHAR(100) NOT NULL,
    Frequency NVARCHAR(100) NOT NULL,
    Duration NVARCHAR(100) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_PrescItem_Main FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE PrescriptionVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PrescriptionId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    Instructions NVARCHAR(MAX) NOT NULL,
    DoctorName NVARCHAR(255), -- Optional in versions? TS says 'doctorName?: string' in version but mandatory in main.
    CONSTRAINT FK_PrescVer_Main FOREIGN KEY (PrescriptionId) REFERENCES Prescriptions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE PrescriptionVersionItems (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    PrescriptionVersionId INT NOT NULL,
    DrugName NVARCHAR(255) NOT NULL,
    Strength NVARCHAR(100) NOT NULL,
    Dosage NVARCHAR(100) NOT NULL,
    Frequency NVARCHAR(100) NOT NULL,
    Duration NVARCHAR(100) NOT NULL,
    Quantity INT NOT NULL,
    CONSTRAINT FK_PrescVerItem_Ver FOREIGN KEY (PrescriptionVersionId) REFERENCES PrescriptionVersions(Id) ON DELETE CASCADE
);
GO

-- Fitness Certificates
CREATE TABLE FitnessCertificates (
    Id NVARCHAR(50) PRIMARY KEY,
    TransactionId NVARCHAR(50) NOT NULL,
    Date DATETIME2 NOT NULL,
    Purpose NVARCHAR(MAX) NOT NULL,
    FitForActivity BIT NOT NULL,
    Limitations NVARCHAR(MAX), -- Optional in TS
    ValidUntil DATETIME2 NOT NULL,
    DoctorName NVARCHAR(255) NOT NULL,
    CONSTRAINT FK_Fitness_Trans FOREIGN KEY (TransactionId) REFERENCES Transactions(Id) ON DELETE CASCADE
);
GO

CREATE TABLE FitnessCertificateVersions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    FitnessCertificateId NVARCHAR(50) NOT NULL,
    EditedAt DATETIME2 NOT NULL,
    EditReason NVARCHAR(MAX), -- Optional
    Purpose NVARCHAR(MAX) NOT NULL,
    FitForActivity BIT NOT NULL,
    Limitations NVARCHAR(MAX), -- Optional
    ValidUntil DATETIME2 NOT NULL,
    CONSTRAINT FK_FitnessVer_Main FOREIGN KEY (FitnessCertificateId) REFERENCES FitnessCertificates(Id) ON DELETE CASCADE
);
GO

-- Triage Queue
CREATE TABLE TriageQueue (
    Id NVARCHAR(50) PRIMARY KEY,
    PatientId NVARCHAR(50) NOT NULL,
    PatientName NVARCHAR(255) NOT NULL,
    Level NVARCHAR(50) NOT NULL CHECK (Level IN ('Priority', 'Standard', 'Wellness')),
    ChiefComplaint NVARCHAR(MAX), -- Optional in TS
    ArrivalTime DATETIME2 NOT NULL,
    BP NVARCHAR(50), -- Blood Pressure (Optional in TS)
    HeartRate NVARCHAR(50), -- (Optional in TS)
    Temperature NVARCHAR(50), -- (Optional in TS)
    OxygenSaturation NVARCHAR(50), -- (Optional in TS)
    Notes NVARCHAR(MAX), -- Optional in TS
    Status NVARCHAR(50) NOT NULL CHECK (Status IN ('Waiting', 'In Progress', 'Completed')),
    CompletedAt DATETIME2, -- Optional in TS
    TransactionId NVARCHAR(50), -- Optional in TS
    CONSTRAINT FK_Triage_Patient FOREIGN KEY (PatientId) REFERENCES Patients(Id)
);
GO
