<?php

declare(strict_types=1);

/**
 * index.php — Front controller de la SPA.
 *
 * Toda petición que no sea un fichero estático llega aquí (ver .htaccess) y
 * se resuelve de una de estas dos formas:
 *
 *   1. Navegación normal (primera carga, recarga, enlace externo, buscador)
 *      → se devuelve el documento HTML completo con la vista ya dentro.
 *
 *   2. Navegación de la SPA (fetch con la cabecera X-GloveUp-SPA: 1)
 *      → se devuelve un JSON con el HTML de la vista, el título y el
 *        elemento de menú activo, y el cliente sustituye sólo el contenido.
 *
 * Renderizar en servidor en ambos casos evita que la SPA dependa de
 * JavaScript para mostrar la primera pantalla y mantiene las URLs
 * compartibles y con historial real.
 */

require __DIR__ . '/../src/Router.php';
require __DIR__ . '/../src/View.php';

use GloveUp\View;

$view   = new View(dirname(__DIR__) . '/views');
$router = require __DIR__ . '/../src/routes.php';

// ── Resolución del path solicitado ─────────────────────────────────
$requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
$path       = (string) (parse_url($requestUri, PHP_URL_PATH) ?: '/');

// Si la app se sirve desde un subdirectorio, se descuenta ese prefijo
$scriptDir = rtrim(str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? ''))), '/');
if ($scriptDir !== '' && $scriptDir !== '/' && str_starts_with($path, $scriptDir)) {
    $path = substr($path, strlen($scriptDir));
}
if ($path === '') {
    $path = '/';
}

$route     = $router->match($path);
$isPartial = ($_SERVER['HTTP_X_GLOVEUP_SPA'] ?? '') === '1';
$isMissing = $route['view'] === 'pages/not-found';

// ── Renderizado de la vista ────────────────────────────────────────
$content = $view->render($route['view'], [
    'params' => $route['params'],
    'route'  => $route,
]);

// ── Respuesta a una navegación de la SPA ───────────────────────────
if ($isPartial) {
    http_response_code($isMissing ? 404 : 200);
    header('Content-Type: application/json; charset=utf-8');
    // Cada URL devuelve contenido distinto: sin caché intermedia
    header('Cache-Control: no-store');

    echo json_encode([
        'title' => $route['title'],
        'nav'   => $route['nav'],
        'shell' => $route['shell'],
        'html'  => $content,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

    return;
}

// ── Respuesta a una navegación normal: documento completo ──────────
http_response_code($isMissing ? 404 : 200);
header('Content-Type: text/html; charset=utf-8');

echo $view->render('layout/shell', [
    'title'   => $route['title'],
    'nav'     => $route['nav'],
    'shell'   => $route['shell'],
    'content' => $content,
]);
