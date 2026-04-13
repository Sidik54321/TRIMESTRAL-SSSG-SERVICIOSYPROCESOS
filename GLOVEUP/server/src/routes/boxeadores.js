import {
    Router
} from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';

const router = Router();

function isObjectIdLike(value) {
    return mongoose.isValidObjectId(value);
}

async function findBoxeadorByIdentifier(identifier) {
    const raw = (identifier || '').toString().trim();
    if (!raw) return null;

    if (isObjectIdLike(raw)) {
        return Boxeador.findById(raw).lean();
    }

    const isEmail = raw.includes('@');
    const email = isEmail ? raw.toLowerCase() : '';
    const dniLicencia = isEmail ? '' : raw.toUpperCase();
    return Boxeador.findOne(isEmail ? {
        email
    } : {
        dniLicencia
    }).lean();
}

router.get('/', async (req, res) => {
    const items = await Boxeador.find().select('-password').lean();
    res.json(items);
});

router.get('/lookup', async (req, res) => {
    try {
        const identifier = (req.query.identifier || '').toString().trim();
        if (!identifier) {
            return res.status(400).json({
                error: 'Identificador requerido'
            });
        }

        const item = await findBoxeadorByIdentifier(identifier);

        if (!item) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        return res.json({
            _id: item._id,
            nombre: item.nombre || '',
            alias: item.alias || '',
            disciplina: item.disciplina || '',
            peso: item.peso || '',
            altura: item.altura || '',
            edad: item.edad || null,
            ubicacion: item.ubicacion || '',
            bio: item.bio || '',
            foto: item.foto || '',
            nivel: item.nivel || 'Amateur',
            gimnasio: item.gimnasio || ''
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.get('/challenges', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }

        const item = await Boxeador.findOne({
            email
        }).lean();

        if (!item) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        return res.json({
            sent: Array.isArray(item.sparringChallengesSent) ? item.sparringChallengesSent : [],
            received: Array.isArray(item.sparringChallengesReceived) ? item.sparringChallengesReceived : []
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.post('/challenges', async (req, res) => {
    try {
        const payload = req.body || {};
        const fromEmail = (payload.fromEmail || '').toString().trim().toLowerCase();
        const toIdentifier = (payload.toIdentifier || '').toString().trim();
        const preset = (payload.preset || '').toString().trim();
        const note = (payload.note || '').toString().trim();
        const gymName = (payload.gymName || '').toString().trim();
        const scheduledAt = (payload.scheduledAt || '').toString().trim();
        const coachIds = Array.isArray(payload.coachIds) ? payload.coachIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        const rating = payload.rating === undefined || payload.rating === null || payload.rating === '' ? null : Number(payload.rating);

        if (!fromEmail) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }
        if (!toIdentifier) {
            return res.status(400).json({
                error: 'Destino requerido'
            });
        }
        if (!preset) {
            return res.status(400).json({
                error: 'Descripción requerida'
            });
        }
        if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
            return res.status(400).json({
                error: 'Valoración inválida'
            });
        }
        if (!gymName) {
            return res.status(400).json({
                error: 'Gimnasio requerido'
            });
        }
        if (!scheduledAt) {
            return res.status(400).json({
                error: 'Fecha y hora requeridas'
            });
        }
        const parsedDate = new Date(scheduledAt);
        if (Number.isNaN(parsedDate.getTime())) {
            return res.status(400).json({
                error: 'Fecha y hora inválidas'
            });
        }
        if (!coachIds.length) {
            return res.status(400).json({
                error: 'Selecciona al menos un entrenador'
            });
        }
        const invalidCoach = coachIds.find((id) => !isObjectIdLike(id));
        if (invalidCoach) {
            return res.status(400).json({
                error: 'Entrenador inválido'
            });
        }

        let from = await Boxeador.findOne({
            email: fromEmail
        }).lean();
        if (!from) {
            from = await Entrenador.findOne({
                email: fromEmail
            }).lean();
        }
        if (!from) {
            return res.status(404).json({
                error: 'Perfil origen no encontrado'
            });
        }

        let to = await findBoxeadorByIdentifier(toIdentifier);
        if (!to) {
            to = await Entrenador.findOne({ email: toIdentifier }).lean() || await Entrenador.findById(toIdentifier).lean();
        }
        if (!to) {
            return res.status(404).json({
                error: 'Perfil destino no encontrado'
            });
        }

        if ((to.email || '').toString().trim().toLowerCase() === fromEmail) {
            return res.status(400).json({
                error: 'No puedes retarte a ti mismo'
            });
        }

        const coaches = await Entrenador.find({
            _id: {
                $in: coachIds
            }
        }).select('_id nombre email gimnasio ubicacion').lean();
        if (!coaches || coaches.length !== coachIds.length) {
            return res.status(400).json({
                error: 'No se pudieron cargar los entrenadores seleccionados'
            });
        }

        const id = crypto.randomUUID();
        const now = new Date().toISOString();

        const record = {
            id,
            fromEmail,
            fromNombre: from.nombre || '',
            toEmail: (to.email || '').toString().trim().toLowerCase(),
            toNombre: to.nombre || '',
            preset,
            rating,
            note,
            coachIds: coaches.map((c) => String(c._id)),
            coachNombres: coaches.map((c) => c.nombre || ''),
            coachEmails: coaches.map((c) => (c.email || '').toString().trim().toLowerCase()),
            gymName,
            scheduledAt: parsedDate.toISOString(),
            status: 'pending',
            createdAt: now,
            respondedAt: ''
        };

        if (await Boxeador.findOne({ email: fromEmail })) {
            await Boxeador.updateOne({
                email: fromEmail
            }, {
                $push: {
                    sparringChallengesSent: record
                }
            });
        } else {
            await Entrenador.updateOne({
                email: fromEmail
            }, {
                $push: {
                    sparringChallengesSent: record
                }
            });
        }

        if (await Boxeador.findOne({ email: record.toEmail })) {
            await Boxeador.updateOne({
                email: record.toEmail
            }, {
                $push: {
                    sparringChallengesReceived: record
                }
            });
        } else {
            await Entrenador.updateOne({
                email: record.toEmail
            }, {
                $push: {
                    sparringChallengesReceived: record
                }
            });
        }

        return res.status(201).json(record);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.post('/challenges/respond', async (req, res) => {
    try {
        const payload = req.body || {};
        const email = (payload.email || '').toString().trim().toLowerCase();
        const challengeId = (payload.challengeId || '').toString().trim();
        const action = (payload.action || '').toString().trim().toLowerCase();

        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }
        if (!challengeId) {
            return res.status(400).json({
                error: 'challengeId requerido'
            });
        }
        if (action !== 'accept' && action !== 'decline') {
            return res.status(400).json({
                error: 'Acción inválida'
            });
        }

        const recipient = await Boxeador.findOne({
            email
        }).lean();
        if (!recipient) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        const received = Array.isArray(recipient.sparringChallengesReceived) ? recipient.sparringChallengesReceived : [];
        const item = received.find((x) => x && String(x.id) === challengeId);
        if (!item) {
            return res.status(404).json({
                error: 'Reto no encontrado'
            });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'declined';
        const respondedAt = new Date().toISOString();

        await Boxeador.updateOne({
            email
        }, {
            $set: {
                'sparringChallengesReceived.$[elem].status': newStatus,
                'sparringChallengesReceived.$[elem].respondedAt': respondedAt
            }
        }, {
            arrayFilters: [{
                'elem.id': challengeId
            }]
        });

        const fromEmail = (item.fromEmail || '').toString().trim().toLowerCase();
        if (fromEmail) {
            await Boxeador.updateOne({
                email: fromEmail
            }, {
                $set: {
                    'sparringChallengesSent.$[elem].status': newStatus,
                    'sparringChallengesSent.$[elem].respondedAt': respondedAt
                }
            }, {
                arrayFilters: [{
                    'elem.id': challengeId
                }]
            });
        }

        if (action === 'accept') {
            const existingSessions = Array.isArray(recipient.sparringSessions) ? recipient.sparringSessions : [];
            const already = existingSessions.some((s) => s && String(s.challengeId) === challengeId);
            if (!already) {
                const sessionId = crypto.randomUUID();
                const now = new Date().toISOString();
                const session = {
                    id: sessionId,
                    challengeId,
                    boxerAEmail: (item.fromEmail || '').toString().trim().toLowerCase(),
                    boxerANombre: item.fromNombre || '',
                    boxerBEmail: (item.toEmail || '').toString().trim().toLowerCase(),
                    boxerBNombre: item.toNombre || '',
                    coachIds: Array.isArray(item.coachIds) ? item.coachIds : [],
                    coachNombres: Array.isArray(item.coachNombres) ? item.coachNombres : [],
                    coachEmails: Array.isArray(item.coachEmails) ? item.coachEmails : [],
                    gymName: item.gymName || '',
                    scheduledAt: item.scheduledAt || '',
                    status: 'scheduled',
                    createdAt: now,
                    completedAt: '',
                    reviews: []
                };

                await Boxeador.updateOne({
                    email
                }, {
                    $push: {
                        sparringSessions: session
                    }
                });

                if (fromEmail) {
                    await Boxeador.updateOne({
                        email: fromEmail
                    }, {
                        $push: {
                            sparringSessions: session
                        }
                    });
                }
            }
        }

        return res.json({
            ok: true,
            status: newStatus
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.get('/sessions', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }

        const item = await Boxeador.findOne({
            email
        }).lean();
        if (!item) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        const sessions = Array.isArray(item.sparringSessions) ? item.sparringSessions : [];
        sessions.sort((a, b) => String(b.scheduledAt || '').localeCompare(String(a.scheduledAt || '')));
        return res.json({
            sessions
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.post('/sessions/complete', async (req, res) => {
    try {
        const payload = req.body || {};
        const email = (payload.email || '').toString().trim().toLowerCase();
        const sessionId = (payload.sessionId || '').toString().trim();
        const stars = payload.stars === undefined || payload.stars === null ? null : Number(payload.stars);
        const tags = Array.isArray(payload.tags) ? payload.tags.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 8) : [];
        const note = (payload.note || '').toString().trim().slice(0, 500);

        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }
        if (!sessionId) {
            return res.status(400).json({
                error: 'sessionId requerido'
            });
        }
        if (!Number.isFinite(stars) || stars < 1 || stars > 5) {
            return res.status(400).json({
                error: 'Valoración inválida'
            });
        }

        const boxer = await Boxeador.findOne({
            email
        }).lean();
        if (!boxer) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        const sessions = Array.isArray(boxer.sparringSessions) ? boxer.sparringSessions : [];
        const session = sessions.find((s) => s && String(s.id) === sessionId);
        if (!session) {
            return res.status(404).json({
                error: 'Sesión no encontrada'
            });
        }

        const a = (session.boxerAEmail || '').toString().trim().toLowerCase();
        const b = (session.boxerBEmail || '').toString().trim().toLowerCase();
        const partnerEmail = email === a ? b : a;
        if (email !== a && email !== b) {
            return res.status(403).json({
                error: 'No autorizado'
            });
        }

        const now = new Date().toISOString();
        const review = {
            byEmail: email,
            stars,
            tags,
            note,
            createdAt: now
        };

        const updateOps = {
            $set: {
                'sparringSessions.$[elem].status': 'completed',
                'sparringSessions.$[elem].completedAt': now
            },
            $push: {
                'sparringSessions.$[elem].reviews': review
            }
        };

        await Boxeador.updateOne({
            email
        }, updateOps, {
            arrayFilters: [{
                'elem.id': sessionId
            }]
        });

        if (partnerEmail) {
            await Boxeador.updateOne({
                email: partnerEmail
            }, updateOps, {
                arrayFilters: [{
                    'elem.id': sessionId
                }]
            });
        }

        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.get('/me', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }

        const item = await Boxeador.findOne({
            email
        }).lean();

        if (!item) {
            return res.status(404).json({
                error: 'Perfil no encontrado'
            });
        }

        return res.json(item);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.put('/me', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }

        const payload = req.body || {};
        const update = {
            nombre: payload.nombre,
            alias: payload.alias || '',
            disciplina: payload.disciplina || '',
            peso: payload.peso || '',
            altura: payload.altura || '',
            edad: payload.edad || null,
            ubicacion: payload.ubicacion || '',
            bio: payload.bio || '',
            foto: payload.foto || '',
            sparringHistory: Array.isArray(payload.sparringHistory) ? payload.sparringHistory : []
        };

        const saved = await Boxeador.findOneAndUpdate({
            email
        }, {
            $setOnInsert: {
                email
            },
            $set: update
        }, {
            new: true,
            upsert: true
        }).lean();

        return res.json(saved);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const payload = req.body || {};
        const created = await Boxeador.create({
            nombre: payload.nombre,
            email: payload.email,
            nivel: payload.nivel,
            alias: payload.alias,
            disciplina: payload.disciplina,
            peso: payload.peso,
            ubicacion: payload.ubicacion,
            boxrecId: payload.boxrecId,
            foto: payload.foto,
            record: payload.record,
            altura: payload.altura,
            alcance: payload.alcance,
            usuarioId: payload.usuarioId,
            edad: payload.edad,
            bio: payload.bio,
            sparringHistory: payload.sparringHistory || []
        });
        const safeDoc = created.toObject();
        delete safeDoc.password;
        res.status(201).json(safeDoc);
    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

export default router;
