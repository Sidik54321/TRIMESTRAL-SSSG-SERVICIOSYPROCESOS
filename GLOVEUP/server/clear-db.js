/**
 * clear-db.js — Vacía las colecciones de usuarios, boxeadores, entrenadores y gimnasios.
 * Uso: node --env-file=.env clear-db.js
 * ADVERTENCIA: Esta operación es irreversible.
 */

import mongoose from '/mongoose';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

async function clearCollections() {
    await mongoose.connect(uri);
    console.log('Conectado a:', uri);

    const db = mongoose.connection.db;
    const collections = ['usuarios', 'boxeadores', 'entrenadores', 'gimnasios'];

    for (const name of collections) {
        const result = await db.collection(name).deleteMany({});
        console.log(`  ${name}: ${result.deletedCount} documentos eliminados`);
    }

    await mongoose.disconnect();
    console.log('Listo. Base de datos limpia.');
}

clearCollections().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});