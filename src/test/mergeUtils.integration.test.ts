/**
 * Integration Tests for Merge Utilities
 * These tests import the REAL functions from mergeUtils.ts
 */

import { describe, it, expect } from 'vitest';
import { mergePatients, mergeById, applyPatientIdRemap, PatientLike } from '../utils/mergeUtils';

describe('mergePatients (Real Implementation)', () => {
    describe('Cloud vs Local deduplication', () => {
        it('should merge patients with different IDs and content', () => {
            const cloud: PatientLike[] = [
                { id: 'cloud-1', fullName: 'Alice', dateOfBirth: '1990-01-01' }
            ];
            const local: PatientLike[] = [
                { id: 'local-1', fullName: 'Bob', dateOfBirth: '1985-05-05' }
            ];

            const result = mergePatients(cloud, local);

            expect(result.merged.length).toBe(2);
            expect(result.newCount).toBe(1);
            expect(result.skippedCount).toBe(0);
        });

        it('should skip and remap if same Name+DOB exists in cloud', () => {
            const cloud: PatientLike[] = [
                { id: 'cloud-1', fullName: 'Alice', dateOfBirth: '1990-01-01' }
            ];
            const local: PatientLike[] = [
                { id: 'local-1', fullName: 'Alice', dateOfBirth: '1990-01-01' } // Same content!
            ];

            const result = mergePatients(cloud, local);

            expect(result.merged.length).toBe(1);
            expect(result.newCount).toBe(0);
            expect(result.skippedCount).toBe(1);
            expect(result.idRemap.get('local-1')).toBe('cloud-1');
        });
    });

    describe('Intra-Batch deduplication (Simulated Re-entry)', () => {
        it('should deduplicate within local batch when no cloud data', () => {
            const cloud: PatientLike[] = [];
            const local: PatientLike[] = [
                { id: 'local-1', fullName: 'Alice', dateOfBirth: '1990-01-01' },
                { id: 'local-2', fullName: 'Alice', dateOfBirth: '1990-01-01' } // Duplicate!
            ];

            const result = mergePatients(cloud, local);

            expect(result.merged.length).toBe(1);
            expect(result.skippedCount).toBe(1);
            expect(result.idRemap.get('local-2')).toBe('local-1');
        });

        it('should deduplicate within local batch with cloud data present', () => {
            const cloud: PatientLike[] = [
                { id: 'cloud-1', fullName: 'Bob', dateOfBirth: '1985-05-05' }
            ];
            const local: PatientLike[] = [
                { id: 'local-1', fullName: 'Alice', dateOfBirth: '1990-01-01' },
                { id: 'local-2', fullName: 'Alice', dateOfBirth: '1990-01-01' } // Intra-batch duplicate!
            ];

            const result = mergePatients(cloud, local);

            expect(result.merged.length).toBe(2); // cloud-1 + local-1
            expect(result.newCount).toBe(1);
            expect(result.skippedCount).toBe(1);
            expect(result.idRemap.get('local-2')).toBe('local-1');
        });
    });

    describe('Edge cases', () => {
        it('should handle empty cloud and local', () => {
            const result = mergePatients([], []);
            expect(result.merged.length).toBe(0);
        });

        it('should handle only cloud data', () => {
            const cloud: PatientLike[] = [{ id: 'c1', fullName: 'A' }];
            const result = mergePatients(cloud, []);
            expect(result.merged.length).toBe(1);
        });

        it('should handle undefined fullName and DOB', () => {
            const cloud: PatientLike[] = [{ id: 'c1' }];
            const local: PatientLike[] = [{ id: 'l1' }]; // Both have undefined name/dob = same key!

            const result = mergePatients(cloud, local);

            expect(result.merged.length).toBe(1);
            expect(result.skippedCount).toBe(1);
        });
    });
});

describe('mergeById (Real Implementation)', () => {
    it('should add new items by ID', () => {
        const cloud = [{ id: 'c1' }, { id: 'c2' }];
        const local = [{ id: 'l1' }, { id: 'c1' }]; // c1 is duplicate

        const result = mergeById(cloud, local);

        expect(result.merged.length).toBe(3);
        expect(result.newCount).toBe(1);
    });
});

describe('applyPatientIdRemap', () => {
    it('should remap patientId in records', () => {
        const records = [
            { id: 'tx1', patientId: 'local-1' },
            { id: 'tx2', patientId: 'cloud-1' }
        ];
        const remap = new Map([['local-1', 'cloud-1']]);

        const result = applyPatientIdRemap(records, remap);

        expect(result.items[0].patientId).toBe('cloud-1');
        expect(result.items[1].patientId).toBe('cloud-1');
        expect(result.remappedCount).toBe(1);
    });
});

describe('Full Sync Scenario Integration', () => {
    it('should correctly merge all data in offline-to-online scenario', () => {
        // Simulate: Cloud has data, user added patients offline (one is a duplicate)
        const cloudPatients: PatientLike[] = [
            { id: 'cloud-1', fullName: 'Alice', dateOfBirth: '1990-01-01' }
        ];
        const localPatients: PatientLike[] = [
            { id: 'local-1', fullName: 'Alice', dateOfBirth: '1990-01-01' }, // Content duplicate
            { id: 'local-2', fullName: 'Bob', dateOfBirth: '1985-05-05' }   // New
        ];
        const localTransactions = [
            { id: 'tx1', patientId: 'local-1' }, // Points to duplicate patient
            { id: 'tx2', patientId: 'local-2' }  // Points to new patient
        ];

        // Step 1: Merge patients
        const patientResult = mergePatients(cloudPatients, localPatients);
        expect(patientResult.merged.length).toBe(2); // Alice + Bob
        expect(patientResult.idRemap.get('local-1')).toBe('cloud-1');

        // Step 2: Remap transactions
        const txResult = applyPatientIdRemap(localTransactions, patientResult.idRemap);
        expect(txResult.items[0].patientId).toBe('cloud-1'); // Remapped!
        expect(txResult.items[1].patientId).toBe('local-2'); // Unchanged
        expect(txResult.remappedCount).toBe(1);
    });
});
