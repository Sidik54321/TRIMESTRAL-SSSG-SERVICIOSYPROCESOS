import mongoose from 'mongoose';

const EntrenadorSchema = new mongoose.Schema({
    usuarioId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Usuario',
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
    especialidad: {
        type: String,
        trim: true,
        default: 'Boxeo'
    },
    gimnasio: {
        type: String,
        trim: true
    },
    precioMensual: {
        type: Number,
        default: 0,
        min: 0
    },
    ubicacion: {
        type: String,
        trim: true
    },
    foto: {
        type: String,
        trim: true
    },
}, {
    timestamps: true
});

export default mongoose.model('Entrenador', EntrenadorSchema, 'entrenadores');
