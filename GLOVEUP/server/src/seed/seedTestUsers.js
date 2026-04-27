import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import { encrypt } from '../utils/crypto.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

const testUsers = [
    {
        nombre: 'Juan Boxeador (Novato)',
        email: 'boxeador1@test.com',
        password: 'password123',
        dni: '12345678A',
        rol: 'boxeador',
        extra: { nivel: 'Amateur', disciplina: 'Boxeo' }
    },
    {
        nombre: 'Maria Boxeadora (Pro)',
        email: 'boxeador2@test.com',
        password: 'password123',
        dni: '87654321B',
        rol: 'boxeador',
        extra: { nivel: 'Profesional', disciplina: 'Boxeo' }
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
        console.log('⏳ Creando usuarios de prueba...');
        await mongoose.connect(MONGO_URI);

        for (const user of testUsers) {
            console.log(`👤 Procesando ${user.email}...`);
            
            // Cifrar DNI para el modelo Usuario (solo si hay clave)
            const encryptedDni = encrypt(user.dni);

            // Eliminar si ya existe para evitar errores de duplicado
            await Usuario.deleteOne({ email: user.email });
            await Boxeador.deleteOne({ email: user.email });
            await Entrenador.deleteOne({ email: user.email });

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
