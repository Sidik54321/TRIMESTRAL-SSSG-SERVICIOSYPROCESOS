/**
 * tests/backend/setup.js — Hooks de Mongoose por test para la suite de backend.
 *
 * Referenciado en server/vitest.config.js → test.setupFiles.
 * Se ejecuta antes/después de CADA archivo de tests (no una sola vez global).
 *
 * beforeAll:
 *   Conecta Mongoose a la instancia de MongoMemoryServer iniciada en globalSetup.js.
 *   El check readyState === 0 evita reconexiones redundantes si el archivo de tests
 *   ya tenía una conexión abierta (por ejemplo, al importar app.js que también conecta).
 *
 * afterEach:
 *   Limpia todas las colecciones de la BD después de cada test individual.
 *   Esto garantiza que cada test parte de un estado limpio sin depender del orden
 *   de ejecución — los tests son completamente independientes entre sí.
 *
 * afterAll:
 *   Desconecta Mongoose al finalizar todos los tests del archivo.
 *   Es necesario para liberar el handle de la conexión y que Vitest pueda
 *   terminar el proceso limpiamente.
 */
import mongoose from 'mongoose';
import { beforeAll, afterAll, afterEach } from 'vitest';

// Conectar a la BD en memoria una sola vez por archivo de tests
beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
        // readyState 0 = disconnected; solo conectar si no hay conexión activa
        await mongoose.connect(process.env.MONGO_URI);
    }
});

// Limpiar todas las colecciones después de cada test para garantizar aislamiento
afterEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
        // deleteMany({}) es más rápido que dropCollection() porque evita recrear índices
        await collections[key].deleteMany({});
    }
});

// Desconectar Mongoose al terminar el archivo para liberar recursos
afterAll(async () => {
    await mongoose.disconnect();
});
