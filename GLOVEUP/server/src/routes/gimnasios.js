/**
 * routes/gimnasios.js — Rutas del recurso Gimnasio
 *
 * Gestiona la creación, actualización y consulta de gimnasios de boxeo.
 * Prefijo de montaje: /api/gimnasios
 *
 * Endpoints:
 *  GET  /           → Listar todos los gimnasios (ordenados por fecha de creación)
 *  POST /           → Crear o actualizar un gimnasio (upsert basado en propietario o key)
 *  GET  /lookup     → Buscar un gimnasio por su slug (key) o por nombre
 *  GET  /:id        → Obtener un gimnasio por su ObjectId
 *
 * Lógica de upsert en POST /:
 *  1. Si ya existe un gimnasio con el mismo creadoPorEmail → actualizar ese
 *  2. Si no, buscar por key (slug del nombre):
 *     - Si el key existe y pertenece a otro entrenador → error 400
 *     - Si el key existe sin dueño → reclamar y actualizar
 *     - Si no existe → crear nuevo
 *  Esto garantiza que cada entrenador solo puede tener un gimnasio a su nombre.
 *
 * Nota: cuando el nombre del gimnasio cambia, se actualiza el campo "gimnasio"
 * en todos los documentos Boxeador que referenciaban el nombre antiguo.
 */

import express from 'express';
import Gimnasio from '../models/Gimnasio.js';

const router = express.Router();

/**
 * Genera un slug URL-friendly a partir del nombre de un gimnasio:
 *  - Convierte a minúsculas
 *  - Elimina acentos y diacríticos (NFD + regex)
 *  - Reemplaza espacios por guiones
 *  - Elimina caracteres que no sean letras, números o guiones
 *  - Colapsa guiones múltiples consecutivos
 *  - Elimina guiones al inicio y al final
 *
 * Ejemplo: "Gym España-Norte" → "gym-espana-norte"
 *
 * @param {string} value - Nombre del gimnasio
 * @returns {string} Slug normalizado
 */
const normalizeGymKey = (value) => {
    const text = (value || '').toString().trim().toLowerCase();
    return text
        .normalize('NFD')                         // Descomponer caracteres acentuados
        .replace(/[̀-ͯ]/g, '')          // Eliminar marcas de acento
        .replace(/\s+/g, '-')                     // Espacios → guiones
        .replace(/[^a-z0-9-]/g, '')              // Eliminar caracteres no permitidos
        .replace(/-+/g, '-')                      // Colapsar guiones múltiples
        .replace(/^-|-$/g, '');                   // Recortar guiones de los extremos
};

