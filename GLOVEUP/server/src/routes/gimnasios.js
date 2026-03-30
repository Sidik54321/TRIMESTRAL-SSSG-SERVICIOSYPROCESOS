import express from 'express';
import Gimnasio from '../models/Gimnasio.js';

const router = express.Router();

const normalizeGymKey = (value) => {
    const text = (value || '').toString().trim().toLowerCase();
    return text
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
};

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

router.post('/', async (req, res) => {
    try {
        const payload = req.body || {};
        const nombre = (payload.nombre || payload.name || '').toString().trim();
        if (!nombre) {
            return res.status(400).json({
                error: 'Nombre requerido'
            });
        }

        const key = normalizeGymKey(nombre);
        if (!key) {
            return res.status(400).json({
                error: 'Nombre inválido'
            });
        }

        const ubicacion = (payload.ubicacion || payload.city || '').toString().trim();
        const direccion = (payload.direccion || '').toString().trim();
        const latRaw = payload.lat;
        const lngRaw = payload.lng;
        const lat = latRaw === null || latRaw === undefined || latRaw === '' ? null : Number(latRaw);
        const lng = lngRaw === null || lngRaw === undefined || lngRaw === '' ? null : Number(lngRaw);
        const bio = payload.bio === null || payload.bio === undefined ? undefined : String(payload.bio).trim();
        const fotosRaw = payload.fotos === null || payload.fotos === undefined ? undefined : payload.fotos;
        const fotos = Array.isArray(fotosRaw) ?
            fotosRaw
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 12) :
            undefined;
        const creadoPorEmail = (payload.creadoPorEmail || payload.email || '').toString().trim().toLowerCase();

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
        if (creadoPorEmail) update.creadoPorEmail = creadoPorEmail;

        const gym = await Gimnasio.findOneAndUpdate({
            key
        }, {
            $set: update,
            $setOnInsert: {
                createdAt: new Date()
            }
        }, {
            new: true,
            upsert: true
        }).lean();

        return res.status(201).json(gym);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.get('/lookup', async (req, res) => {
    try {
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
        return res.json(gym || null);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

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