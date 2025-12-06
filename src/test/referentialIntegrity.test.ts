/**
 * Referential Integrity Tests
 * Tests patient ID remapping and inventory deduplication
 */

import { describe, it, expect } from 'vitest';

interface Patient {
    id: string;
    fullName?: string;
    dateOfBirth?: string;
}

interface InventoryItem {
    id: string;
    drugName?: string;
    batchNumber?: string;
    quantity?: number;
}

interface Transaction {
    id: string;
    patientId: string;
    amount: number;
}

interface Document {
    id: string;
    patientId: string;
    date: string;
}

/**
 * Full merge simulation with patient ID remapping
 */
function smartMergeWithRemapping(
    cloudPatients: Patient[],
    localPatients: Patient[],
    localTransactions: Transaction[],
    localDocuments: Document[]
) {
    const patientIdRemap = new Map<string, string>();
    let skippedPatients = 0;
    let remappedReferences = 0;

    // Create lookup: content key → cloud patient ID
    const cloudPatientByKey = new Map<string, string>();
    cloudPatients.forEach(p => {
        const key = `${(p.fullName || '').toLowerCase().trim()}|${p.dateOfBirth || ''}`;
        cloudPatientByKey.set(key, p.id);
    });
    const cloudIds = new Set(cloudPatients.map(p => p.id));

    // Process patients
    const newPatients: Patient[] = [];
    localPatients.forEach(p => {
        if (cloudIds.has(p.id)) return;

        const key = `${(p.fullName || '').toLowerCase().trim()}|${p.dateOfBirth || ''}`;
        const existingCloudId = cloudPatientByKey.get(key);

        if (existingCloudId) {
            patientIdRemap.set(p.id, existingCloudId);
            skippedPatients++;
        } else {
            newPatients.push(p);
        }
    });

    const mergedPatients = [...cloudPatients, ...newPatients];

    // Process transactions with patientId remapping
    const remappedTransactions = localTransactions.map(t => {
        if (patientIdRemap.has(t.patientId)) {
            remappedReferences++;
            return { ...t, patientId: patientIdRemap.get(t.patientId)! };
        }
        return t;
    });

    // Process documents with patientId remapping
    const remappedDocuments = localDocuments.map(d => {
        if (patientIdRemap.has(d.patientId)) {
            remappedReferences++;
            return { ...d, patientId: patientIdRemap.get(d.patientId)! };
        }
        return d;
    });

    return {
        patients: mergedPatients,
        transactions: remappedTransactions,
        documents: remappedDocuments,
        patientIdRemap,
        skippedPatients,
        remappedReferences
    };
}

/**
 * Inventory merge with content-based deduplication
 */
function mergeInventory(
    cloudInv: InventoryItem[],
    localInv: InventoryItem[]
): { merged: InventoryItem[]; newCount: number; skippedCount: number } {
    if (!localInv.length) return { merged: cloudInv, newCount: 0, skippedCount: 0 };
    if (!cloudInv.length) return { merged: localInv, newCount: localInv.length, skippedCount: 0 };

    let skippedCount = 0;
    const cloudInvKeys = new Set(
        cloudInv.map(i => `${(i.drugName || '').toLowerCase().trim()}|${i.batchNumber || ''}`)
    );
    const cloudIds = new Set(cloudInv.map(i => i.id));

    const newItems = localInv.filter(i => {
        if (cloudIds.has(i.id)) return false;

        const key = `${(i.drugName || '').toLowerCase().trim()}|${i.batchNumber || ''}`;
        if (cloudInvKeys.has(key)) {
            skippedCount++;
            return false;
        }
        return true;
    });

    return {
        merged: [...cloudInv, ...newItems],
        newCount: newItems.length,
        skippedCount
    };
}

describe('Patient ID Remapping', () => {
    it('should create patientId remap for duplicate patients', () => {
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
        ];

        const localPatients: Patient[] = [
            { id: 'local-p1', fullName: 'John Doe', dateOfBirth: '1990-01-01' } // Same content
        ];

        const result = smartMergeWithRemapping(cloudPatients, localPatients, [], []);

        expect(result.patients.length).toBe(1); // Only 1 patient (no duplicate)
        expect(result.skippedPatients).toBe(1);
        expect(result.patientIdRemap.get('local-p1')).toBe('cloud-p1');
    });

    it('should remap transaction patientId to cloud patient ID', () => {
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
        ];

        const localPatients: Patient[] = [
            { id: 'local-p1', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
        ];

        const localTransactions: Transaction[] = [
            { id: 't1', patientId: 'local-p1', amount: 100 }
        ];

        const result = smartMergeWithRemapping(cloudPatients, localPatients, localTransactions, []);

        expect(result.patients.length).toBe(1);
        expect(result.transactions[0].patientId).toBe('cloud-p1'); // REMAPPED!
        expect(result.remappedReferences).toBe(1);
    });

    it('should remap document patientId to cloud patient ID', () => {
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'Jane Doe', dateOfBirth: '1985-05-15' }
        ];

        const localPatients: Patient[] = [
            { id: 'local-p1', fullName: 'Jane Doe', dateOfBirth: '1985-05-15' }
        ];

        const localDocuments: Document[] = [
            { id: 'd1', patientId: 'local-p1', date: '2024-01-01' }
        ];

        const result = smartMergeWithRemapping(cloudPatients, localPatients, [], localDocuments);

        expect(result.documents[0].patientId).toBe('cloud-p1'); // REMAPPED!
        expect(result.remappedReferences).toBe(1);
    });

    it('should NOT remap if patient is truly new', () => {
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'John Doe', dateOfBirth: '1990-01-01' }
        ];

        const localPatients: Patient[] = [
            { id: 'local-p2', fullName: 'Jane Smith', dateOfBirth: '1995-05-05' } // Different person
        ];

        const localTransactions: Transaction[] = [
            { id: 't1', patientId: 'local-p2', amount: 200 }
        ];

        const result = smartMergeWithRemapping(cloudPatients, localPatients, localTransactions, []);

        expect(result.patients.length).toBe(2); // Both patients exist
        expect(result.transactions[0].patientId).toBe('local-p2'); // NOT remapped
        expect(result.remappedReferences).toBe(0);
    });

    it('should handle multiple remappings', () => {
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'Alice', dateOfBirth: '1980-01-01' },
            { id: 'cloud-p2', fullName: 'Bob', dateOfBirth: '1985-02-02' }
        ];

        const localPatients: Patient[] = [
            { id: 'local-p1', fullName: 'Alice', dateOfBirth: '1980-01-01' },
            { id: 'local-p2', fullName: 'Bob', dateOfBirth: '1985-02-02' },
            { id: 'local-p3', fullName: 'Charlie', dateOfBirth: '1990-03-03' } // New
        ];

        const localTransactions: Transaction[] = [
            { id: 't1', patientId: 'local-p1', amount: 100 },
            { id: 't2', patientId: 'local-p2', amount: 200 },
            { id: 't3', patientId: 'local-p3', amount: 300 }
        ];

        const result = smartMergeWithRemapping(cloudPatients, localPatients, localTransactions, []);

        expect(result.patients.length).toBe(3); // 2 cloud + 1 new
        expect(result.skippedPatients).toBe(2);
        expect(result.transactions[0].patientId).toBe('cloud-p1');
        expect(result.transactions[1].patientId).toBe('cloud-p2');
        expect(result.transactions[2].patientId).toBe('local-p3'); // New, no remap
        expect(result.remappedReferences).toBe(2);
    });
});

