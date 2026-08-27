# ──────────────────────────────────────────────────────────────────
# Imagen del frontend: SPA en PHP + Apache, con Tailwind compilado.
# Contexto de construcción: la carpeta GLOVEUP.
# ──────────────────────────────────────────────────────────────────

# ── Etapa 1: compilar el CSS ──────────────────────────────────────
# Tailwind sólo se necesita para generar la hoja de estilos, así que
# Node no llega a la imagen final.
FROM node:22-alpine AS css

WORKDIR /build

# --ignore-scripts evita que puppeteer (dependencia de los tests) se
# descargue un Chromium entero que esta etapa no va a usar.
COPY package.json ./
RUN npm install --ignore-scripts --no-audit --no-fund

# Tailwind rastrea las clases usadas en las plantillas y en el JS,
# por eso hay que copiar app/ antes de compilar.
COPY app ./app

RUN npx @tailwindcss/cli \
        --input  app/css/tailwind.css \
        --output dist/app.css \
        --minify


# ── Etapa 2: servidor PHP ─────────────────────────────────────────
FROM php:8.3-apache

# mod_rewrite  → front controller
# mod_headers  → cabeceras de seguridad del .htaccess
# mod_expires  → caché de estáticos
# mod_proxy*   → /api hacia el contenedor de Node
RUN a2enmod rewrite headers expires proxy proxy_http

# La app vive en /var/www/html; el código PHP que no debe servirse
# directamente queda un nivel por encima, fuera del DocumentRoot.
COPY app/public/ /var/www/html/
COPY app/src/    /var/www/src/
COPY app/views/  /var/www/views/

# Recursos compartidos por la SPA y las páginas clásicas
COPY assets/ /var/www/html/assets/

# Hoja de estilos generada en la etapa anterior
COPY --from=css /build/dist/app.css /var/www/html/assets/css/app.css

# JavaScript de la SPA (módulos ES, se sirven sin empaquetar)
COPY app/js/ /var/www/html/assets/js/

# ── Páginas clásicas aún no migradas ──────────────────────────────
# Se sirven bajo /legacy para que la SPA pueda enlazarlas mientras
# dura la migración. No se copia assets/ otra vez: un Alias apunta
# /legacy/assets a la única copia, que ocupa unos 70 MB.
COPY admin/      /var/www/html/legacy/admin/
COPY auth/       /var/www/html/legacy/auth/
COPY dashboard/  /var/www/html/legacy/dashboard/
COPY gyms/       /var/www/html/legacy/gyms/
COPY home/       /var/www/html/legacy/home/
COPY onboarding/ /var/www/html/legacy/onboarding/
COPY profile/    /var/www/html/legacy/profile/
COPY settings/   /var/www/html/legacy/settings/
COPY sparring/   /var/www/html/legacy/sparring/

COPY docker/web/apache.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 80
