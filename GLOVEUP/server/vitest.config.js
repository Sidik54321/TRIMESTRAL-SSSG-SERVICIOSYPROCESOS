import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globalSetup: '../tests/backend/globalSetup.js',
        setupFiles: ['../tests/backend/setup.js'],
        include: ['../tests/backend/**/*.test.js'],
        testTimeout: 30000,
        singleThread: true,
    },
});
