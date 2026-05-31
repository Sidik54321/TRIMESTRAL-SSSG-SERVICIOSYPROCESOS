/**
 * routes/chat.js — Rutas del sistema de mensajería interna
 *
 * Implementa un chat en tiempo real basado en polling HTTP, sin WebSockets.
 * El frontend consulta periódicamente los endpoints de mensajes y conversaciones
 * para simular la experiencia de chat en tiempo real.
 * Prefijo de montaje: /api/chat
 *
 * Endpoints:
 *  GET  /contactos?email=X       → Lista de contactos disponibles según el rol
 *  GET  /buscar?email=X&q=query  → Búsqueda de contactos por nombre o email
 *  GET  /conversaciones?email=X  → Historial de conversaciones con último mensaje y no-leídos
 *  GET  /mensajes?email=X&con=Y  → Mensajes del hilo entre dos usuarios (marca como leídos)
 *  POST /mensajes                → Enviar un nuevo mensaje
 *  GET  /no-leidos?email=X       → Contador total de mensajes no leídos
 *
 * Reglas de contactos según rol:
 *  - Entrenador: puede contactar con todos los demás entrenadores
 *  - Boxeador: puede contactar con su entrenador asignado y con sus compañeros
 *              de gimnasio (boxeadores del mismo entrenador)
 */

import { Router } from 'express';
import Mensaje from '../models/Mensaje.js';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import { crearNotificacion } from './notificaciones.js';

const router = Router();

// Normaliza un valor a string en minúsculas sin espacios (para emails)
const norm = (v) => (v || '').toString().trim().toLowerCase();

// ─── Helper: getContactos ──────────────────────────────────────────────────
/**
 * Determina la lista de contactos disponibles para un usuario según su rol:
 *  - Entrenador → todos los demás entrenadores registrados en la plataforma
 *  - Boxeador   → su entrenador + sus compañeros de gimnasio (mismo entrenadorId)
 *
 * @param {string} email - Email del usuario que solicita sus contactos
 * @returns {Promise<Array>} Lista de contactos [{nombre, email, rol}]
 */
async function getContactos(email) {
    const user = await Usuario.findOne({ email }).select('rol').lean();
    if (!user) return [];
    let contacts = [];
    if (user.rol === 'entrenador') {
        // Los entrenadores pueden mensajearse entre ellos (excepto a sí mismos)
        const trainers = await Entrenador.find({ email: { $ne: email } }).select('nombre email').lean();
        contacts = trainers.map(t => ({ nombre: t.nombre || t.email, email: t.email, rol: 'entrenador' }));
    } else if (user.rol === 'boxeador') {
        const boxer = await Boxeador.findOne({ email }).lean();
        if (boxer) {
            // Añadir al entrenador asignado como contacto principal
            if (boxer.entrenadorId) {
                const trainer = await Entrenador.findById(boxer.entrenadorId).select('nombre email').lean();
                if (trainer) contacts.push({ nombre: trainer.nombre || trainer.email, email: trainer.email, rol: 'entrenador' });
            }
            // Añadir a los compañeros de gimnasio (mismo entrenador, diferente email)
            if (boxer.entrenadorId) {
                const mates = await Boxeador.find({ entrenadorId: boxer.entrenadorId, email: { $ne: email } }).select('nombre email').lean();
                mates.forEach(b => contacts.push({ nombre: b.nombre || b.email, email: b.email, rol: 'boxeador' }));
            }
        }
    }
    return contacts;
}

