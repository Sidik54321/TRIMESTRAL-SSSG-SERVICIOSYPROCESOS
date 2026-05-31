/**
 * tests/frontend/validators.test.js — Tests unitarios de las funciones de validación.
 *
 * Cubre auth/validators.js: todas las funciones puras de validación de formularios.
 *
 * Estos tests son puramente unitarios: no requieren DOM, BD ni red.
 * Cada función se prueba de forma aislada con valores válidos, inválidos y edge cases.
 *
 * Funciones probadas:
 *  - isValidEmail:      Formato de email (regex RFC básico)
 *  - isValidPassword:   Longitud mínima de 8 caracteres
 *  - isValidDni:        DNI/Licencia entre 6 y 20 caracteres
 *  - doPasswordsMatch:  Comparación estricta de dos contraseñas
 *  - escapeRegex:       Escape de caracteres especiales para uso en RegExp
 *  - isValidName:       Nombre entre 2 y 100 caracteres (sin espacios en blanco)
 */

import { describe, it, expect } from 'vitest';
import {
    isValidEmail,
    isValidPassword,
    isValidDni,
    doPasswordsMatch,
    escapeRegex,
    isValidName,
} from '../../auth/validators.js';

// ─── EMAIL ─────────────────────────────────────────────────────────────────────

describe('isValidEmail', () => {
    it('acepta emails correctos', () => {
        // Formatos estándar, con alias y con subdominios deben ser válidos
        expect(isValidEmail('usuario@gloveup.com')).toBe(true);
        expect(isValidEmail('test+alias@dominio.org')).toBe(true);
        expect(isValidEmail('nombre.apellido@sub.dominio.es')).toBe(true);
    });

    it('rechaza emails mal formados', () => {
        // Sin @, sin usuario, sin dominio → todos inválidos
        expect(isValidEmail('no-es-email')).toBe(false);
        expect(isValidEmail('@sinusuario.com')).toBe(false);
        expect(isValidEmail('sindominio@')).toBe(false);
        expect(isValidEmail('')).toBe(false);
    });

    it('rechaza valores que no son strings', () => {
        // La función espera un string; null/undefined/número son inválidos
        expect(isValidEmail(null)).toBe(false);
        expect(isValidEmail(undefined)).toBe(false);
        expect(isValidEmail(123)).toBe(false);
    });
});

// ─── CONTRASEÑA ───────────────────────────────────────────────────────────────

describe('isValidPassword', () => {
    it('acepta contraseñas de 8 o más caracteres', () => {
        // Exactamente 8 (límite mínimo), y contraseñas más largas
        expect(isValidPassword('Password1')).toBe(true);
        expect(isValidPassword('12345678')).toBe(true);
        expect(isValidPassword('muy_larga_contraseña_segura_123!')).toBe(true);
    });

    it('rechaza contraseñas de menos de 8 caracteres', () => {
        // 3, 7 y 0 caracteres → todos inválidos
        expect(isValidPassword('abc')).toBe(false);
        expect(isValidPassword('1234567')).toBe(false); // 7 = menos de 8
        expect(isValidPassword('')).toBe(false);
    });

    it('rechaza valores que no son strings', () => {
        // null y undefined no tienen .length → deben devolver false
        expect(isValidPassword(null)).toBe(false);
        expect(isValidPassword(undefined)).toBe(false);
    });
});

// ─── DNI / LICENCIA ──────────────────────────────────────────────────────────

describe('isValidDni', () => {
    it('acepta DNI con longitud entre 6 y 20 caracteres', () => {
        // Formatos típicos de DNI, licencia numérica y licencia alfanumérica
        expect(isValidDni('DNI12345678A')).toBe(true);
        expect(isValidDni('123456')).toBe(true);          // Límite mínimo (6 chars)
        expect(isValidDni('LICENCIA-000001')).toBe(true);
    });

    it('rechaza DNI demasiado corto', () => {
        // Menos de 6 caracteres → inválido
        expect(isValidDni('AB1')).toBe(false);  // 3 chars
        expect(isValidDni('')).toBe(false);
    });

    it('rechaza DNI demasiado largo', () => {
        // Más de 20 caracteres → inválido (previene ataques de desbordamiento)
        expect(isValidDni('A'.repeat(21))).toBe(false);
    });

    it('acepta valores nulos/undefined devolviéndolos como inválidos', () => {
        // La función hace (dni || '').toString() internamente, así que no lanza
        expect(isValidDni(null)).toBe(false);
        expect(isValidDni(undefined)).toBe(false);
    });
});

// ─── CONTRASEÑAS COINCIDENTES ─────────────────────────────────────────────────

describe('doPasswordsMatch', () => {
    it('devuelve true cuando ambas contraseñas son iguales', () => {
        expect(doPasswordsMatch('MiPass123', 'MiPass123')).toBe(true);
    });

    it('devuelve false cuando las contraseñas no coinciden', () => {
        expect(doPasswordsMatch('MiPass123', 'OtraPass456')).toBe(false);
    });

    it('es sensible a mayúsculas', () => {
        // La comparación es estricta (===); 'p' ≠ 'P'
        expect(doPasswordsMatch('password', 'Password')).toBe(false);
    });

    it('devuelve false si una está vacía', () => {
        expect(doPasswordsMatch('MiPass123', '')).toBe(false);
    });
});

// ─── ESCAPE REGEX ─────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
    it('escapa puntos y signos especiales de regex', () => {
        // Estos caracteres tienen significado especial en RegExp y deben escaparse
        expect(escapeRegex('user.name+test')).toBe('user\\.name\\+test');
        expect(escapeRegex('precio$')).toBe('precio\\$');
        expect(escapeRegex('a(b)c')).toBe('a\\(b\\)c');
    });

    it('devuelve cadena vacía si el input es nulo o vacío', () => {
        // Manejo defensivo de valores falsy
        expect(escapeRegex(null)).toBe('');
        expect(escapeRegex('')).toBe('');
        expect(escapeRegex(undefined)).toBe('');
    });

    it('no altera cadenas sin caracteres especiales', () => {
        // Strings alfanuméricos normales no deben cambiar
        expect(escapeRegex('nombreNormal123')).toBe('nombreNormal123');
    });
});

// ─── NOMBRE ───────────────────────────────────────────────────────────────────

describe('isValidName', () => {
    it('acepta nombres entre 2 y 100 caracteres', () => {
        // Nombre mínimo (2 chars) y nombre compuesto con espacios
        expect(isValidName('Al')).toBe(true);
        expect(isValidName('Juan García López')).toBe(true);
    });

    it('rechaza nombre de 1 carácter o vacío', () => {
        // 1 char, vacío y solo espacios → inválidos (trim reduce a longitud < 2)
        expect(isValidName('A')).toBe(false);
        expect(isValidName('')).toBe(false);
        expect(isValidName('   ')).toBe(false); // Solo espacios → trim → ""
    });

    it('rechaza nombres excesivamente largos', () => {
        // Más de 100 caracteres → probablemente un error o intento de inyección
        expect(isValidName('A'.repeat(101))).toBe(false);
    });
});
