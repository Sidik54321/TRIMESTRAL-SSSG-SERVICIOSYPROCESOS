import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

const UsuarioSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    password: { type: String, required: true, trim: true },
    dniLicencia: { type: String, trim: true, uppercase: true, unique: true, sparse: true },
    rol: { type: String, enum: ['usuario', 'boxeador', 'entrenador', 'admin'], default: 'usuario' }
  },
  { timestamps: true }
);

/**
 * Pre-save hook: hashea la contraseña con bcrypt antes de guardar
 * Solo se ejecuta si el campo password ha sido modificado
 */
UsuarioSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

/**
 * Método de instancia para comparar contraseñas
 * Compatible con contraseñas antiguas en texto plano Y con hashes bcrypt
 * @param {string} candidatePassword - Contraseña en texto plano a verificar
 * @returns {Promise<boolean>}
 */
UsuarioSchema.methods.comparePassword = async function (candidatePassword) {
  // Si la contraseña almacenada es un hash bcrypt (empieza por $2b$ o $2a$)
  if (this.password && this.password.startsWith('$2')) {
    return bcrypt.compare(candidatePassword, this.password);
  }
  // Fallback para contraseñas antiguas en texto plano
  return this.password === candidatePassword;
};

export default mongoose.model('Usuario', UsuarioSchema, 'usuarios');
