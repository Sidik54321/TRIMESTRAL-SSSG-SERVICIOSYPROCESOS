/**
 * models/Gimnasio.js — Modelo de datos para la colección "gimnasios"
 *
 * Representa un gimnasio de boxeo registrado en la plataforma GloveUp.
 *
 * Un gimnasio puede ser creado por un entrenador desde su perfil.
 * El campo "key" es un slug generado automáticamente a partir del nombre
 * (sin acentos, en minúsculas, con guiones) que sirve de identificador
 * URL-friendly para consultas de búsqueda rápida.
 *
 * La lógica de creación/actualización en routes/gimnasios.js garantiza
 * que cada entrenador solo puede tener un gimnasio a su nombre (búsqueda
 * por creadoPorEmail antes de insertar uno nuevo).
 */

import mongoose from 'mongoose';

const GimnasioSchema = new mongoose.Schema({
    // Nombre visible del gimnasio
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    // Slug único generado a partir del nombre (normalizado: sin acentos, minúsculas, con guiones).
    // Se usa como identificador en búsquedas tipo /gimnasios/lookup?key=...
    key: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true
    },
    // Ciudad o zona geográfica del gimnasio
    ubicacion: {
        type: String,
        trim: true,
        default: ''
    },
    // Dirección postal completa
    direccion: {
        type: String,
        trim: true,
        default: ''
    },
    // Coordenadas geográficas (para futuros mapas interactivos)
    lat: {
        type: Number,
        default: null
    },
    lng: {
        type: Number,
        default: null
    },
    // Descripción o presentación del gimnasio
    bio: {
        type: String,
        trim: true,
        default: ''
    },
    // Array de URLs de fotos del gimnasio (máximo 12, validado en la ruta)
    fotos: {
        type: [String],
        default: []
    },
    // URL de la foto principal/portada del gimnasio
    fotoPerfil: {
        type: String,
        default: ''
    },
    // Email de contacto público del gimnasio
    correoContacto: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    telefono: {
        type: String,
        trim: true,
        default: ''
    },
    // Email del entrenador que creó (y "posee") este gimnasio.
    // Se usa para determinar si un gimnasio ya existe bajo otro dueño.
    creadoPorEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    // Horario de apertura en texto libre (ej: "L-V 9:00-21:00")
    horario: {
        type: String,
        trim: true,
        default: ''
    },
    // Nombre del entrenador principal visible en el perfil del gimnasio
    nombreEntrenador: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true // createdAt y updatedAt automáticos
});

export default mongoose.model('Gimnasio', GimnasioSchema, 'gimnasios');
