/**
 * Merge Utilities
 * Pure, testable functions for data merging and deduplication.
 * These functions are extracted from googleDrive.ts for testability.
 */

export interface PatientLike {
    id: string;
    name?: string;           // Actual Patient field
    fullName?: string;       // Backwards compatibility
    dob?: string;            // Actual Patient field
    dateOfBirth?: string;    // Backwards compatibility
}

export interface MergeResult<T> {
    merged: T[];
    newCount: number;
    skippedCount: number;
    idRemap: Map<string, string>;
}

/**
 * Content-based patient deduplication with Intra-Batch support.
 * - Deduplicates against cloud data (by Name + DOB).
 * - Deduplicates against previously processed local data (Intra-Batch).
 * - Returns ID remapping for downstream collections.
 */
export function mergePatients<T extends PatientLike>(
    cloudPatients: T[] | undefined,
    localPatients: T[] | undefined
): MergeResult<T> {
    const idRemap = new Map<string, string>();

    if (!localPatients || localPatients.length === 0) {
        return { merged: cloudPatients || [], newCount: 0, skippedCount: 0, idRemap };
    }
    if (!cloudPatients || cloudPatients.length === 0) {
        // Intra-batch deduplication for local-only data
        const seen = new Map<string, string>(); // key -> first seen id
        const existingIds = new Set<string>();
        const result: T[] = [];
        let skippedCount = 0;

        localPatients.forEach(p => {
            if (existingIds.has(p.id)) return;

            const key = `${(p.name || p.fullName || '').toLowerCase().trim()}|${p.dob || p.dateOfBirth || ''}`;
            const existingId = seen.get(key);

            if (existingId) {
                idRemap.set(p.id, existingId);
                skippedCount++;
            } else {
                result.push(p);
                seen.set(key, p.id);
                existingIds.add(p.id);
            }
        });

        return { merged: result, newCount: result.length, skippedCount, idRemap };
    }

    // Create lookup: content key → patient ID (starts with cloud, grows with accepted local)
    const patientByKey = new Map<string, string>();
    cloudPatients.forEach(p => {
        const key = `${(p.name || p.fullName || '').toLowerCase().trim()}|${p.dob || p.dateOfBirth || ''}`;
        patientByKey.set(key, p.id);
    });

    const existingIds = new Set(cloudPatients.map(p => p.id));
    const newPatients: T[] = [];
    let skippedCount = 0;

    localPatients.forEach(p => {
        // Skip if ID already exists
        if (existingIds.has(p.id)) return;

        // Check for content duplicate (against cloud AND previously processed local)
        const key = `${(p.name || p.fullName || '').toLowerCase().trim()}|${p.dob || p.dateOfBirth || ''}`;
        const existingId = patientByKey.get(key);

        if (existingId) {
            // Content duplicate! Create ID remapping
            idRemap.set(p.id, existingId);
            skippedCount++;
        } else {
            // Truly new patient - accept it
            newPatients.push(p);
            // CRITICAL: Add to lookup for intra-batch deduplication
            patientByKey.set(key, p.id);
            existingIds.add(p.id);
        }
    });

    return {
        merged: [...cloudPatients, ...newPatients],
        newCount: newPatients.length,
        skippedCount,
        idRemap
    };
}

/**
 * ID-based merge for non-patient data.
 */
export function mergeById<T extends { id: string }>(
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

/**
 * Apply patient ID remapping to records with patientId field.
 */
export function applyPatientIdRemap<T extends { patientId?: string }>(
    items: T[],
    idRemap: Map<string, string>
): { items: T[]; remappedCount: number } {
    let remappedCount = 0;
    const result = items.map(item => {
        if (item.patientId && idRemap.has(item.patientId)) {
            remappedCount++;
            return { ...item, patientId: idRemap.get(item.patientId) };
        }
        return item;
    });
    return { items: result as T[], remappedCount };
}
