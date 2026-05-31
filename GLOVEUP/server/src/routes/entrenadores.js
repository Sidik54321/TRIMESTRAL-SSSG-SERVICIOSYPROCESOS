/**
 * routes/entrenadores.js — Rutas del recurso Entrenador
 *
 * Gestiona todas las operaciones relacionadas con los entrenadores:
 * su perfil, sus boxeadores, el sistema de aprobación de retos de sparring,
 * el registro de pagos y sus eventos de calendario.
 * Prefijo de montaje: /api/entrenadores
 *
 * Endpoints principales:
 *  GET    /                              → Listar todos los entrenadores
 *  GET    /me?email=X                   → Obtener perfil del entrenador autenticado
 *  PUT    /me?email=X                   → Actualizar perfil del entrenador
 *  POST   /me/leave-gym?email=X         → Abandonar el gimnasio actual
 *  POST   /                             → Crear entrenador (uso interno/admin)
 *
 *  GET    /me/boxeadores?email=X        → Listar boxeadores del entrenador
 *  POST   /me/boxeadores?email=X        → Inscribir boxeador existente en el gimnasio
 *  POST   /me/boxeadores/create?email=X → Crear nuevo boxeador y usuario desde el panel del entrenador
 *  PUT    /me/boxeadores/:id?email=X    → Editar datos de un boxeador del entrenador
 *  DELETE /me/boxeadores?email=X        → Dar de baja boxeador del gimnasio (desasociar)
 *  DELETE /me/boxeadores/:id?email=X   → Eliminar boxeador y su cuenta de usuario
 *
 *  POST   /me/boxeadores/:id/pago?email=X   → Registrar pago mensual de un boxeador
 *  DELETE /me/boxeadores/:id/pago?email=X   → Anular pago mensual de un boxeador
 *
 *  GET    /me/metricas?email=X          → Estadísticas del gimnasio (boxeadores, ingresos…)
 *  GET    /me/cobros?email=X            → (Stub) historial de cobros
 *
 *  GET    /me/challenges-for-boxers?email=X → Actividad de retos de todos sus boxeadores
 *  POST   /me/challenges/respond?email=X    → Aprobar o rechazar un reto de sparring
 *  POST   /me/challenges/complete?email=X   → Marcar un reto como completado y valorarlo
 *
 *  GET|POST|PUT|DELETE /me/calendar-events  → CRUD de eventos de calendario del entrenador
 *
 * Seguridad:
 *  - requireCoachByEmail() verifica en cada endpoint protegido que el email
 *    corresponde a un Usuario con rol "entrenador". Sin JWT, el email del
 *    query string actúa como token de sesión (validado contra la BD).
 */

import {
    Router
} from 'express';
import crypto from 'crypto';
import Entrenador from '../models/Entrenador.js';
import Boxeador from '../models/Boxeador.js';
import Usuario from '../models/Usuario.js';
import {
    crearNotificacion
} from './notificaciones.js';

const router = Router();

// Normaliza un valor a email en minúsculas y sin espacios
const normalizeEmail = (value) => (value || '').toString().trim().toLowerCase();

// ─── Helper de autenticación ───────────────────────────────────────────────
/**
 * Verifica que el email recibido pertenece a un usuario con rol "entrenador"
 * y que existe un documento Entrenador asociado.
 * Lanza errores con propiedad "status" para que el catch del endpoint
 * devuelva el código HTTP correcto.
 *
 * @param {string} email - Email del entrenador (obtenido del query string)
 * @returns {Promise<mongoose.Document>} Documento Entrenador de Mongoose
 */
async function requireCoachByEmail(email) {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) {
        const err = new Error('Email requerido');
        err.status = 400;
        throw err;
    }

    // Verificar que el usuario existe y tiene el rol correcto
    const user = await Usuario.findOne({
        email: cleanEmail
    }).select('rol email').lean();

    if (!user || user.rol !== 'entrenador') {
        const err = new Error('No autorizado');
        err.status = 403;
        throw err;
    }

    // Obtener el documento Entrenador (con todos sus campos, no .lean() para poder .save())
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

// ─── GET / ─────────────────────────────────────────────────────────────────
// Devuelve todos los entrenadores (usado por el frontend para listar candidatos de retos)
router.get('/', async (req, res) => {
    const items = await Entrenador.find().lean();
    res.json(items);
});

