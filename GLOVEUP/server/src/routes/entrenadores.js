import { Router } from 'express';
import crypto from 'crypto';
import Entrenador from '../models/Entrenador.js';
import Boxeador from '../models/Boxeador.js';
import Usuario from '../models/Usuario.js';
import { crearNotificacion } from './notificaciones.js';

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

router.get('/me/challenges-for-boxers', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const boxers = await Boxeador.find({
            entrenadorId: coach._id
        }).select('nombre email sparringChallengesReceived sparringChallengesSent sparringSessions').lean();

        let activity = [];
        for (const b of boxers) {
            // 1. Recibidos
            const received = Array.isArray(b.sparringChallengesReceived) ? b.sparringChallengesReceived : [];
            for (const c of received) {
                const challenger = await Boxeador.findOne({ email: c.fromEmail }).select('nombre nivel peso foto').lean();
                activity.push({
                    ...c,
                    direction: 'inbound',
                    type: 'challenge',
                    boxerName: b.nombre || '',
                    boxerEmail: b.email || '',
                    boxerNivel: b.nivel || 'Amateur',
                    boxerPeso: b.peso || '',
                    boxerFoto: b.foto || '',
                    otherName: challenger ? challenger.nombre : (c.fromNombre || 'Boxeador'),
                    otherNivel: challenger ? challenger.nivel : 'Amateur',
                    otherPeso: challenger ? challenger.peso : '',
                    otherFoto: challenger ? challenger.foto : ''
                });
            }

            // 2. Enviados
            const sent = Array.isArray(b.sparringChallengesSent) ? b.sparringChallengesSent : [];
            for (const c of sent) {
                const recipient = await Boxeador.findOne({ email: c.toEmail }).select('nombre nivel peso foto').lean();
                activity.push({
                    ...c,
                    direction: 'outbound',
                    type: 'challenge',
                    boxerName: b.nombre || '',
                    boxerEmail: b.email || '',
                    boxerNivel: b.nivel || 'Amateur',
                    boxerPeso: b.peso || '',
                    boxerFoto: b.foto || '',
                    otherName: recipient ? recipient.nombre : (c.toNombre || 'Boxeador'),
                    otherEmail: c.toEmail,
                    otherNivel: recipient ? recipient.nivel : 'Amateur',
                    otherPeso: recipient ? recipient.peso : '',
                    otherFoto: recipient ? recipient.foto : ''
                });
            }

            // 3. Confirmados (Sesiones)
            const sessions = Array.isArray(b.sparringSessions) ? b.sparringSessions : [];
            for (const s of sessions) {
                const otherEmail = s.boxerA_email === b.email ? s.boxerB_email : s.boxerA_email;
                const other = await Boxeador.findOne({ email: otherEmail }).select('nombre nivel peso foto').lean();
                activity.push({
                    id: s.id || s._id,
                    status: 'accepted',
                    direction: s.boxerA_email === b.email ? 'outbound' : 'inbound',
                    type: 'session',
                    preset: s.preset,
                    scheduledAt: s.scheduledAt,
                    gymName: s.gymName,
                    note: s.note,
                    boxerName: b.nombre || '',
                    boxerEmail: b.email || '',
                    boxerNivel: b.nivel || 'Amateur',
                    boxerPeso: b.peso || '',
                    boxerFoto: b.foto || '',
                    otherName: other ? other.nombre : 'Boxeador',
                    otherEmail: otherEmail,
                    otherNivel: other ? other.nivel : 'Amateur',
                    otherPeso: other ? other.peso : '',
                    otherFoto: other ? other.foto : ''
                });
            }
        }

        // Eliminar duplicados si una sesión aparece en ambos boxeadores (aunque aquí buscamos por boxeadores del entrenador)
        const uniqueActivity = [];
        const seenIds = new Set();
        for (const item of activity) {
            const uid = `${item.type}-${item.id}`;
            if (!seenIds.has(uid)) {
                seenIds.add(uid);
                uniqueActivity.push(item);
            }
        }

        uniqueActivity.sort((a, b) => String(b.scheduledAt || b.createdAt || '').localeCompare(String(a.scheduledAt || a.createdAt || '')));

        return res.json(uniqueActivity);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
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
        const nuevoEmail = (payload.nuevoEmail || '').toString().trim().toLowerCase();

        let emailToSave = coach.email;
        if (nuevoEmail && nuevoEmail !== coach.email) {
            const existingUser = await Usuario.findOne({ email: nuevoEmail }).lean();
            if (existingUser) {
                return res.status(400).json({ error: 'El nuevo email ya está en uso' });
            }
            // Actualizar en la colección principal de usuarios
            await Usuario.updateOne({ email: coach.email }, { $set: { email: nuevoEmail } });
            emailToSave = nuevoEmail;
        }

        const precioMensual = payload.precioMensual === undefined ? coach.precioMensual : Number(payload.precioMensual);
        const safePrecio = Number.isFinite(precioMensual) && precioMensual >= 0 ? precioMensual : 0;
        const update = {
            nombre: payload.nombre === undefined ? coach.nombre : payload.nombre,
            especialidad: payload.especialidad === undefined ? coach.especialidad : (payload.especialidad || 'Boxeo'),
            gimnasio: payload.gimnasio === undefined ? (coach.gimnasio || '') : (payload.gimnasio || ''),
            precioMensual: safePrecio,
            ubicacion: payload.ubicacion === undefined ? (coach.ubicacion || '') : (payload.ubicacion || ''),
            genero: payload.genero === undefined ? (coach.genero || 'Masculino') : payload.genero,
            foto: payload.foto === undefined ? (coach.foto || '') : (payload.foto || '')
        };

        if (emailToSave !== coach.email) {
            update.email = emailToSave;
        }

        const oldGym = coach.gimnasio;
        coach.set(update);
        await coach.save();

        // Si el gimnasio cambió, actualizarlo en todos sus boxeadores
        if (update.gimnasio !== undefined && update.gimnasio !== oldGym) {
            await Boxeador.updateMany(
                { entrenadorId: coach._id },
                { $set: { gimnasio: update.gimnasio || '' } }
            );
        }

        return res.json(coach.toObject());
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ──────── Calendar Events CRUD ────────

// GET  /me/calendar-events  — lista los eventos personalizados del entrenador
router.get('/me/calendar-events', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        return res.json(Array.isArray(coach.calendarEvents) ? coach.calendarEvents : []);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// POST /me/calendar-events  — crear evento
router.post('/me/calendar-events', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const { title, start, end, allDay, color, tipo, notas } = req.body || {};
        if (!title || !start) {
            return res.status(400).json({ error: 'Titulo y fecha de inicio son obligatorios.' });
        }
        const ev = { title, start, end: end || '', allDay: allDay !== false, color: color || '#3b82f6', tipo: tipo || 'personalizado', notas: notas || '' };
        coach.calendarEvents.push(ev);
        await coach.save();
        const created = coach.calendarEvents[coach.calendarEvents.length - 1];
        return res.status(201).json(created);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// PUT /me/calendar-events/:eventId  — editar evento
router.put('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const ev = coach.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Evento no encontrado.' });
        const { title, start, end, allDay, color, tipo, notas } = req.body || {};
        if (title !== undefined) ev.title = title;
        if (start !== undefined) ev.start = start;
        if (end !== undefined) ev.end = end;
        if (allDay !== undefined) ev.allDay = allDay;
        if (color !== undefined) ev.color = color;
        if (tipo !== undefined) ev.tipo = tipo;
        if (notas !== undefined) ev.notas = notas;
        await coach.save();
        return res.json(ev);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// DELETE /me/calendar-events/:eventId  — eliminar evento
router.delete('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const ev = coach.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Evento no encontrado.' });
        ev.deleteOne();
        await coach.save();
        return res.json({ ok: true });
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
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
        if (coach.gimnasio) boxer.gimnasio = coach.gimnasio;
        boxer.fechaInscripcion = new Date();
        await boxer.save();

        // Notificación al boxeador
        await crearNotificacion({
            para: boxer.email,
            tipo: 'gimnasio',
            titulo: `Te han añadido al gimnasio ${coach.gimnasio || 'de un entrenador'}`,
            cuerpo: `El entrenador ${coach.nombre || coach.email} te ha inscrito en su gimnasio.`,
            de: coach.email
        });

        // Notificación al entrenador (confirmación)
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `✅ Boxeador añadido: ${boxer.nombre || boxer.email}`,
            cuerpo: `${boxer.nombre || boxer.email} ha sido inscrito en tu gimnasio.`,
            de: boxer.email
        });

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

        // Notificación al entrenador
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `❌ Boxeador eliminado del gimnasio: ${boxer.nombre || boxer.email}`,
            cuerpo: `${boxer.nombre || boxer.email} ha sido dado de baja de tu gimnasio.`,
            de: coach.email
        });
        // Notificar también al boxeador
        await crearNotificacion({
            para: boxer.email,
            tipo: 'gimnasio',
            titulo: 'Has sido dado de baja del gimnasio',
            cuerpo: `El entrenador ${coach.nombre || coach.email} te ha dado de baja.`,
            de: coach.email
        });

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

        // Notificación al entrenador (confirmación de creación)
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `✅ Cuenta creada para ${nombre}`,
            cuerpo: `El boxeador ${nombre} ha sido registrado y añadido a tu gimnasio.`,
            de: coach.email
        });
        // Notificación al nuevo boxeador
        await crearNotificacion({
            para: email,
            tipo: 'gimnasio',
            titulo: `Bienvenido/a a GloveUp, ${nombre}!`,
            cuerpo: `Tu cuenta ha sido creada por ${coach.nombre || coach.email}. ¡Ya formas parte del gimnasio!`,
            de: coach.email
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
                await Usuario.updateOne({ _id: boxer.usuarioId }, { $set: updateUser });
            }
        }

        // Notificación al entrenador (confirmación de edición)
        await crearNotificacion({
            para: coach.email,
            tipo: 'general',
            titulo: `✏️ Perfil de ${boxer.nombre || boxer.email} actualizado`,
            cuerpo: `Has guardado los cambios del boxeador ${boxer.nombre || boxer.email}.`,
            de: coach.email
        });

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

        const boxerName = boxer.nombre || boxer.email;
        const usuarioId = boxer.usuarioId;
        await Boxeador.deleteOne({ _id: boxer._id });
        if (usuarioId) {
            await Usuario.deleteOne({ _id: usuarioId });
        }

        // Notificación al entrenador
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `🗑️ Boxeador eliminado: ${boxerName}`,
            cuerpo: `La cuenta de ${boxerName} ha sido eliminada del sistema.`,
            de: coach.email
        });

        return res.json({ ok: true });
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