// ─── GET / ─────────────────────────────────────────────────────────────────
// Devuelve todos los gimnasios ordenados por fecha de creación (más recientes primero)
router.get('/', async (req, res) => {
    try {
        const items = await Gimnasio.find().sort({
            createdAt: -1
        }).lean();
        res.json(items);
    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// ─── POST / ────────────────────────────────────────────────────────────────
// Crea o actualiza el gimnasio del entrenador (upsert inteligente).
// Se acepta tanto "nombre" como "name" y "ubicacion" como "city" para
// compatibilidad con diferentes versiones del cliente.
router.post('/', async (req, res) => {
    try {
        const payload = req.body || {};
        const nombre = (payload.nombre || payload.name || '').toString().trim();
        if (!nombre) {
            return res.status(400).json({
                error: 'Nombre requerido'
            });
        }

        // Generar el slug a partir del nombre
        const key = normalizeGymKey(nombre);
        if (!key) {
            return res.status(400).json({
                error: 'Nombre inválido'
            });
        }

        // Normalizar todos los campos opcionales
        const ubicacion = (payload.ubicacion || payload.city || '').toString().trim();
        const direccion = (payload.direccion || '').toString().trim();
        const latRaw = payload.lat;
        const lngRaw = payload.lng;
        // Coordenadas: null si no se proporcionan o son vacías
        const lat = latRaw === null || latRaw === undefined || latRaw === '' ? null : Number(latRaw);
        const lng = lngRaw === null || lngRaw === undefined || lngRaw === '' ? null : Number(lngRaw);
        const bio = payload.bio === null || payload.bio === undefined ? undefined : String(payload.bio).trim();
        const fotosRaw = payload.fotos === null || payload.fotos === undefined ? undefined : payload.fotos;
        // Filtrar y limitar el array de fotos a 12 entradas como máximo
        const fotos = Array.isArray(fotosRaw) ?
            fotosRaw
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 12) :
            undefined;
        const fotoPerfil = (payload.fotoPerfil || '').toString().trim();
        const correoContacto = (payload.correoContacto || '').toString().trim().toLowerCase();
        const telefono = (payload.telefono || '').toString().trim();
        // Email del entrenador propietario (se acepta tanto creadoPorEmail como email)
        const creadoPorEmail = (payload.creadoPorEmail || payload.email || '').toString().trim().toLowerCase();
        const horario = (payload.horario || '').toString().trim();
        const nombreEntrenador = (payload.nombreEntrenador || '').toString().trim();

        // Construir el objeto de actualización con solo los campos que tienen valor
        const update = {
            nombre,
            key
        };
        if (ubicacion) update.ubicacion = ubicacion;
        if (direccion) update.direccion = direccion;
        if (Number.isFinite(lat)) update.lat = lat;
        if (Number.isFinite(lng)) update.lng = lng;
        if (bio !== undefined) update.bio = bio;
        if (fotos !== undefined) update.fotos = fotos;
        if (fotoPerfil !== undefined) update.fotoPerfil = fotoPerfil;
        if (correoContacto) update.correoContacto = correoContacto;
        if (telefono) update.telefono = telefono;
        if (creadoPorEmail) update.creadoPorEmail = creadoPorEmail;
        if (horario) update.horario = horario;
        if (nombreEntrenador) update.nombreEntrenador = nombreEntrenador;

        // ── Lógica de upsert: buscar gimnasio existente ────────────────────
        let gym = null;

        // Paso 1: buscar por propietario (un entrenador solo puede tener un gimnasio)
        if (creadoPorEmail) {
            gym = await Gimnasio.findOne({ creadoPorEmail });
        }

        // Paso 2: si no se encontró por propietario, buscar por slug (key)
        if (!gym) {
            const existingByKey = await Gimnasio.findOne({ key });
            if (existingByKey) {
                // Si pertenece a otro entrenador distinto, no se puede usar ese nombre
                if (existingByKey.creadoPorEmail && existingByKey.creadoPorEmail !== creadoPorEmail) {
                    return res.status(400).json({ error: 'El nombre de este gimnasio ya está registrado por otro entrenador.' });
                }
                // Si no tiene dueño o el dueño es el mismo, se puede actualizar
                gym = existingByKey;
            }
        }

        if (gym) {
            // ── Actualizar gimnasio existente ──────────────────────────────
            const oldName = gym.nombre;
            Object.assign(gym, update);
            if (creadoPorEmail) gym.creadoPorEmail = creadoPorEmail; // Reclamar si estaba sin dueño
            await gym.save();

            // Si el nombre cambió, actualizar el campo "gimnasio" en todos los boxeadores
            // que tenían el nombre antiguo (para mantener consistencia de datos)
            if (oldName && oldName !== nombre) {
                try {
                    const Boxeador = mongoose.model('Boxeador');
                    await Boxeador.updateMany({ gimnasio: oldName }, { $set: { gimnasio: nombre } });
                } catch (boxerErr) {
                    console.error("Error syncing boxers gym name:", boxerErr);
                }
            }
        } else {
            // ── Crear nuevo gimnasio ───────────────────────────────────────
            gym = await Gimnasio.create({
                ...update,
                creadoPorEmail,
                createdAt: new Date()
            });
        }

        const gymObj = gym.toObject ? gym.toObject() : gym;
        return res.status(201).json(gymObj);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── GET /lookup ───────────────────────────────────────────────────────────
// Busca un gimnasio por su slug (key) o por nombre (se convierte a slug internamente).
// Devuelve null si no existe (sin error 404) para que el frontend pueda
// determinar si mostrar el formulario de creación.
router.get('/lookup', async (req, res) => {
    try {
        // Aceptar búsqueda por "key" directo o por "nombre"/"name" (se normaliza a key)
        const qKey = (req.query.key || '').toString().trim().toLowerCase();
        const qNombre = (req.query.nombre || req.query.name || '').toString().trim();
        const key = qKey || normalizeGymKey(qNombre);
        if (!key) {
            return res.status(400).json({
                error: 'Key o nombre requerido'
            });
        }
        const gym = await Gimnasio.findOne({
            key
        }).lean();
        return res.json(gym || null); // null en lugar de 404 para facilitar la lógica del cliente
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── GET /:id ──────────────────────────────────────────────────────────────
// Obtiene un gimnasio por su ObjectId de MongoDB
router.get('/:id', async (req, res) => {
    try {
        const id = (req.params.id || '').toString().trim();
        const gym = await Gimnasio.findById(id).lean();
        if (!gym) {
            return res.status(404).json({
                error: 'Gimnasio no encontrado'
            });
        }
        return res.json(gym);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

export default router;
