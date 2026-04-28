import { Router } from 'express';
import OpenAI from 'openai';
import Boxeador from '../models/Boxeador.js';

const router = Router();

// Inicializar cliente OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || ''
});

// System prompt para el chatbot GloveBot
const GLOVEBOT_SYSTEM_PROMPT = `Eres GloveBot 🥊, el asistente virtual de GloveUp, una plataforma de boxeo.

Tu personalidad:
- Eres amigable, motivador y usas lenguaje de boxeo de vez en cuando
- Respondes siempre en español
- Eres conciso pero útil
- Usas emojis relacionados con boxeo ocasionalmente (🥊, 💪, 🏆, 🔔)

Conoces a fondo la plataforma GloveUp:

FUNCIONALIDADES PRINCIPALES:
1. **Buscar Sparring**: Los boxeadores pueden buscar compañeros de sparring filtrando por nivel (Principiante, Intermedio, Avanzado, Profesional), categoría de peso, ubicación y género.
2. **Retar a Sparring**: Un boxeador puede retar a otro. Debe seleccionar tipo de sparring (técnico, medio, duro, distancia y jab, defensa y contra, preparación para combate), elegir entrenador(es) supervisor(es), un gimnasio y fecha/hora.
3. **Sistema de Aprobación Dual**: Cuando se crea un reto, ambos entrenadores (el del retador y el del retado) deben aprobar el sparring antes de que se confirme.
4. **Perfil**: Cada boxeador tiene: nombre, alias, disciplina, peso, altura, edad, ubicación, nivel, guardia (diestro/zurdo), frecuencia de sparring, bio y foto.
5. **Gimnasios**: Los entrenadores pueden crear y gestionar fichas de gimnasio con fotos, horarios, ubicación y datos de contacto. Los boxeadores pueden ver los gimnasios y sus boxeadores asociados.
6. **Dashboard Boxeador**: Muestra retos enviados/recibidos, sesiones próximas y completadas.
7. **Dashboard Entrenador**: Gestión de boxeadores, aprobación de retos, calendario de eventos y gestión de su gimnasio.
8. **Notificaciones**: Sistema de notificaciones en tiempo real para retos, aprobaciones y mensajes.
9. **Chat**: Sistema de mensajería entre usuarios.
10. **Ajustes**: Cambio de contraseña, email y gestión de cuenta.
11. **Primeros Pasos**: Guía de onboarding para nuevos usuarios.
12. **Manuales**: Manual del boxeador y manual del entrenador disponibles en la barra lateral.
13. **Matchmaking IA**: Botón "Sugerencias IA" en la página de Buscar Sparring que recomienda rivales ideales usando inteligencia artificial.

ROLES:
- **Boxeador**: Puede buscar sparring, retar, ver su perfil y sesiones. Necesita un entrenador asignado para poder crear retos.
- **Entrenador**: Puede gestionar boxeadores, aprobar/rechazar retos, gestionar su gimnasio y ver su calendario.

NAVEGACIÓN:
- Inicio: Dashboard principal según rol
- Buscar Sparring: Página para encontrar compañeros
- Gimnasios: Directorio de gimnasios
- Mis Sparrings: Historial de sparrings (solo boxeadores)
- Gestión: Gestión de boxeadores (solo entrenadores)
- Retos: Ver retos pendientes (solo entrenadores)
- Mi Gimnasio: Gestión del gimnasio (solo entrenadores)
- Ajustes: Configuración de cuenta
- Tema Oscuro/Claro: Toggle de tema visual

Si te preguntan algo que no sabes o que no tiene que ver con GloveUp, sé honesto y redirige amablemente al tema de la plataforma.`;

// ==================== CHATBOT ====================
router.post('/chat', async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'sk-REPLACE-WITH-YOUR-KEY') {
            return res.status(503).json({
                error: 'API key de OpenAI no configurada. Contacta al administrador.'
            });
        }

        const { messages, userRole } = req.body || {};

        if (!Array.isArray(messages) || messages.length === 0) {
            return res.status(400).json({ error: 'Se requieren mensajes' });
        }

        // Limitar a últimos 20 mensajes para no exceder tokens
        const recentMessages = messages.slice(-20);

        // Añadir contexto del rol del usuario
        let systemPrompt = GLOVEBOT_SYSTEM_PROMPT;
        if (userRole) {
            systemPrompt += `\n\nEl usuario actual tiene el rol de: ${userRole}. Adapta tus respuestas a su rol.`;
        }

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: systemPrompt },
                ...recentMessages.map(m => ({
                    role: m.role === 'user' ? 'user' : 'assistant',
                    content: String(m.content || '')
                }))
            ],
            max_tokens: 500,
            temperature: 0.7
        });

        const reply = completion.choices?.[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';

        return res.json({ reply });
    } catch (err) {
        console.error('Error en /api/ai/chat:', err.message);
        if (err.status === 401 || err.code === 'invalid_api_key') {
            return res.status(503).json({ error: 'API key de OpenAI inválida.' });
        }
        return res.status(500).json({ error: 'Error al procesar tu mensaje. Inténtalo de nuevo.' });
    }
});

