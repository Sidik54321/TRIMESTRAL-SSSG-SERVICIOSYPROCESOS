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

// ── Secciones pendientes de migrar (Fases 2 y 3) ───────────────────
$pending = [
    '/ajustes' => [
        'title'  => 'Ajustes — GloveUp',
        'nav'    => 'ajustes',
        'label'  => 'Ajustes',
        'legacy' => '/legacy/settings/index.html',
    ],
    '/primeros-pasos' => [
        'title'  => 'Primeros Pasos — GloveUp',
        'nav'    => 'primeros-pasos',
        'label'  => 'Primeros Pasos',
        'legacy' => '/legacy/onboarding/index.html',
    ],
    '/gestion' => [
        'title'  => 'Gestión — GloveUp',
        'nav'    => 'gestion',
        'label'  => 'Gestión de alumnos',
        'legacy' => '/legacy/dashboard/entrenador/dashboard.html#coach-management',
    ],
    '/mi-gimnasio' => [
        'title'  => 'Mi Gimnasio — GloveUp',
        'nav'    => 'mi-gimnasio',
        'label'  => 'Mi Gimnasio',
        'legacy' => '/legacy/dashboard/entrenador/dashboard.html#coach-gym',
    ],
];

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
