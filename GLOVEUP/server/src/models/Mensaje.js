import mongoose from 'mongoose';

const MensajeSchema = new mongoose.Schema({
    de:    { type: String, required: true, trim: true, lowercase: true },
    para:  { type: String, required: true, trim: true, lowercase: true },
    texto: { type: String, required: true, trim: true, maxlength: 2000 },
    leido: { type: Boolean, default: false }
}, { timestamps: true });

MensajeSchema.index({ de: 1, para: 1, createdAt: 1 });
MensajeSchema.index({ para: 1, leido: 1 });

export default mongoose.model('Mensaje', MensajeSchema, 'mensajes');
