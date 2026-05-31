/**
 * utils/cleanup.js — Script de utilidad para vaciar la base de datos de desarrollo.
 *
 * Propósito: eliminar todos los documentos de todas las colecciones para
 * dejar la base de datos limpia antes de ejecutar seeds o tests manuales.
 *
 * Uso:
 *   node server/src/utils/cleanup.js
 *
 * Las variables de entorno MONGO_URI puede configurarse para apuntar a
 * cualquier entorno (local, staging…). Por defecto usa localhost:27017/gloveup.
 *
 * Usa Promise.allSettled en lugar de Promise.all para garantizar que el
 * intento de borrado de TODAS las colecciones se ejecuta aunque alguna falle,
 * mostrando el error específico sin abortar el resto del proceso.
 *
 * IMPORTANTE: Este script borra datos irreversiblemente. No ejecutar en producción.
 */

import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import Mensaje from '../models/Mensaje.js';
import Notificacion from '../models/Notificacion.js';

// URI de MongoDB: se lee de la variable de entorno o se usa el valor local por defecto
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

/**
 * Función principal: conecta a MongoDB, borra todas las colecciones y desconecta.
 * Sale con código 0 si todo fue bien, o 1 si hubo un error fatal de conexión.
 */
async function cleanup() {
    try {
        console.log('⏳ Conectando a MongoDB para limpieza...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado.');

        console.log('🧹 Borrando colecciones...');

        // Promise.allSettled garantiza que se intentan borrar TODAS las colecciones
        // aunque alguna falle, en vez de abortar en el primer error como haría Promise.all
        const results = await Promise.allSettled([
            Usuario.deleteMany({}),
            Boxeador.deleteMany({}),
            Entrenador.deleteMany({}),
            Gimnasio.deleteMany({}),
            Mensaje.deleteMany({}),
            Notificacion.deleteMany({})
        ]);

        // Informar del resultado de cada colección individualmente
        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                console.log(`✅ Colección ${i} limpiada.`);
            } else {
                console.log(`❌ Error limpiando colección ${i}:`, res.reason);
            }
        });

        console.log('✨ Base de datos limpia.');
        process.exit(0);
    } catch (err) {
        // Error fatal (ej: MongoDB no disponible) → salir con código 1
        console.error('❌ Error fatal:', err);
        process.exit(1);
    }
}

cleanup();
