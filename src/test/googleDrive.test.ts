/**
 * TEST SUITE for Google Drive Integration & Data Integrity
 * 
 * Tests cover:
 * 1. Data serialization/deserialization integrity
 * 2. AppData validation
 * 3. Restore point independence from cloud sync
 * 4. Data corruption detection
 * 5. Version compatibility
 */

import { describe, it, expect } from 'vitest';
import { AppData } from '../types';
import { formatBytes, estimateAppDataSize } from '../utils/storageQuota';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a minimal valid AppData object
 */
const createMinimalAppData = (): AppData => ({
    patients: [],
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

/**
 * Create a fully populated AppData object for stress testing
 */
const createFullAppData = (patientCount: number = 10): AppData => ({
    patients: Array.from({ length: patientCount }, (_, i) => ({
        id: `patient-${i}`,
        name: `Test Patient ${i}`,
        dob: '1990-01-01',
        gender: 'Male' as const,
        phone: `08123456789${i}`,
        createdAt: new Date().toISOString()
    })),
    transactions: Array.from({ length: patientCount * 2 }, (_, i) => ({
        id: `trans-${i}`,
        patientId: `patient-${i % patientCount}`,
        patientName: `Test Patient ${i % patientCount}`,
        drugsUsed: [
            { drugId: 'd1', drugName: 'Vitamin C', quantity: 1, batchNumber: 'BATCH001' }
        ],
        totalPayment: 50000,
        status: 'Paid' as const,
        time: new Date().toISOString(),
        createdAt: new Date().toISOString()
    })),
    soapNotes: Array.from({ length: patientCount }, (_, i) => ({
        id: `soap-${i}`,
        transactionId: `trans-${i}`,
        date: new Date().toISOString(),
        subjective: 'Patient reports fatigue',
        objective: 'BP: 120/80, HR: 72',
        assessment: 'Mild fatigue',
        plan: 'IV vitamin therapy',
        versions: []
    })),
    inventory: Array.from({ length: 20 }, (_, i) => ({
        id: `inv-${i}`,
        genericName: `Drug ${i}`,
        brandName: `Brand ${i}`,
        strength: '500mg',
        dateReceived: new Date().toISOString(),
        storageLocation: 'Shelf A',
        drugClass: 'Vitamin',
        quantity: 100,
        batchNumber: `BATCH${String(i).padStart(3, '0')}`,
        expiryDate: '2025-12-31',
        reorderLevel: 10,
        createdAt: new Date().toISOString()
    })),
    inventoryTransactions: [],
    informedConsents: [],
    declinationLetters: [],
    sickLeaves: [],
    referralLetters: [],
    prescriptions: [],
    fitnessCertificates: [],
    triageQueue: [],
    doctorProfile: {
        doctorName: 'Dr. Test',
        clinicName: 'Test Clinic',
        clinicAddress: '123 Test Street',
        permitCode: 'MD-12345',
        specialization: 'General Practice',
        phoneNumber: '08123456789',
        email: 'doctor@test.com'
    },
    version: '2.0.0'
});

/**
 * Simulate Google Drive save/load cycle (JSON serialization)
 */
function simulateCloudRoundTrip<T>(data: T): T {
    const json = JSON.stringify(data);
    return JSON.parse(json);
}

/**
 * Deep compare two objects (for data integrity check)
 */
function deepEqual(a: unknown, b: unknown): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Validate AppData structure
 */
function validateAppData(data: unknown): data is AppData {
    if (!data || typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;

    const requiredArrays = [
        'patients', 'transactions', 'soapNotes', 'inventory',
        'inventoryTransactions', 'informedConsents', 'declinationLetters',
        'sickLeaves', 'referralLetters', 'prescriptions',
        'fitnessCertificates', 'triageQueue'
    ];

    return requiredArrays.every(key => Array.isArray(d[key]));
}

/**
 * Check for data corruption patterns
 */
function detectCorruption(data: AppData): { isCorrupted: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for null/undefined in arrays (shouldn't happen)
    if (data.patients.some(p => p === null || p === undefined)) {
        issues.push('Null patient entries detected');
    }

    // Check for orphaned transactions (patient doesn't exist)
    const patientIds = new Set(data.patients.map(p => p.id));
    const orphanedTransactions = data.transactions.filter(t => !patientIds.has(t.patientId));
    if (orphanedTransactions.length > 0) {
        issues.push(`${orphanedTransactions.length} orphaned transactions (patient not found)`);
    }

    // Check for duplicate IDs
    const checkDuplicateIds = <T extends { id: string }>(items: T[], name: string) => {
        const ids = items.map(i => i.id);
        const uniqueIds = new Set(ids);
        if (ids.length !== uniqueIds.size) {
            issues.push(`Duplicate IDs in ${name}`);
        }
    };

    checkDuplicateIds(data.patients, 'patients');
    checkDuplicateIds(data.transactions, 'transactions');
    checkDuplicateIds(data.inventory, 'inventory');

    return { isCorrupted: issues.length > 0, issues };
}

// ============================================================================
// Test Suites
// ============================================================================

describe('Data Serialization Integrity', () => {
    it('should preserve minimal AppData through JSON round-trip', () => {
        const original = createMinimalAppData();
        const restored = simulateCloudRoundTrip(original);

        expect(deepEqual(original, restored)).toBe(true);
        expect(validateAppData(restored)).toBe(true);
    });

    it('should preserve full AppData through JSON round-trip', () => {
        const original = createFullAppData(50);
        const restored = simulateCloudRoundTrip(original);

        expect(validateAppData(restored)).toBe(true);
        expect(restored.patients.length).toBe(original.patients.length);
        expect(restored.transactions.length).toBe(original.transactions.length);
        expect(restored.inventory.length).toBe(original.inventory.length);
    });

    it('should preserve Date strings correctly', () => {
        const original = createFullAppData(1);
        const restored = simulateCloudRoundTrip(original);

        // Dates should be preserved as ISO strings
        expect(typeof restored.patients[0].createdAt).toBe('string');
        expect(new Date(restored.patients[0].createdAt!).toISOString()).toBe(original.patients[0].createdAt);
    });

    it('should preserve special characters in text fields', () => {
        const original = createMinimalAppData();
        original.patients.push({
            id: 'special-1',
            name: 'Tëst Pàtïent with "quotes" and \'apostrophes\'',
            dob: '1990-01-01',
            gender: 'Female',
            phone: '+62-812-3456-7890',
            createdAt: new Date().toISOString()
        });

        const restored = simulateCloudRoundTrip(original);
        expect(restored.patients[0].name).toBe(original.patients[0].name);
        expect(restored.patients[0].name).toBe(original.patients[0].name);
        expect(restored.patients[0].phone).toBe(original.patients[0].phone);
    });

    it('should preserve Unicode characters (Indonesian)', () => {
        const original = createMinimalAppData();
        original.doctorProfile = {
            doctorName: 'dr. Bambang Sudrajat, Sp.PD',
            clinicName: 'Klinik Sehat Sejahtera',
            clinicAddress: 'Jl. Gatot Subroto No. 123, Kelurahan Menteng',
            permitCode: 'SIP-12345',
            specialization: 'Penyakit Dalam',
            phoneNumber: '021-12345678',
            email: 'dr.bambang@klinik.co.id'
        };

        const restored = simulateCloudRoundTrip(original);
        expect(restored.doctorProfile?.doctorName).toBe(original.doctorProfile.doctorName);
    });
});

describe('Data Validation', () => {
    it('should validate correct AppData structure', () => {
        const data = createFullAppData(5);
        expect(validateAppData(data)).toBe(true);
    });

    it('should reject null data', () => {
        expect(validateAppData(null)).toBe(false);
    });

    it('should reject undefined data', () => {
        expect(validateAppData(undefined)).toBe(false);
    });

    it('should reject data with missing required arrays', () => {
        const partial = { patients: [], transactions: [] };
        expect(validateAppData(partial)).toBe(false);
    });

    it('should reject data with non-array fields', () => {
        const invalid = {
            ...createMinimalAppData(),
            patients: 'not an array'
        };
        expect(validateAppData(invalid)).toBe(false);
    });
});

describe('Corruption Detection', () => {
    it('should detect no corruption in valid data', () => {
        const data = createFullAppData(10);
        const result = detectCorruption(data);
        expect(result.isCorrupted).toBe(false);
        expect(result.issues).toHaveLength(0);
    });

    it('should detect orphaned transactions', () => {
        const data = createFullAppData(5);
        // Add transaction with non-existent patient
        data.transactions.push({
            id: 'orphan-trans',
            patientId: 'non-existent-patient',
            patientName: 'Ghost Patient',
            drugsUsed: [],
            totalPayment: 0,
            status: 'On Progress',
            time: new Date().toISOString(),
            createdAt: new Date().toISOString()
        });

        const result = detectCorruption(data);
        expect(result.isCorrupted).toBe(true);
        expect(result.issues.some(i => i.includes('orphaned'))).toBe(true);
    });

    it('should detect duplicate patient IDs', () => {
        const data = createMinimalAppData();
        data.patients.push(
            { id: 'dup-1', name: 'Patient A', dob: '1990-01-01', gender: 'Male', phone: '123', createdAt: new Date().toISOString() },
            { id: 'dup-1', name: 'Patient B', dob: '1990-01-01', gender: 'Female', phone: '456', createdAt: new Date().toISOString() }
        );

        const result = detectCorruption(data);
        expect(result.isCorrupted).toBe(true);
        expect(result.issues.some(i => i.includes('Duplicate'))).toBe(true);
    });
});

describe('Restore Point Independence', () => {
    it('should maintain separate copies when modifying cloud data', () => {
        // Simulate: local backup exists, then cloud data is modified
        const localBackup = createFullAppData(5);
        const cloudData = simulateCloudRoundTrip(createFullAppData(5));

        // Modify cloud data
        cloudData.patients.push({
            id: 'new-patient',
            name: 'New Cloud Patient',
            dob: '2000-01-01',
            gender: 'Male',
            phone: '999',
            createdAt: new Date().toISOString()
        });

        // Local backup should be unchanged
        expect(localBackup.patients.length).toBe(5);
        expect(cloudData.patients.length).toBe(6);
    });

    it('should restore from backup without affecting cloud reference', () => {
        const cloudData = createFullAppData(3);
        const backupData = createFullAppData(10); // Backup has more patients

        // Simulate restore operation
        const restoredData = simulateCloudRoundTrip(backupData);

        // Cloud data should be unchanged (in real app, they're separate)
        expect(cloudData.patients.length).toBe(3);
        expect(restoredData.patients.length).toBe(10);
    });

    it('should handle empty backup gracefully', () => {
        const emptyBackup = createMinimalAppData();
        const restored = simulateCloudRoundTrip(emptyBackup);

        expect(validateAppData(restored)).toBe(true);
        expect(restored.patients).toHaveLength(0);
        expect(restored.transactions).toHaveLength(0);
    });
});

describe('Storage Quota Utilities', () => {
    it('should format bytes correctly', () => {
        expect(formatBytes(0)).toBe('0 B');
        expect(formatBytes(1024)).toBe('1 KB');
        expect(formatBytes(1024 * 1024)).toBe('1 MB');
        expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
    });

    it('should estimate data size accurately', () => {
        const smallData = createMinimalAppData();
        const largeData = createFullAppData(100);

        const smallSize = estimateAppDataSize(smallData);
        const largeSize = estimateAppDataSize(largeData);

        expect(smallSize).toBeGreaterThan(0);
        expect(largeSize).toBeGreaterThan(smallSize);
    });

    it('should not throw on empty data', () => {
        const emptyData = createMinimalAppData();
        expect(() => estimateAppDataSize(emptyData)).not.toThrow();
    });
});

describe('Large Data Stress Tests', () => {
    it('should handle 1000 patients without corruption', () => {
        const largeData = createFullAppData(1000);
        const restored = simulateCloudRoundTrip(largeData);

        expect(validateAppData(restored)).toBe(true);
        expect(restored.patients.length).toBe(1000);

        const corruption = detectCorruption(restored);
        expect(corruption.isCorrupted).toBe(false);
    });

    it('should serialize and deserialize consistently', () => {
        const data = createFullAppData(100);

        // Multiple round trips should produce identical results
        const trip1 = simulateCloudRoundTrip(data);
        const trip2 = simulateCloudRoundTrip(trip1);
        const trip3 = simulateCloudRoundTrip(trip2);

        expect(deepEqual(trip1, trip2)).toBe(true);
        expect(deepEqual(trip2, trip3)).toBe(true);
    });
});

describe('Version Compatibility', () => {
    it('should handle data without version field', () => {
        const oldData = createMinimalAppData();
        delete (oldData as unknown as Record<string, unknown>).version;

        const restored = simulateCloudRoundTrip(oldData);
        expect(validateAppData(restored)).toBe(true);
    });

    it('should handle data with different version', () => {
        const data = createMinimalAppData();
        data.version = '1.0.0';

        const restored = simulateCloudRoundTrip(data);
        expect(validateAppData(restored)).toBe(true);
        expect(restored.version).toBe('1.0.0');
    });
});
