import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import Mensaje from '../models/Mensaje.js';
import Notificacion from '../models/Notificacion.js';
import { encrypt } from '../utils/crypto.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

const testGyms = [
    {
        nombre: 'GloveUp Central',
        key: 'gloveup-central',
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

async function seed() {
    try {
        console.log('⏳ Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        console.log('🧹 Vaciando base de datos...');
        await Usuario.deleteMany({});
        await Boxeador.deleteMany({});
        await Entrenador.deleteMany({});
        await Gimnasio.deleteMany({});
        await Mensaje.deleteMany({});
        await Notificacion.deleteMany({});

        console.log('🏟️ Creando gimnasios...');
        for (const gym of testGyms) {
            await Gimnasio.create(gym);
        }

        const trainerDocs = [];
        console.log('👨‍🏫 Creando entrenadores...');
        for (const t of trainers) {
            console.log(`👤 Procesando ${t.email}...`);
            const encryptedDni = encrypt(t.dni);
            const usuario = await Usuario.create({
                nombre: t.nombre,
                email: t.email,
                password: t.password,
                rol: t.rol,
                dniLicencia: encryptedDni
            });

            const entrenador = await Entrenador.create({
                nombre: t.nombre,
                email: t.email,
                usuarioId: usuario._id,
                dniLicencia: t.dni,
                ...t.extra
            });
            trainerDocs.push(entrenador);
        }

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

            // Assign a trainer (alternating)
            const coach = trainerDocs[i % trainerDocs.length];

            await Boxeador.create({
                nombre: b.nombre,
                email: b.email,
                usuarioId: usuario._id,
                entrenadorId: coach._id,
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
