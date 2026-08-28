# GloveUp — SPA en PHP + Tailwind

Migración por fases del frontend a una *single page application* servida por
PHP y con los estilos en Tailwind v4. La API de Node y MongoDB **no cambian**:
siguen siendo las mismas de `server/`.

## Cómo funciona

La SPA es *isomórfica*: el servidor sabe renderizar cualquier ruta entera y el
cliente sólo intercambia el contenido.

```
Navegación normal (primera carga, recarga, enlace externo)
  GET /gimnasios
  → index.php → shell.php (documento completo con la vista dentro)

Navegación dentro de la app (clic en un enlace)
  GET /gimnasios   con cabecera  X-GloveUp-SPA: 1
  → index.php → JSON { title, nav, shell, html }
  → router.js sustituye únicamente #app-view
```

Ventaja de renderizar en servidor en ambos casos: las URLs son reales y
compartibles, funcionan el atrás/adelante del navegador y la primera pantalla
no depende de JavaScript.

## Estructura

```
app/
  public/index.php     Front controller: resuelve la ruta y responde
  public/.htaccess     Reescritura a index.php + cabeceras de seguridad
  src/Router.php       Tabla de rutas con parámetros ({key})
  src/View.php         Renderizado de plantillas PHP a cadena
  src/routes.php       Declaración de todas las rutas
  views/layout/        shell, sidebar y topbar (persisten entre navegaciones)
  views/pages/         Una plantilla por ruta
  css/tailwind.css     Entrada de Tailwind y sistema de diseño
  js/router.js         Router del cliente
  js/app.js            Arranque: sesión, tema, menú, router
  js/api.js            Cliente de la API de Node
  js/session.js        Sesión y control de acceso
  js/pages/<nombre>.js Lógica de una página concreta
```

### Añadir una página

1. Crear `views/pages/mi-seccion.php`.
2. Declarar la ruta en `src/routes.php`.
3. Si necesita JavaScript: poner `data-page="mi-seccion"` en el elemento raíz
   de la vista y crear `js/pages/mi-seccion.js` exportando `init(root)` y,
   si hace falta limpiar algo al salir, `destroy()`.

El router carga ese módulo solo. Las vistas sin `data-page` no cargan nada.

## Ejecutar

```bash
cd docker
docker compose up -d --build      # http://localhost:8080
```

Servicios: `web` (PHP+Apache, puerto 8080), `api` (Node, 3000), `db` (Mongo).
Apache hace de proxy de `/api` hacia `api:3000`, así que el navegador habla
siempre con el mismo origen y no hay CORS.

El frontend antiguo con Nginx sigue disponible para comparar:

```bash
docker compose --profile legacy up -d   # http://localhost:8081
```

### Estilos

Tailwind se compila dentro de la imagen (etapa `css` del Dockerfile), así que
`docker compose build web` es suficiente. Para iterar sin reconstruir, con Node
instalado en local:

```bash
npm install
npm run css:watch
```

Los tokens de diseño (`--color-accent`, tipografías, radios, sombras) están en
el bloque `@theme` de `css/tailwind.css` y replican los de `home/styles.css`.
El tema oscuro usa la clase `.theme-dark`, la misma que ya usaban las páginas
antiguas, mediante un `@custom-variant`.

## Estado de la migración

| Sección | Ruta | Estado |
|---|---|---|
| Landing pública | `/` | Migrada |
| Gimnasios | `/gimnasios` | Migrada (sin el mapa Leaflet). **Explorable sin sesión** |
| Ficha de gimnasio | `/gimnasios/{key}` | Migrada |
| Buscar sparring | `/sparring` | Migrada (sin chat ni notificaciones flotantes). **Explorable sin sesión** |
| Mi Perfil | `/perfil` | Migrada |
| Ver perfil de un boxeador | `/perfil/{identifier}` | Migrada |
| Mis Sparrings | `/mis-sparrings` | Migrada |
| Retos (aprobación por el entrenador) | `/retos` | Migrada |
| Inicio (boxeador) | `/inicio` | Migrada |
| Inicio (entrenador) | `/inicio` | Migrada (calendario; sin las métricas, que el panel clásico tampoco llegaba a pintar) |
| Ajustes | `/ajustes` | Migrada |
| Primeros pasos | `/primeros-pasos` | Migrada |
| Gestión de alumnos | `/gestion` | Migrada (perfil, boxeadores y pagos; pestaña "Boxeadores" por defecto) |
| Mi Gimnasio | `/mi-gimnasio` | Migrada (misma vista que Gestión, pestaña "Gimnasio" por defecto) |
| Panel de administración | `/admin` | Nueva (no existía en la app clásica) |
| Login y registro | `/legacy/auth/` | Fuera de la SPA |

## Panel de administración

`/admin` (`app/views/pages/admin.php` + `app/js/pages/admin.js`) es una
sección nueva, sin equivalente en la app clásica. Vive fuera del shell
"app" (sin el sidebar de boxeador/entrenador) y tiene su propia puerta de
entrada: una contraseña única guardada en `ADMIN_PASSWORD` (backend), sin
relación con las cuentas de boxeador/entrenador ni con `session.js`.

Al acertar la contraseña, `POST /api/admin/login` devuelve un token que se
guarda en `localStorage` (`gloveup_admin_token`) y viaja como
`Authorization: Bearer …` en el resto de llamadas (`server/src/middleware/
adminAuth.js`, tokens en memoria con 6 h de validez). Un 401 en cualquier
llamada hace volver a la pantalla de contraseña.

Tres pestañas:
- **Resumen** — contadores globales (usuarios, boxeadores, entrenadores,
  gimnasios, retos enviados, sparrings completados) y una gráfica de altas
  de usuario de los últimos 6 meses.
