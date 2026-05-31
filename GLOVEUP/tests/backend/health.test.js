import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';

describe('Health endpoints', () => {
    it('GET / devuelve mensaje de bienvenida', async () => {
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mensaje');
        expect(typeof res.body.mensaje).toBe('string');
    });

    it('GET /api/health devuelve ok: true', async () => {
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('GET de ruta inexistente devuelve 404', async () => {
        const res = await request(app).get('/api/ruta-que-no-existe');
        expect(res.status).toBe(404);
    });

    it('Cabeceras de seguridad están presentes', async () => {
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff');
        expect(res.headers['x-frame-options']).toBe('DENY');
    });
});