// ─── GET /contactos ────────────────────────────────────────────────────────
// Devuelve la lista completa de contactos disponibles para el usuario
router.get('/contactos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        res.json(await getContactos(email));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /buscar ───────────────────────────────────────────────────────────
// Filtra los contactos del usuario por nombre o email.
// Si no hay query (q vacío), devuelve todos los contactos sin filtrar.
router.get('/buscar', async (req, res) => {
    try {
        const email = norm(req.query.email);
        const q = (req.query.q || '').toString().trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const contacts = await getContactos(email);
        if (!q) return res.json(contacts); // Sin filtro → devolver todos
        // Filtrar por nombre o email que contengan el término de búsqueda
        const filtered = contacts.filter(c =>
            (c.nombre || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        );
        res.json(filtered);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /conversaciones ───────────────────────────────────────────────────
// Devuelve el resumen de todas las conversaciones del usuario:
// con quién ha hablado, el último mensaje intercambiado y cuántos no ha leído.
// Se ordenan por fecha del último mensaje (más reciente primero).
router.get('/conversaciones', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        // Obtener todos los emails con los que se ha intercambiado al menos un mensaje
        const sent = await Mensaje.distinct('para', { de: email });
        const received = await Mensaje.distinct('de', { para: email });
        const partners = [...new Set([...sent, ...received])]; // Unión sin duplicados

        // Para cada interlocutor, obtener el último mensaje y el conteo de no leídos
        const convs = await Promise.all(partners.map(async (partner) => {
            // Último mensaje del hilo (en cualquier dirección), más reciente primero
            const last = await Mensaje.findOne({
                $or: [{ de: email, para: partner }, { de: partner, para: email }]
            }).sort({ createdAt: -1 }).lean();
            // Mensajes recibidos de este interlocutor que aún no se han leído
            const unread = await Mensaje.countDocuments({ de: partner, para: email, leido: false });

            // Resolver el nombre del interlocutor (buscar primero en entrenadores, luego en boxeadores)
            let nombre = partner;
            const e = await Entrenador.findOne({ email: partner }).select('nombre').lean();
            if (e && e.nombre) { nombre = e.nombre; }
            else {
                const b = await Boxeador.findOne({ email: partner }).select('nombre').lean();
                if (b && b.nombre) nombre = b.nombre;
            }
            return { email: partner, nombre, ultimo: last ? { texto: last.texto, fecha: last.createdAt } : null, noLeidos: unread };
        }));

        // Ordenar por fecha del último mensaje (más reciente arriba)
        convs.sort((a, b) => {
            const ta = a.ultimo ? new Date(a.ultimo.fecha).getTime() : 0;
            const tb = b.ultimo ? new Date(b.ultimo.fecha).getTime() : 0;
            return tb - ta;
        });

        res.json(convs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /mensajes ─────────────────────────────────────────────────────────
// Devuelve los últimos 100 mensajes del hilo entre dos usuarios, ordenados
// cronológicamente (más antiguos primero para visualización en el chat).
// Al leer los mensajes, se marcan automáticamente como leídos.
router.get('/mensajes', async (req, res) => {
    try {
        const email = norm(req.query.email);
        const con = norm(req.query.con); // Email del interlocutor
        if (!email || !con) return res.status(400).json({ error: 'Parámetros requeridos' });
        const mensajes = await Mensaje.find({
            // Buscar mensajes en ambas direcciones del hilo
            $or: [{ de: email, para: con }, { de: con, para: email }]
        }).sort({ createdAt: 1 }).limit(100).lean();
        // Marcar como leídos todos los mensajes no leídos recibidos del interlocutor
        await Mensaje.updateMany({ de: con, para: email, leido: false }, { leido: true });
        res.json(mensajes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /mensajes ────────────────────────────────────────────────────────
// Envía un nuevo mensaje y genera una notificación automática al destinatario.
// El mensaje se trunca si supera los 60 caracteres en la notificación (preview).
router.post('/mensajes', async (req, res) => {
    try {
        const de = norm(req.body.de);
        const para = norm(req.body.para);
        const texto = (req.body.texto || '').toString().trim();
        if (!de || !para || !texto) return res.status(400).json({ error: 'Faltan datos' });
        if (texto.length > 2000) return res.status(400).json({ error: 'Mensaje demasiado largo' });
        const msg = await Mensaje.create({ de, para, texto });

        // Resolver el nombre del remitente para personalizar la notificación
        // Se busca primero en Entrenador y si no, en Boxeador
        const sender = await (Entrenador.findOne({ email: de }).select('nombre').lean()
            .then(r => r || Boxeador.findOne({ email: de }).select('nombre').lean()));
        const senderName = sender && sender.nombre ? sender.nombre : de;

        // Crear notificación de tipo 'mensaje' para el destinatario
        await crearNotificacion({
            para,
            tipo: 'mensaje',
            titulo: `Nuevo mensaje de ${senderName}`,
            // Vista previa del texto: truncar a 60 caracteres con "…"
            cuerpo: texto.length > 60 ? texto.slice(0, 60) + '…' : texto,
            de,
            link: ''
        });

        res.status(201).json(msg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /no-leidos ────────────────────────────────────────────────────────
// Devuelve el número total de mensajes no leídos recibidos por el usuario.
// El frontend lo usa para mostrar el badge de notificaciones en el icono de chat.
router.get('/no-leidos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const count = await Mensaje.countDocuments({ para: email, leido: false });
        res.json({ count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
