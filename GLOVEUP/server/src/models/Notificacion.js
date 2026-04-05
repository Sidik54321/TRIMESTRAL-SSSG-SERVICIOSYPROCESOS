import mongoose from 'mongoose';

const NotificacionSchema = new mongoose.Schema({
    para:   { type: String, required: true, trim: true, lowercase: true },
    tipo:   { type: String, enum: ['mensaje', 'sparring', 'gimnasio', 'general'], default: 'general' },
    titulo: { type: String, required: true, trim: true },
    cuerpo: { type: String, default: '', trim: true },
    leida:  { type: Boolean, default: false },
    link:   { type: String, default: '' },
    de:     { type: String, default: '', trim: true, lowercase: true }
}, { timestamps: true });

NotificacionSchema.index({ para: 1, leida: 1, createdAt: -1 });

export default mongoose.model('Notificacion', NotificacionSchema, 'notificaciones');
