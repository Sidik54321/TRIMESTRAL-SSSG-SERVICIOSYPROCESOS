import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../../server/src/utils/crypto.js';

describe('Utilidad de cifrado AES-256-CBC', () => {
    it('cifra un texto y devuelve formato iv:encrypted', () => {
        const original = 'DNI12345678A';
        const encrypted = encrypt(original);
        expect(encrypted).not.toBe(original);
        expect(encrypted).toContain(':');
    });

    it('descifra correctamente un texto cifrado', () => {
        const original = 'LICENCIA99XYZ';
        const encrypted = encrypt(original);
        const decrypted = decrypt(encrypted);
        expect(decrypted).toBe(original);
    });

    it('cifrar y descifrar preserva el valor original', () => {
        const valores = ['ABC123', 'DNI-98765432-B', 'LIC0000001'];
        for (const val of valores) {
            expect(decrypt(encrypt(val))).toBe(val);
        }
    });

    it('descifrar texto sin formato iv:encrypted lo devuelve tal cual', () => {
        const plain = 'texto_sin_cifrar';
        expect(decrypt(plain)).toBe(plain);
    });

    it('cada cifrado produce un IV diferente (no determinista)', () => {
        const text = 'MismoTexto';
        const enc1 = encrypt(text);
        const enc2 = encrypt(text);
        expect(enc1).not.toBe(enc2);
    });
});
