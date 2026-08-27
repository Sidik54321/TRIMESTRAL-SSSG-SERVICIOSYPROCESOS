<?php

declare(strict_types=1);

namespace GloveUp;

use RuntimeException;

/**
 * View — Renderizado de plantillas PHP a cadena.
 *
 * Las plantillas viven en app/views y reciben sus datos como variables
 * locales. No hay motor de plantillas externo: PHP ya lo es, y así el
 * proyecto no arrastra dependencias de Composer.
 */
final class View
{
    public function __construct(private readonly string $basePath)
    {
    }

    /**
     * Renderiza una plantilla y devuelve su HTML.
     *
     * @param string               $template Ruta relativa sin extensión, p. ej. "pages/gyms"
     * @param array<string, mixed> $data     Variables disponibles en la plantilla
     */
    public function render(string $template, array $data = []): string
    {
        $file = $this->basePath . '/' . $template . '.php';

        if (!is_file($file)) {
            throw new RuntimeException("Vista no encontrada: {$template}");
        }

        // Se expone $view para que las plantillas puedan anidar parciales
        $data['view'] = $this;

        extract($data, EXTR_SKIP);
        ob_start();

        try {
            require $file;
        } catch (\Throwable $e) {
            ob_end_clean();
            throw $e;
        }

        return (string) ob_get_clean();
    }

    /** Escapa texto para insertarlo en HTML. Atajo usado en todas las vistas. */
    public static function e(?string $value): string
    {
        return htmlspecialchars($value ?? '', ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }
}
