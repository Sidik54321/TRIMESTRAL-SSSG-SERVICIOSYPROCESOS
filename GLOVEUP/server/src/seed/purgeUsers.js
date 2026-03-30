import 'dotenv/config';
import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

await mongoose.connect(uri);

const db = mongoose.connection.db;
const collections = ['usuarios', 'boxeadors', 'boxeadores', 'entrenadors', 'entrenadores'];

for (const name of collections) {
    try {
        const result = await db.collection(name).deleteMany({});
        console.log(`${name}: ${result.deletedCount}`);
    } catch (err) {
        console.log(`${name}: 0`);
    }
}

await mongoose.disconnect();
