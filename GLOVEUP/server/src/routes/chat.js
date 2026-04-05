import { Router } from 'express';
import Mensaje from '../models/Mensaje.js';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';

const router = Router();
const norm = (v) => (v || '').toString().trim().toLowerCase();

// GET /api/chat/contactos?email=X
router.get('/contactos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const user = await Usuario.findOne({ email }).select('rol').lean();
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        let contacts = [];

        if (user.rol === 'entrenador') {
            // Entrenadores: pueden hablar con todos los demás entrenadores
            const trainers = await Entrenador.find({ email: { $ne: email } })
                .select('nombre email').lean();
            contacts = trainers.map(t => ({ nombre: t.nombre || t.email, email: t.email, rol: 'entrenador' }));

        } else if (user.rol === 'boxeador') {
            const boxer = await Boxeador.findOne({ email }).lean();
            if (boxer) {
                // Su entrenador asignado
                if (boxer.entrenadorId) {
                    const trainer = await Entrenador.findById(boxer.entrenadorId)
                        .select('nombre email').lean();
                    if (trainer) contacts.push({ nombre: trainer.nombre || trainer.email, email: trainer.email, rol: 'entrenador' });
                }
                // Boxeadores del mismo gimnasio (mismo entrenadorId)
                if (boxer.entrenadorId) {
                    const gymmates = await Boxeador.find({
                        entrenadorId: boxer.entrenadorId,
                        email: { $ne: email }
                    }).select('nombre email').lean();
                    gymmates.forEach(b => contacts.push({ nombre: b.nombre || b.email, email: b.email, rol: 'boxeador' }));
                }
            }
        }

        res.json(contacts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/chat/mensajes?email=X&con=Y
router.get('/mensajes', async (req, res) => {
    try {
        const email = norm(req.query.email);
        const con = norm(req.query.con);
        if (!email || !con) return res.status(400).json({ error: 'Parámetros requeridos' });

        const mensajes = await Mensaje.find({
            $or: [{ de: email, para: con }, { de: con, para: email }]
        }).sort({ createdAt: 1 }).limit(100).lean();

        // Marcar como leídos los mensajes recibidos
        await Mensaje.updateMany({ de: con, para: email, leido: false }, { leido: true });

        res.json(mensajes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat/mensajes — enviar mensaje
router.post('/mensajes', async (req, res) => {
    try {
        const de = norm(req.body.de);
        const para = norm(req.body.para);
        const texto = (req.body.texto || '').toString().trim();

        if (!de || !para || !texto) return res.status(400).json({ error: 'Faltan datos' });
        if (texto.length > 2000) return res.status(400).json({ error: 'Mensaje demasiado largo' });

        const msg = await Mensaje.create({ de, para, texto });
        res.status(201).json(msg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/chat/no-leidos?email=X — badge de mensajes nuevos
router.get('/no-leidos', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const count = await Mensaje.countDocuments({ para: email, leido: false });
        res.json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
