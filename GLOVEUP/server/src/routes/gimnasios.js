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
        const fotoPerfil = (payload.fotoPerfil || '').toString().trim();
        const correoContacto = (payload.correoContacto || '').toString().trim().toLowerCase();
        const telefono = (payload.telefono || '').toString().trim();
        const creadoPorEmail = (payload.creadoPorEmail || payload.email || '').toString().trim().toLowerCase();
        const horario = (payload.horario || '').toString().trim();
        const nombreEntrenador = (payload.nombreEntrenador || '').toString().trim();

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

        // Improved finding logic:
        let gym = null;
        if (creadoPorEmail) {
            gym = await Gimnasio.findOne({ creadoPorEmail });
        }

        // If not found by email, check if name (key) exists
        if (!gym) {
            const existingByKey = await Gimnasio.findOne({ key });
            if (existingByKey) {
                // If it belongs to someone else, we can't take it
                if (existingByKey.creadoPorEmail && existingByKey.creadoPorEmail !== creadoPorEmail) {
                    return res.status(400).json({ error: 'El nombre de este gimnasio ya está registrado por otro entrenador.' });
                }
                // If it has no owner, or it's the same owner, we update it
                gym = existingByKey;
            }
        }

        if (gym) {
            // Update existing
            const oldName = gym.nombre;
            Object.assign(gym, update);
            if (creadoPorEmail) gym.creadoPorEmail = creadoPorEmail; // Claim it if it was ownerless
            await gym.save();

            // If name changed, update all boxers associated with the old name
            if (oldName && oldName !== nombre) {
                try {
                    const Boxeador = mongoose.model('Boxeador');
                    await Boxeador.updateMany({ gimnasio: oldName }, { $set: { gimnasio: nombre } });
                } catch (boxerErr) {
                    console.error("Error syncing boxers gym name:", boxerErr);
                }
            }
        } else {
            // Create new
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