import express from 'express';
import mongoose from 'mongoose';
import boxeadoresRouter from './routes/boxeadores.js';
import entrenadoresRouter from './routes/entrenadores.js';
import gimnasiosRouter from './routes/gimnasios.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';
import chatRouter from './routes/chat.js';

const app = express();

// CORS — middleware propio sin dependencia externa
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));

// 🔥 Conexión a MongoDB
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

mongoose
    .connect(uri)
    .then(() => console.log("✅ Conectado a MongoDB"))
    .catch((err) => console.log("❌ Error de conexión:", err));

// Ruta de prueba
app.get("/", (req, res) => {
    res.json({
        mensaje: "Servidor funcionando 🚀"
    });
});

app.get('/api/health', (req, res) => {
    res.json({
        ok: true
    });
});

// Rutas de la API
app.use('/api/boxeadores', boxeadoresRouter);
app.use('/api/entrenadores', entrenadoresRouter);
app.use('/api/gimnasios', gimnasiosRouter);
app.use('/api/auth', authRouter);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/chat', chatRouter);

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
});