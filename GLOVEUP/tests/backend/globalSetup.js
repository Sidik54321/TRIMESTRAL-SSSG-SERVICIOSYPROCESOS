/**
 * tests/backend/globalSetup.js — Configuración global de la suite de tests de backend.
 *
 * Referenciado en server/vitest.config.js → test.globalSetup.
 * Se ejecuta UNA sola vez para toda la suite (no por cada test ni por cada archivo).
 *
 * setup():
 *   Arranca un servidor MongoDB en memoria (MongoMemoryServer) sin necesitar
 *   MongoDB instalado en el sistema. Inyecta las variables de entorno necesarias
 *   para que la aplicación Express y el cifrado AES funcionen correctamente:
 *    - MONGO_URI:       URI de la BD en memoria (ej: "mongodb://127.0.0.1:PORT/test")
 *    - ENCRYPTION_KEY:  Clave AES-256 de 64 chars hex para cifrar DNIs en los tests
 *
 * teardown():
 *   Para el servidor MongoDB en memoria al finalizar todos los tests.
 *
 * Por qué MongoMemoryServer en lugar de una BD real:
 *   - Tests aislados: cada suite tiene su propia BD efímera.
 *   - Sin efectos secundarios en datos reales o de staging.
 *   - Más rápido que arrancar un MongoDB externo en CI.
 */
import { MongoMemoryServer } from 'mongodb-memory-server';

// Referencia al servidor de MongoDB en memoria (compartida entre setup y teardown)
let mongod;

/**
 * Arranca MongoMemoryServer e inyecta las variables de entorno requeridas.
 * Llamado automáticamente por Vitest antes de ejecutar cualquier test.
 */
export async function setup() {
    mongod = await MongoMemoryServer.create();
    // Exponer la URI del servidor en memoria para que mongoose.connect() la use
    process.env.MONGO_URI = mongod.getUri();
    // Clave AES-256-CBC válida (64 chars hex = 32 bytes): necesaria para encrypt/decrypt en los tests
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
}

/**
 * Para el servidor MongoDB en memoria.
 * Llamado automáticamente por Vitest después de que terminan todos los tests.
 */
export async function teardown() {
    await mongod.stop();
}
