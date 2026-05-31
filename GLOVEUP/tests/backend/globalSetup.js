import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

export async function setup() {
    mongod = await MongoMemoryServer.create();
    process.env.MONGO_URI = mongod.getUri();
    // Clave de 64 caracteres hex válida para AES-256-CBC en los tests
    process.env.ENCRYPTION_KEY = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
}

export async function teardown() {
    await mongod.stop();
}
