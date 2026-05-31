/**
 * tests/backend/health.test.js — Tests de los endpoints de estado del servidor.
 *
 * Cubre los endpoints de salud definidos en server/src/app.js:
 *  - GET /          → Mensaje de bienvenida (usado por proxies y orquestadores)
 *  - GET /api/health → Respuesta de estado { ok: true } (usado por Docker HEALTHCHECK)
 *  - GET /ruta-inexistente → Debe devolver 404 (not found handler)
 *  - Cabeceras de seguridad HTTP → Verificar que el middleware las aplica correctamente
 *
 * Aunque son simples, estos tests son importantes porque garantizan que:
 *  - El servidor arranca sin errores antes de la suite completa.
 *  - Los middlewares de seguridad (equivalentes a helmet.js) están activos.
 *  - Cualquier cambio en app.js que rompa el arranque falla aquí de forma clara.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';

describe('Health endpoints', () => {
    it('GET / devuelve mensaje de bienvenida', async () => {
        // El endpoint raíz sirve como señal de vida básica del servidor
        const res = await request(app).get('/');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('mensaje');
        expect(typeof res.body.mensaje).toBe('string');
    });

    it('GET /api/health devuelve ok: true', async () => {
        // Endpoint específico para health checks de Docker/Kubernetes
        const res = await request(app).get('/api/health');
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('GET de ruta inexistente devuelve 404', async () => {
        // El handler de "ruta no encontrada" de Express debe responder con 404
        const res = await request(app).get('/api/ruta-que-no-existe');
        expect(res.status).toBe(404);
    });

    it('Cabeceras de seguridad están presentes', async () => {
        // Verificar que el middleware de seguridad (equivalente a helmet.js)
        // aplica las cabeceras X-Content-Type-Options y X-Frame-Options en todas
        // las respuestas, incluyendo los endpoints de health.
        const res = await request(app).get('/api/health');
        expect(res.headers['x-content-type-options']).toBe('nosniff'); // Previene MIME sniffing
        expect(res.headers['x-frame-options']).toBe('DENY');            // Previene clickjacking
    });
});
