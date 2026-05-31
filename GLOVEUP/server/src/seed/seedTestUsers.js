/**
 * seed/seedTestUsers.js — Seed de usuarios de prueba para GloveUp.
 *
 * Similar a seedMinimal.js pero con datos ligeramente diferentes
 * (nombres de gimnasio y usuarios distintos) para poder tener
 * conjuntos de datos de prueba variados.
 *
 * Crea:
 *  - 2 gimnasios: "Club La Furia" (Madrid) y "Gimnasio Olimpico" (Barcelona)
 *  - 2 entrenadores: entrenador1@test.com y entrenador2@test.com
 *  - 2 boxeadores: boxeador1@test.com y boxeador2@test.com
 *
 * Uso:
 *   node server/src/seed/seedTestUsers.js
 *
 * ADVERTENCIA: Limpia completamente la base de datos antes de insertar.
 * No ejecutar en entornos con datos reales.
 *
 * Los DNI se cifran con AES-256-CBC para que el login y la recuperación
 * de contraseña funcionen correctamente con estos usuarios de prueba.
 *
 * Credenciales de prueba:
 *   Entrenador 1: entrenador1@test.com / password123 (DNI: 11111111C)
 *   Entrenador 2: entrenador2@test.com / password123 (DNI: 22222222D)
 *   Boxeador 1:   boxeador1@test.com   / password123 (DNI: 12345678A)
 *   Boxeador 2:   boxeador2@test.com   / password123 (DNI: 87654321B)
 */

import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import { encrypt } from '../utils/crypto.js';

// URI de MongoDB: variable de entorno o valor local por defecto
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

// ── Datos de los gimnasios de prueba ──────────────────────────────────────────

const testGyms = [
    {
        nombre: 'Club La Furia',
        key: 'club-la-furia',
        ubicacion: 'Madrid',
        direccion: 'Calle del Combate 12',
        bio: 'El club más legendario de la capital.',
        fotoPerfil: 'https://images.unsplash.com/photo-1544033527-b192daee1f5b?auto=format&fit=crop&q=80',
        correoContacto: 'contacto@lafuria.com',
        creadoPorEmail: 'entrenador1@test.com'  // Propietario del gimnasio
    },
    {
        nombre: 'Gimnasio Olimpico',
        key: 'gimnasio-olimpico',
        ubicacion: 'Barcelona',
        direccion: 'Avenida del Deporte 45',
        bio: 'Formando campeones desde 1992.',
        fotoPerfil: 'https://images.unsplash.com/photo-1574673130244-c747e7480735?auto=format&fit=crop&q=80',
        correoContacto: 'info@olimpico.com',
        creadoPorEmail: 'entrenador2@test.com'
    }
];

// ── Definición unificada de usuarios de prueba (boxeadores y entrenadores) ────

const testUsers = [
    {
        nombre: 'Juan Boxeador (Novato)',
        email: 'boxeador1@test.com',
        password: 'password123',
        dni: '12345678A',
        rol: 'boxeador',
        extra: { nivel: 'Amateur', disciplina: 'Boxeo', gimnasio: 'Club La Furia' }
    },
    {
        nombre: 'Maria Boxeadora (Pro)',
        email: 'boxeador2@test.com',
        password: 'password123',
        dni: '87654321B',
        rol: 'boxeador',
        extra: { nivel: 'Profesional', disciplina: 'Boxeo', gimnasio: 'Gimnasio Olimpico' }
    },
    {
        nombre: 'Carlos Entrenador (Elite)',
        email: 'entrenador1@test.com',
        password: 'password123',
        dni: '11111111C',
        rol: 'entrenador',
        extra: { especialidad: 'Boxeo', gimnasio: 'Club La Furia' }
    },
    {
        nombre: 'Laura Entrenadora (Gym Central)',
        email: 'entrenador2@test.com',
        password: 'password123',
        dni: '22222222D',
        rol: 'entrenador',
        extra: { especialidad: 'Fitness & Boxeo', gimnasio: 'Gimnasio Olimpico' }
    }
];

/**
 * Función principal del seed:
 *  1. Conecta a MongoDB.
 *  2. Limpia la BD para partir de cero.
 *  3. Crea los gimnasios.
 *  4. Itera testUsers creando el documento Usuario (credenciales)
 *     y el documento de perfil correspondiente (Boxeador o Entrenador)
 *     según el rol de cada entrada.
 */
async function seed() {
    try {
        console.log('⏳ Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        // Limpiar todas las colecciones para un estado inicial limpio
        console.log('🧹 Limpiando base de datos...');
        await Usuario.deleteMany({});
        await Boxeador.deleteMany({});
        await Entrenador.deleteMany({});
        await Gimnasio.deleteMany({});

        // Crear los gimnasios de prueba
        console.log('🏟️ Creando gimnasios de prueba...');
        for (const gym of testGyms) {
            await Gimnasio.create(gym);
            console.log(`✅ Gimnasio ${gym.nombre} creado.`);
        }

        // Crear los usuarios y sus perfiles deportivos
        console.log('👤 Creando usuarios de prueba...');
        for (const user of testUsers) {
            console.log(`👤 Procesando ${user.email}...`);

            // Cifrar el DNI con AES-256-CBC antes de guardarlo en la colección de usuarios
            const encryptedDni = encrypt(user.dni);

            // Crear las credenciales de acceso (la contraseña se hasheará en el pre-save)
            const usuario = await Usuario.create({
                nombre: user.nombre,
                email: user.email,
                password: user.password,
                rol: user.rol,
                dniLicencia: encryptedDni
            });

            // Crear el perfil deportivo según el rol del usuario
            if (user.rol === 'boxeador') {
                await Boxeador.create({
                    nombre: user.nombre,
                    email: user.email,
                    usuarioId: usuario._id,
                    dniLicencia: user.dni,  // Sin cifrar en la colección de perfiles
                    ...user.extra
                });
            } else if (user.rol === 'entrenador') {
                await Entrenador.create({
                    nombre: user.nombre,
                    email: user.email,
                    usuarioId: usuario._id,
                    dniLicencia: user.dni,
                    ...user.extra
                });
            }
            console.log(`✅ ${user.nombre} creado.`);
        }

        console.log('✨ Seed completado con éxito.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error en seed:', err);
        process.exit(1);
    }
}

seed();
