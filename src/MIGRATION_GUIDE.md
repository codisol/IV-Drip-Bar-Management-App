# IV Drip Bar System - Major Refactor Migration Guide

## Overview
This document outlines the major architectural changes needed to implement the transaction-based workflow.

## Key Changes

### 1. Data Model Changes (✅ COMPLETED)
- Added `Transaction` model as the central entity
- All documents now link to transactions instead of patients
- Added new document types: `ReferralLetter`, `Prescription`, `FitnessCertificate`
- Added version history to all document types
- Added optional file attachments to all documents

### 2. New Components Created (✅ COMPLETED)
- `TransactionCombobox.tsx` - For selecting transactions with filtering
- `Transactions.tsx` - Main transaction management component
- `FinancialReports.tsx` - Income tracking with charts

### 3. Workflow Changes Needed

#### Triage → Transaction Flow
1. When triage status changes to "Completed", create a Transaction automatically
2. Transaction should be in "On Progress" status initially
3. Link triage entry to transaction

#### Documents Workflow
1. When creating any document, user searches for patient
2. System shows only "On Progress" transactions for that patient
3. User selects transaction to attach document to
4. Each document type needs history view showing all versions across transactions

### 4. Components That Need Major Updates

#### InventoryManagement.tsx
- **Remove**: Transactions tab
- **Add**: Stock Movement History tab with:
  - Combined IN/OUT transactions
  - Date range filtering (start-end + "Today" button)
  - Show: Date, Type (IN/OUT), Drug Name, Batch, Quantity, Reason/Transaction ID

#### Documents.tsx (NEEDS COMPLETE REWRITE)
- Change from patient-based to transaction-based selection
- Add tabs for each document type:
  - Informed Consent
  - Declination Letter
  - Sick Leave
  - Referral Letter
  - Prescription
  - Fitness Certificate
- Each tab should have:
  - Create new document (select transaction)
  - View/Edit existing documents
  - Document history by patient
  - PDF download functionality
  - File upload (png/jpg/pdf)
  - Version history display

#### SoapNotes.tsx
- Change to transaction-based
- Add edit functionality with version history
- Add file attachments
- Show edit timestamps

#### Triage.tsx
- Auto-create transaction when marking as "Completed"
- Link transaction ID to triage entry

### 5. New Features Needed

#### Dashboard Updates
- **Birthday Widget**: Show patients with birthday today
- Move from forecast to Inventory Alerts (already done)

#### Inventory Forecasting
- Replace simple forecast with Reservoir Computing model
- Features needed:
  - Historical data collection (drug name, quantity out, date, expiry)
  - Time-series normalization
  - Readout layer training only
  - Markov chain state transition detection
  - Automatic retraining on error spikes
  - Integration with restocking alerts

### 6. PDF Generation
All document types need PDF download with:
- Professional formatting
- Patient information header
- Document content
- Signatures/dates
- Clinic branding area

### 7. File Upload Implementation
- Support png, jpg, pdf formats
- Base64 encoding for storage
- Preview capability
- Attachment to document records

## Implementation Priority

### Phase 1 (Critical)
1. Update App.tsx to handle transactions
2. Integrate Transactions component
3. Update Triage to create transactions
4. Basic transaction-based documents

### Phase 2 (Important)
1. Complete Documents rewrite with all types
2. Add version history to all documents
3. PDF generation
4. File uploads

### Phase 3 (Enhancement)
1. Reservoir Computing forecast
2. Advanced reporting
3. Stock movement history
4. Birthday notifications

## Current Status
- ✅ Types updated
- ✅ Storage utils updated
- ✅ TransactionCombobox created
- ✅ Transactions component created
- ✅ FinancialReports component created
- ⏳ App.tsx needs updates
- ⏳ Documents.tsx needs complete rewrite
- ⏳ SoapNotes.tsx needs updates
- ⏳ InventoryManagement.tsx needs updates
- ⏳ Triage.tsx needs updates
- ⏳ PDF generation not implemented
- ⏳ File upload not implemented
- ⏳ Reservoir Computing not implemented

## Breaking Changes
- All existing data with patient-linked documents will need migration
- Version bumped to 2.0.0
- Recommend data export before upgrade
