import mongoose from 'mongoose';
import app from './app.js';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

const connectWithRetry = (attempts = 0) => {
    mongoose.connect(uri).then(() => {
        console.log("✅ Conectado a MongoDB:", uri);
    }).catch((err) => {
        if (attempts < 10) {
            console.log(`⏳ MongoDB no disponible, reintentando (${attempts + 1}/10)...`);
            setTimeout(() => connectWithRetry(attempts + 1), 3000);
        } else {
            console.error("❌ No se pudo conectar a MongoDB:", err.message);
            process.exit(1);
        }
    });
};

connectWithRetry();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
});
