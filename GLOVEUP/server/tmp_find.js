import mongoose from 'mongoose';
import fs from 'fs';

async function buscar() {
  try {
    await mongoose.connect('mongodb://127.0.0.1:27017/gloveup');
    const db = mongoose.connection.db;
    
    const colecciones = ['usuarios', 'boxeadors', 'entrenadors'];
    let encontrados = {};

    for (const c of colecciones) {
      const resultados = await db.collection(c).find({
        $or: [
          { email: /examen2/i },
          { nombre: /examen2/i }
        ]
      }).toArray();

      if (resultados.length > 0) {
        encontrados[c] = resultados;
      }
    }

    fs.writeFileSync('tmp_res.json', JSON.stringify(encontrados, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}

buscar();
