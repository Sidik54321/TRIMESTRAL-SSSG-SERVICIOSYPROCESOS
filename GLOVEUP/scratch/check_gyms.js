import mongoose from 'mongoose';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloveup';

async function check() {
    await mongoose.connect(uri);
    const Gimnasio = mongoose.model('Gimnasio', new mongoose.Schema({}, { strict: false }));
    const gyms = await Gimnasio.find({ nombre: /Glove Up/i }).lean();
    console.log(JSON.stringify(gyms, null, 2));
    await mongoose.disconnect();
}

check();
