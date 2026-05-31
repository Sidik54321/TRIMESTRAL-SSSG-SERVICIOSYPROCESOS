/**
 * routes/notificaciones.js — Rutas del sistema de notificaciones
 *
 * Gestiona las notificaciones internas de la plataforma GloveUp.
 * Las notificaciones se generan automáticamente desde el servidor (sin push
 * notifications ni WebSockets) en respuesta a eventos del sistema:
 * retos de sparring, mensajes de chat, altas/bajas en gimnasios, pagos, etc.
 * Prefijo de montaje: /api/notificaciones
 *
 * Función exportable:
 *  crearNotificacion(opts) → Crea una notificación desde cualquier otro módulo
 *
 * Endpoints:
 *  GET    /                    → Obtener las 50 notificaciones más recientes del usuario
 *  GET    /no-leidas?email=X   → Contador de notificaciones no leídas (para el badge)
 *  PUT    /leer/:id            → Marcar una notificación como leída
 *  PUT    /leer-todas?email=X  → Marcar todas las notificaciones del usuario como leídas
 *  DELETE /todas?email=X       → Eliminar todas las notificaciones del usuario
 *  DELETE /:id                 → Eliminar una notificación concreta
 */

import { Router } from 'express';
import Notificacion from '../models/Notificacion.js';

const router = Router();

// Normaliza un valor a email en minúsculas y sin espacios
const norm = (v) => (v || '').toString().trim().toLowerCase();

// ─── Helper exportable: crearNotificacion ─────────────────────────────────
/**
 * Crea una notificación en la base de datos.
 * Es exportada para ser usada desde otros módulos (auth, boxeadores, entrenadores, chat).
 *
 * Falla silenciosamente (try/catch vacío) para que un error al crear una
 * notificación nunca interrumpa el flujo principal de la operación que la generó.
 *
 * @param {Object} opts
 * @param {string} opts.para    - Email del destinatario
 * @param {string} opts.tipo    - Categoría: 'mensaje'|'sparring'|'gimnasio'|'general'
 * @param {string} opts.titulo  - Título corto de la notificación
 * @param {string} [opts.cuerpo]  - Descripción detallada (opcional)
 * @param {string} [opts.link]    - URL de destino al pulsar la notificación
 * @param {string} [opts.de]      - Email del emisor del evento
 */
export async function crearNotificacion({ para, tipo = 'general', titulo, cuerpo = '', link = '', de = '' }) {
    try {
        if (!para || !titulo) return; // Campos mínimos obligatorios; ignorar si faltan
        await Notificacion.create({ para: norm(para), tipo, titulo, cuerpo, link, de: norm(de) });
    } catch (_) { /* Silencioso: los errores de notificación no deben interrumpir la operación */ }
}

// ─── GET / ─────────────────────────────────────────────────────────────────
// Devuelve las 50 notificaciones más recientes del usuario, ordenadas
// de más nueva a más antigua (para mostrarlas en el panel de notificaciones)
router.get('/', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const notifs = await Notificacion.find({ para: email })
            .sort({ createdAt: -1 }) // Más recientes primero
            .limit(50)               // Limitar para no saturar la respuesta
            .lean();
        res.json(notifs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /no-leidas ────────────────────────────────────────────────────────
// Devuelve el número de notificaciones no leídas del usuario.
// El frontend llama a este endpoint periódicamente para actualizar el badge
// del icono de notificaciones sin necesidad de WebSockets.
router.get('/no-leidas', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        const count = await Notificacion.countDocuments({ para: email, leida: false });
        res.json({ count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /leer/:id ─────────────────────────────────────────────────────────
// Marca una notificación concreta como leída (al pulsar sobre ella en la UI)
router.put('/leer/:id', async (req, res) => {
    try {
        await Notificacion.findByIdAndUpdate(req.params.id, { leida: true });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /leer-todas ───────────────────────────────────────────────────────
// Marca TODAS las notificaciones no leídas del usuario como leídas de golpe
// (equivalente al botón "Marcar todas como leídas")
router.put('/leer-todas', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        await Notificacion.updateMany({ para: email, leida: false }, { leida: true });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /todas ─────────────────────────────────────────────────────────
// Elimina permanentemente todas las notificaciones del usuario
// (función de "limpiar bandeja")
router.delete('/todas', async (req, res) => {
    try {
        const email = norm(req.query.email);
        if (!email) return res.status(400).json({ error: 'Email requerido' });
        await Notificacion.deleteMany({ para: email });
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /:id ───────────────────────────────────────────────────────────
// Elimina una notificación concreta por su ObjectId
router.delete('/:id', async (req, res) => {
    try {
        await Notificacion.findByIdAndDelete(req.params.id);
        res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

export default router;
