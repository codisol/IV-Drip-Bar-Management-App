import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'lcov'],
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: ['src/test/**', 'src/**/*.d.ts', 'src/vite-env.d.ts'],
            // COVERAGE THRESHOLDS - Enable when coverage improves
            // Current coverage is low. Gradually increase as tests are added.
            // thresholds: {
            //     lines: 10,
            //     functions: 10,
            //     branches: 5,
            //     statements: 10,
            // }
        }
    }
});
