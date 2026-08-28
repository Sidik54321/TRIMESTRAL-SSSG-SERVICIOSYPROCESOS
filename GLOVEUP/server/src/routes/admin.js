/**
 * routes/admin.js — Panel de administración.
 *
 *  - POST   /api/admin/login              → Contraseña de admin → token
 *  - GET    /api/admin/stats               → Contadores globales de la plataforma
 *  - GET    /api/admin/usuarios            → Listado de usuarios (con su gimnasio, si aplica)
 *  - POST   /api/admin/usuarios            → Crear un boxeador o entrenador
 *  - DELETE /api/admin/usuarios/:id        → Eliminar un usuario y su perfil
 *  - DELETE /api/admin/gimnasios/:id       → Eliminar un gimnasio
 *
 * Todas las rutas salvo /login exigen el token que devuelve /login (ver
 * middleware/adminAuth.js). No hay una cuenta de administrador en Mongo:
 * es una única contraseña compartida, guardada en ADMIN_PASSWORD.
 */

import { Router } from 'express';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import { encrypt } from '../utils/crypto.js';
import { verifyAdminPassword, requireAdmin } from '../middleware/adminAuth.js';

const router = Router();

// ─── LOGIN ─────────────────────────────────────────────────────────────────
router.post('/login', (req, res) => {
    if (!process.env.ADMIN_PASSWORD) {
        return res.status(503).json({ error: 'El panel de administración no está configurado' });
    }

    const { password } = req.body || {};
    const token = verifyAdminPassword(password);
    if (!token) {
        return res.status(401).json({ error: 'Contraseña incorrecta' });
    }
    return res.json({ token });
});

// A partir de aquí, todas las rutas exigen el token del paso anterior.
router.use(requireAdmin);

// ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
    try {
        const [usuarios, boxeadores, entrenadores, gimnasios] = await Promise.all([
            Usuario.countDocuments(),
            Boxeador.countDocuments(),
            Entrenador.countDocuments(),
            Gimnasio.countDocuments(),
        ]);

        const [challengeTotals] = await Boxeador.aggregate([
            { $project: { enviados: { $size: { $ifNull: ['$sparringChallengesSent', []] } } } },
            { $group: { _id: null, total: { $sum: '$enviados' } } },
        ]);

        const [completedTotals] = await Boxeador.aggregate([
            { $unwind: '$sparringSessions' },
            { $match: { 'sparringSessions.status': 'completed' } },
            { $count: 'total' },
        ]);

        // Altas de usuario de los últimos 6 meses (incluido el actual), para
        // dibujar una gráfica de crecimiento sencilla en el panel.
        const desde = new Date();
        desde.setMonth(desde.getMonth() - 5);
        desde.setDate(1);
        desde.setHours(0, 0, 0, 0);

        const registrosPorMes = await Usuario.aggregate([
            { $match: { createdAt: { $gte: desde } } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } },
                    total: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        return res.json({
            usuarios,
            boxeadores,
            entrenadores,
            gimnasios,
            retosEnviados: challengeTotals?.total || 0,
            sparringsCompletados: completedTotals?.total || 0,
            registrosPorMes: registrosPorMes.map((r) => ({ mes: r._id, total: r.total })),
        });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

// ─── USUARIOS ────────────────────────────────────────────────────────────────
router.get('/usuarios', async (req, res) => {
    try {
        const usuarios = await Usuario.find().select('-password -dniLicencia').sort({ createdAt: -1 }).lean();

        // El gimnasio y un dato de contexto (nivel o especialidad) viven en el
        // perfil deportivo, no en Usuario, así que se cruzan por email.
        const [boxeadores, entrenadores] = await Promise.all([
            Boxeador.find().select('email gimnasio nivel').lean(),
            Entrenador.find().select('email gimnasio especialidad').lean(),
        ]);

        const perfilPorEmail = new Map();
        boxeadores.forEach((b) => perfilPorEmail.set(b.email, { gimnasio: b.gimnasio || '', detalle: b.nivel || '' }));
        entrenadores.forEach((e) => perfilPorEmail.set(e.email, { gimnasio: e.gimnasio || '', detalle: e.especialidad || '' }));

        return res.json(usuarios.map((u) => ({
            id: u._id,
            nombre: u.nombre,
            email: u.email,
            rol: u.rol,
            createdAt: u.createdAt,
            gimnasio: perfilPorEmail.get(u.email)?.gimnasio || '',
            detalle: perfilPorEmail.get(u.email)?.detalle || '',
        })));
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
});

router.post('/usuarios', async (req, res) => {
    try {
        const { nombre, email, password, rol, dniLicencia, gimnasio } = req.body || {};

        const cleanName = (nombre || '').toString().trim();
        const cleanEmail = (email || '').toString().trim().toLowerCase();
        const cleanPassword = (password || '').toString().trim();
        const cleanRol = (rol || '').toString().trim().toLowerCase();
        const cleanDni = (dniLicencia || '').toString().trim().toUpperCase();
        const cleanGimnasio = (gimnasio || '').toString().trim();

        if (!cleanName || !cleanEmail || !cleanPassword) {
            return res.status(400).json({ error: 'Nombre, email y contraseña son obligatorios' });
        }
        if (cleanPassword.length < 8 || !/[A-Z]/.test(cleanPassword) || !/[0-9]/.test(cleanPassword)) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número' });
        }
        if (cleanRol !== 'boxeador' && cleanRol !== 'entrenador') {
            return res.status(400).json({ error: 'El rol debe ser "boxeador" o "entrenador"' });
        }
        if (!cleanDni || cleanDni.length < 6 || cleanDni.length > 20) {
            return res.status(400).json({ error: 'DNI/Licencia es obligatorio' });
        }

        const existingUser = await Usuario.findOne({ email: cleanEmail }).lean();
        if (existingUser) {
            return res.status(409).json({ error: 'Este email ya está registrado' });
        }

        const existingEntrenadorDni = await Entrenador.findOne({ dniLicencia: cleanDni }).lean();
        if (existingEntrenadorDni) return res.status(409).json({ error: 'Ese DNI ya existe' });
        const existingBoxeadorDni = await Boxeador.findOne({ dniLicencia: cleanDni }).lean();
        if (existingBoxeadorDni) return res.status(409).json({ error: 'Ese DNI ya existe' });

        const usuario = await Usuario.create({
            nombre: cleanName,
            email: cleanEmail,
            password: cleanPassword, // se hashea en el pre-save del modelo
            rol: cleanRol,
            dniLicencia: encrypt(cleanDni),
        });

        if (cleanRol === 'boxeador') {
            await Boxeador.create({
                nombre: cleanName,
                email: cleanEmail,
                usuarioId: usuario._id,
                dniLicencia: cleanDni,
                gimnasio: cleanGimnasio,
            });
        } else {
            await Entrenador.create({
                nombre: cleanName,
                email: cleanEmail,
                usuarioId: usuario._id,
                dniLicencia: cleanDni,
                gimnasio: cleanGimnasio,
            });
        }

        return res.status(201).json({
            id: usuario._id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
        });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Ese DNI ya existe' });
        }
        return res.status(400).json({ error: err.message });
    }
});

router.delete('/usuarios/:id', async (req, res) => {
    try {
        const id = (req.params.id || '').toString().trim();
        const usuario = await Usuario.findById(id);
        if (!usuario) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        await Usuario.deleteOne({ _id: usuario._id });

        if (usuario.rol === 'boxeador') {
            await Boxeador.deleteOne({ email: usuario.email });
        } else if (usuario.rol === 'entrenador') {
            const entrenador = await Entrenador.findOneAndDelete({ email: usuario.email });
            if (entrenador) {
                // Sus boxeadores no se borran: se quedan sin entrenador asignado.
                await Boxeador.updateMany({ entrenadorId: entrenador._id }, { $unset: { entrenadorId: '' } });
            }
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// ─── GIMNASIOS ───────────────────────────────────────────────────────────────
router.delete('/gimnasios/:id', async (req, res) => {
    try {
        const id = (req.params.id || '').toString().trim();
        const gimnasio = await Gimnasio.findById(id);
        if (!gimnasio) {
            return res.status(404).json({ error: 'Gimnasio no encontrado' });
        }

        await Gimnasio.deleteOne({ _id: gimnasio._id });

        // "gimnasio" en boxeadores/entrenadores es un nombre suelto, no una
        // referencia: hay que limpiarlo a mano para no dejar perfiles
        // apuntando a un gimnasio que ya no existe.
        await Promise.all([
            Boxeador.updateMany({ gimnasio: gimnasio.nombre }, { $set: { gimnasio: '' } }),
            Entrenador.updateMany({ gimnasio: gimnasio.nombre }, { $set: { gimnasio: '' } }),
        ]);

        return res.json({ ok: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

export default router;
