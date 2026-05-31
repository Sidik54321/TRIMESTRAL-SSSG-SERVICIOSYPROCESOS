/**
 * models/Boxeador.js — Modelo de datos para la colección "boxeadores"
 *
 * Representa el perfil deportivo completo de un boxeador dentro de GloveUp.
 * Va más allá de la mera autenticación (que gestiona Usuario.js) e incluye:
 *
 *  - Datos personales y deportivos (peso, altura, guardia, nivel…)
 *  - Historial de sparring libre (anotaciones manuales)
 *  - Sistema de retos de sparring con aprobación doble de entrenadores:
 *      · sparringChallengesSent    → retos enviados por este boxeador
 *      · sparringChallengesReceived → retos recibidos
 *      · sparringSessions          → sesiones confirmadas (ambos entrenadores aprobaron)
 *  - Registro de pagos mensuales al gimnasio
 *  - Eventos de calendario personales
 *
 * La relación con el entrenador se establece mediante el campo entrenadorId
 * (referencia a Entrenador). Cuando un boxeador pertenece a un gimnasio,
 * su campo "gimnasio" refleja el nombre del gimnasio del entrenador.
 */

import mongoose from 'mongoose';

const BoxeadorSchema = new mongoose.Schema({
    // Referencia al documento Usuario (credenciales de acceso)
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        index: true,
        sparse: true // Puede ser null si el boxeador fue creado sin cuenta de usuario
    },
    // Referencia al entrenador asignado (null si no pertenece a ningún gimnasio)
    entrenadorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Entrenador',
        index: true,
        sparse: true
    },
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    // Email único que también sirve como identificador en la mayoría de endpoints
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    // DNI o número de licencia federativa (sin cifrar en boxeadores, a diferencia de Usuario)
    dniLicencia: {
        type: String,
        trim: true,
        uppercase: true,
        unique: true,
        sparse: true
    },
    // Nivel competitivo del boxeador
    nivel: {
        type: String,
        enum: ['Principiante', 'Intermedio', 'Avanzado', 'Amateur', 'Profesional'],
        default: 'Amateur'
    },
    alias: {
        type: String,
        trim: true
    },
    disciplina: {
        type: String,
        trim: true,
        default: 'Boxeo'
    },
    peso: {
        type: String,
        trim: true
    },
    ubicacion: {
        type: String,
        trim: true
    },
    // Nombre del gimnasio al que pertenece (se sincroniza con Entrenador.gimnasio)
    gimnasio: {
        type: String,
        trim: true
    },
    // ID externo en BoxRec (base de datos de boxeo profesional) para consultas futuras
    boxrecId: {
        type: String,
        trim: true
    },
    categoriaPeso: {
        type: String,
        trim: true
    },
    genero: {
        type: String,
        enum: ['Masculino', 'Femenino', 'Otro'],
        default: 'Masculino'
    },
    // Con qué frecuencia el boxeador desea hacer sparring
    frecuenciaSparring: {
        type: String,
        enum: ['Diaria', 'Semanal', 'Mensual'],
        default: 'Semanal'
    },
    // Posición de guardia al boxear
    guardia: {
        type: String,
        enum: ['Diestro', 'Zurdo'],
        default: 'Diestro'
    },
    // URL de la foto de perfil (base64 o URL externa)
    foto: {
        type: String,
        trim: true
    },
    // Récord de victorias/derrotas/empates en formato libre (ej: "10-2-1")
    record: {
        type: String,
        trim: true
    },
    altura: {
        type: String,
        trim: true
    },
    // Alcance (envergadura de brazos) en cm
    alcance: {
        type: String,
        trim: true
    },
    edad: {
        type: Number
    },
    bio: {
        type: String,
        trim: true
    },

    // ── Historial de sparring libre ────────────────────────────────────────
    // Anotaciones manuales del boxeador sobre sus sesiones pasadas (sin flujo de retos)
    sparringHistory: [{
        date: String,
        partner: String,
        place: String,
        notes: String
    }],

    // ── Retos de sparring enviados ─────────────────────────────────────────
    // Cada reto contiene los datos de ambos boxeadores, los entrenadores implicados
    // y los campos de aprobación de cada entrenador (coachFromApproval, coachToApproval).
    // El flujo de estados es: pending_coach_to → pending_coach_from → accepted | declined
    sparringChallengesSent: [{
        id: String,                 // UUID único del reto
        fromEmail: String,          // Email del retador
        fromNombre: String,
        toEmail: String,            // Email del retado
        toNombre: String,
        preset: String,             // Descripción/tipo de sparring pactado
        rating: Number,             // Valoración opcional (1-5) propuesta por el retador
        note: String,               // Nota libre adjunta al reto
        coachIds: [String],         // IDs de entrenadores involucrados
        coachNombres: [String],
        coachEmails: [String],
        coachFromEmail: String,     // Email del entrenador del retador
        coachToEmail: String,       // Email del entrenador del retado
        coachFromApproval: {
            type: mongoose.Schema.Types.Mixed,
            default: null           // null=pendiente, true=aprobado, false=rechazado
        },
        coachToApproval: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        gymName: String,
        scheduledAt: String,        // Fecha/hora propuesta en ISO 8601
        status: String,             // Estado actual del reto
        createdAt: String,
        respondedAt: String
    }],

    // ── Retos de sparring recibidos ────────────────────────────────────────
    // Misma estructura que sparringChallengesSent; se replica el documento
    // en el boxeador destino para facilitar las consultas sin joins costosos.
    sparringChallengesReceived: [{
        id: String,
        fromEmail: String,
        fromNombre: String,
        toEmail: String,
        toNombre: String,
        preset: String,
        rating: Number,
        note: String,
        coachIds: [String],
        coachNombres: [String],
        coachEmails: [String],
        coachFromEmail: String,
        coachToEmail: String,
        coachFromApproval: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        coachToApproval: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        gymName: String,
        scheduledAt: String,
        status: String,
        createdAt: String,
        respondedAt: String
    }],

    // ── Sesiones de sparring confirmadas ───────────────────────────────────
    // Se crean automáticamente cuando ambos entrenadores aprueban el reto.
    // Incluyen reviews post-sesión de cada participante (estrellas, etiquetas, nota).
    sparringSessions: [{
        id: String,               // UUID de la sesión
        challengeId: String,      // Referencia al reto que originó la sesión
        boxerAEmail: String,
        boxerANombre: String,
        boxerBEmail: String,
        boxerBNombre: String,
        coachIds: [String],
        coachNombres: [String],
        coachEmails: [String],
        gymName: String,
        scheduledAt: String,
        status: String,           // 'scheduled' → 'completed'
        createdAt: String,
        completedAt: String,
        ratingEntrenador: Number, // Valoración puesta por el entrenador al completar
        ratingBoxeador: Number,   // Valoración puesta por el boxeador al completar
        noteEntrenador: String,
        noteBoxeador: String,
        // Array de reseñas enviadas por los participantes tras la sesión
        reviews: [{
            byEmail: String,
            stars: Number,
            tags: [String],
            note: String,
            createdAt: String
        }]
    }],

    // ── Pagos mensuales al gimnasio ────────────────────────────────────────
    // Cada entrada registra el mes (formato "YYYY-MM"), la fecha y el monto
    // cobrado según el precioMensual del entrenador en ese momento.
    pagos: [{
        mes: { type: String, trim: true },       // "YYYY-MM"
        fecha: { type: Date, default: Date.now },
        monto: { type: Number, default: 0 }
    }],

    // Fecha en que el boxeador se inscribió en el gimnasio actual
    fechaInscripcion: {
        type: Date
    },

    // ── Eventos de calendario personales ──────────────────────────────────
    // Permite al boxeador añadir entrenamientos, combates u otros eventos
    // a su calendario dentro de la aplicación.
    calendarEvents: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        title: { type: String, required: true, trim: true },
        start: { type: String, required: true },   // Fecha/hora inicio (ISO 8601)
        end: { type: String, default: '' },
        allDay: { type: Boolean, default: true },
        color: { type: String, default: '#f97316' }, // Naranja por defecto (color de marca)
        tipo: { type: String, default: 'personalizado', trim: true },
        notas: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now }
    }]
}, {
    timestamps: true // createdAt y updatedAt automáticos
});

export default mongoose.model('Boxeador', BoxeadorSchema, 'boxeadores');
