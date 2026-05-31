/**
 * routes/usuarios.js — Rutas del recurso Usuario
 *
 * Proporciona acceso a la colección de usuarios de la plataforma.
 * Prefijo de montaje: /api/usuarios
 *
 * Endpoints:
 *  GET / → Devuelve todos los usuarios registrados (sin contraseña)
 *
 * Esta ruta está pensada principalmente para uso administrativo o de
 * depuración. En producción debería protegerse con un middleware de
 * autorización que compruebe el rol "admin" del solicitante.
 *
 * Los perfiles completos (datos deportivos, retos, etc.) se obtienen a
 * través de /api/boxeadores y /api/entrenadores respectivamente.
 * Este endpoint solo expone los datos básicos de identidad y rol.
 */

import {
    Router
} from 'express';
import Usuario from '../models/Usuario.js';

const router = Router();

// ─── GET / ─────────────────────────────────────────────────────────────────
// Devuelve todos los usuarios de la plataforma ordenados por fecha de
// registro (más recientes primero).
// Se excluye el campo "password" para nunca exponer hashes de contraseñas
// a través de la API, aunque sean hashes bcrypt.
router.get('/', async (req, res) => {
    try {
        const users = await Usuario.find()
            .select('-password')  // Nunca devolver el hash de la contraseña
            .sort({ createdAt: -1 })
            .lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

export default router;
