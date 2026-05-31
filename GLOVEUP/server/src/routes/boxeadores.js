/**
 * routes/boxeadores.js — Rutas del recurso Boxeador
 *
 * Expone la API REST para gestionar los perfiles de boxeadores y el
 * sistema de retos de sparring. Prefijo de montaje: /api/boxeadores
 *
 * Endpoints principales:
 *  GET    /                        → Listar todos los boxeadores
 *  GET    /lookup?identifier=X     → Buscar boxeador por email, DNI u ObjectId
 *  GET    /me?email=X              → Obtener perfil completo del boxeador autenticado
 *  PUT    /me?email=X              → Actualizar perfil del boxeador
 *  POST   /me/leave-gym?email=X    → Abandonar el gimnasio actual
 *  POST   /                        → Crear boxeador (uso interno/admin)
 *
 *  GET    /challenges?email=X      → Obtener retos enviados y recibidos
 *  POST   /challenges              → Enviar un nuevo reto de sparring
 *  POST   /challenges/respond      → (Obsoleto) → 410 Gone
 *
 *  GET    /sessions?email=X        → Obtener sesiones de sparring confirmadas
 *  POST   /sessions/complete       → El boxeador valorar y completa una sesión
 *
 *  GET    /me/calendar-events      → Listar eventos de calendario del boxeador
 *  POST   /me/calendar-events      → Crear evento de calendario
 *  PUT    /me/calendar-events/:id  → Editar evento de calendario
 *  DELETE /me/calendar-events/:id  → Eliminar evento de calendario
 *
 * Flujo de retos de sparring (aprobación doble):
 *  1. El boxeador retador envía un reto → status: "pending_coach_to"
 *  2. El entrenador del retado aprueba  → status: "pending_coach_from"
 *  3. El entrenador del retador aprueba → status: "accepted" (se crea la sesión)
 *  Si cualquier entrenador rechaza      → status: "declined"
 *  (La aprobación se gestiona en routes/entrenadores.js → POST /me/challenges/respond)
 */

import {
    Router
} from 'express';
import crypto from 'crypto';
import mongoose from 'mongoose';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Usuario from '../models/Usuario.js';
import {
    crearNotificacion
} from './notificaciones.js';

const router = Router();

// ─── Utilidades internas ───────────────────────────────────────────────────

/**
 * Comprueba si un string tiene formato de ObjectId de MongoDB (24 hex chars)
 */
function isObjectIdLike(value) {
    return mongoose.isValidObjectId(value);
}

/**
 * Busca un boxeador por cualquier tipo de identificador:
 *  - ObjectId de MongoDB
 *  - Email (si contiene "@")
 *  - DNI/Licencia (en cualquier otro caso)
 *
 * @param {string} identifier - Identificador del boxeador
 * @returns {Promise<Object|null>} Documento del boxeador o null
 */
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

// ─── GET / ─────────────────────────────────────────────────────────────────
// Devuelve todos los boxeadores de la base de datos (sin campo password por seguridad)
router.get('/', async (req, res) => {
    const items = await Boxeador.find().select('-password').lean();
    res.json(items);
});

// ─── GET /lookup ───────────────────────────────────────────────────────────
// Búsqueda pública de boxeadores (para el sistema de retos).
// Devuelve únicamente los campos del perfil público, sin datos sensibles.
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

        // Devolver solo campos públicos del perfil
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

// ─── GET /challenges ───────────────────────────────────────────────────────
// Devuelve los arrays de retos enviados y recibidos de un boxeador.
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

