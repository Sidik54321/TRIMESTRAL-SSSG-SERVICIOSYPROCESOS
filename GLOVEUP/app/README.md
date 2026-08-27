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
| Gimnasios | `/gimnasios` | Migrada (sin el mapa Leaflet) |
| Ficha de gimnasio | `/gimnasios/{key}` | Migrada |
| Buscar sparring | `/sparring` | Migrada (sin chat ni notificaciones flotantes) |
| Mi Perfil | `/perfil` | Migrada |
| Ver perfil de un boxeador | `/perfil/{identifier}` | Migrada |
| Mis Sparrings | `/mis-sparrings` | Migrada |
| Retos (aprobación por el entrenador) | `/retos` | Migrada |
| Inicio (boxeador) | `/inicio` | Migrada |
| Inicio (entrenador) | `/inicio` | Pendiente (redirige a la versión clásica) |
| Ajustes | `/ajustes` | Pendiente |
| Primeros pasos | `/primeros-pasos` | Pendiente |
| Gestión / Mi gimnasio | `/gestion`, `/mi-gimnasio` | Pendiente |
| Login y registro | `/legacy/auth/` | Fuera de la SPA |

Las secciones pendientes muestran una tarjeta que enlaza a su versión clásica,
servida bajo `/legacy/…`. La app es utilizable en todo momento.

## Comprobación

`scratch/spa-smoke.mjs` verifica en un Chromium real el renderizado, la
navegación sin recarga, el historial, la sesión, los filtros y el tema:

```bash
docker run --rm --network docker_default \
  -v "$PWD/scratch:/home/pptruser/work" -w /home/pptruser/work \
  ghcr.io/puppeteer/puppeteer:latest node spa-smoke.mjs
```
