/**
 * seed/seedBoxeadores.js — Seed de boxeadores con dos modos de ejecución.
 *
 * Modo archivo (por defecto):
 *   Lee los datos desde server/data/boxeadores.json y los inserta como upserts.
 *   Útil para cargar datos reales o de producción migrados.
 *   Uso: node server/src/seed/seedBoxeadores.js
 *
 * Modo demo (con flag --demo):
 *   Genera 20 entrenadores y 20 boxeadores con datos pseudoaleatorios
 *   usando semillas deterministas (pick + pad) para nombres, emails y DNIs.
 *   Los boxeadores se distribuyen entre los entrenadores de forma rotativa.
 *   Uso: node server/src/seed/seedBoxeadores.js --demo
 *
 * Ambos modos usan findOneAndUpdate con upsert:true para ser idempotentes:
 * si el usuario ya existe, se actualiza en lugar de crear duplicados.
 *
 * NOTA: Este seed no limpia la BD antes de insertar (a diferencia de seedMinimal.js).
 * Esto permite añadir datos sobre una BD existente sin borrar los registros actuales.
 *
 * Credenciales de demo generadas:
 *   Entrenadores: demo.entrenador01@gloveup.com / Coach01#2026  ... (hasta demo.entrenador20)
 *   Boxeadores:   demo.boxeador01@gloveup.com   / Boxer01#2026  ... (hasta demo.boxeador20)
 */

import mongoose from '/mongoose';
import Boxeador from '/models/Boxeador.js';
import Entrenador from '/models/Entrenador.js';
import Usuario from '/models/Usuario.js';
import {
    createRequire
} from 'module';

// createRequire permite usar require() para archivos JSON dentro de un módulo ES
const require = createRequire(import.meta.url);

// URI de MongoDB: se acepta tanto MONGO_URI como MONGODB_URI para compatibilidad
const uri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/gloveup';

// ── Utilidades de generación de nombres ───────────────────────────────────────

/** Rellena un número con ceros a la izquierda hasta alcanzar la longitud indicada. */
const pad = (value, len) => String(value).padStart(len, '0');

// Listas de nombres y apellidos españoles para generar nombres realistas en el modo demo
const FIRST_NAMES = [
    'Adrián', 'Álvaro', 'Carlos', 'Dani', 'David', 'Diego', 'Eduardo',
    'Enrique', 'Fernando', 'Gonzalo', 'Hugo', 'Iván', 'Javier', 'Jorge',
    'José', 'Juan', 'Luis', 'Manuel', 'Mario', 'Miguel', 'Pablo', 'Raúl',
    'Rubén', 'Sergio', 'Víctor'
];

const LAST_NAMES = [
    'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez',
    'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Ruiz', 'Hernández',
    'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez'
];

const COACH_TITLES = ['Coach', 'Entrenador', 'Profe', 'Míster'];

/**
 * Selecciona un elemento de la lista usando un índice derivado de la semilla.
 * Determinista: la misma semilla siempre produce el mismo elemento.
 *
 * @param {Array} list - Lista de opciones.
 * @param {number} seed - Semilla numérica para derivar el índice.
 * @returns {*} Elemento de la lista.
 */
const pick = (list, seed) => list[Math.abs(seed) % list.length];

/**
 * Genera un nombre completo realista basado en una semilla numérica.
 * Para entrenadores añade un título (Coach, Entrenador, Profe, Míster).
 *
 * @param {number} seed - Semilla numérica para la generación determinista.
 * @param {string} role - 'entrenador' o 'boxeador'.
 * @returns {string} Nombre completo generado.
 */
const makeRandomName = (seed, role) => {
    const first = pick(FIRST_NAMES, seed * 31 + (role === 'entrenador' ? 7 : 3));
    const last  = pick(LAST_NAMES,  seed * 17 + (role === 'entrenador' ? 11 : 5));
    if (role === 'entrenador') {
        const title = pick(COACH_TITLES, seed * 13 + 19);
        return `${title} ${first} ${last}`;
    }
    return `${first} ${last}`;
};

// ── Modo "archivo": carga datos desde boxeadores.json ─────────────────────────

/**
 * Lee server/data/boxeadores.json y hace upsert de cada boxeador:
 * crea el documento Usuario (credenciales) y el Boxeador (perfil) si no existen,
 * o los actualiza si ya estaban en la BD.
 */
async function seedFromFile() {
    // Carga síncrona del JSON de datos fuente
    const docs = require('../../data/boxeadores.json');

    for (const d of docs) {
        const email = d.email.toLowerCase().trim();

        // Upsert del documento de credenciales (Usuario)
        const usuario = await Usuario.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre: d.nombre,
                email,
                password: d.password || '',
                rol: 'boxeador',
                dniLicencia: d.dniLicencia || ''
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });

        // Upsert del perfil deportivo (Boxeador), enlazado al usuario creado
        await Boxeador.findOneAndUpdate({
            email
        }, {
            $set: {
                nombre: d.nombre,
                email,
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
                usuarioId: usuario._id
            }
        }, {
            new: true,
            upsert: true,
            setDefaultsOnInsert: true
        });
    }

    console.log(`Seed de boxeadores (archivo) completada: ${docs.length} boxeadores + usuarios de login.`);
}

