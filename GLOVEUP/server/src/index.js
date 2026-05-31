/**
 * index.js — Punto de entrada del servidor
 *
 * Se encarga de dos responsabilidades:
 *  1. Conectar a la base de datos MongoDB con lógica de reintento automático
 *     (hasta 10 intentos con 3 s de espera entre ellos).
 *  2. Arrancar el servidor HTTP Express en el puerto configurado.
 *
 * La aplicación Express ya está construida y exportada en app.js;
 * aquí solo se levanta el listener HTTP.
 */

import mongoose from 'mongoose';
import app from './app.js';

// URI de MongoDB: se lee de la variable de entorno o se usa un valor local por defecto
const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

/**
 * Conecta a MongoDB con reintentos exponenciales simples.
 * Si falla 10 veces seguidas, termina el proceso con código de error.
 *
 * @param {number} attempts - Número de intentos ya realizados (empieza en 0)
 */
const connectWithRetry = (attempts = 0) => {
    mongoose.connect(uri).then(() => {
        console.log("✅ Conectado a MongoDB:", uri);
    }).catch((err) => {
        if (attempts < 10) {
            // Esperar 3 segundos antes de volver a intentar la conexión
            console.log(`⏳ MongoDB no disponible, reintentando (${attempts + 1}/10)...`);
            setTimeout(() => connectWithRetry(attempts + 1), 3000);
        } else {
            // Se agotaron los reintentos: abortar el proceso para que el
            // orquestador (Docker, PM2…) pueda reiniciarlo
            console.error("❌ No se pudo conectar a MongoDB:", err.message);
            process.exit(1);
        }
    });
};

// Iniciar el intento de conexión a la base de datos
connectWithRetry();

// ─── ARRANQUE DEL SERVIDOR HTTP ────────────────────────────────────────────
// El puerto se lee de la variable de entorno PORT (útil en entornos de nube)
// o se usa el 3000 por defecto para desarrollo local.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🔥 Servidor corriendo en http://localhost:${PORT}`);
});
