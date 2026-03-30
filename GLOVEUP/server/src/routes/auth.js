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
const escapeRegex = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ─── REGISTRO ─────────────────────────────────────────────
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

        const cleanName = (nombre || '').toString().trim();
        const cleanEmail = (email || '').toString().trim().toLowerCase();
        const cleanPassword = (password || '').toString().trim();
        const cleanRol = (rol || 'boxeador').toString().trim().toLowerCase();
        const cleanDni = (dniLicencia || '').toString().trim().toUpperCase();

        if (!cleanName || !cleanEmail || !cleanPassword) {
            return res.status(400).json({
                error: 'Nombre, email y contraseña son obligatorios'
            });
        }

        if (cleanRol !== 'boxeador' && cleanRol !== 'entrenador') {
            return res.status(400).json({
                error: 'Tipo de cuenta inválido'
            });
        }

        if (!cleanDni || cleanDni.length < 6 || cleanDni.length > 20) {
            return res.status(400).json({
                error: 'DNI/Licencia es obligatorio'
            });
        }

        const existingUser = await Usuario.findOne({
            email: cleanEmail
        }).lean();

        if (existingUser) {
            return res.status(409).json({
                error: 'Este email ya está registrado'
            });
        }

        const existingDni = await Usuario.findOne({
            dniLicencia: cleanDni
        }).lean();
        if (existingDni) {
            return res.status(409).json({
                error: 'Este DNI/Licencia ya está registrado'
            });
        }

        // 🔐 La contraseña se hashea automáticamente en el pre-save hook del modelo
        // 🔐 El DNI se cifra con AES-256-CBC si hay ENCRYPTION_KEY configurada
        const encryptedDni = encrypt(cleanDni);

        const usuario = await Usuario.create({
            nombre: cleanName,
            email: cleanEmail,
            password: cleanPassword,   // Se hasheará con bcrypt en el pre-save
            rol: cleanRol,
            dniLicencia: encryptedDni  // Cifrado AES
        });

        if (cleanRol === 'boxeador') {
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
                    dniLicencia: cleanDni    // En boxeadores guardamos el DNI original
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

        return res.status(201).json({
            id: usuario._id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            dniLicencia: cleanDni  // Devolvemos el DNI original, no el cifrado
        });
    } catch (err) {
        return res.status(400).json({
            error: err.message
        });
    }
});

// ─── LOGIN ────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const {
            email,
            identifier,
            password
        } = req.body || {};
        const rawId = (email || identifier || '').toString().trim();

        if (!rawId || !password) {
            return res.status(400).json({
                error: 'Credenciales incompletas'
            });
        }

        const normalizedEmail = rawId.toLowerCase();
        const safeId = escapeRegex(rawId);

        const user = await Usuario.findOne({
            $or: [{
                    email: normalizedEmail
                },
                {
                    nombre: {
                        $regex: new RegExp(`^${safeId}$`, 'i')
                    }
                }
            ]
        });

        if (!user || !user.password) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // 🔐 Comparar contraseña con bcrypt (compatible con texto plano antiguo)
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                error: 'Credenciales inválidas'
            });
        }

        // Descifrar DNI para la respuesta
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

// ─── RECUPERAR CONTRASEÑA ─────────────────────────────────
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

        const user = await Usuario.findOne({
            email: cleanEmail
        });
        if (!user) {
            return res.status(404).json({
                error: 'No se encontró un usuario con ese email'
            });
        }

        // 🔐 Descifrar el DNI almacenado para comparar
        const storedDni = decrypt(user.dniLicencia || '').toString().trim().toUpperCase();
        if (storedDni !== cleanDni) {
            return res.status(401).json({
                error: 'DNI/Licencia incorrecto'
            });
        }

        // 🔐 La nueva contraseña se hasheará con bcrypt en el pre-save hook
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