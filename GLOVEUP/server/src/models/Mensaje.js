/**
 * models/Mensaje.js — Modelo de datos para la colección "mensajes"
 *
 * Representa un mensaje individual del sistema de chat interno de GloveUp.
 *
 * El chat funciona mediante polling: el frontend consulta periódicamente
 * el endpoint GET /api/chat/mensajes para obtener mensajes nuevos, sin
 * necesidad de WebSockets ni conexiones persistentes.
 *
 * Cada mensaje almacena el remitente ("de"), el destinatario ("para"),
 * el texto y un flag de lectura. Los índices compuestos optimizan las
 * consultas más frecuentes:
 *  - Recuperar el hilo entre dos personas (de + para + createdAt)
 *  - Contar mensajes no leídos de un usuario (para + leido)
 */

import mongoose from 'mongoose';

const MensajeSchema = new mongoose.Schema({
    de:    { type: String, required: true, trim: true, lowercase: true }, // Email del remitente
    para:  { type: String, required: true, trim: true, lowercase: true }, // Email del destinatario
    texto: { type: String, required: true, trim: true, maxlength: 2000 }, // Contenido del mensaje (máx. 2000 chars)
    leido: { type: Boolean, default: false }                               // false = no leído, true = leído
}, { timestamps: true }); // createdAt usado para ordenar el hilo cronológicamente

// Índice compuesto para recuperar el hilo de conversación entre dos usuarios con paginación
MensajeSchema.index({ de: 1, para: 1, createdAt: 1 });
// Índice para el conteo rápido de mensajes no leídos de un destinatario
MensajeSchema.index({ para: 1, leido: 1 });

export default mongoose.model('Mensaje', MensajeSchema, 'mensajes');
