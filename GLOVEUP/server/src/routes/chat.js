import { Router } from 'express';
import Mensaje from '../models/Mensaje.js';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import { crearNotificacion } from './notificaciones.js';

const router = Router();
const norm = (v) => (v || '').toString().trim().toLowerCase();

// ── Helpers ──────────────────────────────────────────────
async function getContactos(email) {
    const user = await Usuario.findOne({ email }).select('rol').lean();
    if (!user) return [];
    let contacts = [];
    if (user.rol === 'entrenador') {
        const trainers = await Entrenador.find({ email: { $ne: email } }).select('nombre email').lean();
        contacts = trainers.map(t => ({ nombre: t.nombre || t.email, email: t.email, rol: 'entrenador' }));
    } else if (user.rol === 'boxeador') {
        const boxer = await Boxeador.findOne({ email }).lean();
        if (boxer) {
            if (boxer.entrenadorId) {
                const trainer = await Entrenador.findById(boxer.entrenadorId).select('nombre email').lean();
                if (trainer) contacts.push({ nombre: trainer.nombre || trainer.email, email: trainer.email, rol: 'entrenador' });
            }
            if (boxer.entrenadorId) {
                const mates = await Boxeador.find({ entrenadorId: boxer.entrenadorId, email: { $ne: email } }).select('nombre email').lean();
                mates.forEach(b => contacts.push({ nombre: b.nombre || b.email, email: b.email, rol: 'boxeador' }));
            }
        }
    }
    return contacts;
}

// ── GET /api/chat/contactos?email=X ──────────────────────
router.get('/contactos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        res.json(await getContactos(email));
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/chat/buscar?email=X&q=query ─────────────────
// Busca entre todos los contactos posibles por nombre/email
router.get('/buscar', async (req, res) => {
    try {
        const email = norm(req.query.email);
        const q = (req.query.q || '').toString().trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const contacts = await getContactos(email);
        if (!q) return res.json(contacts);
        const filtered = contacts.filter(c =>
            (c.nombre || '').toLowerCase().includes(q) ||
            (c.email || '').toLowerCase().includes(q)
        );
        res.json(filtered);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/chat/conversaciones?email=X ─────────────────
// Devuelve el historial de conversaciones con último mensaje y no-leídos
router.get('/conversaciones', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        // Emails con los que ha habido intercambio
        const sent = await Mensaje.distinct('para', { de: email });
        const received = await Mensaje.distinct('de', { para: email });
        const partners = [...new Set([...sent, ...received])];

        const convs = await Promise.all(partners.map(async (partner) => {
            const last = await Mensaje.findOne({
                $or: [{ de: email, para: partner }, { de: partner, para: email }]
            }).sort({ createdAt: -1 }).lean();
            const unread = await Mensaje.countDocuments({ de: partner, para: email, leido: false });

            // Obtener nombre del contacto
            let nombre = partner;
            const e = await Entrenador.findOne({ email: partner }).select('nombre').lean();
            if (e && e.nombre) { nombre = e.nombre; }
            else {
                const b = await Boxeador.findOne({ email: partner }).select('nombre').lean();
                if (b && b.nombre) nombre = b.nombre;
            }
            return { email: partner, nombre, ultimo: last ? { texto: last.texto, fecha: last.createdAt } : null, noLeidos: unread };
        }));

        // Ordenar por último mensaje más reciente
        convs.sort((a, b) => {
            const ta = a.ultimo ? new Date(a.ultimo.fecha).getTime() : 0;
            const tb = b.ultimo ? new Date(b.ultimo.fecha).getTime() : 0;
            return tb - ta;
        });

        res.json(convs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/chat/mensajes?email=X&con=Y ─────────────────
router.get('/mensajes', async (req, res) => {
    try {
        const email = norm(req.query.email);
        const con = norm(req.query.con);
        if (!email || !con) return res.status(400).json({ error: 'Parámetros requeridos' });
        const mensajes = await Mensaje.find({
            $or: [{ de: email, para: con }, { de: con, para: email }]
        }).sort({ createdAt: 1 }).limit(100).lean();
        await Mensaje.updateMany({ de: con, para: email, leido: false }, { leido: true });
        res.json(mensajes);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/chat/mensajes ───────────────────────────────
router.post('/mensajes', async (req, res) => {
    try {
        const de = norm(req.body.de);
        const para = norm(req.body.para);
        const texto = (req.body.texto || '').toString().trim();
        if (!de || !para || !texto) return res.status(400).json({ error: 'Faltan datos' });
        if (texto.length > 2000) return res.status(400).json({ error: 'Mensaje demasiado largo' });
        const msg = await Mensaje.create({ de, para, texto });

        // Notificación automática al receptor
        const sender = await (Entrenador.findOne({ email: de }).select('nombre').lean()
            .then(r => r || Boxeador.findOne({ email: de }).select('nombre').lean()));
        const senderName = sender && sender.nombre ? sender.nombre : de;
        await crearNotificacion({
            para,
            tipo: 'mensaje',
            titulo: `Nuevo mensaje de ${senderName}`,
            cuerpo: texto.length > 60 ? texto.slice(0, 60) + '…' : texto,
            de,
            link: ''
        });

        res.status(201).json(msg);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/chat/no-leidos?email=X ──────────────────────
router.get('/no-leidos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const count = await Mensaje.countDocuments({ para: email, leido: false });
        res.json({ count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
