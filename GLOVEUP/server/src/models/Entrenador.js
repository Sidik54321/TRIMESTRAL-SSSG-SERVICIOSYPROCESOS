/**
 * models/Entrenador.js — Modelo de datos para la colección "entrenadores"
 *
 * Representa el perfil profesional de un entrenador dentro de GloveUp.
 *
 * El entrenador es la figura central del gimnasio:
 *  - Gestiona a sus boxeadores (los inscribe, edita y da de baja)
 *  - Aprueba o rechaza los retos de sparring de sus pupilos
 *  - Configura el precio mensual de cuota del gimnasio
 *  - Registra eventos en su propio calendario
 *
 * La referencia usuarioId vincula este perfil con las credenciales de
 * autenticación almacenadas en la colección "usuarios".
 */

import mongoose from 'mongoose';

const EntrenadorSchema = new mongoose.Schema({
    // Referencia al documento Usuario (credenciales de acceso)
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        index: true,
        sparse: true // Permite null para entrenadores creados manualmente sin cuenta
    },
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    // Email único, sirve también de identificador en la mayoría de endpoints
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    // DNI o número de licencia de entrenador (sin cifrar, igual que en Boxeador)
    dniLicencia: {
        type: String,
        trim: true,
        uppercase: true,
        unique: true,
        sparse: true
    },
    // Especialidad deportiva (por defecto "Boxeo")
    especialidad: {
        type: String,
        trim: true,
        default: 'Boxeo'
    },
    // Nombre del gimnasio donde trabaja; se propaga a todos sus boxeadores
    // al actualizarse (ver lógica en routes/entrenadores.js → PUT /me)
    gimnasio: {
        type: String,
        trim: true
    },
    // Cuota mensual en euros que cobra a sus boxeadores
    precioMensual: {
        type: Number,
        default: 0,
        min: 0
    },
    ubicacion: {
        type: String,
        trim: true
    },
    genero: {
        type: String,
        enum: ['Masculino', 'Femenino', 'Otro'],
        default: 'Masculino'
    },
    // URL de la foto de perfil (base64 o URL externa)
    foto: {
        type: String,
        trim: true
    },

    // ── Eventos de calendario personales del entrenador ────────────────────
    // Permite añadir entrenamientos, combates de sus boxeadores u otros eventos
    // al calendario del entrenador dentro de la aplicación.
    calendarEvents: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        title: { type: String, required: true, trim: true },
        start: { type: String, required: true },   // Fecha/hora inicio (ISO 8601)
        end: { type: String },
        allDay: { type: Boolean, default: true },
        color: { type: String, default: '#3b82f6' }, // Azul por defecto (distinto al naranja de boxeadores)
        tipo: { type: String, default: 'personalizado', trim: true },
        notas: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true // createdAt y updatedAt automáticos
});

export default mongoose.model('Entrenador', EntrenadorSchema, 'entrenadores');
