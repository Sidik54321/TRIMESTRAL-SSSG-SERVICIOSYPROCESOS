/**
 * scratch/check_gyms.js — Script de depuración para inspeccionar gimnasios.
 *
 * Uso: node scratch/check_gyms.js
 *
 * Busca en la colección "gimnasios" todos los documentos cuyo nombre
 * contenga "Glove Up" (búsqueda case-insensitive) y los imprime en JSON
 * formateado en la consola para inspección rápida.
 *
 * Usa un Schema vacío con { strict: false } para acceder a la colección sin
 * necesidad de importar el modelo real de Gimnasio.js, lo que permite
 * ejecutarlo de forma independiente sin importar el módulo completo.
 *
 * NOTA: Solo para uso en desarrollo. No incluir en flujos CI/CD.
 */

import mongoose from 'mongoose';

// URI de MongoDB: se lee de la variable de entorno o se usa el valor local por defecto
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

/**
 * Conecta a MongoDB, consulta los gimnasios que coincidan con /Glove Up/i,
 * los imprime en consola y desconecta.
 */
async function check() {
    await mongoose.connect(uri);

    // Schema vacío con strict:false para leer documentos sin definir todos los campos
    const Gimnasio = mongoose.model('Gimnasio', new mongoose.Schema({}, { strict: false }));
    const gyms = await Gimnasio.find({ nombre: /Glove Up/i }).lean();

    // Imprimir en JSON indentado para facilitar la lectura en consola
    console.log(JSON.stringify(gyms, null, 2));

    await mongoose.disconnect();
}

check();
