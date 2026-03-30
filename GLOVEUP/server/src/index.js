import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import boxeadoresRouter from './routes/boxeadores.js';
import entrenadoresRouter from './routes/entrenadores.js';
import gimnasiosRouter from './routes/gimnasios.js';
import authRouter from './routes/auth.js';
import usuariosRouter from './routes/usuarios.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({
    limit: '50mb'
}));
app.use(express.urlencoded({
    limit: '50mb',
    extended: true
}));

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

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
});