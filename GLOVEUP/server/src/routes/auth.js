/**
 * routes/auth.js — Rutas de autenticación
 *
 * Gestiona el ciclo de vida de la identidad del usuario:
 *  - POST /api/auth/register      → Crear cuenta (boxeador o entrenador)
 *  - POST /api/auth/login         → Iniciar sesión
 *  - POST /api/auth/forgot-password → Recuperar contraseña mediante DNI/Licencia
 *
 * Consideraciones de seguridad implementadas:
 *  - Las contraseñas se hashean con bcrypt en el pre-save hook del modelo Usuario
 *  - El DNI/Licencia se cifra con AES-256-CBC (utils/crypto.js) antes de
 *    guardarse en la colección "usuarios"; en "boxeadores"/"entrenadores" se
 *    guarda en texto plano para facilitar búsquedas internas.
 *  - La recuperación de contraseña usa el DNI como segundo factor de verificación
 *    (no se envían emails de recuperación; el DNI descifrado actúa de "secreto")
 *
 * No se usan JWT; la sesión se gestiona en el cliente almacenando el email
 * y el rol devueltos en el login (autenticación stateless básica).
 */

import {
    Router
} from 'express';
import bcrypt from 'bcrypt';
import Boxeador from '../models/Boxeador.js';
import Entrenador from '../models/Entrenador.js';
import Usuario from '../models/Usuario.js';
import { encrypt, decrypt } from '../utils/crypto.js';

const router = Router();
const SALT_ROUNDS = 10;

