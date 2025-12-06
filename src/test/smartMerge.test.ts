/**
 * Smart Merge and Deduplication Tests
 * Tests HIPAA-compliant patient deduplication logic
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the merge functions for unit testing (isolated from Google Drive)
// These are the core merge functions extracted for testing

interface Patient {
    id: string;
    fullName?: string;
    dateOfBirth?: string;
    createdAt?: string;
}

interface AppData {
    patients?: Patient[];
    soapNotes?: Array<{ id: string; date?: string }>;
    transactions?: Array<{ id: string; createdAt?: string }>;
}

/**
 * Content-based patient deduplication (extracted from googleDrive.ts for testing)
 */
function mergePatients(
    cloudPatients: Patient[] | undefined,
    localPatients: Patient[] | undefined
): { merged: Patient[]; newCount: number; skippedCount: number } {
    if (!localPatients || localPatients.length === 0) {
        return { merged: cloudPatients || [], newCount: 0, skippedCount: 0 };
    }
    if (!cloudPatients || cloudPatients.length === 0) {
        return { merged: localPatients, newCount: localPatients.length, skippedCount: 0 };
    }

    let skippedCount = 0;

    // Create a set of unique patient keys (name + DOB) from cloud data
    const cloudPatientKeys = new Set(
        cloudPatients.map(p => {
            const name = (p.fullName || '').toLowerCase().trim();
            const dob = p.dateOfBirth || '';
            return `${name}|${dob}`;
        })
    );

    // Also track IDs to avoid ID duplicates
    const cloudIds = new Set(cloudPatients.map(p => p.id));

    // Filter local patients: only add if BOTH ID and content (name+DOB) don't exist
    const newPatients = localPatients.filter(p => {
        // Skip if ID already exists
        if (cloudIds.has(p.id)) return false;

        // Skip if same name + DOB already exists (content duplicate)
        const key = `${(p.fullName || '').toLowerCase().trim()}|${p.dateOfBirth || ''}`;
        if (cloudPatientKeys.has(key)) {
            skippedCount++;
            return false;
        }

        return true;
    });

    return {
        merged: [...cloudPatients, ...newPatients],
        newCount: newPatients.length,
        skippedCount
    };
}

/**
 * ID-based merge for non-patient data (extracted from googleDrive.ts for testing)
 */
function mergeById<T extends { id: string }>(
    cloudArr: T[] | undefined,
    localArr: T[] | undefined
): { merged: T[]; newCount: number } {
    if (!localArr || localArr.length === 0) {
        return { merged: cloudArr || [], newCount: 0 };
    }
    if (!cloudArr || cloudArr.length === 0) {
        return { merged: localArr, newCount: localArr.length };
    }

    const cloudIds = new Set(cloudArr.map(item => item.id));
    const newItems = localArr.filter(item => !cloudIds.has(item.id));

    return {
        merged: [...cloudArr, ...newItems],
        newCount: newItems.length
    };
}

describe('Patient Deduplication (HIPAA Compliant)', () => {
    describe('ID-based deduplication', () => {
        it('should not add patient if same ID exists in cloud', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(0);
        });

        it('should add patient if ID is different and content is different', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: 'Jane Smith', dateOfBirth: '1985-05-15' }
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(2);
            expect(result.newCount).toBe(1);
            expect(result.skippedCount).toBe(0);
        });
    });

    describe('Content-based deduplication (name + DOB)', () => {
        it('should NOT add patient if same name + DOB exists (different ID)', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: 'John Doe', dateOfBirth: '1990-01-01' } // SAME content, different ID
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(1); // Should be skipped as duplicate
        });

        it('should skip duplicate even with case difference in name', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: 'JOHN DOE', dateOfBirth: '1990-01-01' } // UPPERCASE
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(1);
        });

        it('should skip duplicate even with extra whitespace in name', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: '  John Doe  ', dateOfBirth: '1990-01-01' } // Extra spaces
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(1);
        });

        it('should add patient if same name but different DOB', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: 'John Doe', dateOfBirth: '1991-02-02' } // Different DOB
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(2);
            expect(result.newCount).toBe(1);
            expect(result.skippedCount).toBe(0);
        });

        it('should add patient if same DOB but different name', () => {
            const cloudPatients: Patient[] = [
                { id: 'abc-123', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'xyz-789', fullName: 'Jane Doe', dateOfBirth: '1990-01-01' } // Different name
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(2);
            expect(result.newCount).toBe(1);
            expect(result.skippedCount).toBe(0);
        });
    });

    describe('Multiple patients scenario', () => {
        it('should correctly merge multiple patients with mixed duplicates', () => {
            const cloudPatients: Patient[] = [
                { id: 'p1', fullName: 'Alice', dateOfBirth: '1980-01-01' },
                { id: 'p2', fullName: 'Bob', dateOfBirth: '1985-02-02' },
                { id: 'p3', fullName: 'Charlie', dateOfBirth: '1990-03-03' }
            ];
            const localPatients: Patient[] = [
                { id: 'p4', fullName: 'Alice', dateOfBirth: '1980-01-01' }, // Duplicate by content
                { id: 'p5', fullName: 'David', dateOfBirth: '1995-04-04' }, // New
                { id: 'p6', fullName: 'Eve', dateOfBirth: '2000-05-05' },   // New
                { id: 'p1', fullName: 'Alice', dateOfBirth: '1980-01-01' }  // Duplicate by ID
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(5); // 3 cloud + 2 new (David, Eve)
            expect(result.newCount).toBe(2);
            expect(result.skippedCount).toBe(1); // p4 skipped by content
        });

        it('should handle empty cloud data', () => {
            const cloudPatients: Patient[] = [];
            const localPatients: Patient[] = [
                { id: 'p1', fullName: 'Alice', dateOfBirth: '1980-01-01' },
                { id: 'p2', fullName: 'Bob', dateOfBirth: '1985-02-02' }
            ];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(2);
            expect(result.newCount).toBe(2);
            expect(result.skippedCount).toBe(0);
        });

        it('should handle empty local data', () => {
            const cloudPatients: Patient[] = [
                { id: 'p1', fullName: 'Alice', dateOfBirth: '1980-01-01' }
            ];
            const localPatients: Patient[] = [];

            const result = mergePatients(cloudPatients, localPatients);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(0);
        });
    });

    describe('Edge cases', () => {
        it('should handle null/undefined names correctly', () => {
            const cloudPatients: Patient[] = [
                { id: 'p1', fullName: undefined, dateOfBirth: '1980-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'p2', fullName: undefined, dateOfBirth: '1980-01-01' }
            ];

            const result = mergePatients(cloudPatients, localPatients);

            // Both have undefined name and same DOB - should be considered duplicate
            expect(result.merged.length).toBe(1);
            expect(result.skippedCount).toBe(1);
        });

        it('should handle empty string names correctly', () => {
            const cloudPatients: Patient[] = [
                { id: 'p1', fullName: '', dateOfBirth: '1980-01-01' }
            ];
            const localPatients: Patient[] = [
                { id: 'p2', fullName: '   ', dateOfBirth: '1980-01-01' } // Whitespace only
            ];

            const result = mergePatients(cloudPatients, localPatients);

            // Both normalize to empty string, same DOB - should be duplicate
            expect(result.merged.length).toBe(1);
            expect(result.skippedCount).toBe(1);
        });
    });
});

