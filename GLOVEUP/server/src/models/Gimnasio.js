import mongoose from 'mongoose';

const GimnasioSchema = new mongoose.Schema({
    nombre: {
        type: String,
        required: true,
        trim: true
    },
    key: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        unique: true,
        index: true
    },
    ubicacion: {
        type: String,
        trim: true,
        default: ''
    },
    direccion: {
        type: String,
        trim: true,
        default: ''
    },
    lat: {
        type: Number,
        default: null
    },
    lng: {
        type: Number,
        default: null
    },
    bio: {
        type: String,
        trim: true,
        default: ''
    },
    fotos: {
        type: [String],
        default: []
    },
    fotoPerfil: {
        type: String,
        default: ''
    },
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
    creadoPorEmail: {
        type: String,
        trim: true,
        lowercase: true,
        default: ''
    },
    horario: {
        type: String,
        trim: true,
        default: ''
    },
    nombreEntrenador: {
        type: String,
        trim: true,
        default: ''
    }
}, {
    timestamps: true
});

export default mongoose.model('Gimnasio', GimnasioSchema, 'gimnasios');