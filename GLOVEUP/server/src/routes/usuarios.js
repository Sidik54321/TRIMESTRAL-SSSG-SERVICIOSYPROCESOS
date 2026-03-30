import {
    Router
} from 'express';
import Usuario from '../models/Usuario.js';

const router = Router();

// GET /api/usuarios - Obtener todos los usuarios (Tabla de usuarios)
router.get('/', async (req, res) => {
    try {
        const users = await Usuario.find().select('-password').sort({
            createdAt: -1
        }).lean();
        res.json(users);
    } catch (err) {
        res.status(500).json({
            error: err.message
        });
    }
});

export default router;