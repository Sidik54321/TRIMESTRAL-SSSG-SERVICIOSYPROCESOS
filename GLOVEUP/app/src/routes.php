<?php

declare(strict_types=1);

/**
 * routes.php — Tabla de rutas de la SPA.
 *
 * Claves de cada ruta:
 *   view   Plantilla a renderizar dentro de app/views
 *   title  Título del documento (se actualiza también al navegar por SPA)
 *   nav    Identificador del elemento activo del menú lateral
 *   shell  "app"    → layout con sidebar (requiere sesión)
 *          "public" → página suelta a ancho completo (landing, errores)
 *   legacy Ruta a la página antigua, para las secciones aún sin migrar
 *
 * Durante la migración por fases conviven dos tipos de entrada:
 * las ya migradas (view propia) y las pendientes, que usan la vista
 * "pages/pending" y enlazan a la página original.
 */

use GloveUp\Router;

$router = new Router();

// ── Zona pública ───────────────────────────────────────────────────
$router->add('/', [
    'view'  => 'pages/landing',
    'title' => 'GloveUp — Find your fight',
    'shell' => 'public',
    'nav'   => null,
]);

// Panel de administración: audiencia totalmente distinta a boxeadores y
// entrenadores, así que no usa el shell "app" (sidebar/topbar de la SPA de
// usuarios) — construye su propia cabecera dentro de la vista, a ancho
// completo, igual que la landing. El acceso lo controla su propio login por
// contraseña (ver app/js/pages/admin.js), no session.js.
$router->add('/admin', [
    'view'  => 'pages/admin',
    'title' => 'Administración — GloveUp',
    'shell' => 'public',
    'nav'   => null,
]);

// ── Secciones migradas ─────────────────────────────────────────────
$router->add('/gimnasios', [
    'view'  => 'pages/gyms',
    'title' => 'Gimnasios — GloveUp',
    'shell' => 'app',
    'nav'   => 'gimnasios',
]);

$router->add('/gimnasios/{key}', [
    'view'  => 'pages/gym-detail',
    'title' => 'Gimnasio — GloveUp',
    'shell' => 'app',
    'nav'   => 'gimnasios',
]);

$router->add('/sparring', [
    'view'  => 'pages/sparring',
    'title' => 'Buscar Sparring — GloveUp',
    'shell' => 'app',
    'nav'   => 'sparring',
]);

$router->add('/perfil', [
    'view'  => 'pages/profile',
    'title' => 'Mi Perfil — GloveUp',
    'shell' => 'app',
    'nav'   => 'perfil',
]);

$router->add('/perfil/{identifier}', [
    'view'  => 'pages/profile-view',
    'title' => 'Perfil — GloveUp',
    'shell' => 'app',
    'nav'   => 'sparring',
]);

$router->add('/mis-sparrings', [
    'view'  => 'pages/my-sparrings',
    'title' => 'Mis Sparrings — GloveUp',
    'shell' => 'app',
    'nav'   => 'mis-sparrings',
]);

$router->add('/retos', [
    'view'  => 'pages/coach-challenges',
    'title' => 'Retos — GloveUp',
    'shell' => 'app',
    'nav'   => 'retos',
]);

$router->add('/inicio', [
    'view'  => 'pages/dashboard',
    'title' => 'Inicio — GloveUp',
    'shell' => 'app',
    'nav'   => 'inicio',
]);

$router->add('/ajustes', [
    'view'  => 'pages/settings',
    'title' => 'Ajustes — GloveUp',
    'shell' => 'app',
    'nav'   => 'ajustes',
]);

$router->add('/primeros-pasos', [
    'view'  => 'pages/onboarding',
    'title' => 'Primeros Pasos — GloveUp',
    'shell' => 'app',
    'nav'   => 'primeros-pasos',
]);

/*
 * /gestion y /mi-gimnasio comparten una misma vista: en el dashboard
 * clásico, el panel de perfil del gimnasio y el de gestión de boxeadores
 * eran en realidad UNA sola pieza con dos pestañas internas (montada en
 * #coach-gym). El enlace "Gestión" del menú, en cambio, apuntaba a un
 * panel de pagos/finanzas sin relación con "gestionar alumnos" — un cruce
 * de nombres, no un diseño intencional (confirmado leyendo el punto de
 * montaje: dashboard.react.js:4567-4571). Aquí se corrige: ambas rutas
 * llevan al mismo panel de perfil + boxeadores, cada una con su pestaña
 * por defecto; el panel de pagos queda pendiente de migrar aparte.
 */
$router->add('/gestion', [
    'view'    => 'pages/coach-panel',
    'title'   => 'Gestión de Alumnos — GloveUp',
    'shell'   => 'app',
    'nav'     => 'gestion',
    'default_tab' => 'boxers',
]);

$router->add('/mi-gimnasio', [
    'view'    => 'pages/coach-panel',
    'title'   => 'Mi Gimnasio — GloveUp',
    'shell'   => 'app',
    'nav'     => 'mi-gimnasio',
    'default_tab' => 'gym',
]);

// ── Secciones pendientes de migrar (Fases 2 y 3) ───────────────────
$pending = [];

foreach ($pending as $path => $meta) {
    $router->add($path, [
        'view'   => 'pages/pending',
        'title'  => $meta['title'],
        'shell'  => 'app',
        'nav'    => $meta['nav'],
        'label'  => $meta['label'],
        'legacy' => $meta['legacy'],
    ]);
}

$router->fallback([
    'view'  => 'pages/not-found',
    'title' => 'Página no encontrada — GloveUp',
    'shell' => 'public',
    'nav'   => null,
]);

return $router;
