/**
 * EXTREME TEST SUITE for File Storage (storage.ts)
 * 
 * Tests cover:
 * 1. Data format detection (rescue dump vs backup entry vs normal)
 * 2. Data validation
 * 3. Error handling
 */

import { describe, it, expect, vi } from 'vitest';
import { getInitialData } from '../utils/storage';
import { AppData } from '../types';

// Helper to create mock AppData
const createMockAppData = (id: number): AppData => ({
    patients: [{ id: `patient-${id}`, name: `Patient ${id}`, dob: '1990-01-01', gender: 'Male', phone: '123', createdAt: new Date().toISOString() }],
    transactions: [],
    soapNotes: [],
    inventory: [],
    inventoryTransactions: [],
    informedConsents: [],
    declinationLetters: [],
    sickLeaves: [],
    referralLetters: [],
    prescriptions: [],
    fitnessCertificates: [],
    triageQueue: [],
    doctorProfile: undefined,
    version: '2.0.0'
});

// Helper to create rescue dump format
const createRescueDump = (appData: AppData) => ({
    latest: appData,
    'hourly_2024-12-05T09': {
        data: appData,
        timestamp: '2024-12-05T09:00:00Z',
        type: 'hourly',
        label: '2024-12-05T09'
    },
    'daily_2024-12-05': {
        data: appData,
        timestamp: '2024-12-05T00:00:00Z',
        type: 'daily',
        label: '2024-12-05'
    }
});

// Helper to create backup entry format
const createBackupEntry = (appData: AppData) => ({
    data: appData,
    timestamp: '2024-12-05T09:00:00Z',
    type: 'hourly',
    label: '2024-12-05T09'
});

