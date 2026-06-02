import mongoose from '/mongoose';

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
        ratingEntrenador: Number,
        ratingBoxeador: Number,
        noteEntrenador: String,
        noteBoxeador: String,
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
    calendarEvents: [{
        _id: {
            type: mongoose.Schema.Types.ObjectId,
            auto: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        start: {
            type: String,
            required: true
        },
        end: {
            type: String,
            default: ''
        },
        allDay: {
            type: Boolean,
            default: true
        },
        color: {
            type: String,
            default: '#f97316'
        },
        tipo: {
            type: String,
            default: 'personalizado',
            trim: true
        },
        notas: {
            type: String,
            default: '',
            trim: true
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

export default mongoose.model('Boxeador', BoxeadorSchema, 'boxeadores');