// Escapa caracteres especiales de regex para usar strings de usuario de forma segura
// en expresiones regulares (previene ReDoS)
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── REGISTRO ─────────────────────────────────────────────────────────────
// Crea un nuevo usuario con rol "boxeador" o "entrenador".
// El proceso crea dos documentos: uno en "usuarios" (credenciales) y otro
// en "boxeadores" o "entrenadores" (perfil deportivo), enlazados por usuarioId.
router.post('/register', async (req, res) => {
    try {
        const {
            nombre,
            email,
            password,
            nivel,
            disciplina,
            rol,
            dniLicencia,
            especialidad,
            gimnasio,
            ubicacion,
            foto
        } = req.body || {};

        // Normalizar y sanear todas las entradas antes de cualquier operación
        const cleanName = (nombre || '').toString().trim();
        const cleanEmail = (email || '').toString().trim().toLowerCase();
        const cleanPassword = (password || '').toString().trim();
        const cleanRol = (rol || 'boxeador').toString().trim().toLowerCase();
        const cleanDni = (dniLicencia || '').toString().trim().toUpperCase();

        // Validaciones básicas de campos obligatorios
        if (!cleanName || !cleanEmail || !cleanPassword) {
            return res.status(400).json({
                error: 'Nombre, email y contraseña son obligatorios'
            });
        }

        // Solo se permiten los dos roles principales en el registro público
        if (cleanRol !== 'boxeador' && cleanRol !== 'entrenador') {
            return res.status(400).json({
                error: 'Tipo de cuenta inválido'
            });
        }

        // El DNI es obligatorio y debe tener entre 6 y 20 caracteres
        if (!cleanDni || cleanDni.length < 6 || cleanDni.length > 20) {
            return res.status(400).json({
                error: 'DNI/Licencia es obligatorio'
            });
        }

        // Verificar que el email no esté ya registrado en la colección de usuarios
        const existingUser = await Usuario.findOne({
            email: cleanEmail
        }).lean();

        if (existingUser) {
            return res.status(409).json({
                error: 'Este email ya está registrado'
            });
        }

        // Verificar unicidad del DNI en entrenadores y boxeadores por separado
        // (la validación en Usuario.dniLicencia usa el DNI cifrado, por lo que
        // hay que buscar también en las colecciones de perfil con el texto plano)
        const existingEntrenadorDni = await Entrenador.findOne({ dniLicencia: cleanDni }).lean();
        if (existingEntrenadorDni) {
            return res.status(409).json({ error: 'Ese DNI ya existe' });
        }
        const existingBoxeadorDni = await Boxeador.findOne({ dniLicencia: cleanDni }).lean();
        if (existingBoxeadorDni) {
            return res.status(409).json({ error: 'Ese DNI ya existe' });
        }

        // Cifrar el DNI con AES-256-CBC antes de guardarlo en la colección de usuarios
        // La contraseña se hasheará automáticamente en el pre-save hook del modelo
        const encryptedDni = encrypt(cleanDni);

        const usuario = await Usuario.create({
            nombre: cleanName,
            email: cleanEmail,
            password: cleanPassword,   // Se hasheará con bcrypt en el pre-save
            rol: cleanRol,
            dniLicencia: encryptedDni  // Cifrado AES-256-CBC
        });

        // Crear el documento de perfil deportivo según el rol
        if (cleanRol === 'boxeador') {
            // upsert:true evita errores de duplicado si el boxeador ya existía (ej: creado por un entrenador)
            await Boxeador.updateOne({
                email: cleanEmail
            }, {
                $setOnInsert: {
                    email: cleanEmail
                },
                $set: {
                    nombre: cleanName,
                    nivel: nivel || 'Amateur',
                    disciplina: disciplina || 'Boxeo',
                    usuarioId: usuario._id,
                    dniLicencia: cleanDni    // En boxeadores guardamos el DNI original (sin cifrar)
                }
            }, {
                upsert: true
            });
        }

        if (cleanRol === 'entrenador') {
            await Entrenador.updateOne({
                email: cleanEmail
            }, {
                $setOnInsert: {
                    email: cleanEmail
                },
                $set: {
                    nombre: cleanName,
                    especialidad: (especialidad || '').toString().trim() || 'Boxeo',
                    gimnasio: (gimnasio || '').toString().trim(),
                    ubicacion: (ubicacion || '').toString().trim(),
                    foto: (foto || '').toString().trim(),
                    usuarioId: usuario._id,
                    dniLicencia: cleanDni
                }
            }, {
                upsert: true
            });
        }

        // Devolver los datos del nuevo usuario (DNI original, no cifrado)
        return res.status(201).json({
            id: usuario._id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            dniLicencia: cleanDni  // Devolvemos el DNI original, no el cifrado
        });
    } catch (err) {
        // Error 11000 = violación de índice único en MongoDB (DNI o email duplicado)
        if (err.code === 11000) {
            return res.status(409).json({ error: 'Ese DNI ya existe' });
        }
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────
// Permite identificarse con email o nombre de usuario.
// Responde con los datos básicos del usuario para que el frontend
// guarde la sesión en localStorage/sessionStorage.
router.post('/login', async (req, res) => {
    try {
        const {
            email,
            identifier, // Campo alternativo al email (acepta nombre de usuario)
            password
        } = req.body || {};
        const rawId = (email || identifier || '').toString().trim();

        if (!rawId || !password) {
            return res.status(400).json({
                error: 'Credenciales incompletas'
            });
        }

        const normalizedEmail = rawId.toLowerCase();
        // Escapar el identificador para usarlo de forma segura en la regex
        const safeId = escapeRegex(rawId);

        // Buscar por email exacto (normalizado) O por nombre (regex case-insensitive)
        const user = await Usuario.findOne({
            $or: [{
                    email: normalizedEmail
                },
                {
                    // Búsqueda por nombre exacto ignorando mayúsculas/minúsculas
                    nombre: {
                        $regex: new RegExp(`^${safeId}$`, 'i')
                    }
                }
            ]
        });

        if (!user || !user.password) {
            // Mensaje genérico: no revelar si el email existe o no (enumeración de usuarios)
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // Comparar contraseña con bcrypt (compatible con texto plano antiguo vía comparePassword)
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // Descifrar el DNI almacenado para incluirlo en la respuesta
        const dniOriginal = decrypt(user.dniLicencia || '');

        return res.json({
            id: user._id,
            nombre: user.nombre,
            email: user.email,
            rol: user.rol || 'usuario',
            dniLicencia: dniOriginal
        });
    } catch (err) {
        return res.status(500).json({
            error: 'Error al iniciar sesión'
        });
    }
});

// ─── RECUPERAR CONTRASEÑA ──────────────────────────────────────────────────
// Permite cambiar la contraseña verificando la identidad mediante el DNI/Licencia.
// El DNI almacenado en "usuarios" está cifrado, por lo que se descifra para comparar
// con el que introduce el usuario.
router.post('/forgot-password', async (req, res) => {
    try {
        const {
            email,
            dniLicencia,
            password
        } = req.body || {};

        const cleanEmail = (email || '').toString().trim().toLowerCase();
        const cleanDni = (dniLicencia || '').toString().trim().toUpperCase();
        const cleanPassword = (password || '').toString().trim();

        if (!cleanEmail || !cleanDni || !cleanPassword) {
            return res.status(400).json({
                error: 'Email, DNI/Licencia y nueva contraseña son obligatorios'
            });
        }

        // Buscar usuario por email
        const user = await Usuario.findOne({
            email: cleanEmail
        });
        if (!user) {
            return res.status(404).json({
                error: 'No se encontró un usuario con ese email'
            });
        }

        // Descifrar el DNI almacenado y comparar con el proporcionado por el usuario
        // El DNI actúa como segundo factor de verificación (similar a una pregunta secreta)
        const storedDni = decrypt(user.dniLicencia || '').toString().trim().toUpperCase();
        if (storedDni !== cleanDni) {
            return res.status(401).json({
                error: 'DNI/Licencia incorrecto'
            });
        }

        // Asignar la nueva contraseña en texto plano; el pre-save hook la hasheará automáticamente
        user.password = cleanPassword;
        await user.save();

        return res.json({
            ok: true
        });
    } catch (err) {
        return res.status(500).json({
            error: 'Error al actualizar la contraseña'
        });
    }
});

export default router;
