/**
 * tests/backend/admin.test.js — Tests de integración para el panel de administración.
 *
 * Cubre routes/admin.js:
 *  - POST   /api/admin/login        → Contraseña de admin → token
 *  - GET    /api/admin/stats        → Contadores globales (exige token)
 *  - GET    /api/admin/usuarios     → Listado enriquecido (exige token)
 *  - POST   /api/admin/usuarios     → Crear boxeador/entrenador (exige token)
 *  - DELETE /api/admin/usuarios/:id → Eliminar usuario + perfil (exige token)
 *  - DELETE /api/admin/gimnasios/:id → Eliminar gimnasio (exige token)
 *
 * ADMIN_PASSWORD se fija en globalSetup.js a 'test-admin-password-123' para
 * que esta suite tenga un valor determinista contra el que probar.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';
import Boxeador from '../../server/src/models/Boxeador.js';
import Entrenador from '../../server/src/models/Entrenador.js';
import Gimnasio from '../../server/src/models/Gimnasio.js';

const ADMIN_PASSWORD = 'test-admin-password-123';

/** Inicia sesión de admin y devuelve el token, listo para usar en Authorization. */
async function loginAsAdmin() {
    const res = await request(app).post('/api/admin/login').send({ password: ADMIN_PASSWORD });
    return res.body.token;
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

describe('POST /api/admin/login', () => {
    it('emite un token con la contraseña correcta', async () => {
        const res = await request(app).post('/api/admin/login').send({ password: ADMIN_PASSWORD });
        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe('string');
        expect(res.body.token.length).toBeGreaterThan(20);
    });

    it('rechaza una contraseña incorrecta', async () => {
        const res = await request(app).post('/api/admin/login').send({ password: 'lo-que-sea' });
        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('error');
    });

    it('rechaza una solicitud sin contraseña', async () => {
        const res = await request(app).post('/api/admin/login').send({});
        expect(res.status).toBe(401);
    });
});

// ─── PROTECCIÓN DE RUTAS ──────────────────────────────────────────────────────

describe('rutas de administración sin token', () => {
    it('GET /api/admin/stats responde 401 sin token', async () => {
        const res = await request(app).get('/api/admin/stats');
        expect(res.status).toBe(401);
    });

    it('GET /api/admin/usuarios responde 401 con un token inventado', async () => {
        const res = await request(app).get('/api/admin/usuarios').set('Authorization', 'Bearer token-falso');
        expect(res.status).toBe(401);
    });
});

// ─── ESTADÍSTICAS ────────────────────────────────────────────────────────────

describe('GET /api/admin/stats', () => {
    it('cuenta usuarios, boxeadores, entrenadores y gimnasios reales', async () => {
        const token = await loginAsAdmin();

        await request(app).post('/api/auth/register').send({
            nombre: 'Stat Boxer', email: 'statboxer@gloveup.com', password: 'Password123',
            rol: 'boxeador', dniLicencia: 'STATDNI001',
        });
        await Gimnasio.create({ nombre: 'Stat Gym', key: 'stat-gym' });

        const res = await request(app).get('/api/admin/stats').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.usuarios).toBeGreaterThanOrEqual(1);
        expect(res.body.boxeadores).toBeGreaterThanOrEqual(1);
        expect(res.body.gimnasios).toBeGreaterThanOrEqual(1);
        expect(Array.isArray(res.body.registrosPorMes)).toBe(true);
    });
});

// ─── USUARIOS ────────────────────────────────────────────────────────────────

describe('POST /api/admin/usuarios', () => {
    it('crea un boxeador nuevo', async () => {
        const token = await loginAsAdmin();
        const res = await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'Admin Creado',
            email: 'admincreado@gloveup.com',
            password: 'Password123',
            rol: 'boxeador',
            dniLicencia: 'ADMINCREA01',
            gimnasio: 'The Ring',
        });
        expect(res.status).toBe(201);
        expect(res.body.rol).toBe('boxeador');

        const boxer = await Boxeador.findOne({ email: 'admincreado@gloveup.com' }).lean();
        expect(boxer).not.toBeNull();
        expect(boxer.gimnasio).toBe('The Ring');
    });

    it('crea un entrenador nuevo', async () => {
        const token = await loginAsAdmin();
        const res = await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'Coach Creado',
            email: 'coachcreado@gloveup.com',
            password: 'Password123',
            rol: 'entrenador',
            dniLicencia: 'COACHCREA01',
        });
        expect(res.status).toBe(201);

        const coach = await Entrenador.findOne({ email: 'coachcreado@gloveup.com' }).lean();
        expect(coach).not.toBeNull();
    });

    it('rechaza un rol distinto de boxeador/entrenador', async () => {
        const token = await loginAsAdmin();
        const res = await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'Otro Admin',
            email: 'otroadmin@gloveup.com',
            password: 'Password123',
            rol: 'admin',
            dniLicencia: 'OTROADMIN01',
        });
        expect(res.status).toBe(400);
    });

    it('rechaza sin token', async () => {
        const res = await request(app).post('/api/admin/usuarios').send({
            nombre: 'Sin Token', email: 'sintoken@gloveup.com', password: 'Password123',
            rol: 'boxeador', dniLicencia: 'SINTOKEN01',
        });
        expect(res.status).toBe(401);
    });
});

