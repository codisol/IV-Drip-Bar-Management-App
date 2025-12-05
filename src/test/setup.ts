// Test setup file
import 'fake-indexeddb/auto';
import { vi } from 'vitest';

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    clear: vi.fn(),
    removeItem: vi.fn(),
    length: 0,
    key: vi.fn()
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });
