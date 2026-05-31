/**
 * models/Notificacion.js — Modelo de datos para la colección "notificaciones"
 *
 * Representa una notificación del sistema enviada a un usuario de GloveUp.
 *
 * Las notificaciones se generan automáticamente desde el backend (sin
 * WebSockets) en respuesta a eventos relevantes:
 *  - Nuevo mensaje de chat recibido
 *  - Reto de sparring enviado, recibido, aprobado o rechazado
 *  - Alta o baja en un gimnasio
 *  - Confirmación de pago mensual
 *
 * El frontend consulta periódicamente GET /api/notificaciones/no-leidas
 * para mostrar el badge de notificaciones en la interfaz.
 *
 * El índice compuesto (para + leida + createdAt DESC) optimiza la consulta
 * más habitual: obtener las notificaciones no leídas más recientes de un usuario.
 */

import mongoose from 'mongoose';

const NotificacionSchema = new mongoose.Schema({
    para:   { type: String, required: true, trim: true, lowercase: true }, // Email del destinatario
    // Categoría de la notificación (determina el icono en el frontend)
    tipo:   { type: String, enum: ['mensaje', 'sparring', 'gimnasio', 'general'], default: 'general' },
    titulo: { type: String, required: true, trim: true },                  // Título corto visible en el listado
    cuerpo: { type: String, default: '', trim: true },                     // Descripción detallada (opcional)
    leida:  { type: Boolean, default: false },                             // false = nueva, true = vista
    // Enlace opcional para redirigir al usuario al contexto relacionado
    link:   { type: String, default: '' },
    de:     { type: String, default: '', trim: true, lowercase: true }     // Email del emisor del evento
}, { timestamps: true }); // createdAt para ordenar por recencia

// Índice compuesto: acelera la consulta "dame las X últimas notificaciones no leídas de este usuario"
NotificacionSchema.index({ para: 1, leida: 1, createdAt: -1 });

export default mongoose.model('Notificacion', NotificacionSchema, 'notificaciones');
