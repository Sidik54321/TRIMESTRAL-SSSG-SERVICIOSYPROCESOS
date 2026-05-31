import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';

const usuarioBase = {
    nombre: 'Test Boxeador',
    email: 'test@gloveup.com',
    password: 'Password123',
    rol: 'boxeador',
    dniLicencia: 'DNI12345678A',
    nivel: 'Amateur',
    disciplina: 'Boxeo',
};

// ─── REGISTRO ─────────────────────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
    it('registra un boxeador correctamente', async () => {
        const res = await request(app).post('/api/auth/register').send(usuarioBase);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.email).toBe(usuarioBase.email);
        expect(res.body.rol).toBe('boxeador');
    });

    it('registra un entrenador correctamente', async () => {
        const entrenador = {
            nombre: 'Coach Pro',
            email: 'coach@gloveup.com',
            password: 'Coach1234',
            rol: 'entrenador',
            dniLicencia: 'LIC00000001',
            especialidad: 'Boxeo',
        };
        const res = await request(app).post('/api/auth/register').send(entrenador);
        expect(res.status).toBe(201);
        expect(res.body.rol).toBe('entrenador');
    });

    it('rechaza registro sin nombre, email o contraseña', async () => {
        const res = await request(app).post('/api/auth/register').send({
            email: 'incompleto@gloveup.com',
            password: 'Pass123',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('rechaza DNI con menos de 6 caracteres', async () => {
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            email: 'nuevo@gloveup.com',
            dniLicencia: 'AB1',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/dni/i);
    });

    it('rechaza email duplicado', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            dniLicencia: 'OTRODNIXXXX',
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/email ya está registrado/i);
    });

    it('rechaza DNI duplicado', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            email: 'otro@gloveup.com',
        });
        expect(res.status).toBe(409);
    });

    it('rechaza rol no permitido', async () => {
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            email: 'admin@gloveup.com',
            dniLicencia: 'ADMINDNIXX1',
            rol: 'admin',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/tipo de cuenta inválido/i);
    });
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
    it('inicia sesión con credenciales correctas', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/login').send({
            email: usuarioBase.email,
            password: usuarioBase.password,
        });
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('id');
        expect(res.body.email).toBe(usuarioBase.email);
        expect(res.body.rol).toBe('boxeador');
    });

    it('rechaza contraseña incorrecta', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/login').send({
            email: usuarioBase.email,
            password: 'ContraseñaMal',
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/credenciales inválidas/i);
    });

    it('rechaza email que no existe', async () => {
        const res = await request(app).post('/api/auth/login').send({
            email: 'fantasma@gloveup.com',
            password: 'Password123',
        });
        expect(res.status).toBe(401);
    });

    it('rechaza solicitud sin credenciales', async () => {
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/credenciales incompletas/i);
    });
});

// ─── RECUPERAR CONTRASEÑA ─────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
    it('actualiza la contraseña con email y DNI correctos', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/forgot-password').send({
            email: usuarioBase.email,
            dniLicencia: usuarioBase.dniLicencia,
            password: 'NuevaPassword999',
        });
        expect(res.status).toBe(200);
        expect(res.body.ok).toBe(true);
    });

    it('rechaza DNI incorrecto', async () => {
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/forgot-password').send({
            email: usuarioBase.email,
            dniLicencia: 'DNIINCORRECTO',
            password: 'NuevaPass999',
        });
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/dni\/licencia incorrecto/i);
    });

    it('rechaza email inexistente', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({
            email: 'noexiste@gloveup.com',
            dniLicencia: 'DNI12345678A',
            password: 'NuevaPass999',
        });
        expect(res.status).toBe(404);
    });

    it('rechaza solicitud con campos vacíos', async () => {
        const res = await request(app).post('/api/auth/forgot-password').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
