import mongoose from 'mongoose';

const BoxeadorSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
        index: true,
        sparse: true
    },
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
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true
    },
    dniLicencia: {
        type: String,
        trim: true,
        uppercase: true,
        unique: true,
        sparse: true
    },
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
    gimnasio: {
        type: String,
        trim: true
    },
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
    frecuenciaSparring: {
        type: String,
        enum: ['Diaria', 'Semanal', 'Mensual'],
        default: 'Semanal'
    },
    guardia: {
        type: String,
        enum: ['Diestro', 'Zurdo'],
        default: 'Diestro'
    },
    foto: {
        type: String,
        trim: true
    },
    record: {
        type: String,
        trim: true
    },
    altura: {
        type: String,
        trim: true
    },
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
    sparringHistory: [{
        date: String,
        partner: String,
        place: String,
        notes: String
    }],
    sparringChallengesSent: [{
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
        gymName: String,
        scheduledAt: String,
        status: String,
        createdAt: String,
        respondedAt: String
    }],
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
        gymName: String,
        scheduledAt: String,
        status: String,
        createdAt: String,
        respondedAt: String
    }],
    sparringSessions: [{
        id: String,
        challengeId: String,
        boxerAEmail: String,
        boxerANombre: String,
        boxerBEmail: String,
        boxerBNombre: String,
        coachIds: [String],
        coachNombres: [String],
        coachEmails: [String],
        gymName: String,
        scheduledAt: String,
        status: String,
        createdAt: String,
        completedAt: String,
        reviews: [{
            byEmail: String,
            stars: Number,
            tags: [String],
            note: String,
            createdAt: String
        }]
    }],
    fechaInscripcion: {
        type: Date
    },
}, {
    timestamps: true
});

export default mongoose.model('Boxeador', BoxeadorSchema, 'boxeadores');