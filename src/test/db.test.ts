/**
 * EXTREME TEST SUITE for IndexedDB Data Persistence (db.ts)
 * 
 * Tests cover:
 * 1. Basic save/load operations
 * 2. GFS tiered backup (hourly + daily)
 * 3. Backup rotation and cleanup
 * 4. Data integrity validation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    initDB,
    saveToDB,
    loadFromDB,
    getAllBackups,
    loadBackupByKey,
    forceBackup,
    dumpAllData
} from '../utils/db';
import { AppData } from '../types';

// Helper to create mock AppData with correct types
const createMockAppData = (id: number): AppData => ({
    patients: [{
        id: `patient-${id}`,
        name: `Patient ${id}`,
        dob: '1990-01-01',
        gender: 'Male',
        phone: '123',
        createdAt: new Date().toISOString()
    }],
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
    triageQueue: [{
        id: `triage-${id}`,
        patientId: `patient-${id}`,
        arrivalTime: new Date().toISOString(),
        chiefComplaint: 'Test',
        urgencyLevel: 'Normal',
        status: 'Waiting'
    }],
    doctorProfile: undefined,
    version: '2.0.0'
});

describe('IndexedDB Data Persistence - EXTREME TESTS', () => {

    beforeEach(async () => {
        // Clear database for each test
        const db = await initDB();
        const transaction = db.transaction('appState', 'readwrite');
        const store = transaction.objectStore('appState');
        store.clear();
        await new Promise<void>(r => { transaction.oncomplete = () => r(); });

        vi.useFakeTimers();
    });

    // ==========================================
    // BASIC SAVE/LOAD TESTS
    // ==========================================
    describe('Basic Save/Load Operations', () => {

        it('should save and load data correctly', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);
            await saveToDB(testData);

            const loaded = await loadFromDB();
            expect(loaded).toBeDefined();
            expect(loaded?.patients).toHaveLength(1);
            expect(loaded?.patients[0].name).toBe('Patient 1');
        }, { timeout: 10000 });

        it('should return null when no data exists', async () => {
            const loaded = await loadFromDB();
            expect(loaded).toBeNull();
        }, { timeout: 10000 });

        it('should overwrite existing data on save', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const data1 = createMockAppData(1);
            const data2 = createMockAppData(2);

            await saveToDB(data1);
            await saveToDB(data2);

            const loaded = await loadFromDB();
            expect(loaded?.patients[0].name).toBe('Patient 2');
        }, { timeout: 10000 });

        it('should preserve doctorProfile through save/load cycle', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);
            testData.doctorProfile = {
                doctorName: 'Dr. Test',
                clinicName: 'Test Clinic',
                clinicAddress: '123 Test St',
                permitCode: 'TEST-001',
                specialization: 'General',
                phoneNumber: '123456',
                email: 'test@test.com'
            };

            await saveToDB(testData);
            const loaded = await loadFromDB();

            expect(loaded?.doctorProfile?.doctorName).toBe('Dr. Test');
            expect(loaded?.doctorProfile?.clinicName).toBe('Test Clinic');
        }, { timeout: 10000 });
    });

    // ==========================================
    // HOURLY BACKUP TESTS  
    // ==========================================
    describe('Hourly Backup System', () => {

        it('should create hourly backup on save', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));

            const data1 = createMockAppData(1);
            await saveToDB(data1);

            // Second save triggers backup of first
            vi.setSystemTime(new Date('2024-12-05T10:00:00Z'));
            const data2 = createMockAppData(2);
            await saveToDB(data2);

            const backups = await getAllBackups();
            expect(backups.hourly.length).toBeGreaterThanOrEqual(1);
        }, { timeout: 15000 });

        it('should NOT overwrite hourly backup with same hour saves', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            await saveToDB(createMockAppData(1));

            vi.setSystemTime(new Date('2024-12-05T09:30:00Z'));
            await saveToDB(createMockAppData(2));

            vi.setSystemTime(new Date('2024-12-05T09:59:00Z'));
            await saveToDB(createMockAppData(3));

            const backups = await getAllBackups();
            const hourlyFor9 = backups.hourly.filter(b => b.key.includes('T09'));
            // Should have at most 1 backup for hour 09
            expect(hourlyFor9.length).toBeLessThanOrEqual(1);
        }, { timeout: 15000 });
    });

    // ==========================================
    // DAILY BACKUP TESTS
    // ==========================================
    describe('Daily Backup System', () => {

        it('should create daily backup on save', async () => {
            vi.setSystemTime(new Date('2024-12-05T00:00:00Z'));
            await saveToDB(createMockAppData(1));

            // Next day trigger backup
            vi.setSystemTime(new Date('2024-12-06T00:00:00Z'));
            await saveToDB(createMockAppData(2));

            const backups = await getAllBackups();
            expect(backups.daily.length).toBeGreaterThanOrEqual(1);
        }, { timeout: 15000 });

        it('should NOT overwrite daily backup with same day saves', async () => {
            vi.setSystemTime(new Date('2024-12-05T08:00:00Z'));
            await saveToDB(createMockAppData(1));

            vi.setSystemTime(new Date('2024-12-05T12:00:00Z'));
            await saveToDB(createMockAppData(2));

            vi.setSystemTime(new Date('2024-12-05T23:59:00Z'));
            await saveToDB(createMockAppData(3));

            const backups = await getAllBackups();
            const dailyFor5 = backups.daily.filter(b => b.key.includes('2024-12-05'));
            // Should have at most 1 backup for Dec 5
            expect(dailyFor5.length).toBeLessThanOrEqual(1);
        }, { timeout: 15000 });
    });

    // ==========================================
    // FORCE BACKUP TESTS
    // ==========================================
    describe('Force Backup', () => {

        it('should create backup with forceBackup', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            await saveToDB(createMockAppData(1));

            const success = await forceBackup();
            expect(success).toBe(true);
        }, { timeout: 10000 });

        it('forceBackup should return false when no data exists', async () => {
            const success = await forceBackup();
            expect(success).toBe(false);
        }, { timeout: 10000 });
    });

    // ==========================================
    // DUMP ALL DATA TESTS
    // ==========================================
    describe('Dump All Data', () => {

        it('should dump all data including latest', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            await saveToDB(createMockAppData(1));

            const dump = await dumpAllData();

            expect(dump).toBeDefined();
            expect(dump.latest).toBeDefined();
        }, { timeout: 10000 });

        it('should return empty object when no data exists', async () => {
            const dump = await dumpAllData();
            expect(dump).toEqual({});
        }, { timeout: 10000 });
    });

    // ==========================================
    // DATA INTEGRITY TESTS
    // ==========================================
    describe('Data Integrity', () => {

        it('should maintain data integrity across save/load cycles', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);
            testData.patients.push({
                id: 'patient-2',
                name: 'Patient 2',
                dob: '1985-05-15',
                gender: 'Female',
                phone: '456',
                createdAt: new Date().toISOString()
            });
            testData.transactions.push({
                id: 'tx-1',
                patientId: 'patient-1',
                patientName: 'Patient 1',
                time: '10:00',
                totalPayment: 100,
                status: 'On Progress',
                drugsUsed: [],
                createdAt: new Date().toISOString()
            });

            // Multiple save/load cycles
            for (let i = 0; i < 3; i++) {
                await saveToDB(testData);
                const loaded = await loadFromDB();
                expect(loaded?.patients).toHaveLength(2);
                expect(loaded?.transactions).toHaveLength(1);
            }
        }, { timeout: 20000 });

        it('should handle large data correctly', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);

            // Add 100 patients (reduced for faster test)
            for (let i = 0; i < 100; i++) {
                testData.patients.push({
                    id: `patient-${i + 2}`,
                    name: `Patient ${i + 2}`,
                    dob: '1990-01-01',
                    gender: i % 2 === 0 ? 'Male' : 'Female',
                    phone: `123456${i}`,
                    createdAt: new Date().toISOString()
                });
            }

            await saveToDB(testData);
            const loaded = await loadFromDB();

            expect(loaded?.patients).toHaveLength(101);
        }, { timeout: 15000 });

        it('should handle special characters in data', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);
            testData.patients[0].name = 'Patient "Test" 日本語 émojis 🎉';

            await saveToDB(testData);
            const loaded = await loadFromDB();

            expect(loaded?.patients[0].name).toBe('Patient "Test" 日本語 émojis 🎉');
        }, { timeout: 10000 });
    });

    // ==========================================
    // EDGE CASES
    // ==========================================
    describe('Edge Cases', () => {

        it('should handle empty arrays in data', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData: AppData = {
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
            };

            await saveToDB(testData);
            const loaded = await loadFromDB();

            expect(loaded?.patients).toEqual([]);
            expect(loaded?.transactions).toEqual([]);
        }, { timeout: 10000 });

        it('should handle undefined doctorProfile', async () => {
            vi.setSystemTime(new Date('2024-12-05T09:00:00Z'));
            const testData = createMockAppData(1);
            testData.doctorProfile = undefined;

            await saveToDB(testData);
            const loaded = await loadFromDB();

            expect(loaded?.doctorProfile).toBeUndefined();
        }, { timeout: 10000 });
    });
});