// ==================== MATCHMAKING ====================
router.post('/matchmaking', async (req, res) => {
    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey || apiKey === 'sk-REPLACE-WITH-YOUR-KEY') {
            return res.status(503).json({
                error: 'API key de OpenAI no configurada. Contacta al administrador.'
            });
        }

        const { email } = req.body || {};
        if (!email) {
            return res.status(400).json({ error: 'Email requerido' });
        }

        const emailNorm = email.toString().trim().toLowerCase();

        // Buscar el boxeador que pide matchmaking
        const me = await Boxeador.findOne({ email: emailNorm }).lean();
        if (!me) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        // Buscar todos los demás boxeadores
        const allBoxeadores = await Boxeador.find({
            email: { $ne: emailNorm }
        }).select('nombre email nivel peso categoriaPeso ubicacion guardia genero disciplina alias gimnasio edad altura alcance frecuenciaSparring').lean();

        if (!allBoxeadores.length) {
            return res.json({ matches: [], message: 'No hay otros boxeadores registrados.' });
        }

        // Preparar datos para la IA
        const myProfile = {
            nombre: me.nombre,
            nivel: me.nivel,
            peso: me.peso,
            categoriaPeso: me.categoriaPeso,
            ubicacion: me.ubicacion,
            guardia: me.guardia,
            genero: me.genero,
            edad: me.edad,
            altura: me.altura,
            disciplina: me.disciplina,
            frecuenciaSparring: me.frecuenciaSparring
        };

        const candidates = allBoxeadores.map(b => ({
            email: b.email,
            nombre: b.nombre,
            nivel: b.nivel,
            peso: b.peso,
            categoriaPeso: b.categoriaPeso,
            ubicacion: b.ubicacion,
            guardia: b.guardia,
            genero: b.genero,
            edad: b.edad,
            altura: b.altura,
            disciplina: b.disciplina,
            frecuenciaSparring: b.frecuenciaSparring,
            gimnasio: b.gimnasio
        }));

        const matchmakingPrompt = `Eres un experto en matchmaking de boxeo. Analiza el perfil del boxeador y los candidatos disponibles para recomendar los 5 mejores sparrings.

PERFIL DEL BOXEADOR:
${JSON.stringify(myProfile, null, 2)}

CANDIDATOS DISPONIBLES:
${JSON.stringify(candidates, null, 2)}

CRITERIOS DE MATCHMAKING (en orden de importancia):
1. **Nivel similar**: Principiante con Principiante/Intermedio, Avanzado con Avanzado/Profesional, etc.
2. **Peso compatible**: Categorías de peso cercanas (máximo 1-2 categorías de diferencia)
3. **Ubicación cercana**: Misma ciudad o zona
4. **Guardia complementaria**: Diestro vs Zurdo es ideal para practicar
5. **Frecuencia compatible**: Similar frecuencia de sparring

Responde ÚNICAMENTE con un JSON válido (sin markdown, sin backticks) con este formato exacto:
{
  "matches": [
    {
      "email": "email@del.candidato",
      "nombre": "Nombre",
      "score": 95,
      "reasons": ["Mismo nivel Intermedio", "Peso compatible", "Misma ciudad"]
    }
  ]
}

Incluye máximo 5 candidatos, ordenados por score (100 = match perfecto). Si no hay buenos matches, devuelve un array vacío.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: 'Eres un sistema de matchmaking de boxeo. Responde SOLO con JSON válido, sin markdown ni explicaciones.' },
                { role: 'user', content: matchmakingPrompt }
            ],
            max_tokens: 800,
            temperature: 0.3
        });

        const raw = (completion.choices?.[0]?.message?.content || '').trim();

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            // Intentar extraer JSON del texto
            const jsonMatch = raw.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                parsed = JSON.parse(jsonMatch[0]);
            } else {
                return res.json({ matches: [], message: 'No se pudieron generar recomendaciones.' });
            }
        }

        const matches = Array.isArray(parsed.matches) ? parsed.matches : [];

        // Enriquecer con datos reales (foto, etc.)
        const enriched = [];
        for (const match of matches.slice(0, 5)) {
            const boxer = allBoxeadores.find(b => b.email === match.email);
            if (boxer) {
                enriched.push({
                    email: boxer.email,
                    nombre: boxer.nombre || match.nombre,
                    alias: boxer.alias || '',
                    nivel: boxer.nivel || '',
                    peso: boxer.peso || '',
                    ubicacion: boxer.ubicacion || '',
                    guardia: boxer.guardia || '',
                    gimnasio: boxer.gimnasio || '',
                    foto: boxer.foto || '',
                    score: match.score || 0,
                    reasons: Array.isArray(match.reasons) ? match.reasons : []
                });
            }
        }

        return res.json({ matches: enriched });
    } catch (err) {
        console.error('Error en /api/ai/matchmaking:', err.message);
        if (err.status === 401 || err.code === 'invalid_api_key') {
            return res.status(503).json({ error: 'API key de OpenAI inválida.' });
        }
        return res.status(500).json({ error: 'Error al generar recomendaciones.' });
    }
});

export default router;
