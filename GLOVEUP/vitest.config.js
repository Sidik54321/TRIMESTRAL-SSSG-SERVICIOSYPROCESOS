/**
 * vitest.config.js — Configuración de Vitest para los tests de frontend.
 *
 * Ejecutar los tests de frontend desde la raíz del proyecto:
 *   npx vitest run
 *   o bien: npm test (si hay script configurado en package.json)
 *
 * Tests de frontend: tests/frontend/**\/*.test.js
 *  - Son tests unitarios puros (funciones puras, sin DOM real).
 *  - Actualmente incluyen: validators.test.js
 *
 * testTimeout: 10 s — suficiente para tests unitarios sin I/O.
 *
 * No tiene globalSetup ni setupFiles porque los tests de frontend
 * no necesitan MongoDB ni ningún estado externo.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // Ejecutar solo los tests de la carpeta frontend
        include: ['tests/frontend/**/*.test.js'],
        // 10 segundos por test (solo lógica pura, sin I/O)
        testTimeout: 10000,
    },
});
