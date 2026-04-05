import { Router } from 'express';
import Notificacion from '../models/Notificacion.js';

const router = Router();
const norm = (v) => (v || '').toString().trim().toLowerCase();

// Helper exportable para crear notificaciones desde otras rutas
export async function crearNotificacion({ para, tipo = 'general', titulo, cuerpo = '', link = '', de = '' }) {
    try {
        if (!para || !titulo) return;
        await Notificacion.create({ para: norm(para), tipo, titulo, cuerpo, link, de: norm(de) });
    } catch (_) { /* silencioso */ }
}

// GET /api/notificaciones?email=X
router.get('/', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const notifs = await Notificacion.find({ para: email })
            .sort({ createdAt: -1 }).limit(50).lean();
        res.json(notifs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/notificaciones/no-leidas?email=X
router.get('/no-leidas', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const count = await Notificacion.countDocuments({ para: email, leida: false });
        res.json({ count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notificaciones/leer/:id
router.put('/leer/:id', async (req, res) => {
    try {
        await Notificacion.findByIdAndUpdate(req.params.id, { leida: true });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/notificaciones/leer-todas?email=X
router.put('/leer-todas', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        await Notificacion.updateMany({ para: email, leida: false }, { leida: true });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
