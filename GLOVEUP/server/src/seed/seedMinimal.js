/**
 * seed/seedMinimal.js — Seed mínimo de datos de prueba para GloveUp.
 *
 * Crea un conjunto pequeño pero completo de datos para desarrollo y testing manual:
 *  - 2 gimnasios de prueba (GloveUp Central y The Ring)
 *  - 2 entrenadores (uno por gimnasio)
 *  - 3 boxeadores (distribuidos entre los dos entrenadores)
 *
 * Uso:
 *   node server/src/seed/seedMinimal.js
 *
 * ADVERTENCIA: Limpia completamente la base de datos antes de insertar.
 * No ejecutar en entornos con datos reales.
 *
 * Los DNI se cifran con AES-256-CBC (igual que en el flujo de registro normal)
 * para que el login y la recuperación de contraseña funcionen correctamente
 * con estos usuarios de prueba.
 *
 * Credenciales de prueba:
 *   Entrenador 1: entrenador1@test.com / password123
 *   Entrenador 2: entrenador2@test.com / password123
 *   Boxeador 1:   boxeador1@test.com   / password123
 *   Boxeador 2:   boxeador2@test.com   / password123
 *   Boxeador 3:   boxeador3@test.com   / password123
 */

import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import Mensaje from '../models/Mensaje.js';
import Notificacion from '../models/Notificacion.js';
import { encrypt } from '../utils/crypto.js';

// URI de MongoDB: variable de entorno o valor local por defecto
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

// ── Datos de los gimnasios de prueba ──────────────────────────────────────────

const testGyms = [
    {
        nombre: 'GloveUp Central',
        key: 'gloveup-central',           // Slug URL-friendly
        ubicacion: 'Madrid',
        direccion: 'Calle del Boxeo 1',
        bio: 'El centro neurálgico de GloveUp.',
        fotoPerfil: 'https://images.unsplash.com/photo-1544033527-b192daee1f5b?auto=format&fit=crop&q=80',
        correoContacto: 'central@gloveup.com'
    },
    {
        nombre: 'The Ring',
        key: 'the-ring',
        ubicacion: 'Madrid',
        direccion: 'Avenida del Ring 45',
        bio: 'Donde nacen las leyendas.',
        fotoPerfil: 'https://images.unsplash.com/photo-1574673130244-c747e7480735?auto=format&fit=crop&q=80',
        correoContacto: 'ring@gloveup.com'
    }
];

// ── Datos de los entrenadores de prueba ───────────────────────────────────────

const trainers = [
    {
        nombre: 'Carlos Entrenador',
        email: 'entrenador1@test.com',
        password: 'password123',
        dni: '11111111C',
        rol: 'entrenador',
        extra: { especialidad: 'Boxeo Elite', gimnasio: 'GloveUp Central', precioMensual: 50 }
    },
    {
        nombre: 'Laura Entrenadora',
        email: 'entrenador2@test.com',
        password: 'password123',
        dni: '22222222D',
        rol: 'entrenador',
        extra: { especialidad: 'Fitness & Boxeo', gimnasio: 'The Ring', precioMensual: 45 }
    }
];

// ── Datos de los boxeadores de prueba ─────────────────────────────────────────

const boxers = [
    {
        nombre: 'Juan Boxeador',
        email: 'boxeador1@test.com',
        password: 'password123',
        dni: '12345678A',
        rol: 'boxeador',
        extra: { nivel: 'Amateur', disciplina: 'Boxeo', gimnasio: 'GloveUp Central' }
    },
    {
        nombre: 'Maria Boxeadora',
        email: 'boxeador2@test.com',
        password: 'password123',
        dni: '87654321B',
        rol: 'boxeador',
        extra: { nivel: 'Profesional', disciplina: 'Boxeo', gimnasio: 'The Ring' }
    },
    {
        nombre: 'Pedro Boxeador',
        email: 'boxeador3@test.com',
        password: 'password123',
        dni: '99999999P',
        rol: 'boxeador',
        extra: { nivel: 'Intermedio', disciplina: 'Boxeo', gimnasio: 'GloveUp Central' }
    }
];

/**
 * Función principal del seed:
 *  1. Conecta a MongoDB.
 *  2. Limpia todas las colecciones para partir de cero.
 *  3. Crea los gimnasios.
 *  4. Crea los entrenadores (Usuario + Entrenador, con DNI cifrado).
 *  5. Crea los boxeadores asignando entrenadores de forma rotativa.
 */
async function seed() {
    try {
        console.log('⏳ Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        // Limpiar todas las colecciones para garantizar un estado inicial limpio
        console.log('🧹 Vaciando base de datos...');
        await Usuario.deleteMany({});
        await Boxeador.deleteMany({});
        await Entrenador.deleteMany({});
        await Gimnasio.deleteMany({});
        await Mensaje.deleteMany({});
        await Notificacion.deleteMany({});

        // Crear los gimnasios de prueba
        console.log('🏟️ Creando gimnasios...');
        for (const gym of testGyms) {
            await Gimnasio.create(gym);
        }

        // Crear los entrenadores: primero la cuenta de Usuario (credenciales),
        // luego el perfil de Entrenador (datos profesionales)
        const trainerDocs = [];
        console.log('👨‍🏫 Creando entrenadores...');
        for (const t of trainers) {
            console.log(`👤 Procesando ${t.email}...`);
            // Cifrar el DNI antes de guardarlo en la colección de usuarios
            const encryptedDni = encrypt(t.dni);
            const usuario = await Usuario.create({
                nombre: t.nombre,
                email: t.email,
                password: t.password, // Se hasheará en el pre-save hook del modelo
                rol: t.rol,
                dniLicencia: encryptedDni
            });

            // Crear el perfil profesional del entrenador enlazado al usuario
            const entrenador = await Entrenador.create({
                nombre: t.nombre,
                email: t.email,
                usuarioId: usuario._id,  // Referencia cruzada para consultas futuras
                dniLicencia: t.dni,      // Sin cifrar en la colección de perfiles
                ...t.extra
            });
            trainerDocs.push(entrenador);
        }

        // Crear los boxeadores y asignarlos a los entrenadores de forma rotativa
        console.log('🥊 Creando boxeadores...');
        for (const [i, b] of boxers.entries()) {
            console.log(`👤 Procesando ${b.email}...`);
            const encryptedDni = encrypt(b.dni);
            const usuario = await Usuario.create({
                nombre: b.nombre,
                email: b.email,
                password: b.password,
                rol: b.rol,
                dniLicencia: encryptedDni
            });

            // Asignar entrenador de forma rotativa: índice % nº entrenadores
            const coach = trainerDocs[i % trainerDocs.length];

            await Boxeador.create({
                nombre: b.nombre,
                email: b.email,
                usuarioId: usuario._id,
                entrenadorId: coach._id,  // Vinculación con el entrenador asignado
                dniLicencia: b.dni,
                ...b.extra
            });
        }

        console.log('✨ Base de datos reiniciada con 3 boxeadores y 2 entrenadores.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en seed:', err);
        process.exit(1);
    }
}

seed();
