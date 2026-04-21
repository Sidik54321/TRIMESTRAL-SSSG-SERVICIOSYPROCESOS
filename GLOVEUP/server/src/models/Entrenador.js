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
    calendarEvents: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        title: { type: String, required: true, trim: true },
        start: { type: String, required: true },
        end: { type: String },
        allDay: { type: Boolean, default: true },
        color: { type: String, default: '#3b82f6' },
        tipo: { type: String, default: 'personalizado', trim: true },
        notas: { type: String, default: '', trim: true },
        createdAt: { type: Date, default: Date.now }
    }],
}, {
    timestamps: true
});

export default mongoose.model('Entrenador', EntrenadorSchema, 'entrenadores');