describe('Inventory Deduplication', () => {
    it('should deduplicate by drugName + batchNumber', () => {
        const cloudInv: InventoryItem[] = [
            { id: 'inv1', drugName: 'Vitamin C', batchNumber: 'BATCH001', quantity: 100 }
        ];

        const localInv: InventoryItem[] = [
            { id: 'inv2', drugName: 'Vitamin C', batchNumber: 'BATCH001', quantity: 50 }
        ];

        const result = mergeInventory(cloudInv, localInv);

        expect(result.merged.length).toBe(1);
        expect(result.skippedCount).toBe(1);
    });

    it('should allow same drug with different batch number', () => {
        const cloudInv: InventoryItem[] = [
            { id: 'inv1', drugName: 'Vitamin C', batchNumber: 'BATCH001' }
        ];

        const localInv: InventoryItem[] = [
            { id: 'inv2', drugName: 'Vitamin C', batchNumber: 'BATCH002' }
        ];

        const result = mergeInventory(cloudInv, localInv);

        expect(result.merged.length).toBe(2);
        expect(result.newCount).toBe(1);
        expect(result.skippedCount).toBe(0);
    });

    it('should be case-insensitive for drug names', () => {
        const cloudInv: InventoryItem[] = [
            { id: 'inv1', drugName: 'Vitamin C', batchNumber: 'BATCH001' }
        ];

        const localInv: InventoryItem[] = [
            { id: 'inv2', drugName: 'VITAMIN C', batchNumber: 'BATCH001' }
        ];

        const result = mergeInventory(cloudInv, localInv);

        expect(result.merged.length).toBe(1);
        expect(result.skippedCount).toBe(1);
    });

    it('should handle whitespace in drug names', () => {
        const cloudInv: InventoryItem[] = [
            { id: 'inv1', drugName: 'Vitamin C', batchNumber: 'BATCH001' }
        ];

        const localInv: InventoryItem[] = [
            { id: 'inv2', drugName: '  Vitamin C  ', batchNumber: 'BATCH001' }
        ];

        const result = mergeInventory(cloudInv, localInv);

        expect(result.merged.length).toBe(1);
        expect(result.skippedCount).toBe(1);
    });
});

describe('Full Offline-to-Online Scenario', () => {
    it('should handle complete offline scenario with all data types', () => {
        // Cloud has complete data
        const cloudPatients: Patient[] = [
            { id: 'cloud-p1', fullName: 'Patient One', dateOfBirth: '1980-01-01' },
            { id: 'cloud-p2', fullName: 'Patient Two', dateOfBirth: '1985-02-02' }
        ];

        // User was offline, IndexedDB got cleared, recreated patients
        const localPatients: Patient[] = [
            { id: 'local-p1', fullName: 'Patient One', dateOfBirth: '1980-01-01' }, // Duplicate
            { id: 'local-p3', fullName: 'Patient Three', dateOfBirth: '1990-03-03' } // New
        ];

        const localTransactions: Transaction[] = [
            { id: 't1', patientId: 'local-p1', amount: 100 }, // References duplicate patient
            { id: 't2', patientId: 'local-p3', amount: 200 }  // References new patient
        ];

        const localDocuments: Document[] = [
            { id: 'd1', patientId: 'local-p1', date: '2024-01-01' } // References duplicate patient
        ];

        const result = smartMergeWithRemapping(
            cloudPatients,
            localPatients,
            localTransactions,
            localDocuments
        );

        // Verify patient merge
        expect(result.patients.length).toBe(3); // 2 cloud + 1 new
        expect(result.skippedPatients).toBe(1);

        // Verify transaction remapping
        expect(result.transactions[0].patientId).toBe('cloud-p1'); // Remapped
        expect(result.transactions[1].patientId).toBe('local-p3'); // Not remapped (new patient)

        // Verify document remapping
        expect(result.documents[0].patientId).toBe('cloud-p1'); // Remapped

        expect(result.remappedReferences).toBe(2); // 1 transaction + 1 document
    });
});