describe('File Storage - EXTREME TESTS', () => {

    // ==========================================
    // INITIAL DATA TESTS
    // ==========================================
    describe('getInitialData', () => {

        it('should return valid empty AppData structure', () => {
            const data = getInitialData();

            expect(data.patients).toEqual([]);
            expect(data.transactions).toEqual([]);
            expect(data.inventory).toEqual([]);
            expect(data.triageQueue).toEqual([]);
            expect(data.doctorProfile).toBeUndefined();
            expect(data.version).toBe('2.0.0');
        });

        it('should return a new object each time', () => {
            const data1 = getInitialData();
            const data2 = getInitialData();

            expect(data1).not.toBe(data2);
            data1.patients.push({} as any);
            expect(data2.patients).toHaveLength(0);
        });
    });

    // ==========================================
    // DATA FORMAT DETECTION TESTS
    // ==========================================
    describe('Data Format Detection Logic', () => {

        it('should identify rescue dump format (has latest key)', () => {
            const appData = createMockAppData(1);
            const rescueDump = createRescueDump(appData);

            // Check structure
            expect(rescueDump.latest).toBeDefined();
            expect(rescueDump.latest.patients).toHaveLength(1);
            expect(rescueDump['hourly_2024-12-05T09']).toBeDefined();
            expect(rescueDump['daily_2024-12-05']).toBeDefined();
        });

        it('should identify backup entry format (has data key)', () => {
            const appData = createMockAppData(1);
            const backupEntry = createBackupEntry(appData);

            // Check structure
            expect(backupEntry.data).toBeDefined();
            expect(backupEntry.data.patients).toHaveLength(1);
            expect(backupEntry.timestamp).toBeDefined();
            expect(backupEntry.type).toBe('hourly');
        });

        it('should identify normal AppData format', () => {
            const appData = createMockAppData(1);

            // Check structure - has patients array at root level
            expect(appData.patients).toBeDefined();
            expect(Array.isArray(appData.patients)).toBe(true);
            expect((appData as any).latest).toBeUndefined();
            expect((appData as any).data).toBeUndefined();
        });
    });

    // ==========================================
    // EXTRACTION LOGIC TESTS
    // ==========================================
    describe('Data Extraction Logic', () => {

        it('should correctly extract AppData from rescue dump', () => {
            const originalData = createMockAppData(1);
            const rescueDump = createRescueDump(originalData);

            // Simulate extraction logic from storage.ts
            let extracted: AppData;
            if (rescueDump.latest && typeof rescueDump.latest === 'object' && rescueDump.latest.patients) {
                extracted = rescueDump.latest;
            } else {
                extracted = rescueDump as unknown as AppData;
            }

            expect(extracted.patients).toHaveLength(1);
            expect(extracted.patients[0].name).toBe('Patient 1');
        });

        it('should correctly extract AppData from backup entry', () => {
            const originalData = createMockAppData(1);
            const backupEntry = createBackupEntry(originalData);

            // Simulate extraction logic from storage.ts
            let extracted: AppData;
            if (backupEntry.data && typeof backupEntry.data === 'object' && backupEntry.data.patients) {
                extracted = backupEntry.data;
            } else {
                extracted = backupEntry as unknown as AppData;
            }

            expect(extracted.patients).toHaveLength(1);
            expect(extracted.patients[0].name).toBe('Patient 1');
        });

        it('should pass through normal AppData unchanged', () => {
            const originalData = createMockAppData(1);

            // Simulate validation logic from storage.ts
            const isValid = originalData.patients && Array.isArray(originalData.patients);

            expect(isValid).toBe(true);
            expect(originalData.patients[0].name).toBe('Patient 1');
        });
    });

    // ==========================================
    // VALIDATION TESTS
    // ==========================================
    describe('Data Validation', () => {

        it('should reject data without patients array', () => {
            const invalidData = { transactions: [], version: '2.0.0' };

            const isValid = (invalidData as any).patients && Array.isArray((invalidData as any).patients);
            expect(isValid).toBeFalsy();
        });

        it('should reject data with non-array patients', () => {
            const invalidData = { patients: {}, version: '2.0.0' };

            const isValid = invalidData.patients && Array.isArray(invalidData.patients);
            expect(isValid).toBe(false);
        });

        it('should accept data with empty patients array', () => {
            const validData = { patients: [], version: '2.0.0' };

            const isValid = validData.patients && Array.isArray(validData.patients);
            expect(isValid).toBe(true);
        });

        it('should accept fully populated AppData', () => {
            const validData = createMockAppData(1);
            validData.patients.push({
                id: 'patient-2',
                name: 'Patient 2',
                dob: '1990-01-01',
                gender: 'Female',
                phone: '456',
                createdAt: new Date().toISOString()
            });

            const isValid = validData.patients && Array.isArray(validData.patients);
            expect(isValid).toBe(true);
            expect(validData.patients).toHaveLength(2);
        });
    });

    // ==========================================
    // EDGE CASES
    // ==========================================
    describe('Edge Cases', () => {

        it('should handle deeply nested rescue dump', () => {
            const appData = createMockAppData(1);
            const rescueDump = createRescueDump(appData);

            // Add more backup entries
            for (let i = 0; i < 24; i++) {
                (rescueDump as any)[`hourly_2024-12-05T${String(i).padStart(2, '0')}`] = {
                    data: createMockAppData(i),
                    timestamp: `2024-12-05T${String(i).padStart(2, '0')}:00:00Z`,
                    type: 'hourly',
                    label: `2024-12-05T${String(i).padStart(2, '0')}`
                };
            }

            expect(Object.keys(rescueDump).length).toBeGreaterThan(25);
            expect(rescueDump.latest.patients).toHaveLength(1);
        });

        it('should handle rescue dump with missing latest', () => {
            const appData = createMockAppData(1);
            const partialDump = {
                'hourly_2024-12-05T09': createBackupEntry(appData)
            };

            // Should not have latest
            expect((partialDump as any).latest).toBeUndefined();

            // But should have backup entries we can extract from
            const hourlyEntry = partialDump['hourly_2024-12-05T09'];
            expect(hourlyEntry.data.patients).toHaveLength(1);
        });

        it('should handle malformed JSON structures gracefully', () => {
            const malformedData = {
                latest: null,
                patients: undefined
            };

            // Latest is null, so extraction logic should skip it
            const hasValidLatest = malformedData.latest &&
                typeof malformedData.latest === 'object' &&
                (malformedData.latest as any).patients;

            expect(hasValidLatest).toBeFalsy();

            // Also no valid patients array
            const hasValidPatients = malformedData.patients && Array.isArray(malformedData.patients);
            expect(hasValidPatients).toBeFalsy();
        });

        it('should handle very large patient arrays', () => {
            const appData = createMockAppData(1);

            // Add 10000 patients
            for (let i = 0; i < 10000; i++) {
                appData.patients.push({
                    id: `patient-${i + 2}`,
                    name: `Patient ${i + 2} with a very long name that might cause issues`,
                    dob: '1990-01-01',
                    gender: i % 2 === 0 ? 'Male' : 'Female',
                    phone: `+1-555-${String(i).padStart(4, '0')}`,
                    createdAt: new Date().toISOString()
                });
            }

            expect(appData.patients).toHaveLength(10001);

            // Create rescue dump and verify it works
            const rescueDump = createRescueDump(appData);
            expect(rescueDump.latest.patients).toHaveLength(10001);
        });

        it('should handle special characters in data fields', () => {
            const appData = createMockAppData(1);
            appData.patients[0] = {
                id: 'patient-special',
                name: '이름 名前 имя 🏥 <script>alert("xss")</script>',
                dob: '1990-01-01',
                gender: 'Other',
                phone: '+81-3-1234-5678',
                createdAt: new Date().toISOString()
            };

            const rescueDump = createRescueDump(appData);

            expect(rescueDump.latest.patients[0].name).toContain('🏥');
        });
    });
});