describe('GET /api/admin/usuarios', () => {
    it('lista usuarios con su gimnasio', async () => {
        const token = await loginAsAdmin();
        await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'Listado Boxer', email: 'listadoboxer@gloveup.com', password: 'Password123',
            rol: 'boxeador', dniLicencia: 'LISTADOBX01', gimnasio: 'GloveUp Central',
        });

        const res = await request(app).get('/api/admin/usuarios').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);

        const found = res.body.find((u) => u.email === 'listadoboxer@gloveup.com');
        expect(found).toBeTruthy();
        expect(found.gimnasio).toBe('GloveUp Central');
        expect(found).not.toHaveProperty('password');
    });
});

describe('DELETE /api/admin/usuarios/:id', () => {
    it('elimina un boxeador y su perfil deportivo', async () => {
        const token = await loginAsAdmin();
        const create = await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'A Borrar', email: 'aborrar@gloveup.com', password: 'Password123',
            rol: 'boxeador', dniLicencia: 'ABORRAR001',
        });

        const del = await request(app).delete(`/api/admin/usuarios/${create.body.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(del.status).toBe(200);
        expect(del.body.ok).toBe(true);

        const boxer = await Boxeador.findOne({ email: 'aborrar@gloveup.com' }).lean();
        expect(boxer).toBeNull();
    });

    it('al eliminar un entrenador, sus boxeadores quedan sin asignar (no se borran)', async () => {
        const token = await loginAsAdmin();

        const coachRes = await request(app).post('/api/admin/usuarios').set('Authorization', `Bearer ${token}`).send({
            nombre: 'Coach A Borrar', email: 'coachaborrar@gloveup.com', password: 'Password123',
            rol: 'entrenador', dniLicencia: 'COACHBORRA1',
        });
        const coach = await Entrenador.findOne({ email: 'coachaborrar@gloveup.com' });

        const boxeador = await Boxeador.create({
            nombre: 'Pupilo', email: 'pupilo@gloveup.com', dniLicencia: 'PUPILODNI01',
            entrenadorId: coach._id,
        });

        const del = await request(app).delete(`/api/admin/usuarios/${coachRes.body.id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(del.status).toBe(200);

        const pupiloTrasBorrar = await Boxeador.findById(boxeador._id).lean();
        expect(pupiloTrasBorrar).not.toBeNull(); // sigue existiendo
        expect(pupiloTrasBorrar.entrenadorId).toBeFalsy(); // pero sin entrenador
    });

    it('responde 404 si el usuario no existe', async () => {
        const token = await loginAsAdmin();
        const res = await request(app).delete('/api/admin/usuarios/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });
});

// ─── GIMNASIOS ───────────────────────────────────────────────────────────────

describe('DELETE /api/admin/gimnasios/:id', () => {
    it('elimina el gimnasio y limpia la referencia en boxeadores/entrenadores', async () => {
        const token = await loginAsAdmin();
        const gym = await Gimnasio.create({ nombre: 'Gimnasio Borrable', key: 'gimnasio-borrable' });
        const boxeador = await Boxeador.create({
            nombre: 'Con Gimnasio', email: 'congimnasio@gloveup.com', dniLicencia: 'CONGIMNAS1',
            gimnasio: 'Gimnasio Borrable',
        });

        const res = await request(app).delete(`/api/admin/gimnasios/${gym._id}`)
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);

        const gymTrasBorrar = await Gimnasio.findById(gym._id).lean();
        expect(gymTrasBorrar).toBeNull();

        const boxerTrasBorrar = await Boxeador.findById(boxeador._id).lean();
        expect(boxerTrasBorrar.gimnasio).toBe('');
    });

    it('responde 404 si el gimnasio no existe', async () => {
        const token = await loginAsAdmin();
        const res = await request(app).delete('/api/admin/gimnasios/000000000000000000000000')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(404);
    });

    it('rechaza sin token', async () => {
        const gym = await Gimnasio.create({ nombre: 'Otro Gym', key: 'otro-gym' });
        const res = await request(app).delete(`/api/admin/gimnasios/${gym._id}`);
        expect(res.status).toBe(401);
    });
});
