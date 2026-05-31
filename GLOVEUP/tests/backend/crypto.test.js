/**
 * tests/backend/crypto.test.js — Tests unitarios de la utilidad AES-256-CBC.
 *
 * Cubre server/src/utils/crypto.js: encrypt() y decrypt().
 *
 * Estos tests son puramente unitarios: no requieren BD ni HTTP.
 * La clave ENCRYPTION_KEY la inyecta globalSetup.js antes de ejecutar los tests.
 *
 * Propiedades que se verifican:
 *  1. Formato del texto cifrado: debe contener ":" (separador iv:encrypted)
 *  2. Round-trip: decrypt(encrypt(x)) === x para cualquier valor
 *  3. Múltiples valores: el round-trip funciona con diferentes strings
 *  4. Fallback: texto sin formato ":" se devuelve tal cual (datos sin cifrar)
 *  5. No determinismo: el mismo texto produce cifrados distintos (IV aleatorio)
 */

import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../server/src/utils/crypto.js';

describe('Utilidad de cifrado AES-256-CBC', () => {
    it('cifra un texto y devuelve formato iv:encrypted', () => {
        // El formato de salida debe ser "iv_hex:encrypted_hex"
        const original = 'DNI12345678A';
        const encrypted = encrypt(original);
        expect(encrypted).not.toBe(original);   // No debe devolver el texto en claro
        expect(encrypted).toContain(':');         // Debe contener el separador IV:datos
    });

    it('descifra correctamente un texto cifrado', () => {
        // El ciclo completo encrypt → decrypt debe recuperar el valor original
        const original = 'LICENCIA99XYZ';
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('cifrar y descifrar preserva el valor original', () => {
        // Verificar el round-trip con diferentes formatos de DNI y licencia
        const valores = ['ABC123', 'DNI-98765432-B', 'LIC0000001'];
        for (const val of valores) {
            expect(decrypt(encrypt(val))).toBe(val);
        }
    });

    it('descifrar texto sin formato iv:encrypted lo devuelve tal cual', () => {
        // Compatibilidad con datos antiguos que no fueron cifrados (sin ":")
        const plain = 'texto_sin_cifrar';
        expect(decrypt(plain)).toBe(plain);
    });

    it('cada cifrado produce un IV diferente (no determinista)', () => {
        // El mismo texto cifrado dos veces NO debe producir el mismo resultado
        // porque se genera un IV aleatorio de 16 bytes en cada llamada a encrypt()
        const text = 'MismoTexto';
        const enc1 = encrypt(text);
        const enc2 = encrypt(text);
        expect(enc1).not.toBe(enc2);
    });
});
