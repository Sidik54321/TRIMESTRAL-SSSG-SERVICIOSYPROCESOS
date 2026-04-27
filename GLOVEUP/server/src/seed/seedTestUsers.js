import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import { encrypt } from '../utils/crypto.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

const testGyms = [
    {
        nombre: 'Club La Furia',
        key: 'club-la-furia',
        ubicacion: 'Madrid',
        direccion: 'Calle del Combate 12',
        bio: 'El club más legendario de la capital.',
        fotoPerfil: 'https://images.unsplash.com/photo-1544033527-b192daee1f5b?auto=format&fit=crop&q=80',
        correoContacto: 'contacto@lafuria.com',
        creadoPorEmail: 'entrenador1@test.com'
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

async function seed() {
    try {
        console.log('⏳ Conectando a MongoDB...');
        await mongoose.connect(MONGO_URI);

        console.log('🧹 Limpiando base de datos...');
        await Usuario.deleteMany({});
        await Boxeador.deleteMany({});
        await Entrenador.deleteMany({});
        await Gimnasio.deleteMany({});

        console.log('🏟️ Creando gimnasios de prueba...');
        for (const gym of testGyms) {
            await Gimnasio.create(gym);
            console.log(`✅ Gimnasio ${gym.nombre} creado.`);
        }

        console.log('👤 Creando usuarios de prueba...');
        for (const user of testUsers) {
            console.log(`👤 Procesando ${user.email}...`);
            
            const encryptedDni = encrypt(user.dni);

            const usuario = await Usuario.create({
                nombre: user.nombre,
                email: user.email,
                password: user.password, 
                rol: user.rol,
                dniLicencia: encryptedDni
            });

            if (user.rol === 'boxeador') {
                await Boxeador.create({
                    nombre: user.nombre,
                    email: user.email,
                    usuarioId: usuario._id,
                    dniLicencia: user.dni,
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