router.post('/me/challenges/respond', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const { challengeId, action } = req.body || {};

        if (!challengeId) return res.status(400).json({ error: 'challengeId requerido' });
        if (action !== 'accept' && action !== 'decline') return res.status(400).json({ error: 'Acción inválida: usa "accept" o "decline"' });

        const coachEmail = coach.email.toLowerCase();

        // Search all of this coach's boxers for the challenge
        const myBoxers = await Boxeador.find({ entrenadorId: coach._id }).lean();
        let foundChallenge = null;
        let isToCoach = false; // True if this is the coach of the challenged (recipient) boxer

        for (const boxer of myBoxers) {
            const received = Array.isArray(boxer.sparringChallengesReceived) ? boxer.sparringChallengesReceived : [];
            const c = received.find(x => x && String(x.id) === challengeId);
            if (c) { foundChallenge = c; isToCoach = true; break; }

            const sent = Array.isArray(boxer.sparringChallengesSent) ? boxer.sparringChallengesSent : [];
            const s = sent.find(x => x && String(x.id) === challengeId);
            if (s) { foundChallenge = s; isToCoach = false; break; }
        }

        if (!foundChallenge) {
            return res.status(404).json({ error: 'Reto no encontrado en los boxeadores bajo tu supervisión' });
        }

        const curStatus = String(foundChallenge.status || 'pending');

        // Compatibilidad con retos antiguos: 'pending' se trata como 'pending_coach_to'
        const effectiveStatus = curStatus === 'pending' ? 'pending_coach_to' : curStatus;

        // Validar que este entrenador no haya respondido ya
        if (isToCoach && foundChallenge.coachToApproval !== null) {
            return res.status(400).json({ error: 'Ya has respondido a este reto como el entrenador del retado.' });
        }
        if (!isToCoach && foundChallenge.coachFromApproval !== null) {
            return res.status(400).json({ error: 'Ya has respondido a este reto como el entrenador del retador.' });
        }
        if (curStatus === 'accepted') return res.status(400).json({ error: 'Este sparring ya está confirmado.' });
        if (curStatus === 'declined') return res.status(400).json({ error: 'Este reto ya ha sido rechazado.' });

        const fromEmail = (foundChallenge.fromEmail || '').toLowerCase();
        const toEmail = (foundChallenge.toEmail || '').toLowerCase();
        const respondedAt = new Date().toISOString();
        const coachApprovalField = isToCoach ? 'coachToApproval' : 'coachFromApproval';
        const approvalValue = action === 'accept';

        // Determinar el siguiente estado
        let newStatus;
        if (action === 'decline') {
            newStatus = 'declined';
        } else {
            const nextTo = isToCoach ? true : !!foundChallenge.coachToApproval;
            const nextFrom = !isToCoach ? true : !!foundChallenge.coachFromApproval;

            if (nextTo && nextFrom) {
                newStatus = 'accepted';
            } else if (!nextTo) {
                newStatus = 'pending_coach_to';
            } else {
                newStatus = 'pending_coach_from';
            }
        }

        // Update the challenge in ALL boxer documents (both received and sent arrays)
        await Boxeador.updateMany(
            { 'sparringChallengesReceived.id': challengeId },
            { $set: {
                [`sparringChallengesReceived.$[elem].${coachApprovalField}`]: approvalValue,
                'sparringChallengesReceived.$[elem].status': newStatus,
                'sparringChallengesReceived.$[elem].respondedAt': respondedAt
            }},
            { arrayFilters: [{ 'elem.id': challengeId }] }
        );
        await Boxeador.updateMany(
            { 'sparringChallengesSent.id': challengeId },
            { $set: {
                [`sparringChallengesSent.$[elem].${coachApprovalField}`]: approvalValue,
                'sparringChallengesSent.$[elem].status': newStatus,
                'sparringChallengesSent.$[elem].respondedAt': respondedAt
            }},
            { arrayFilters: [{ 'elem.id': challengeId }] }
        );

        // Handle outcomes
        if (newStatus === 'accepted') {
            // Both coaches approved -> create sparring session
            const sessionId = crypto.randomUUID();
            const now = new Date().toISOString();
            const session = {
                id: sessionId,
                challengeId,
                boxerAEmail: fromEmail,
                boxerANombre: foundChallenge.fromNombre || '',
                boxerBEmail: toEmail,
                boxerBNombre: foundChallenge.toNombre || '',
                coachIds: Array.isArray(foundChallenge.coachIds) ? foundChallenge.coachIds : [],
                coachNombres: Array.isArray(foundChallenge.coachNombres) ? foundChallenge.coachNombres : [],
                coachEmails: Array.isArray(foundChallenge.coachEmails) ? foundChallenge.coachEmails : [],
                gymName: foundChallenge.gymName || '',
                scheduledAt: foundChallenge.scheduledAt || '',
                preset: foundChallenge.preset || '',
                note: foundChallenge.note || '',
                status: 'scheduled',
                createdAt: now,
                completedAt: '',
                reviews: []
            };

            for (const bEmail of [fromEmail, toEmail]) {
                if (!bEmail) continue;
                const bx = await Boxeador.findOne({ email: bEmail }).lean();
                if (!bx) continue;
                const alreadyHas = (Array.isArray(bx.sparringSessions) ? bx.sparringSessions : []).some(s => String(s.challengeId) === challengeId);
                if (!alreadyHas) {
                    await Boxeador.updateOne({ email: bEmail }, { $push: { sparringSessions: session } });
                }
            }

            // Notify both boxers
            await crearNotificacion({ para: fromEmail, tipo: 'sparring', titulo: 'Sparring Confirmado', cuerpo: `Tu sparring con ${foundChallenge.toNombre} ha sido aprobado por ambos entrenadores.`, de: toEmail });
            await crearNotificacion({ para: toEmail, tipo: 'sparring', titulo: 'Sparring Confirmado', cuerpo: `Tu sparring con ${foundChallenge.fromNombre} ha sido aprobado por ambos entrenadores.`, de: fromEmail });

        } else if (newStatus === 'pending_coach_from') {
            // Notify the challenger's coach that it's their turn
            const coachFromEmail = (foundChallenge.coachFromEmail || '');
            if (coachFromEmail) {
                await crearNotificacion({ para: coachFromEmail, tipo: 'sparring', titulo: 'Confirma el sparring de tu boxeador', cuerpo: `El entrenador rival ha aprobado. Necesitas confirmar el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}.`, de: coachEmail });
            }
        } else if (newStatus === 'declined') {
            // Notify both boxers of the rejection
            await crearNotificacion({ para: fromEmail, tipo: 'sparring', titulo: 'Sparring Rechazado', cuerpo: `Un entrenador ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`, de: coachEmail });
            await crearNotificacion({ para: toEmail, tipo: 'sparring', titulo: 'Sparring Rechazado', cuerpo: `Un entrenador ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`, de: coachEmail });
            // Notify the other coach too
            const otherCoachEmail = isToCoach ? (foundChallenge.coachFromEmail || '') : (foundChallenge.coachToEmail || '');
            if (otherCoachEmail && otherCoachEmail !== coachEmail) {
                await crearNotificacion({ para: otherCoachEmail, tipo: 'sparring', titulo: 'Sparring Cancelado', cuerpo: `El entrenador rival ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`, de: coachEmail });
            }
        }

        return res.json({ ok: true, status: newStatus });
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

export default router;