// ─── POST /challenges ──────────────────────────────────────────────────────
// Crea un nuevo reto de sparring entre dos boxeadores.
//
// Validaciones importantes:
//  - Ambos boxeadores deben tener entrenador asignado (flujo de aprobación doble)
//  - Los entrenadores de AMBOS boxeadores deben estar seleccionados en coachIds
//  - Un entrenador no puede retar directamente a un boxeador
//  - Un boxeador sin gimnasio no puede enviar retos
//  - Límite de 5 retos por semana (lunes-domingo) para boxeadores
//
// El reto se guarda en sparringChallengesSent del retador y en
// sparringChallengesReceived del retado, y se notifica a todas las partes.
router.post('/challenges', async (req, res) => {
    try {
        const payload = req.body || {};
        const fromEmail = (payload.fromEmail || '').toString().trim().toLowerCase();
        const toIdentifier = (payload.toIdentifier || '').toString().trim();
        const preset = (payload.preset || '').toString().trim();
        const note = (payload.note || '').toString().trim();
        const gymName = (payload.gymName || '').toString().trim();
        const scheduledAt = (payload.scheduledAt || '').toString().trim();
        // coachIds: array de ObjectIds de los entrenadores que deben aprobar el reto
        const coachIds = Array.isArray(payload.coachIds) ? payload.coachIds.map((x) => String(x || '').trim()).filter(Boolean) : [];
        const rating = payload.rating === undefined || payload.rating === null || payload.rating === '' ? null : Number(payload.rating);

        // Validaciones de campos obligatorios
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
        // Verificar que todos los IDs de entrenadores son ObjectIds válidos
        const invalidCoach = coachIds.find((id) => !isObjectIdLike(id));
        if (invalidCoach) {
            return res.status(400).json({
                error: 'Entrenador inválido'
            });
        }

        // Resolver el perfil del retador (puede ser boxeador o entrenador)
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

        // Resolver el perfil del retado (puede ser boxeador o entrenador)
        let to = await findBoxeadorByIdentifier(toIdentifier);
        if (!to) {
            to = await Entrenador.findOne({
                email: toIdentifier
            }).lean() || await Entrenador.findById(toIdentifier).lean();
        }
        if (!to) {
            return res.status(404).json({
                error: 'Perfil destino no encontrado'
            });
        }

        // Regla de negocio: un entrenador no puede retar directamente a un boxeador
        const fromTrainer = await Entrenador.findOne({
            email: fromEmail
        }).lean();
        const toBoxer = await findBoxeadorByIdentifier(toIdentifier);
        if (fromTrainer && toBoxer) {
            return res.status(403).json({
                error: 'Como entrenador, no puedes retar directamente a un boxeador. Los retos deben dirigirse al entrenador del boxeador.'
            });
        }

        // Un boxeador sin gimnasio no puede enviar retos de sparring
        if (!fromTrainer && !from.gimnasio) {
            return res.status(403).json({
                error: 'Debes pertenecer a un gimnasio para poder enviar retos.'
            });
        }

        // Evitar auto-reto
        if ((to.email || '').toString().trim().toLowerCase() === fromEmail) {
            return res.status(400).json({
                error: 'No puedes retarte a ti mismo'
            });
        }

        // ── Límite de retos semanal (solo para boxeadores) ─────────────────
        // Ventana de lunes a domingo (ISO week). Máximo 5 retos enviados por semana.
        if (!fromTrainer) {
            const weekStart = new Date();
            weekStart.setHours(0, 0, 0, 0);
            const day = weekStart.getDay();
            // Calcular el lunes de la semana actual (getDay() devuelve 0=domingo)
            weekStart.setDate(weekStart.getDate() - (day === 0 ? 6 : day - 1));
            const sentThisWeek = (from.sparringChallengesSent || []).filter(
                (c) => new Date(c.createdAt) >= weekStart
            );
            if (sentThisWeek.length >= 5) {
                return res.status(429).json({
                    error: 'Has alcanzado el límite de 5 retos por semana. Podrás enviar más retos a partir del próximo lunes.'
                });
            }
        }

        // Obtener datos completos de los entrenadores seleccionados
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

        // ── Resolución de entrenadores para el flujo de aprobación doble ───
        // Se busca el entrenador asignado a cada boxeador para saber a quién
        // notificar y qué campos de aprobación actualizar.
        const id = crypto.randomUUID(); // ID único del reto
        const now = new Date().toISOString();

        let coachFromEmail = null; // Email del entrenador del retador
        let coachToEmail = null;   // Email del entrenador del retado
        const toEmailNorm = (to.email || '').toString().trim().toLowerCase();

        // Buscar entrenador del boxeador retador
        const fromBoxerForCoach = await Boxeador.findOne({
            email: fromEmail
        }).select('entrenadorId').lean();
        if (fromBoxerForCoach && fromBoxerForCoach.entrenadorId) {
            const fromCoach = await Entrenador.findById(fromBoxerForCoach.entrenadorId).select('email').lean();
            if (fromCoach) coachFromEmail = (fromCoach.email || '').toLowerCase();
        } else {
            // Si el "retador" es él mismo un entrenador, él es su propio representante
            const isCoach = await Entrenador.findOne({
                email: fromEmail
            }).select('email').lean();
            if (isCoach) coachFromEmail = fromEmail.toLowerCase();
        }

        // Buscar entrenador del boxeador retado
        const toBoxerForCoach = await Boxeador.findOne({
            email: toEmailNorm
        }).select('entrenadorId').lean();
        if (toBoxerForCoach && toBoxerForCoach.entrenadorId) {
            const toCoach = await Entrenador.findById(toBoxerForCoach.entrenadorId).select('email').lean();
            if (toCoach) coachToEmail = (toCoach.email || '').toLowerCase();
        }

        // Regla de negocio: ambos boxeadores DEBEN tener entrenador asignado
        // para que el flujo de aprobación doble sea posible
        if (!coachFromEmail || !coachToEmail) {
            const missing = [];
            if (!coachFromEmail) missing.push(from.nombre || fromEmail);
            if (!coachToEmail) missing.push(to.nombre || toEmailNorm);
            return res.status(400).json({
                error: `No se puede crear el reto: ${missing.join(' y ')} no tiene(n) entrenador asignado. Ambos boxeadores necesitan un entrenador para que el sparring sea aprobado.`
            });
        }

        // Verificar que los entrenadores de ambos boxeadores están incluidos en coachIds
        // (obligatorio para garantizar que ambos dan su aprobación explícita)
        const requiredCoachIds = [];
        if (fromBoxerForCoach && fromBoxerForCoach.entrenadorId) requiredCoachIds.push(String(fromBoxerForCoach.entrenadorId));
        if (toBoxerForCoach && toBoxerForCoach.entrenadorId) requiredCoachIds.push(String(toBoxerForCoach.entrenadorId));
        const missingRequired = requiredCoachIds.filter((id) => !coachIds.includes(id));
        if (missingRequired.length) {
            return res.status(400).json({
                error: 'Debes seleccionar obligatoriamente a los entrenadores de ambos boxeadores.'
            });
        }

        // Estado inicial: esperando la aprobación del entrenador del retado
        const initialStatus = 'pending_coach_to';

        // Construir el documento del reto que se guardará en ambos boxeadores
        const record = {
            id,
            fromEmail,
            fromNombre: from.nombre || '',
            toEmail: toEmailNorm,
            toNombre: to.nombre || '',
            preset,
            rating,
            note,
            coachIds: coaches.map((c) => String(c._id)),
            coachNombres: coaches.map((c) => c.nombre || ''),
            coachEmails: coaches.map((c) => (c.email || '').toString().trim().toLowerCase()),
            coachFromEmail: coachFromEmail || '',
            coachToEmail: coachToEmail || '',
            coachFromApproval: null, // null = pendiente de respuesta
            coachToApproval: null,
            gymName,
            scheduledAt: parsedDate.toISOString(),
            status: initialStatus,
            createdAt: now,
            respondedAt: ''
        };

        // ── Guardar el reto en el documento del retador ────────────────────
        if (await Boxeador.findOne({
                email: fromEmail
            })) {
            await Boxeador.updateOne({
                email: fromEmail
            }, {
                $push: {
                    sparringChallengesSent: record
                }
            });
        } else {
            // El retador podría ser un entrenador (flujo entrenador vs entrenador)
            await Entrenador.updateOne({
                email: fromEmail
            }, {
                $push: {
                    sparringChallengesSent: record
                }
            });
        }

        // ── Guardar el reto en el documento del retado ─────────────────────
        if (await Boxeador.findOne({
                email: record.toEmail
            })) {
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

        // ── Notificaciones a todas las partes implicadas ───────────────────
        // Al retador: confirmación de que el reto fue enviado
        await crearNotificacion({
            para: fromEmail,
            tipo: 'sparring',
            titulo: '🥊 Reto enviado',
            cuerpo: `Has enviado un reto de sparring a ${record.toNombre || record.toEmail}.`,
            de: record.toEmail
        });
        // Al retado: aviso de nuevo reto recibido
        await crearNotificacion({
            para: record.toEmail,
            tipo: 'sparring',
            titulo: '📥 Nuevo reto de sparring',
            cuerpo: `${record.fromNombre || record.fromEmail} te ha retado. ¡Revisa tu perfil!`,
            de: fromEmail
        });

        // A ambos entrenadores: aviso de que deben aprobar el sparring
        if (coachToEmail) {
            await crearNotificacion({
                para: coachToEmail,
                tipo: 'sparring',
                titulo: '🔔 Reto para tu boxeador',
                cuerpo: `${record.fromNombre} ha retado a tu boxeador ${record.toNombre}. Tu aprobación es necesaria.`,
                de: fromEmail
            });
        }
        if (coachFromEmail) {
            await crearNotificacion({
                para: coachFromEmail,
                tipo: 'sparring',
                titulo: '🥊 Reto enviado por tu boxeador',
                cuerpo: `Tu boxeador ${record.fromNombre} ha enviado un reto a ${record.toNombre}. Tu aprobación es necesaria.`,
                de: fromEmail
            });
        }

        return res.status(201).json(record);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── POST /challenges/respond ──────────────────────────────────────────────
// Este endpoint fue migrado a /api/entrenadores/me/challenges/respond.
// Se mantiene aquí para devolver un error claro a clientes desactualizados.
router.post('/challenges/respond', async (req, res) => {
    // Deprecated: use POST /api/entrenadores/me/challenges/respond
    return res.status(410).json({
        error: 'Este endpoint está obsoleto. Usa POST /api/entrenadores/me/challenges/respond'
    });
});

// ─── GET /sessions ─────────────────────────────────────────────────────────
// Devuelve las sesiones de sparring confirmadas del boxeador, ordenadas
// por fecha programada (más recientes primero).
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
        // Ordenar de más reciente a más antigua por fecha programada
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

// ─── POST /sessions/complete ───────────────────────────────────────────────
// Permite a un boxeador marcar una sesión como completada y dejar su valoración.
// Se actualiza tanto su propio documento como el del boxeador rival.
router.post('/sessions/complete', async (req, res) => {
    try {
        const payload = req.body || {};
        const email = (payload.email || '').toString().trim().toLowerCase();
        const sessionId = (payload.sessionId || '').toString().trim();
        const stars = payload.stars === undefined || payload.stars === null ? null : Number(payload.stars);
        // Limitar a 8 etiquetas y 500 caracteres de nota
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

        // Verificar que el solicitante es uno de los dos boxeadores de la sesión
        const a = (session.boxerAEmail || '').toString().trim().toLowerCase();
        const b = (session.boxerBEmail || '').toString().trim().toLowerCase();
        const partnerEmail = email === a ? b : a; // Email del boxeador rival
        if (email !== a && email !== b) {
            return res.status(403).json({
                error: 'No autorizado'
            });
        }

        const now = new Date().toISOString();
        // Construir el objeto de review del boxeador
        const review = {
            byEmail: email,
            stars,
            tags,
            note,
            createdAt: now
        };

        // Actualizar la sesión en el documento del boxeador que completa
        // $[elem] es un arrayFilter que identifica el subdocumento correcto por ID
        const updateOps = {
            $set: {
                'sparringSessions.$[elem].status': 'completed',
                'sparringSessions.$[elem].completedAt': now,
                'sparringSessions.$[elem].ratingBoxeador': stars,
                'sparringSessions.$[elem].noteBoxeador': note
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

        // Actualizar también el documento del boxeador rival (marcar como completada y añadir review)
        if (partnerEmail) {
            const partnerUpdateOps = {
                $set: {
                    'sparringSessions.$[elem].status': 'completed',
                    'sparringSessions.$[elem].completedAt': now
                },
                $push: {
                    'sparringSessions.$[elem].reviews': review
                }
            };
            await Boxeador.updateOne({
                email: partnerEmail
            }, partnerUpdateOps, {
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

// ─── GET /me ───────────────────────────────────────────────────────────────
// Devuelve el perfil completo del boxeador (incluyendo retos, sesiones, pagos…)
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

// ─── POST /me/leave-gym ────────────────────────────────────────────────────
// El boxeador abandona voluntariamente su gimnasio.
// Se limpian los campos entrenadorId, gimnasio y fechaInscripcion, y se
// notifica al entrenador de la baja.
router.post('/me/leave-gym', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) return res.status(400).json({ error: 'Email requerido' });

        const boxer = await Boxeador.findOne({ email });
        if (!boxer) return res.status(404).json({ error: 'Boxeador no encontrado' });
        if (!boxer.gimnasio) return res.status(400).json({ error: 'No perteneces a ningún gimnasio' });

        const coachId = boxer.entrenadorId;
        const gymName = boxer.gimnasio;

        // Desasociar del gimnasio y del entrenador
        boxer.gimnasio = '';
        boxer.entrenadorId = undefined;
        boxer.fechaInscripcion = undefined;
        await boxer.save();

        // Notificar al entrenador de la baja voluntaria del boxeador
        if (coachId) {
            const coach = await Entrenador.findById(coachId).lean();
            if (coach && coach.email) {
                await crearNotificacion({
                    para: coach.email,
                    tipo: 'gimnasio',
                    titulo: `${boxer.nombre || email} ha abandonado el gimnasio`,
                    cuerpo: `${boxer.nombre || email} ha decidido abandonar ${gymName}.`,
                    de: email
                });
            }
        }

        return res.json({ ok: true });
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
});

// ─── PUT /me ───────────────────────────────────────────────────────────────
// Actualiza el perfil deportivo del boxeador.
// Si se cambia el email, se actualiza también en la colección "usuarios".
// Usa upsert para crear el perfil si todavía no existe.
router.put('/me', async (req, res) => {
    try {
        const email = (req.query.email || '').toString().trim().toLowerCase();
        if (!email) {
            return res.status(400).json({
                error: 'Email requerido'
            });
        }

        const payload = req.body || {};
        const nuevoEmail = (payload.nuevoEmail || '').toString().trim().toLowerCase();

        let emailToSave = email;
        if (nuevoEmail && nuevoEmail !== email) {
            // Verificar que el nuevo email no esté ya en uso por otro usuario
            const existingUser = await Usuario.findOne({
                email: nuevoEmail
            }).lean();
            if (existingUser) {
                return res.status(400).json({
                    error: 'El nuevo email ya está en uso'
                });
            }
            // Actualizar el email también en la colección principal de usuarios
            await Usuario.updateOne({
                email
            }, {
                $set: {
                    email: nuevoEmail
                }
            });
            emailToSave = nuevoEmail;
        }

        const update = {
            nombre: payload.nombre,
            alias: payload.alias || '',
            disciplina: payload.disciplina || '',
            peso: payload.peso || '',
            categoriaPeso: payload.categoriaPeso || '',
            genero: payload.genero || 'Masculino',
            frecuenciaSparring: payload.frecuenciaSparring || 'Semanal',
            guardia: payload.guardia || 'Diestro',
            altura: payload.altura || '',
            edad: payload.edad || null,
            ubicacion: payload.ubicacion || '',
            bio: payload.bio || '',
            foto: payload.foto || '',
            sparringHistory: Array.isArray(payload.sparringHistory) ? payload.sparringHistory : [],
        };

        // Incluir el nuevo email en el objeto de actualización si fue cambiado
        if (emailToSave !== email) {
            update.email = emailToSave;
        }

        // findOneAndUpdate con upsert:true crea el documento si no existe
        // $setOnInsert solo se ejecuta en la creación (para establecer el email inicial)
        const saved = await Boxeador.findOneAndUpdate({
            email
        }, {
            $setOnInsert: {
                email: emailToSave
            },
            $set: update
        }, {
            new: true,  // Devolver el documento actualizado
            upsert: true
        }).lean();

        return res.json(saved);
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── POST / ────────────────────────────────────────────────────────────────
// Crea un boxeador directamente (uso interno o administrativo).
// No realiza el flujo completo de registro (sin Usuario, sin notificaciones).
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
        delete safeDoc.password; // Nunca exponer el campo password por error
        res.status(201).json(safeDoc);
    } catch (err) {
        res.status(400).json({
            error: err.message
        });
    }
});

// ──────── Calendar Events CRUD ────────────────────────────────────────────

/**
 * Helper: obtiene el documento Mongoose del boxeador por email.
 * Lanza un error con propiedad "status" para que el catch del endpoint
 * pueda devolver el código HTTP apropiado.
 */
async function requireBoxeadorByEmail(email) {
    const raw = (email || '').toString().trim().toLowerCase();
    if (!raw) throw Object.assign(new Error('Email requerido'), { status: 400 });
    const boxer = await Boxeador.findOne({ email: raw });
    if (!boxer) throw Object.assign(new Error('Perfil no encontrado'), { status: 404 });
    return boxer;
}

// ─── GET /me/calendar-events ───────────────────────────────────────────────
// Devuelve todos los eventos de calendario del boxeador
router.get('/me/calendar-events', async (req, res) => {
    try {
        const boxer = await requireBoxeadorByEmail(req.query.email);
        return res.json(Array.isArray(boxer.calendarEvents) ? boxer.calendarEvents : []);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// ─── POST /me/calendar-events ──────────────────────────────────────────────
// Añade un nuevo evento al calendario del boxeador
router.post('/me/calendar-events', async (req, res) => {
    try {
        const boxer = await requireBoxeadorByEmail(req.query.email);
        const { title, start, end, allDay, color, tipo, notas } = req.body || {};
        if (!title || !start) return res.status(400).json({ error: 'Titulo y fecha de inicio son obligatorios.' });
        boxer.calendarEvents.push({
            title,
            start,
            end: end || '',
            allDay: allDay !== false,
            color: color || '#f97316',
            tipo: tipo || 'personalizado',
            notas: notas || ''
        });
        await boxer.save();
        // Devolver el evento recién creado (último elemento del array)
        return res.status(201).json(boxer.calendarEvents[boxer.calendarEvents.length - 1]);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// ─── PUT /me/calendar-events/:eventId ─────────────────────────────────────
// Edita un evento existente del calendario. Solo actualiza los campos presentes en el body.
router.put('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const boxer = await requireBoxeadorByEmail(req.query.email);
        // Mongoose DocumentArray.id() busca el subdocumento por su _id
        const ev = boxer.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Evento no encontrado.' });
        const { title, start, end, allDay, color, tipo, notas } = req.body || {};
        // Actualizar solo los campos que vienen en el body (patch parcial)
        if (title !== undefined) ev.title = title;
        if (start !== undefined) ev.start = start;
        if (end !== undefined) ev.end = end;
        if (allDay !== undefined) ev.allDay = allDay;
        if (color !== undefined) ev.color = color;
        if (tipo !== undefined) ev.tipo = tipo;
        if (notas !== undefined) ev.notas = notas;
        await boxer.save();
        return res.json(ev);
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

// ─── DELETE /me/calendar-events/:eventId ──────────────────────────────────
// Elimina un evento del calendario del boxeador
router.delete('/me/calendar-events/:eventId', async (req, res) => {
    try {
        const boxer = await requireBoxeadorByEmail(req.query.email);
        const ev = boxer.calendarEvents.id(req.params.eventId);
        if (!ev) return res.status(404).json({ error: 'Evento no encontrado.' });
        ev.deleteOne(); // Eliminar el subdocumento del array
        await boxer.save();
        return res.json({ ok: true });
    } catch (err) {
        return res.status(err.status || 400).json({ error: err.message });
    }
});

export default router;