describe('ID-based Merge (Non-Patient Data)', () => {
    it('should add new items by ID', () => {
        const cloudData = [
            { id: 'n1', date: '2024-01-01' },
            { id: 'n2', date: '2024-01-02' }
        ];
        const localData = [
            { id: 'n3', date: '2024-01-03' }, // New
            { id: 'n1', date: '2024-01-01' }  // Duplicate
        ];

        const result = mergeById(cloudData, localData);

        expect(result.merged.length).toBe(3);
        expect(result.newCount).toBe(1);
    });

    it('should not add duplicates by ID', () => {
        const cloudData = [{ id: 'n1', date: '2024-01-01' }];
        const localData = [{ id: 'n1', date: '2024-01-01' }];

        const result = mergeById(cloudData, localData);

        expect(result.merged.length).toBe(1);
        expect(result.newCount).toBe(0);
    });
});

describe('Integration: Complete Merge Scenario', () => {
    it('should correctly merge all data types in offline-to-online scenario', () => {
        // Simulate: Cloud has complete data, IndexedDB has partial + new additions

        const cloudData: AppData = {
            patients: [
                { id: 'p1', fullName: 'Patient 1', dateOfBirth: '1980-01-01' },
                { id: 'p2', fullName: 'Patient 2', dateOfBirth: '1985-02-02' },
                { id: 'p3', fullName: 'Patient 3', dateOfBirth: '1990-03-03' }
            ],
            soapNotes: [
                { id: 's1', date: '2024-01-01' },
                { id: 's2', date: '2024-01-02' }
            ],
            transactions: [
                { id: 't1', createdAt: '2024-01-01' }
            ]
        };

        // Local has less patients (incomplete) but added NEW ones while offline
        const localData: AppData = {
            patients: [
                { id: 'p2', fullName: 'Patient 2', dateOfBirth: '1985-02-02' }, // Exists
                { id: 'p4', fullName: 'Patient 4', dateOfBirth: '1995-04-04' }, // New
                { id: 'p5', fullName: 'Patient 1', dateOfBirth: '1980-01-01' }  // Content duplicate!
            ],
            soapNotes: [
                { id: 's3', date: '2024-01-03' } // New
            ],
            transactions: [
                { id: 't2', createdAt: '2024-01-02' } // New
            ]
        };

        // Merge patients
        const patientResult = mergePatients(cloudData.patients, localData.patients);
        expect(patientResult.merged.length).toBe(4); // 3 cloud + 1 new (p4)
        expect(patientResult.newCount).toBe(1);
        expect(patientResult.skippedCount).toBe(1); // p5 skipped as duplicate

        // Merge soap notes
        const soapResult = mergeById(cloudData.soapNotes, localData.soapNotes);
        expect(soapResult.merged.length).toBe(3); // 2 cloud + 1 new
        expect(soapResult.newCount).toBe(1);

        // Merge transactions
        const txResult = mergeById(cloudData.transactions, localData.transactions);
        expect(txResult.merged.length).toBe(2); // 1 cloud + 1 new
        expect(txResult.newCount).toBe(1);
    });
});
