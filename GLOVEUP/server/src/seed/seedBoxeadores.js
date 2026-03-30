import 'dotenv/config';
import mongoose from 'mongoose';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Usuario from '../models/Usuario.js';
import {
    createRequire
} from 'module';

const require = createRequire(
    import.meta.url);

const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gloveup';

const pad = (value, len) => String(value).padStart(len, '0');

const FIRST_NAMES = [
    'Adrián',
    'Álvaro',
    'Carlos',
    'Dani',
    'David',
    'Diego',
    'Eduardo',
    'Enrique',
    'Fernando',
    'Gonzalo',
    'Hugo',
    'Iván',
    'Javier',
    'Jorge',
    'José',
    'Juan',
    'Luis',
    'Manuel',
    'Mario',
    'Miguel',
    'Pablo',
    'Raúl',
    'Rubén',
    'Sergio',
    'Víctor'
];

const LAST_NAMES = [
    'García',
    'Fernández',
    'González',
    'Rodríguez',
    'López',
    'Martínez',
    'Sánchez',
    'Pérez',
    'Gómez',
    'Martín',
    'Jiménez',
    'Ruiz',
    'Hernández',
    'Díaz',
    'Moreno',
    'Muñoz',
    'Álvarez',
    'Romero',
    'Alonso',
    'Gutiérrez'
];

const COACH_TITLES = ['Coach', 'Entrenador', 'Profe', 'Míster'];

const pick = (list, seed) => list[Math.abs(seed) % list.length];

const makeRandomName = (seed, role) => {
    const first = pick(FIRST_NAMES, seed * 31 + (role === 'entrenador' ? 7 : 3));
    const last = pick(LAST_NAMES, seed * 17 + (role === 'entrenador' ? 11 : 5));
    if (role === 'entrenador') {
        const title = pick(COACH_TITLES, seed * 13 + 19);
        return `${title} ${first} ${last}`;
    }
    return `${first} ${last}`;
};

async function seedFromFile() {
    const docs = require('../../data/boxeadores.json');
    const ops = docs.map((d) => ({
        updateOne: {
            filter: {
                email: d.email.toLowerCase().trim()
            },
            update: {
                $set: {
                    nombre: d.nombre,
                    email: d.email.toLowerCase().trim(),
                    nivel: d.nivel || 'Amateur',
                    alias: d.alias || '',
                    disciplina: d.disciplina || 'Boxeo',
                    peso: d.peso || '',
                    ubicacion: d.ubicacion || '',
                    boxrecId: d.boxrecId || '',
                    foto: d.foto || '',
                    record: d.record || '',
                    altura: d.altura || '',
                    alcance: d.alcance || '',
                    password: d.password || ''
                }
            },
            upsert: true
        }
    }));

    await Boxeador.bulkWrite(ops);
    console.log('Seed de boxeadores (archivo) completada');
}

async function seedDemo() {
    const coachCount = 20;
    const boxerCount = 20;
    const gyms = ['GloveUp Gym 1', 'GloveUp Gym 2', 'GloveUp Gym 3', 'GloveUp Gym 4', 'GloveUp Gym 5'];
    const coachDocs = [];

    for (let i = 1; i <= coachCount; i += 1) {
        const idx = pad(i, 2);
        const email = `demo.entrenador${idx}@gloveup.com`.toLowerCase();
        const nombre = makeRandomName(i, 'entrenador');
        const password = `Coach${idx}#2026`;
        const dniLicencia = `COA${pad(i, 4)}`;
        const gimnasio = gyms[(i - 1) % gyms.length];
        const precioMensual = 25 + ((i - 1) % 6) * 5;

        const usuario = await Usuario.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre,
                email,
                password,
                rol: 'entrenador',
                dniLicencia
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        const entrenador = await Entrenador.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre,
                email,
                especialidad: 'Boxeo',
                gimnasio,
                ubicacion: '',
                foto: '',
                usuarioId: usuario._id,
                dniLicencia,
                precioMensual
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        coachDocs.push(entrenador);
    }

    for (let i = 1; i <= boxerCount; i += 1) {
        const idx = pad(i, 2);
        const email = `demo.boxeador${idx}@gloveup.com`.toLowerCase();
        const nombre = makeRandomName(i + 100, 'boxeador');
        const password = `Boxer${idx}#2026`;
        const dniLicencia = `BOX${pad(i, 4)}`;
        const nivel = i % 3 === 0 ? 'Profesional' : (i % 2 === 0 ? 'Intermedio' : 'Amateur');
        const disciplina = 'Boxeo';

        const coach = coachDocs[(i - 1) % coachDocs.length];
        const fechaInscripcion = new Date();
        fechaInscripcion.setHours(12, 0, 0, 0);
        fechaInscripcion.setDate(Math.min(28, ((i - 1) % 28) + 1));

        const usuario = await Usuario.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre,
                email,
                password,
                rol: 'boxeador',
                dniLicencia
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        await Boxeador.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre,
                email,
                dniLicencia,
                nivel,
                disciplina,
                gimnasio: coach && coach.gimnasio ? coach.gimnasio : '',
                entrenadorId: coach ? coach._id : undefined,
                usuarioId: usuario._id,
                fechaInscripcion,
                sparringHistory: [],
                password
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });
    }

    console.log(`Seed demo completado: ${coachCount} entrenadores + ${boxerCount} boxeadores + usuarios de login.`);
    console.log('Ejemplo entrenador: demo.entrenador01@gloveup.com / Coach01#2026');
    console.log('Ejemplo boxeador: demo.boxeador01@gloveup.com / Boxer01#2026');
}

async function run() {
    await mongoose.connect(uri, {
        autoIndex: true
    });

    const demo = process.argv.includes('--demo');
    if (demo) {
        await seedDemo();
    } else {
        await seedFromFile();
    }
    await mongoose.disconnect();
}

run().catch(async (e) => {
    console.error(e);
    await mongoose.disconnect();
    process.exit(1);
});