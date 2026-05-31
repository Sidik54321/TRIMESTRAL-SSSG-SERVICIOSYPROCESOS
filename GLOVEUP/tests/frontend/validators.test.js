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
        expect(isValidEmail('usuario@gloveup.com')).toBe(true);
        expect(isValidEmail('test+alias@dominio.org')).toBe(true);
        expect(isValidEmail('nombre.apellido@sub.dominio.es')).toBe(true);
    });

    it('rechaza emails mal formados', () => {
        expect(isValidEmail('no-es-email')).toBe(false);
        expect(isValidEmail('@sinusuario.com')).toBe(false);
        expect(isValidEmail('sindominio@')).toBe(false);
        expect(isValidEmail('')).toBe(false);
    });

    it('rechaza valores que no son strings', () => {
        expect(isValidEmail(null)).toBe(false);
        expect(isValidEmail(undefined)).toBe(false);
        expect(isValidEmail(123)).toBe(false);
    });
});

// ─── CONTRASEÑA ───────────────────────────────────────────────────────────────

describe('isValidPassword', () => {
    it('acepta contraseñas de 8 o más caracteres', () => {
        expect(isValidPassword('Password1')).toBe(true);
        expect(isValidPassword('12345678')).toBe(true);
        expect(isValidPassword('muy_larga_contraseña_segura_123!')).toBe(true);
    });

    it('rechaza contraseñas de menos de 8 caracteres', () => {
        expect(isValidPassword('abc')).toBe(false);
        expect(isValidPassword('1234567')).toBe(false);
        expect(isValidPassword('')).toBe(false);
    });

    it('rechaza valores que no son strings', () => {
        expect(isValidPassword(null)).toBe(false);
        expect(isValidPassword(undefined)).toBe(false);
    });
});

// ─── DNI / LICENCIA ──────────────────────────────────────────────────────────

describe('isValidDni', () => {
    it('acepta DNI con longitud entre 6 y 20 caracteres', () => {
        expect(isValidDni('DNI12345678A')).toBe(true);
        expect(isValidDni('123456')).toBe(true);
        expect(isValidDni('LICENCIA-000001')).toBe(true);
    });

    it('rechaza DNI demasiado corto', () => {
        expect(isValidDni('AB1')).toBe(false);
        expect(isValidDni('')).toBe(false);
    });

    it('rechaza DNI demasiado largo', () => {
        expect(isValidDni('A'.repeat(21))).toBe(false);
    });

    it('acepta valores nulos/undefined devolviéndolos como inválidos', () => {
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
        expect(doPasswordsMatch('password', 'Password')).toBe(false);
    });

    it('devuelve false si una está vacía', () => {
        expect(doPasswordsMatch('MiPass123', '')).toBe(false);
    });
});

// ─── ESCAPE REGEX ─────────────────────────────────────────────────────────────

describe('escapeRegex', () => {
    it('escapa puntos y signos especiales de regex', () => {
        expect(escapeRegex('user.name+test')).toBe('user\\.name\\+test');
        expect(escapeRegex('precio$')).toBe('precio\\$');
        expect(escapeRegex('a(b)c')).toBe('a\\(b\\)c');
    });

    it('devuelve cadena vacía si el input es nulo o vacío', () => {
        expect(escapeRegex(null)).toBe('');
        expect(escapeRegex('')).toBe('');
        expect(escapeRegex(undefined)).toBe('');
    });

    it('no altera cadenas sin caracteres especiales', () => {
        expect(escapeRegex('nombreNormal123')).toBe('nombreNormal123');
    });
});

// ─── NOMBRE ───────────────────────────────────────────────────────────────────

describe('isValidName', () => {
    it('acepta nombres entre 2 y 100 caracteres', () => {
        expect(isValidName('Al')).toBe(true);
        expect(isValidName('Juan García López')).toBe(true);
    });

    it('rechaza nombre de 1 carácter o vacío', () => {
        expect(isValidName('A')).toBe(false);
        expect(isValidName('')).toBe(false);
        expect(isValidName('   ')).toBe(false);
    });

    it('rechaza nombres excesivamente largos', () => {
        expect(isValidName('A'.repeat(101))).toBe(false);
    });
});
