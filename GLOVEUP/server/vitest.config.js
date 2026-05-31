/**
 * server/vitest.config.js — Configuración de Vitest para los tests de backend.
 *
 * Ejecutar tests desde la carpeta server/:
 *   cd server && npx vitest run
 *   o bien: npm test  (si hay script configurado en server/package.json)
 *
 * Opciones destacadas:
 *  - globalSetup:  Arranca MongoMemoryServer antes de todos los tests y
 *                  lo para al finalizar (ver tests/backend/globalSetup.js).
 *  - setupFiles:   Conecta Mongoose a la BD en memoria, limpia colecciones
 *                  entre tests y desconecta al terminar (ver setup.js).
 *  - singleThread: Fuerza ejecución serie (no paralela) para evitar
 *                  condiciones de carrera entre tests que comparten la BD.
 *  - testTimeout:  30 s por test (generoso para dar margen a operaciones
 *                  de BD lentas en CI).
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // Configura la BD en memoria antes/después de toda la suite
        globalSetup: '../tests/backend/globalSetup.js',
        // Conecta Mongoose y limpia colecciones entre tests individuales
        setupFiles: ['../tests/backend/setup.js'],
        // Ejecutar solo los tests de backend
        include: ['../tests/backend/**/*.test.js'],
        // 30 segundos por test (operaciones de BD pueden ser lentas en CI)
        testTimeout: 30000,
        // Un único hilo evita condiciones de carrera con la BD en memoria compartida
        singleThread: true,
    },
});
