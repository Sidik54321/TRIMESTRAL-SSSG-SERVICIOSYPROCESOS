/**
 * models/Usuario.js — Modelo de datos para la colección "usuarios"
 *
 * Representa la identidad de autenticación de cualquier persona registrada
 * en GloveUp, independientemente de si es boxeador, entrenador o admin.
 *
 * Responsabilidades:
 *  - Almacenar credenciales (email + contraseña hasheada con bcrypt)
 *  - Guardar el DNI/Licencia cifrado con AES-256-CBC (encrypt en auth.js)
 *  - Definir el rol del usuario dentro de la plataforma
 *
 * Los perfiles específicos (Boxeador, Entrenador) son documentos separados
 * enlazados mediante el campo usuarioId que referencian a este modelo.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Coste del hash bcrypt: 10 rondas es el estándar recomendado (buen equilibrio
// entre seguridad y tiempo de cómputo, ~100 ms en hardware moderno)
const SALT_ROUNDS = 10;

const UsuarioSchema = new mongoose.Schema(
  {
    nombre:      { type: String, required: true, trim: true },
    // El email se normaliza a minúsculas y es único en la colección
    email:       { type: String, required: true, trim: true, lowercase: true, unique: true },
    // La contraseña se almacena hasheada (nunca en texto plano después del pre-save)
    password:    { type: String, required: true, trim: true },
    // DNI o número de licencia: se cifra con AES-256-CBC antes de persistirse.
    // sparse:true permite que múltiples documentos no tengan este campo (null)
    // sin violar la restricción unique.
    dniLicencia: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    // Rol que determina el nivel de acceso y las vistas disponibles en el frontend
    rol:         { type: String, enum: ['usuario', 'boxeador', 'entrenador', 'admin'], default: 'usuario' }
  },
  { timestamps: true } // Añade createdAt y updatedAt automáticamente
);

/**
 * Pre-save hook: hashea la contraseña con bcrypt antes de guardar el documento.
 *
 * Solo se ejecuta si el campo "password" ha sido modificado, evitando así
 * re-hashear un hash ya existente cada vez que se actualice otro campo.
 */
UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next(); // Sin cambios en password → nada que hacer
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Método de instancia: compara una contraseña candidata con la almacenada.
 *
 * Compatible con contraseñas en texto plano (datos antiguos migrados) Y
 * con hashes bcrypt modernos. Los hashes bcrypt siempre empiezan por "$2b$"
 * o "$2a$", lo que permite detectar el formato automáticamente.
 *
 * @param {string} candidatePassword - Contraseña en texto plano a verificar
 * @returns {Promise<boolean>} true si la contraseña es correcta
 */
UsuarioSchema.methods.comparePassword = async function (candidatePassword) {
  // Si la contraseña almacenada es un hash bcrypt (empieza por $2b$ o $2a$)
  if (this.password && this.password.startsWith('$2')) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Fallback para contraseñas antiguas en texto plano (no debería haber nuevas)
  return this.password === candidatePassword;
};

// Mapear el schema al modelo 'Usuario' sobre la colección 'usuarios'
export default mongoose.model('Usuario', UsuarioSchema, 'usuarios');
