import {
    Router
} from 'express';
import Entrenador from '../models/Entrenador.js';
import Boxeador from '../models/Boxeador.js';
import Usuario from '../models/Usuario.js';

const router = Router();

const normalizeEmail = (value) => (value || '').toString().trim().toLowerCase();

async function requireCoachByEmail(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
        const err = new Error('Email requerido');
        err.status = 400;
        throw err;
    }

    const user = await Usuario.findOne({
        email: cleanEmail
    }).select('rol email').lean();

    if (!user || user.rol !== 'entrenador') {
        const err = new Error('No autorizado');
        err.status = 403;
        throw err;
    }

    const coach = await Entrenador.findOne({
        email: cleanEmail
    });

    if (!coach) {
        const err = new Error('Entrenador no encontrado');
        err.status = 404;
        throw err;
    }

    return coach;
}

router.get('/', async (req, res) => {
    const items = await Entrenador.find().lean();
    res.json(items);
});

router.get('/me', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const item = coach.toObject();

        if (!item) {
            return res.status(404).json({
                error: 'Entrenador no encontrado'
            });
        }

        return res.json(item);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.put('/me', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const payload = req.body || {};
        const precioMensual = payload.precioMensual === undefined ? coach.precioMensual : Number(payload.precioMensual);
        const safePrecio = Number.isFinite(precioMensual) && precioMensual >= 0 ? precioMensual : 0;
        const update = {
            nombre: payload.nombre === undefined ? coach.nombre : payload.nombre,
            especialidad: payload.especialidad === undefined ? coach.especialidad : (payload.especialidad || 'Boxeo'),
            gimnasio: payload.gimnasio === undefined ? (coach.gimnasio || '') : (payload.gimnasio || ''),
            precioMensual: safePrecio,
            ubicacion: payload.ubicacion === undefined ? (coach.ubicacion || '') : (payload.ubicacion || ''),
            foto: payload.foto === undefined ? (coach.foto || '') : (payload.foto || '')
        };

        coach.set(update);
        await coach.save();

        return res.json(coach.toObject());
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.get('/me/metricas', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        const boxeadoresActivos = await Boxeador.countDocuments({
            entrenadorId: coach._id
        });

        const inscripcionesMes = await Boxeador.countDocuments({
            entrenadorId: coach._id,
            $or: [{
                    fechaInscripcion: {
                        $gte: start,
                        $lt: end
                    }
                },
                {
                    fechaInscripcion: {
                        $exists: false
                    },
                    createdAt: {
                        $gte: start,
                        $lt: end
                    }
                },
                {
                    fechaInscripcion: null,
                    createdAt: {
                        $gte: start,
                        $lt: end
                    }
                }
            ]
        });

        const precioMensual = Number.isFinite(Number(coach.precioMensual)) ? Number(coach.precioMensual) : 0;
        const ingresosMes = precioMensual * inscripcionesMes;

        return res.json({
            gimnasio: coach.gimnasio || '',
            precioMensual,
            boxeadoresActivos,
            inscripcionesMes,
            ingresosMes
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.get('/me/boxeadores', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);

        const items = await Boxeador.find({
            entrenadorId: coach._id
        }).select('-password').sort({
            createdAt: -1
        }).lean();

        return res.json(items);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.post('/me/boxeadores', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const rawIdentifier = (req.body && (req.body.boxeadorEmail || req.body.boxeadorIdentifier) ? (req.body.boxeadorEmail || req.body.boxeadorIdentifier) : '').toString().trim();
        if (!rawIdentifier) {
            return res.status(400).json({
                error: 'Email o DNI/Licencia del boxeador requerido'
            });
        }

        const isEmail = rawIdentifier.includes('@');
        const boxeadorEmail = isEmail ? normalizeEmail(rawIdentifier) : '';
        const boxeadorDni = !isEmail ? rawIdentifier.toUpperCase() : '';
        const boxer = await Boxeador.findOne(
            isEmail ? {
                email: boxeadorEmail
            } : {
                dniLicencia: boxeadorDni
            }
        );
        if (!boxer) {
            return res.status(404).json({
                error: 'Boxeador no encontrado'
            });
        }

        boxer.entrenadorId = coach._id;
        if (coach.gimnasio) {
            boxer.gimnasio = coach.gimnasio;
        }
        boxer.fechaInscripcion = new Date();
        await boxer.save();

        const safe = boxer.toObject();
        delete safe.password;
        return res.json(safe);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.delete('/me/boxeadores', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const rawIdentifier = (req.body && (req.body.boxeadorEmail || req.body.boxeadorIdentifier) ? (req.body.boxeadorEmail || req.body.boxeadorIdentifier) : '').toString().trim();
        if (!rawIdentifier) {
            return res.status(400).json({
                error: 'Email o DNI/Licencia del boxeador requerido'
            });
        }

        const isEmail = rawIdentifier.includes('@');
        const boxeadorEmail = isEmail ? normalizeEmail(rawIdentifier) : '';
        const boxeadorDni = !isEmail ? rawIdentifier.toUpperCase() : '';
        const boxer = await Boxeador.findOne(
            isEmail ? {
                email: boxeadorEmail
            } : {
                dniLicencia: boxeadorDni
            }
        );
        if (!boxer) {
            return res.status(404).json({
                error: 'Boxeador no encontrado'
            });
        }

        if (!boxer.entrenadorId || String(boxer.entrenadorId) !== String(coach._id)) {
            return res.status(409).json({
                error: 'Este boxeador no está asociado a tu cuenta'
            });
        }

        boxer.entrenadorId = undefined;
        boxer.gimnasio = '';
        boxer.fechaInscripcion = undefined;
        await boxer.save();

        const safe = boxer.toObject();
        delete safe.password;
        return res.json(safe);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.post('/me/boxeadores/create', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const payload = req.body || {};

        const nombre = (payload.nombre || '').toString().trim();
        const email = normalizeEmail(payload.email);
        const password = (payload.password || '').toString().trim();
        const nivel = (payload.nivel || 'Amateur').toString().trim() || 'Amateur';
        const disciplina = (payload.disciplina || 'Boxeo').toString().trim() || 'Boxeo';
        const dniLicencia = (payload.dniLicencia || '').toString().trim().toUpperCase();

        if (!nombre || !email) {
            return res.status(400).json({
                error: 'Nombre y email son obligatorios'
            });
        }
        if (!password) {
            return res.status(400).json({
                error: 'Password es obligatorio'
            });
        }
        if (!dniLicencia || dniLicencia.length < 6 || dniLicencia.length > 20) {
            return res.status(400).json({
                error: 'DNI/Licencia es obligatorio'
            });
        }

        const existingUser = await Usuario.findOne({
            email
        }).lean();
        if (existingUser) {
            return res.status(409).json({
                error: 'Este email ya está registrado'
            });
        }

        const existingDni = await Usuario.findOne({
            dniLicencia
        }).lean();
        if (existingDni) {
            return res.status(409).json({
                error: 'Este DNI/Licencia ya está registrado'
            });
        }

        // Encriptar el DNI antes de guardarlo en Usuario para consistencia
        const { encrypt } = await import('../utils/crypto.js');
        const encryptedDni = encrypt(dniLicencia);

        const usuario = await Usuario.create({
            nombre,
            email,
            password,
            rol: 'boxeador',
            dniLicencia: encryptedDni
        });

        const boxer = await Boxeador.create({
            usuarioId: usuario._id,
            entrenadorId: coach._id,
            nombre,
            email,
            dniLicencia,
            nivel,
            disciplina,
            gimnasio: coach.gimnasio || '',
            fechaInscripcion: new Date(),
            sparringHistory: []
        });

        const safe = boxer.toObject();
        delete safe.password;
        return res.status(201).json(safe);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.put('/me/boxeadores/:id', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const id = (req.params.id || '').toString().trim();
        if (!id) {
            return res.status(400).json({
                error: 'Id requerido'
            });
        }

        const boxer = await Boxeador.findById(id);
        if (!boxer) {
            return res.status(404).json({
                error: 'Boxeador no encontrado'
            });
        }
        if (!boxer.entrenadorId || String(boxer.entrenadorId) !== String(coach._id)) {
            return res.status(403).json({
                error: 'No autorizado'
            });
        }

        const payload = req.body || {};
        if (payload.nombre !== undefined) boxer.nombre = String(payload.nombre || '').trim();
        if (payload.nivel !== undefined) boxer.nivel = String(payload.nivel || '').trim() || boxer.nivel;
        if (payload.disciplina !== undefined) boxer.disciplina = String(payload.disciplina || '').trim() || boxer.disciplina;
        if (payload.dniLicencia !== undefined) boxer.dniLicencia = String(payload.dniLicencia || '').trim().toUpperCase();
        if (payload.email !== undefined) boxer.email = normalizeEmail(payload.email);

        await boxer.save();

        if (boxer.usuarioId) {
            const updateUser = {};
            if (payload.nombre !== undefined) updateUser.nombre = boxer.nombre;
            if (payload.dniLicencia !== undefined) updateUser.dniLicencia = boxer.dniLicencia;
            if (payload.email !== undefined) updateUser.email = boxer.email;
            if (Object.keys(updateUser).length > 0) {
                await Usuario.updateOne({
                    _id: boxer.usuarioId
                }, {
                    $set: updateUser
                });
            }
        }

        const safe = boxer.toObject();
        delete safe.password;
        return res.json(safe);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.delete('/me/boxeadores/:id', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const id = (req.params.id || '').toString().trim();
        if (!id) {
            return res.status(400).json({
                error: 'Id requerido'
            });
        }

        const boxer = await Boxeador.findById(id);
        if (!boxer) {
            return res.status(404).json({
                error: 'Boxeador no encontrado'
            });
        }
        if (!boxer.entrenadorId || String(boxer.entrenadorId) !== String(coach._id)) {
            return res.status(403).json({
                error: 'No autorizado'
            });
        }

        const usuarioId = boxer.usuarioId;
        await Boxeador.deleteOne({
            _id: boxer._id
        });
        if (usuarioId) {
            await Usuario.deleteOne({
                _id: usuarioId
            });
        }

        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

router.get('/me/cobros', async (req, res) => {
    const email = (req.query.email || '').toString().trim().toLowerCase();
    if (!email) {
        return res.status(400).json({
            error: 'Email requerido'
        });
    }
    return res.json({
        total: 0,
        items: []
    });
});

router.post('/', async (req, res) => {
    try {
        const payload = req.body || {};
        const created = await Entrenador.create({
            nombre: payload.nombre,
            email: payload.email,
            especialidad: payload.especialidad,
            gimnasio: payload.gimnasio,
            ubicacion: payload.ubicacion,
            foto: payload.foto,
        });
        res.status(201).json(created);
    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

export default router;
