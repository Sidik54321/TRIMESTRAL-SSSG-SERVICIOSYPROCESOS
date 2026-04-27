import mongoose from 'mongoose';
import Usuario from '../models/Usuario.js';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Gimnasio from '../models/Gimnasio.js';
import Mensaje from '../models/Mensaje.js';
import Notificacion from '../models/Notificacion.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

async function cleanup() {
    try {
        console.log('⏳ Conectando a MongoDB para limpieza...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Conectado.');

        console.log('🧹 Borrando colecciones...');
        
        const results = await Promise.allSettled([
            Usuario.deleteMany({}),
            Boxeador.deleteMany({}),
            Entrenador.deleteMany({}),
            Gimnasio.deleteMany({}),
            Mensaje.deleteMany({}),
            Notificacion.deleteMany({})
        ]);

        results.forEach((res, i) => {
            if (res.status === 'fulfilled') {
                console.log(`✅ Colección ${i} limpiada.`);
            } else {
                console.log(`❌ Error limpiando colección ${i}:`, res.reason);
            }
        });

        console.log('✨ Base de datos limpia.');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error fatal:', err);
        process.exit(1);
    }
}

cleanup();
