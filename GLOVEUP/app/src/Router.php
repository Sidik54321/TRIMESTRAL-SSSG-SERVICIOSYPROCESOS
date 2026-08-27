<?php

declare(strict_types=1);

namespace GloveUp;

/**
 * Router — Resolución de rutas de la SPA.
 *
 * Cada ruta se declara con un patrón tipo "/gimnasios/{key}". Los segmentos
 * entre llaves se capturan como parámetros y llegan a la vista dentro de
 * $params. El emparejamiento es exacto y sin expresiones regulares en la
 * declaración, para que la tabla de rutas siga siendo legible.
 */
final class Router
{
    /** @var array<int, array{pattern: string, route: array<string, mixed>}> */
    private array $routes = [];

    /** @var array<string, mixed>|null */
    private ?array $fallback = null;

    /**
     * Registra una ruta.
     *
     * @param string               $pattern Patrón de URL, p. ej. "/gimnasios/{key}"
     * @param array<string, mixed> $route   Metadatos: view, title, nav, shell, auth
     */
    public function add(string $pattern, array $route): void
    {
        $this->routes[] = ['pattern' => $this->normalize($pattern), 'route' => $route];
    }

    /**
     * Ruta usada cuando ninguna otra encaja (404).
     *
     * @param array<string, mixed> $route
     */
    public function fallback(array $route): void
    {
        $this->fallback = $route;
    }

    /**
     * Busca la ruta que corresponde a un path.
     *
     * @return array<string, mixed> Metadatos de la ruta más la clave "params"
     */
    public function match(string $path): array
    {
        $path = $this->normalize($path);
        $segments = $path === '/' ? [] : explode('/', trim($path, '/'));

        foreach ($this->routes as $entry) {
            $params = $this->compare($entry['pattern'], $segments);
            if ($params !== null) {
                return $entry['route'] + ['params' => $params, 'path' => $path];
            }
        }

        return ($this->fallback ?? ['view' => 'pages/not-found', 'title' => 'No encontrado'])
            + ['params' => [], 'path' => $path];
    }

    /**
     * Compara un patrón con los segmentos de la URL.
     *
     * @param  array<int, string>       $segments
     * @return array<string, string>|null  Parámetros capturados, o null si no encaja
     */
    private function compare(string $pattern, array $segments): ?array
    {
        $expected = $pattern === '/' ? [] : explode('/', trim($pattern, '/'));

        if (count($expected) !== count($segments)) {
            return null;
        }

        $params = [];
        foreach ($expected as $i => $part) {
            // Segmento dinámico: "{key}" captura el valor de esa posición
            if (strlen($part) > 2 && $part[0] === '{' && str_ends_with($part, '}')) {
                $name = substr($part, 1, -1);
                if ($segments[$i] === '') {
                    return null;
                }
                $params[$name] = rawurldecode($segments[$i]);
                continue;
            }

            // Segmento literal: comparación insensible a mayúsculas
            if (strcasecmp($part, $segments[$i]) !== 0) {
                return null;
            }
        }

        return $params;
    }

    /** Garantiza barra inicial y elimina la final (salvo en la raíz). */
    private function normalize(string $path): string
    {
        $path = '/' . trim($path, '/');

        return $path === '/' ? '/' : rtrim($path, '/');
    }
}
