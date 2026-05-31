import express from 'express';
import boxeadoresRouter from './routes/boxeadores.js';
import entrenadoresRouter from './routes/entrenadores.js';
import gimnasiosRouter from './routes/gimnasios.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import chatRouter from './routes/chat.js';
import notificacionesRouter from './routes/notificaciones.js';

const app = express();

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Cabeceras de seguridad
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
});

// Rate limiting
const rateLimitCache = new Map();
app.use((req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowMs = 15 * 60 * 1000;
    const limit = 300;

    if (!rateLimitCache.has(ip)) {
        rateLimitCache.set(ip, { count: 1, resetTime: now + windowMs });
        return next();
    }

    const userData = rateLimitCache.get(ip);
    if (now > userData.resetTime) {
        userData.count = 1;
        userData.resetTime = now + windowMs;
        return next();
    }

    userData.count++;
    if (userData.count > limit) {
        return res.status(429).json({ error: 'Demasiadas solicitudes. Por favor, inténtalo más tarde.' });
    }
    next();
});

// Parseo y sanitización NoSQL
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

const sanitizeInput = (obj) => {
    if (obj instanceof Object) {
        for (const key in obj) {
            if (key.includes('$') || key.includes('.')) {
                delete obj[key];
            } else if (typeof obj[key] === 'object') {
                sanitizeInput(obj[key]);
            }
        }
    }
};

app.use((req, res, next) => {
    if (req.body) sanitizeInput(req.body);
    if (req.query) sanitizeInput(req.query);
    if (req.params) sanitizeInput(req.params);
    next();
});

// Health
app.get('/', (req, res) => {
    res.json({ mensaje: 'Servidor funcionando 🚀' });
});

app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Rutas de la API
app.use('/api/boxeadores', boxeadoresRouter);
app.use('/api/entrenadores', entrenadoresRouter);
app.use('/api/gimnasios', gimnasiosRouter);
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/chat', chatRouter);
app.use('/api/notificaciones', notificacionesRouter);

export default app;
