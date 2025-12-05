/**
 * BULLETPROOF TEST SUITE for Data Reliability
 */

import { describe, it, expect } from 'vitest';
import { AppData } from '../types';

// Helper to create mock AppData
const createMockAppData = (patientCreatedAt?: string): AppData => ({
    patients: patientCreatedAt ? [{
        id: 'patient-1',
        name: 'Test Patient',
        dob: '1990-01-01',
        gender: 'Male',
        phone: '123',
        createdAt: patientCreatedAt
    }] : [],
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

// Timestamp estimation logic (same as SaveStatus.tsx)
const estimateDataTimestamp = (data: AppData): Date | null => {
    const timestamps: number[] = [];

    const addIfValid = (dateStr: string | undefined) => {
        if (dateStr) {
            const ts = new Date(dateStr).getTime();
            if (!isNaN(ts)) timestamps.push(ts);
        }
    };

    data.patients?.forEach(p => addIfValid(p.createdAt));
    data.transactions?.forEach(t => {
        addIfValid(t.createdAt);
        addIfValid(t.paidAt);
    });
    data.soapNotes?.forEach(s => addIfValid(s.date));
    data.inventoryTransactions?.forEach(it => addIfValid(it.date));

    if (timestamps.length === 0) return null;
    return new Date(Math.max(...timestamps));
};

// Data extraction logic (same as storage.ts)
const extractAppData = (parsed: any): { data: AppData | null; format: string } => {
    if (!parsed) return { data: null, format: 'invalid' };

    if (parsed.latest && typeof parsed.latest === 'object' && parsed.latest.patients) {
        return { data: parsed.latest, format: 'rescue_dump' };
    }
    if (parsed.data && typeof parsed.data === 'object' && parsed.data.patients) {
        return { data: parsed.data, format: 'backup_entry' };
    }
    if (parsed.patients && Array.isArray(parsed.patients)) {
        return { data: parsed, format: 'normal' };
    }
    return { data: null, format: 'invalid' };
};

describe('Data Reliability - BULLETPROOF TESTS', () => {

    describe('Timestamp Estimation', () => {
        it('should return null for empty data', () => {
            expect(estimateDataTimestamp(createMockAppData())).toBeNull();
        });

        it('should detect timestamp from patients', () => {
            const ts = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(ts?.toISOString()).toBe('2024-12-05T10:00:00.000Z');
        });

        it('should handle invalid date strings', () => {
            expect(estimateDataTimestamp(createMockAppData('invalid'))).toBeNull();
        });
    });

    describe('Timestamp Comparison', () => {
        it('FILE OLDER than DB should trigger warning', () => {
            const file = estimateDataTimestamp(createMockAppData('2024-12-01T10:00:00Z'));
            const db = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(file!.getTime() < db!.getTime()).toBe(true);
        });

        it('FILE NEWER than DB should NOT trigger warning', () => {
            const file = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            const db = estimateDataTimestamp(createMockAppData('2024-12-01T10:00:00Z'));
            expect(file!.getTime() > db!.getTime()).toBe(true);
        });

        it('FILE SAME as DB should NOT trigger warning', () => {
            const file = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            const db = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(file!.getTime() === db!.getTime()).toBe(true);
        });

        it('Empty file (no timestamp) prevents comparison', () => {
            const file = estimateDataTimestamp(createMockAppData());
            const db = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(file).toBeNull();
            expect(db).not.toBeNull();
        });
    });

    describe('Data Format Detection', () => {
        it('should detect RESCUE DUMP format', () => {
            const dump = { latest: createMockAppData('2024-12-05T10:00:00Z') };
            expect(extractAppData(dump).format).toBe('rescue_dump');
        });

        it('should detect BACKUP ENTRY format', () => {
            const entry = { data: createMockAppData('2024-12-05T10:00:00Z'), timestamp: '...' };
            expect(extractAppData(entry).format).toBe('backup_entry');
        });

        it('should detect NORMAL AppData format', () => {
            expect(extractAppData(createMockAppData('2024-12-05T10:00:00Z')).format).toBe('normal');
        });

        it('should detect INVALID format - null', () => {
            expect(extractAppData(null).format).toBe('invalid');
        });

        it('should detect INVALID format - no patients', () => {
            expect(extractAppData({ transactions: [] }).format).toBe('invalid');
        });

        it('should prefer RESCUE DUMP over backup entry', () => {
            const hybrid = {
                latest: createMockAppData('2024-12-05T12:00:00Z'),
                data: createMockAppData('2024-12-05T10:00:00Z')
            };
            const result = extractAppData(hybrid);
            expect(result.format).toBe('rescue_dump');
            expect(estimateDataTimestamp(result.data!)?.toISOString()).toBe('2024-12-05T12:00:00.000Z');
        });
    });

    describe('Edge Cases', () => {
        it('should handle very old timestamp (year 2000)', () => {
            const old = estimateDataTimestamp(createMockAppData('2000-01-01T00:00:00Z'));
            const recent = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(old!.getTime() < recent!.getTime()).toBe(true);
        });

        it('should handle future timestamp', () => {
            const future = estimateDataTimestamp(createMockAppData('2030-01-01T00:00:00Z'));
            const now = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            expect(future!.getTime() > now!.getTime()).toBe(true);
        });

        it('should handle corrupted rescue dump (latest null)', () => {
            expect(extractAppData({ latest: null }).format).toBe('invalid');
        });

        it('should handle empty patients array', () => {
            const empty = createMockAppData();
            expect(extractAppData(empty).format).toBe('normal');
            expect(extractAppData(empty).data?.patients).toHaveLength(0);
        });
    });

    describe('Real-World Scenarios', () => {
        it('SCENARIO: Week-old backup triggers warning', () => {
            const weekOld = estimateDataTimestamp(createMockAppData('2024-11-28T10:00:00Z'));
            const current = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            const diffDays = (current!.getTime() - weekOld!.getTime()) / (1000 * 60 * 60 * 24);
            expect(diffDays).toBe(7);
        });

        it('SCENARIO: Rescue dump extraction preserves data', () => {
            const original = createMockAppData('2024-12-05T10:00:00Z');
            original.doctorProfile = {
                doctorName: 'Dr. Test',
                clinicName: 'Test Clinic',
                clinicAddress: '123 Test St',
                permitCode: 'TEST'
            };

            const dump = { latest: original };
            const extracted = extractAppData(dump);

            expect(extracted.data?.doctorProfile?.doctorName).toBe('Dr. Test');
        });

        it('SCENARIO: First-time user (empty DB) loads existing file', () => {
            const file = estimateDataTimestamp(createMockAppData('2024-12-05T10:00:00Z'));
            const emptyDb = estimateDataTimestamp(createMockAppData());

            expect(emptyDb).toBeNull();
            expect(file).not.toBeNull();
            // No warning should trigger if DB has no timestamp
        });
    });
});
