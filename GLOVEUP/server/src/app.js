/**
 * app.js — Configuración central de la aplicación Express
 *
 * Este archivo construye y configura la instancia principal de Express:
 *  - Middlewares globales de seguridad (CORS, cabeceras HTTP, rate limiting)
 *  - Sanitización de entradas para prevenir inyecciones NoSQL
 *  - Parseo del cuerpo de las peticiones (JSON / URL-encoded)
 *  - Montaje de todos los routers de la API
 *
 * La aplicación se exporta como módulo; el arranque del servidor
 * HTTP ocurre en index.js.
 */

import express from 'express';
import boxeadoresRouter from './routes/boxeadores.js';
import entrenadoresRouter from './routes/entrenadores.js';
import gimnasiosRouter from './routes/gimnasios.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import chatRouter from './routes/chat.js';
import notificacionesRouter from './routes/notificaciones.js';
import adminRouter from './routes/admin.js';

const app = express();

// ─── CORS ──────────────────────────────────────────────────────────────────
// Permite peticiones cruzadas desde el frontend (o cualquier origen si la
// variable de entorno ALLOWED_ORIGINS no está definida).
// Las peticiones OPTIONS (preflight) se responden de inmediato con 200.
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ─── CABECERAS DE SEGURIDAD HTTP ───────────────────────────────────────────
// Equivalente manual a helmet.js; se añaden cabeceras estándar para mitigar
// ataques comunes de navegador sin depender de librerías externas.
app.use((req, res, next) => {
    // Impide que el navegador "olfatee" el tipo MIME de la respuesta
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Prohíbe que la página se muestre dentro de un iframe (clickjacking)
    res.setHeader('X-Frame-Options', 'DENY');
    // Activa el filtro XSS del navegador (legacy, pero útil en IE/Edge antiguos)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    // Fuerza HTTPS durante 1 año en el navegador del cliente
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// ─── RATE LIMITING ─────────────────────────────────────────────────────────
// Implementación propia sin express-rate-limit.
// Cada IP puede hacer como máximo 300 peticiones en una ventana de 15 minutos.
// Los contadores se almacenan en memoria (Map); se reinician cuando expira
// la ventana de tiempo de esa IP.
const rateLimitCache = new Map();
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000; // Ventana de 15 minutos en milisegundos
    const limit = 300;                // Máximo de peticiones por ventana

    if (!rateLimitCache.has(ip)) {
        // Primera petición de esta IP: crear entrada con contador 1
        rateLimitCache.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const userData = rateLimitCache.get(ip);
    if (now > userData.resetTime) {
        // La ventana ha expirado: reiniciar el contador para esta IP
        userData.count = 1;
        userData.resetTime = now + windowMs;
        return next();
    }

    userData.count++;
    if (userData.count > limit) {
        // IP ha superado el límite: responder 429 Too Many Requests
        return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor, inténtalo más tarde.' });
    }
    next();
});

// ─── PARSEO DEL CUERPO DE LAS PETICIONES ──────────────────────────────────
// Permite recibir JSON y datos de formularios codificados en URL.
// El límite de 100 MB soporta el envío de imágenes en base64.
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ─── SANITIZACIÓN CONTRA INYECCIONES NOSQL ────────────────────────────────
// MongoDB ejecuta operadores especiales si las claves empiezan por "$" o
// contienen ".". Esta función elimina recursivamente esas claves peligrosas
// del objeto recibido antes de que llegue a cualquier controlador.
const sanitizeInput = (obj) => {
    if (obj instanceof Object) {
        for (const key in obj) {
            if (key.includes('$') || key.includes('.')) {
                // Clave potencialmente peligrosa: eliminar del objeto
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                // Profundizar recursivamente en objetos anidados
                sanitizeInput(obj[key]);
            }
        }
    }
};

// Aplicar la sanitización a body, query string y params de ruta en cada petición
app.use((req, res, next) => {
    if (req.body) sanitizeInput(req.body);
    if (req.query) sanitizeInput(req.query);
    if (req.params) sanitizeInput(req.params);
    next();
});

// ─── ENDPOINTS DE ESTADO (HEALTH CHECK) ───────────────────────────────────
// Usados por Docker/orquestadores para verificar que el servidor responde.
app.get('/', (req, res) => {
    res.json({ mensaje: 'Servidor funcionando 🚀' });
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// ─── MONTAJE DE RUTAS DE LA API ────────────────────────────────────────────
// Cada router gestiona un recurso independiente bajo el prefijo /api/...
app.use('/api/boxeadores', boxeadoresRouter);
app.use('/api/entrenadores', entrenadoresRouter);
app.use('/api/gimnasios', gimnasiosRouter);
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notificaciones', notificacionesRouter);
app.use('/api/admin', adminRouter);

export default app;