// ─── GET /me/challenges-for-boxers ─────────────────────────────────────────
// Devuelve toda la actividad de sparring (retos enviados, recibidos y sesiones)
// de TODOS los boxeadores bajo la supervisión de este entrenador.
// Los duplicados se eliminan por ID para evitar mostrar el mismo evento dos veces.
router.get('/me/challenges-for-boxers', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        // Buscar todos los boxeadores asignados a este entrenador
        const boxers = await Boxeador.find({
            entrenadorId: coach._id
        }).select('nombre email sparringChallengesReceived sparringChallengesSent sparringSessions').lean();

        let activity = [];
        for (const b of boxers) {
            // 1. Retos recibidos por este boxeador
            const received = Array.isArray(b.sparringChallengesReceived) ? b.sparringChallengesReceived : [];
            for (const c of received) {
                // Enriquecer con datos del boxeador retador para mostrarlos en el panel
                const challenger = await Boxeador.findOne({
                    email: c.fromEmail
                }).select('nombre nivel peso foto').lean();
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

            // 2. Retos enviados por este boxeador
            const sent = Array.isArray(b.sparringChallengesSent) ? b.sparringChallengesSent : [];
            for (const c of sent) {
                const recipient = await Boxeador.findOne({
                    email: c.toEmail
                }).select('nombre nivel peso foto').lean();
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

            // 3. Sesiones de sparring confirmadas
            const sessions = Array.isArray(b.sparringSessions) ? b.sparringSessions : [];
            for (const s of sessions) {
                const otherEmail = s.boxerA_email === b.email ? s.boxerB_email : s.boxerA_email;
                const other = await Boxeador.findOne({
                    email: otherEmail
                }).select('nombre nivel peso foto').lean();
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

        // Eliminar duplicados si un reto/sesión aparece en más de un boxeador del mismo entrenador
        const uniqueActivity = [];
        const seenIds = new Set();
        for (const item of activity) {
            const uid = `${item.type}-${item.id}`;
            if (!seenIds.has(uid)) {
                seenIds.add(uid);
                uniqueActivity.push(item);
            }
        }

        // Ordenar por fecha programada o de creación (más recientes primero)
        uniqueActivity.sort((a, b) => String(b.scheduledAt || b.createdAt || '').localeCompare(String(a.scheduledAt || a.createdAt || '')));

        return res.json(uniqueActivity);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── GET /me ───────────────────────────────────────────────────────────────
// Devuelve el perfil completo del entrenador autenticado
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

// ─── PUT /me ───────────────────────────────────────────────────────────────
// Actualiza el perfil del entrenador.
// Si el gimnasio cambia, se propaga el nuevo nombre a todos sus boxeadores.
// Si el email cambia, se actualiza también en la colección "usuarios".
router.put('/me', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const payload = req.body || {};
        const nuevoEmail = (payload.nuevoEmail || '').toString().trim().toLowerCase();

        let emailToSave = coach.email;
        if (nuevoEmail && nuevoEmail !== coach.email) {
            // Verificar que el nuevo email no está ya en uso
            const existingUser = await Usuario.findOne({
                email: nuevoEmail
            }).lean();
            if (existingUser) {
                return res.status(400).json({
                    error: 'El nuevo email ya está en uso'
                });
            }
            // Actualizar el email en la colección principal de usuarios
            await Usuario.updateOne({
                email: coach.email
            }, {
                $set: {
                    email: nuevoEmail
                }
            });
            emailToSave = nuevoEmail;
        }

        // Sanitizar el precio mensual: si no es un número finito y positivo, usar 0
        const precioMensual = payload.precioMensual === undefined ? coach.precioMensual : Number(payload.precioMensual);
        const safePrecio = Number.isFinite(precioMensual) && precioMensual >= 0 ? precioMensual : 0;

        // Construir el objeto de actualización preservando los valores actuales si no vienen en el body
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

        const oldGym = coach.gimnasio; // Guardar el nombre anterior del gimnasio para comparación
        coach.set(update);
        await coach.save();

        // Si el nombre del gimnasio cambió, actualizar el campo "gimnasio" en todos sus boxeadores
        if (update.gimnasio !== undefined && update.gimnasio !== oldGym) {
            await Boxeador.updateMany({
                entrenadorId: coach._id
            }, {
                $set: {
                    gimnasio: update.gimnasio || ''
                }
            });
        }

        return res.json(coach.toObject());
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── POST /me/leave-gym ────────────────────────────────────────────────────
// El entrenador abandona su gimnasio (limpia el campo gimnasio de su perfil).
router.post('/me/leave-gym', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        if (!coach.gimnasio) return res.status(400).json({
            error: 'No perteneces a ningún gimnasio'
        });

        coach.gimnasio = '';
        await coach.save();

        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ──────── Calendar Events CRUD ────────────────────────────────────────────

// GET /me/calendar-events — lista los eventos personalizados del entrenador
router.get('/me/calendar-events', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        return res.json(Array.isArray(coach.calendarEvents) ? coach.calendarEvents : []);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// POST /me/calendar-events — crear evento de calendario para el entrenador
router.post('/me/calendar-events', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const {
            title,
            start,
            end,
            allDay,
            color,
            tipo,
            notas
        } = req.body || {};
        if (!title || !start) {
            return res.status(400).json({
                error: 'Titulo y fecha de inicio son obligatorios.'
            });
        }
        const ev = {
            title,
            start,
            end: end || '',
            allDay: allDay !== false,
            color: color || '#3b82f6', // Azul por defecto para entrenadores
            tipo: tipo || 'personalizado',
            notas: notas || ''
        };
        coach.calendarEvents.push(ev);
        await coach.save();
        // Devolver el evento creado (último elemento del array tras el push)
        const created = coach.calendarEvents[coach.calendarEvents.length - 1];
        return res.status(201).json(created);
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// PUT /me/calendar-events/:eventId — editar evento de calendario (patch parcial)
router.put('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const ev = coach.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({
            error: 'Evento no encontrado.'
        });
        const {
            title,
            start,
            end,
            allDay,
            color,
            tipo,
            notas
        } = req.body || {};
        // Solo actualizar los campos que lleguen en el body
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
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// DELETE /me/calendar-events/:eventId — eliminar evento de calendario
router.delete('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const ev = coach.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({
            error: 'Evento no encontrado.'
        });
        ev.deleteOne(); // Eliminar el subdocumento del array de Mongoose
        await coach.save();
        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── GET /me/metricas ──────────────────────────────────────────────────────
// Devuelve estadísticas del gimnasio del entrenador:
//  - Número de boxeadores activos
//  - Nuevas inscripciones en el mes actual
//  - Pagos registrados en el mes actual e ingresos estimados
router.get('/me/metricas', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        // Calcular los límites del mes actual (primer y último día)
        const start = new Date();
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);

        // Total de boxeadores activos (asignados a este entrenador)
        const boxeadoresActivos = await Boxeador.countDocuments({
            entrenadorId: coach._id
        });

        // Inscripciones nuevas en el mes actual (por fechaInscripcion o createdAt si no hay fecha)
        const inscripcionesMes = await Boxeador.countDocuments({
            entrenadorId: coach._id,
            $or: [{
                    fechaInscripcion: {
                        $gte: start,
                        $lt: end
                    }
                },
                {
                    // Boxeadores sin fechaInscripcion explícita: usar fecha de creación del documento
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

        // Calcular ingresos del mes: nº de boxeadores que han pagado × precio mensual
        const precioMensual = Number.isFinite(Number(coach.precioMensual)) ? Number(coach.precioMensual) : 0;
        const mesPago = new Date().toISOString().slice(0, 7); // Formato "YYYY-MM"
        const pagosMes = await Boxeador.countDocuments({
            entrenadorId: coach._id,
            'pagos.mes': mesPago
        });
        const ingresosMes = precioMensual * pagosMes;

        return res.json({
            gimnasio: coach.gimnasio || '',
            precioMensual,
            boxeadoresActivos,
            inscripcionesMes,
            pagosMes,
            ingresosMes
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── GET /me/boxeadores ────────────────────────────────────────────────────
// Devuelve la lista de boxeadores inscritos en el gimnasio del entrenador
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

// ─── POST /me/boxeadores ───────────────────────────────────────────────────
// Inscribe un boxeador existente en el gimnasio del entrenador.
// El boxeador se busca por email o DNI/Licencia.
// Se actualiza entrenadorId, gimnasio y fechaInscripcion del boxeador.
router.post('/me/boxeadores', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        // El identificador puede ser un email o un DNI/Licencia
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

        // Asignar el entrenador y copiar el gimnasio al perfil del boxeador
        boxer.entrenadorId = coach._id;
        if (coach.gimnasio) boxer.gimnasio = coach.gimnasio;
        boxer.fechaInscripcion = new Date();
        await boxer.save();

        // Notificar al boxeador de su nueva inscripción
        await crearNotificacion({
            para: boxer.email,
            tipo: 'gimnasio',
            titulo: `Te han añadido al gimnasio ${coach.gimnasio || 'de un entrenador'}`,
            cuerpo: `El entrenador ${coach.nombre || coach.email} te ha inscrito en su gimnasio.`,
            de: coach.email
        });

        // Confirmar al entrenador que la inscripción fue exitosa
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

// ─── DELETE /me/boxeadores ────────────────────────────────────────────────
// Desasocia un boxeador del gimnasio del entrenador (baja) sin eliminar su cuenta.
// Solo puede hacerlo el entrenador que tiene asignado a ese boxeador.
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

        // Verificar que el boxeador está asignado a ESTE entrenador (no a otro)
        if (!boxer.entrenadorId || String(boxer.entrenadorId) !== String(coach._id)) {
            return res.status(409).json({
                error: 'Este boxeador no está asociado a tu cuenta'
            });
        }

        // Limpiar la asociación sin borrar el documento del boxeador
        boxer.entrenadorId = undefined;
        boxer.gimnasio = '';
        boxer.fechaInscripcion = undefined;
        await boxer.save();

        // Notificar al entrenador de la baja
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `❌ Boxeador eliminado del gimnasio: ${boxer.nombre || boxer.email}`,
            cuerpo: `${boxer.nombre || boxer.email} ha sido dado de baja de tu gimnasio.`,
            de: coach.email
        });
        // Notificar al boxeador que ha sido dado de baja
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

// ─── POST /me/boxeadores/create ────────────────────────────────────────────
// Crea una cuenta completa de boxeador directamente desde el panel del entrenador.
// Genera tanto el documento Usuario (credenciales) como el Boxeador (perfil)
// y lo inscribe automáticamente en el gimnasio del entrenador.
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

        // Comprobar duplicados antes de crear nada
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
                error: 'Ese DNI ya existe'
            });
        }

        // Cifrar el DNI para guardarlo en la colección de usuarios (igual que en el registro normal)
        const {
            encrypt
        } = await import('../utils/crypto.js');
        const encryptedDni = encrypt(dniLicencia);

        // Crear las credenciales de acceso (la contraseña se hasheará en el pre-save)
        const usuario = await Usuario.create({
            nombre,
            email,
            password,
            rol: 'boxeador',
            dniLicencia: encryptedDni
        });

        // Crear el perfil deportivo e inscribirlo en el gimnasio del entrenador
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

        // Confirmar al entrenador la creación de la cuenta
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `✅ Cuenta creada para ${nombre}`,
            cuerpo: `El boxeador ${nombre} ha sido registrado y añadido a tu gimnasio.`,
            de: coach.email
        });
        // Dar la bienvenida al nuevo boxeador
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

// ─── PUT /me/boxeadores/:id ────────────────────────────────────────────────
// Edita datos básicos de un boxeador del gimnasio.
// Solo puede editar el entrenador que tiene asignado a ese boxeador.
// Si hay usuarioId, sincroniza los cambios también en la colección "usuarios".
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
        // Verificar que el boxeador pertenece a este entrenador
        if (!boxer.entrenadorId || String(boxer.entrenadorId) !== String(coach._id)) {
            return res.status(403).json({
                error: 'No autorizado'
            });
        }

        // Actualizar solo los campos presentes en el body
        const payload = req.body || {};
        if (payload.nombre !== undefined) boxer.nombre = String(payload.nombre || '').trim();
        if (payload.nivel !== undefined) boxer.nivel = String(payload.nivel || '').trim() || boxer.nivel;
        if (payload.disciplina !== undefined) boxer.disciplina = String(payload.disciplina || '').trim() || boxer.disciplina;
        if (payload.dniLicencia !== undefined) boxer.dniLicencia = String(payload.dniLicencia || '').trim().toUpperCase();
        if (payload.email !== undefined) boxer.email = normalizeEmail(payload.email);

        await boxer.save();

        // Sincronizar cambios en la colección de usuarios si el boxeador tiene cuenta
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

        // Confirmar al entrenador que los cambios se guardaron
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

// ─── POST /me/boxeadores/:id/pago ──────────────────────────────────────────
// Registra el pago mensual de un boxeador para el mes en curso.
// Evita registrar dos pagos para el mismo mes (idempotencia).
router.post('/me/boxeadores/:id/pago', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const boxer = await Boxeador.findById(req.params.id);
        if (!boxer) return res.status(404).json({
            error: 'Boxeador no encontrado'
        });
        if (String(boxer.entrenadorId) !== String(coach._id)) return res.status(403).json({
            error: 'No autorizado'
        });

        const mes = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        if (!Array.isArray(boxer.pagos)) boxer.pagos = [];
        // Verificar que no se ha registrado ya un pago para este mes
        if (boxer.pagos.some(p => p.mes === mes)) {
            return res.status(409).json({
                error: 'El boxeador ya ha pagado este mes'
            });
        }

        // El monto se toma del precio mensual configurado por el entrenador
        const monto = Number(coach.precioMensual) || 0;
        boxer.pagos.push({
            mes,
            monto,
            fecha: new Date()
        });
        await boxer.save();
        return res.json({
            ok: true,
            mes,
            monto
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── DELETE /me/boxeadores/:id/pago ───────────────────────────────────────
// Anula el pago registrado del mes en curso para un boxeador.
router.delete('/me/boxeadores/:id/pago', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const boxer = await Boxeador.findById(req.params.id);
        if (!boxer) return res.status(404).json({
            error: 'Boxeador no encontrado'
        });
        if (String(boxer.entrenadorId) !== String(coach._id)) return res.status(403).json({
            error: 'No autorizado'
        });

        const mes = new Date().toISOString().slice(0, 7); // "YYYY-MM"
        // Filtrar el array eliminando el pago del mes actual
        boxer.pagos = (boxer.pagos || []).filter(p => p.mes !== mes);
        await boxer.save();
        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── DELETE /me/boxeadores/:id ────────────────────────────────────────────
// Elimina permanentemente un boxeador y su cuenta de usuario del sistema.
// Solo puede hacerlo el entrenador que tiene asignado a ese boxeador.
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

        // Eliminar el documento del boxeador
        await Boxeador.deleteOne({
            _id: boxer._id
        });
        // Si tenía cuenta de usuario, eliminarla también para no dejar huérfanos
        if (usuarioId) {
            await Usuario.deleteOne({
                _id: usuarioId
            });
        }

        // Confirmar al entrenador la eliminación
        await crearNotificacion({
            para: coach.email,
            tipo: 'gimnasio',
            titulo: `🗑️ Boxeador eliminado: ${boxerName}`,
            cuerpo: `La cuenta de ${boxerName} ha sido eliminada del sistema.`,
            de: coach.email
        });

        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── GET /me/cobros ────────────────────────────────────────────────────────
// Stub para historial de cobros (funcionalidad pendiente de implementar)
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

// ─── POST / ────────────────────────────────────────────────────────────────
// Crea un entrenador directamente (uso interno/admin, sin flujo de registro)
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

// ─── POST /me/challenges/respond ───────────────────────────────────────────
// Permite al entrenador aprobar o rechazar un reto de sparring de sus boxeadores.
//
// Flujo de aprobación doble:
//  - El entrenador del retado (coachTo) responde primero → status: pending_coach_from
//  - El entrenador del retador (coachFrom) responde después → status: accepted
//  - Si cualquiera rechaza → status: declined
//
// Cuando ambos aprueban se crea automáticamente una sparringSession en los
// documentos de ambos boxeadores y se notifica a todas las partes.
router.post('/me/challenges/respond', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const {
            challengeId,
            action
        } = req.body || {};

        if (!challengeId) return res.status(400).json({
            error: 'challengeId requerido'
        });
        if (action !== 'accept' && action !== 'decline') return res.status(400).json({
            error: 'Acción inválida: usa "accept" o "decline"'
        });

        const coachEmail = coach.email.toLowerCase();

        // Buscar el reto en todos los boxeadores supervisados por este entrenador
        const myBoxers = await Boxeador.find({
            entrenadorId: coach._id
        }).lean();
        let foundChallenge = null;
        let isToCoach = false; // true = este es el entrenador del retado (responde primero)

        for (const boxer of myBoxers) {
            // Buscar primero en los retos recibidos (este entrenador es el del retado)
            const received = Array.isArray(boxer.sparringChallengesReceived) ? boxer.sparringChallengesReceived : [];
            const c = received.find(x => x && String(x.id) === challengeId);
            if (c) {
                foundChallenge = c;
                isToCoach = true;
                break;
            }

            // Si no está en recibidos, buscar en enviados (este entrenador es el del retador)
            const sent = Array.isArray(boxer.sparringChallengesSent) ? boxer.sparringChallengesSent : [];
            const s = sent.find(x => x && String(x.id) === challengeId);
            if (s) {
                foundChallenge = s;
                isToCoach = false;
                break;
            }
        }

        if (!foundChallenge) {
            return res.status(404).json({
                error: 'Reto no encontrado en los boxeadores bajo tu supervisión'
            });
        }

        const curStatus = String(foundChallenge.status || 'pending');

        // Compatibilidad con retos creados antes de implementar la aprobación doble
        const effectiveStatus = curStatus === 'pending' ? 'pending_coach_to' : curStatus;

        // Verificar que este entrenador no haya respondido ya (== captura null y undefined)
        if (isToCoach && foundChallenge.coachToApproval != null) {
            return res.status(400).json({
                error: 'Ya has respondido a este reto como el entrenador del retado.'
            });
        }
        if (!isToCoach && foundChallenge.coachFromApproval != null) {
            return res.status(400).json({
                error: 'Ya has respondido a este reto como el entrenador del retador.'
            });
        }
        if (curStatus === 'accepted') return res.status(400).json({
            error: 'Este sparring ya está confirmado.'
        });
        if (curStatus === 'declined') return res.status(400).json({
            error: 'Este reto ya ha sido rechazado.'
        });

        const fromEmail = (foundChallenge.fromEmail || '').toLowerCase();
        const toEmail = (foundChallenge.toEmail || '').toLowerCase();
        const respondedAt = new Date().toISOString();

        // Campo a actualizar según si es el entrenador del retado o del retador
        const coachApprovalField = isToCoach ? 'coachToApproval' : 'coachFromApproval';
        const approvalValue = action === 'accept'; // true = aprobado, false = rechazado

        // ── Determinar el siguiente estado del reto ────────────────────────
        let newStatus;
        if (action === 'decline') {
            newStatus = 'declined'; // Cualquier rechazo cancela el reto inmediatamente
        } else {
            // Calcular si ya tienen ambas aprobaciones
            const nextTo = isToCoach ? true : !!foundChallenge.coachToApproval;
            const nextFrom = !isToCoach ? true : !!foundChallenge.coachFromApproval;

            if (nextTo && nextFrom) {
                newStatus = 'accepted'; // Ambos entrenadores aprobaron
            } else if (!nextTo) {
                newStatus = 'pending_coach_to'; // Falta aprobación del entrenador del retado
            } else {
                newStatus = 'pending_coach_from'; // Falta aprobación del entrenador del retador
            }
        }

        // Actualizar el reto en TODOS los documentos de boxeadores que lo tengan
        // (tanto en sparringChallengesReceived como en sparringChallengesSent)
        await Boxeador.updateMany({
            'sparringChallengesReceived.id': challengeId
        }, {
            $set: {
                [`sparringChallengesReceived.$[elem].${coachApprovalField}`]: approvalValue,
                'sparringChallengesReceived.$[elem].status': newStatus,
                'sparringChallengesReceived.$[elem].respondedAt': respondedAt
            }
        }, {
            arrayFilters: [{
                'elem.id': challengeId
            }]
        });
        await Boxeador.updateMany({
            'sparringChallengesSent.id': challengeId
        }, {
            $set: {
                [`sparringChallengesSent.$[elem].${coachApprovalField}`]: approvalValue,
                'sparringChallengesSent.$[elem].status': newStatus,
                'sparringChallengesSent.$[elem].respondedAt': respondedAt
            }
        }, {
            arrayFilters: [{
                'elem.id': challengeId
            }]
        });

        // ── Acciones según el resultado final del reto ─────────────────────
        if (newStatus === 'accepted') {
            // Ambos entrenadores aprobaron → crear la sesión de sparring en ambos boxeadores
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

            // Insertar la sesión en el documento de cada boxeador evitando duplicados
            for (const bEmail of [fromEmail, toEmail]) {
                if (!bEmail) continue;
                const bx = await Boxeador.findOne({
                    email: bEmail
                }).lean();
                if (!bx) continue;
                // Verificar que no se haya creado ya la sesión para este reto
                const alreadyHas = (Array.isArray(bx.sparringSessions) ? bx.sparringSessions : []).some(s => String(s.challengeId) === challengeId);
                if (!alreadyHas) {
                    await Boxeador.updateOne({
                        email: bEmail
                    }, {
                        $push: {
                            sparringSessions: session
                        }
                    });
                }
            }

            // Notificar a ambos boxeadores que el sparring ha sido confirmado
            await crearNotificacion({
                para: fromEmail,
                tipo: 'sparring',
                titulo: 'Sparring Confirmado',
                cuerpo: `Tu sparring con ${foundChallenge.toNombre} ha sido aprobado por ambos entrenadores.`,
                de: toEmail
            });
            await crearNotificacion({
                para: toEmail,
                tipo: 'sparring',
                titulo: 'Sparring Confirmado',
                cuerpo: `Tu sparring con ${foundChallenge.fromNombre} ha sido aprobado por ambos entrenadores.`,
                de: fromEmail
            });

        } else if (newStatus === 'pending_coach_from') {
            // El entrenador del retado ya aprobó → notificar al entrenador del retador
            const coachFromEmail = (foundChallenge.coachFromEmail || '');
            if (coachFromEmail) {
                await crearNotificacion({
                    para: coachFromEmail,
                    tipo: 'sparring',
                    titulo: 'Confirma el sparring de tu boxeador',
                    cuerpo: `El entrenador rival ha aprobado. Necesitas confirmar el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}.`,
                    de: coachEmail
                });
            }
        } else if (newStatus === 'declined') {
            // Cualquier entrenador rechazó → notificar a ambos boxeadores y al otro entrenador
            await crearNotificacion({
                para: fromEmail,
                tipo: 'sparring',
                titulo: 'Sparring Rechazado',
                cuerpo: `Un entrenador ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`,
                de: coachEmail
            });
            await crearNotificacion({
                para: toEmail,
                tipo: 'sparring',
                titulo: 'Sparring Rechazado',
                cuerpo: `Un entrenador ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`,
                de: coachEmail
            });
            // Avisar también al otro entrenador del rechazo
            const otherCoachEmail = isToCoach ? (foundChallenge.coachFromEmail || '') : (foundChallenge.coachToEmail || '');
            if (otherCoachEmail && otherCoachEmail !== coachEmail) {
                await crearNotificacion({
                    para: otherCoachEmail,
                    tipo: 'sparring',
                    titulo: 'Sparring Cancelado',
                    cuerpo: `El entrenador rival ha rechazado el sparring de ${foundChallenge.fromNombre} vs ${foundChallenge.toNombre}. El reto ha sido cancelado.`,
                    de: coachEmail
                });
            }
        }

        return res.json({
            ok: true,
            status: newStatus
        });
    } catch (err) {
        return res.status(err.status || 400).json({
            error: err.message
        });
    }
});

// ─── POST /me/challenges/complete ─────────────────────────────────────────
// El entrenador marca un reto aceptado como completado y le asigna una valoración.
// Solo afecta a los boxeadores supervisados por este entrenador.
router.post('/me/challenges/complete', async (req, res) => {
    try {
        const coach = await requireCoachByEmail(req.query.email);
        const {
            challengeId,
            stars,
            note
        } = req.body || {};

        if (!challengeId) return res.status(400).json({
            error: 'challengeId requerido'
        });

        // Buscar el reto en los boxeadores supervisados
        const myBoxers = await Boxeador.find({
            entrenadorId: coach._id
        }).lean();
        let foundChallenge = null;
        let foundBoxerEmail = '';
        let foundIn = ''; // 'received' o 'sent'

        for (const boxer of myBoxers) {
            const received = Array.isArray(boxer.sparringChallengesReceived) ? boxer.sparringChallengesReceived : [];
            const c = received.find(x => x && String(x.id) === challengeId);
            if (c) {
                foundChallenge = c;
                foundBoxerEmail = (boxer.email || '').toString().trim().toLowerCase();
                foundIn = 'received';
                break;
            }

            const sent = Array.isArray(boxer.sparringChallengesSent) ? boxer.sparringChallengesSent : [];
            const s = sent.find(x => x && String(x.id) === challengeId);
            if (s) {
                foundChallenge = s;
                foundBoxerEmail = (boxer.email || '').toString().trim().toLowerCase();
                foundIn = 'sent';
                break;
            }
        }

        if (!foundChallenge) {
            return res.status(404).json({
                error: 'Reto no encontrado'
            });
        }

        // Solo se pueden valorar retos ya aceptados o previamente completados
        const st = (foundChallenge.status || '').toString().trim().toLowerCase();
        if (st !== 'accepted' && st !== 'completed') {
            return res.status(400).json({
                error: 'Solo se pueden valorar retos aceptados o completados.'
            });
        }

        const completedAt = new Date().toISOString();
        const rating = Number(stars) || 5; // Por defecto 5 estrellas si no se especifica

        // Marcar como 'completed' en TODOS los documentos (sin sobrescribir valoraciones ajenas)
        await Boxeador.updateMany({
            'sparringChallengesReceived.id': challengeId
        }, {
            $set: {
                'sparringChallengesReceived.$[elem].status': 'completed',
                'sparringChallengesReceived.$[elem].completedAt': completedAt
            }
        }, {
            arrayFilters: [{
                'elem.id': challengeId
            }]
        });
        await Boxeador.updateMany({
            'sparringChallengesSent.id': challengeId
        }, {
            $set: {
                'sparringChallengesSent.$[elem].status': 'completed',
                'sparringChallengesSent.$[elem].completedAt': completedAt
            }
        }, {
            arrayFilters: [{
                'elem.id': challengeId
            }]
        });

        // Guardar la valoración del entrenador SOLO en el documento del boxeador supervisado
        // (para no sobrescribir la valoración del otro entrenador)
        if (foundBoxerEmail) {
            if (foundIn === 'received') {
                await Boxeador.updateOne({
                    email: foundBoxerEmail
                }, {
                    $set: {
                        'sparringChallengesReceived.$[elem].rating': rating,
                        'sparringChallengesReceived.$[elem].completedNote': note || '',
                        'sparringChallengesReceived.$[elem].completedAt': completedAt
                    }
                }, {
                    arrayFilters: [{
                        'elem.id': challengeId
                    }]
                });
            } else if (foundIn === 'sent') {
                await Boxeador.updateOne({
                    email: foundBoxerEmail
                }, {
                    $set: {
                        'sparringChallengesSent.$[elem].rating': rating,
                        'sparringChallengesSent.$[elem].completedNote': note || '',
                        'sparringChallengesSent.$[elem].completedAt': completedAt
                    }
                }, {
                    arrayFilters: [{
                        'elem.id': challengeId
                    }]
                });
            }

            // Marcar también la sesión de sparring como completada
            await Boxeador.updateMany({
                'sparringSessions.challengeId': challengeId
            }, {
                $set: {
                    'sparringSessions.$[elem].status': 'completed',
                    'sparringSessions.$[elem].completedAt': completedAt
                }
            }, {
                arrayFilters: [{
                    'elem.challengeId': challengeId
                }]
            });

            // Guardar la valoración del entrenador en el campo específico de la sesión
            await Boxeador.updateOne({
                email: foundBoxerEmail
            }, {
                $set: {
                    'sparringSessions.$[elem].ratingEntrenador': rating,
                    'sparringSessions.$[elem].noteEntrenador': (note || '').toString().trim().slice(0, 500)
                }
            }, {
                arrayFilters: [{
                    'elem.challengeId': challengeId
                }]
            });
        }

        // Notificar a ambos boxeadores de que el sparring ha sido completado y valorado
        const notifyEmails = [foundChallenge.fromEmail, foundChallenge.toEmail];
        for (const email of notifyEmails) {
            await crearNotificacion({
                para: email,
                tipo: 'sparring',
                titulo: '🥊 Sparring Completado',
                cuerpo: `El sparring de ${foundChallenge.preset} ha sido marcado como completado con una valoración de ${stars} estrellas.`,
                de: coach.email
            });
        }

        res.json({
            success: true,
            status: 'completed'
        });
    } catch (err) {
        console.error('Error completing challenge:', err);
        res.status(500).json({
            error: err.message
        });
    }
});

export default router;