// ── Modo "demo": genera 20 entrenadores y 20 boxeadores pseudoaleatorios ──────

/**
 * Genera 20 entrenadores y 20 boxeadores con datos ficticios.
 * Los boxeadores se distribuyen entre los entrenadores de forma rotativa
 * usando el índice (i - 1) % nº entrenadores.
 *
 * Los datos son deterministas: ejecutar el seed dos veces produce los mismos
 * registros gracias a la función pick() y la semilla incremental.
 */
async function seedDemo() {
    const coachCount = 20;
    const boxerCount = 20;
    // 5 gimnasios ficticios que se asignan rotativamente a los entrenadores
    const gyms = ['GloveUp Gym 1', 'GloveUp Gym 2', 'GloveUp Gym 3', 'GloveUp Gym 4', 'GloveUp Gym 5'];
    const coachDocs = [];

    // Crear los entrenadores demo
    for (let i = 1; i <= coachCount; i += 1) {
        const idx           = pad(i, 2);                          // "01", "02"...
        const email         = `demo.entrenador${idx}@gloveup.com`.toLowerCase();
        const nombre        = makeRandomName(i, 'entrenador');
        const password      = `Coach${idx}#2026`;                 // Contraseña predecible para pruebas
        const dniLicencia   = `COA${pad(i, 4)}`;                  // "COA0001", "COA0002"...
        const gimnasio      = gyms[(i - 1) % gyms.length];        // Asignación rotativa de gimnasio
        const precioMensual = 25 + ((i - 1) % 6) * 5;            // Entre 25€ y 50€ en saltos de 5€

        const usuario = await Usuario.findOneAndUpdate(
            { email },
            { $set: { nombre, email, password, rol: 'entrenador', dniLicencia } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        const entrenador = await Entrenador.findOneAndUpdate(
            { email },
            { $set: { nombre, email, especialidad: 'Boxeo', gimnasio, ubicacion: '', foto: '',
                      usuarioId: usuario._id, dniLicencia, precioMensual } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        coachDocs.push(entrenador);
    }

    // Crear los boxeadores demo y asignarles un entrenador de forma rotativa
    for (let i = 1; i <= boxerCount; i += 1) {
        const idx         = pad(i, 2);
        const email       = `demo.boxeador${idx}@gloveup.com`.toLowerCase();
        const nombre      = makeRandomName(i + 100, 'boxeador'); // +100 para nombres distintos
        const password    = `Boxer${idx}#2026`;
        const dniLicencia = `BOX${pad(i, 4)}`;
        // Nivel escalonado: Profesional cada 3, Intermedio los pares, Amateur el resto
        const nivel       = i % 3 === 0 ? 'Profesional' : (i % 2 === 0 ? 'Intermedio' : 'Amateur');
        const disciplina  = 'Boxeo';

        const coach = coachDocs[(i - 1) % coachDocs.length];

        // Fecha de inscripción distribuida a lo largo del mes actual
        const fechaInscripcion = new Date();
        fechaInscripcion.setHours(12, 0, 0, 0);
        fechaInscripcion.setDate(Math.min(28, ((i - 1) % 28) + 1)); // Días 1-28

        const usuario = await Usuario.findOneAndUpdate(
            { email },
            { $set: { nombre, email, password, rol: 'boxeador', dniLicencia } },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        await Boxeador.findOneAndUpdate(
            { email },
            {
                $set: {
                    nombre, email, dniLicencia, nivel, disciplina,
                    gimnasio: coach && coach.gimnasio ? coach.gimnasio : '',
                    entrenadorId: coach ? coach._id : undefined,
                    usuarioId: usuario._id,
                    fechaInscripcion,
                    sparringHistory: [],
                    password
                }
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    }

    console.log(`Seed demo completado: ${coachCount} entrenadores + ${boxerCount} boxeadores + usuarios de login.`);
    console.log('Ejemplo entrenador: demo.entrenador01@gloveup.com / Coach01#2026');
    console.log('Ejemplo boxeador: demo.boxeador01@gloveup.com / Boxer01#2026');
}

// ── Punto de entrada ──────────────────────────────────────────────────────────

/**
 * Conecta a MongoDB y ejecuta el modo correspondiente según los argumentos CLI.
 * --demo → modo demo; sin argumentos → modo archivo.
 */
async function run() {
    await mongoose.connect(uri, { autoIndex: true });

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
