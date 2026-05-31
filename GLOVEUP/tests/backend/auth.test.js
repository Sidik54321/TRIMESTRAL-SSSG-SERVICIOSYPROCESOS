/**
 * tests/backend/auth.test.js — Tests de integración para las rutas de autenticación.
 *
 * Cubre los tres endpoints de auth.js:
 *  - POST /api/auth/register      → Registro de nuevos usuarios
 *  - POST /api/auth/login         → Inicio de sesión
 *  - POST /api/auth/forgot-password → Recuperación de contraseña via DNI
 *
 * Tests de integración "reales":
 *  - Usan Supertest para hacer peticiones HTTP contra la app Express.
 *  - Usan MongoMemoryServer (configurado en globalSetup.js) para una BD real.
 *  - No hay mocks: se prueban los flujos completos incluyendo bcrypt y AES-256-CBC.
 *
 * El objeto usuarioBase define un boxeador de prueba reutilizado por varios tests.
 */

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../server/src/app.js';

// Datos del usuario de prueba base (reutilizado en múltiples tests)
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
        // El registro correcto debe devolver 201 con id, email y rol del nuevo usuario
        const res = await request(app).post('/api/auth/register').send(usuarioBase);
        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('id');
        expect(res.body.email).toBe(usuarioBase.email);
        expect(res.body.rol).toBe('boxeador');
    });

    it('registra un entrenador correctamente', async () => {
        // El rol 'entrenador' crea un documento Entrenador en lugar de Boxeador
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
        // Campos obligatorios ausentes → 400 con mensaje de error
        const res = await request(app).post('/api/auth/register').send({
            email: 'incompleto@gloveup.com',
            password: 'Pass123',
        });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });

    it('rechaza DNI con menos de 6 caracteres', async () => {
        // El DNI debe tener entre 6 y 20 caracteres alfanuméricos
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            email: 'nuevo@gloveup.com',
            dniLicencia: 'AB1',
        });
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/dni/i);
    });

    it('rechaza email duplicado', async () => {
        // El segundo registro con el mismo email debe devolver 409 Conflict
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            dniLicencia: 'OTRODNIXXXX', // DNI diferente para no duplicar ese también
        });
        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/email ya está registrado/i);
    });

    it('rechaza DNI duplicado', async () => {
        // El mismo DNI no puede estar registrado por dos usuarios distintos
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/register').send({
            ...usuarioBase,
            email: 'otro@gloveup.com', // Email diferente, mismo DNI
        });
        expect(res.status).toBe(409);
    });

    it('rechaza rol no permitido', async () => {
        // Solo se permiten 'boxeador' y 'entrenador' en el registro público
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
        // Flujo completo: registrar → login → verificar respuesta con datos del usuario
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
        // bcrypt.compare devuelve false → 401 con mensaje genérico
        await request(app).post('/api/auth/register').send(usuarioBase);
        const res = await request(app).post('/api/auth/login').send({
            email: usuarioBase.email,
            password: 'ContraseñaMal',
        });
        expect(res.status).toBe(401);
        // El mensaje debe ser genérico para no revelar si el email existe (enumeración)
        expect(res.body.error).toMatch(/credenciales inválidas/i);
    });

    it('rechaza email que no existe', async () => {
        // Usuario inexistente → 401 (mismo código que contraseña incorrecta por seguridad)
        const res = await request(app).post('/api/auth/login').send({
            email: 'fantasma@gloveup.com',
            password: 'Password123',
        });
        expect(res.status).toBe(401);
    });

    it('rechaza solicitud sin credenciales', async () => {
        // Body vacío → 400 antes de buscar en la BD
        const res = await request(app).post('/api/auth/login').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/credenciales incompletas/i);
    });
});

// ─── RECUPERAR CONTRASEÑA ─────────────────────────────────────────────────────

describe('POST /api/auth/forgot-password', () => {
    it('actualiza la contraseña con email y DNI correctos', async () => {
        // Flujo completo: registrar → recuperar con DNI correcto → verificar ok
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
        // El DNI almacenado (cifrado con AES) se descifra y compara; no coincide → 401
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
        // Usuario no encontrado → 404 (no 401, para indicar que no hay nada que verificar)
        const res = await request(app).post('/api/auth/forgot-password').send({
            email: 'noexiste@gloveup.com',
            dniLicencia: 'DNI12345678A',
            password: 'NuevaPass999',
        });
        expect(res.status).toBe(404);
    });

    it('rechaza solicitud con campos vacíos', async () => {
        // Body vacío → 400 antes de acceder a la BD
        const res = await request(app).post('/api/auth/forgot-password').send({});
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
    });
});