- **Usuarios** — listado con su gimnasio (cruzado desde el perfil
  deportivo), buscador, crear boxeador/entrenador y eliminar cuenta (borra
  también su perfil; si es un entrenador, sus boxeadores se quedan sin
  asignar en vez de borrarse).
- **Gimnasios** — listado (reutiliza `GET /api/gimnasios`, que ya era
  público) y eliminar; al borrar uno se limpia el campo `gimnasio` de los
  boxeadores/entrenadores que lo tuvieran asignado, porque ese campo es un
  nombre suelto, no una referencia.

Endpoints nuevos en `server/src/routes/admin.js` (todos menos `/login`
exigen el token): `GET /stats`, `GET /usuarios`, `POST /usuarios`,
`DELETE /usuarios/:id`, `DELETE /gimnasios/:id`. Cubiertos por
`tests/backend/admin.test.js`.

**Nota de seguridad:** `server/.env` y `docker/.env` ya estaban en el
repositorio de git desde antes de esta migración (sin `.gitignore` que lo
impidiera) — este cambio añade un `.gitignore` en la raíz para que dejen de
subirse a partir de ahora, pero **no** reescribe el historial. La clave de
cifrado (`ENCRYPTION_KEY`) y la contraseña de admin que ya están commiteadas
deben considerarse expuestas; conviene rotarlas y valorar limpiar el
historial si el repositorio es o vaya a ser público.

**Nota sobre Inicio del entrenador:** `CoachStatsDashboard`, el componente
clásico, calculaba métricas del gimnasio (`boxeadoresActivos`,
`inscripcionesMes`, `ingresosMes`) pero su JSX nunca llegó a pintarlas —
sólo devolvía la cabecera y el calendario. La migración reproduce
exactamente eso: cabecera + calendario con eventos automáticos (altas de
boxeadores, pagos, sparrings, recordatorios) y personalizados, con filtros
por tipo. El calendario del boxeador y el del entrenador comparten el mismo
módulo de montaje y modal de evento en `app/js/pages/dashboard.js`.

**Nota sobre Gestión / Mi Gimnasio:** en el dashboard clásico, el enlace
"Gestión" del menú montaba por error el panel de **Pagos/Finanzas**
(`CoachFinance`) y "Mi Gimnasio" montaba el panel real de **perfil del
gimnasio + boxeadores** (`CoachManagement`) — un cruce de nombres confirmado
leyendo el punto de montaje (`dashboard.react.js:4567-4571`), no un diseño
intencional. Se corrigió en la migración: ambos enlaces llevan al mismo
panel, con tres pestañas (Mi Gimnasio, Mis Boxeadores, Pagos), cada ruta con
su pestaña por defecto. "Pagos" no tenía ningún enlace propio en el menú
clásico — se añadió aquí como tercera pestaña por ser la ubicación más
natural, ya que las otras dos ya compartían panel.

De las cinco métricas de la pestaña Pagos, dos muestran siempre 0 — no es
un fallo de esta migración, es lo que el backend real devuelve hoy:
- **"Cobros"**: `GET /me/cobros` es un *stub* que nunca se llegó a
  implementar (`return res.json({ total: 0, items: [] })` siempre).
- **"Pagos este mes"**: cuenta `boxer.pagos`, el mismo campo que **no existe
  en el esquema de Mongoose** de `Boxeador` — el mismo bug documentado en
  Retos y en el botón "Marcar como pagado" de Gestión. `POST /pago`
  responde `{ok:true}` pero Mongoose descarta la escritura en silencio.

El gráfico de ingresos por inscripciones sí es funcional (se basa en
`fechaInscripcion`, no en `pagos`), igual que "Tu gimnasio" y "Boxeadores
activos".

Las secciones pendientes muestran una tarjeta que enlaza a su versión clásica,
servida bajo `/legacy/…`. La app es utilizable en todo momento.

## Modo invitado

Gimnasios y Sparring se pueden explorar sin haber iniciado sesión, como
"vista previa" de la app en el rol de boxeador: `app/js/app.js` sólo llama a
`session.guard()` (que expulsa a `/legacy/auth/` si no hay sesión) en las
vistas que NO llevan `data-guest-ok` en su `data-page` — Gimnasios y
Sparring sí lo llevan. El resto de las secciones con sidebar (Inicio, Mi
Perfil, Ajustes, Primeros Pasos…) siguen exigiendo sesión igual que antes.

Dentro de esas dos vistas, cualquier acción real (guardar favorito, ver la
ficha de un gimnasio, ver el perfil de un boxeador, retar a sparring) abre
el modal de "Inicia sesión en GloveUp" en vez de ejecutarse — lo gatean los
propios módulos de página (`gyms.js`, `sparring.js`) llamando a
`loginModal.open()`. Ese modal ahora vive en `layout/login-modal.php`,
fuera de `#app-view`, para estar disponible tanto en la landing como dentro
del panel; lo controla `app/js/login-modal.js` mediante dos atributos
declarativos:
- `data-login-trigger`: siempre abre el modal (los CTA de "crear cuenta").
- `data-guest-lock`: sólo lo abre si no hay sesión; con sesión el elemento
  se comporta con normalidad. Se usa en los enlaces del sidebar/topbar que
  no son explorables (Inicio, Ajustes, el chip de perfil, la campana de
  notificaciones).

## Comprobación

`scratch/spa-smoke.mjs` verifica en un Chromium real el renderizado, la
navegación sin recarga, el historial, la sesión, los filtros y el tema;
`scratch/guest-mode-smoke.mjs` verifica específicamente el modo invitado:

```bash
docker run --rm --network docker_default \
  -v "$PWD/scratch:/home/pptruser/work" -w /home/pptruser/work \
  ghcr.io/puppeteer/puppeteer:latest node spa-smoke.mjs
```
