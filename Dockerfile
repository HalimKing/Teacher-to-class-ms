# syntax=docker/dockerfile:1

# -----------------------------------------------------------------------------
# Stage 1: PHP dependencies (required before Vite build for ziggy-js alias)
# -----------------------------------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app

COPY composer.json composer.lock ./

# The composer:2 image is minimal and lacks ext-zip, ext-gd, etc. required by
# PhpSpreadsheet/DomPDF. Those extensions are installed in the runtime stage.
RUN composer install \
    --no-dev \
    --no-interaction \
    --no-scripts \
    --prefer-dist \
    --ignore-platform-reqs

COPY . .

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --ignore-platform-reqs \
    && composer clear-cache

# -----------------------------------------------------------------------------
# Stage 2: Frontend assets (Vite + React + Inertia)
# -----------------------------------------------------------------------------
FROM node:22-bookworm-slim AS assets

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY vite.config.ts tsconfig.json components.json ./
COPY resources ./resources
COPY public ./public
COPY --from=vendor /app/vendor ./vendor

ARG VITE_APP_NAME="Teacher-to-Class-MS"
ARG VITE_GOOGLE_MAPS_API_KEY=""
ARG VITE_DEFAULT_CAMPUS_LAT=""
ARG VITE_DEFAULT_CAMPUS_LNG=""

ENV VITE_APP_NAME=${VITE_APP_NAME}
ENV VITE_GOOGLE_MAPS_API_KEY=${VITE_GOOGLE_MAPS_API_KEY}
ENV VITE_DEFAULT_CAMPUS_LAT=${VITE_DEFAULT_CAMPUS_LAT}
ENV VITE_DEFAULT_CAMPUS_LNG=${VITE_DEFAULT_CAMPUS_LNG}

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 3: Production runtime (Apache + PHP)
# -----------------------------------------------------------------------------
FROM php:8.3-apache-bookworm AS runtime

LABEL org.opencontainers.image.title="teacher-to-class-ms"
LABEL org.opencontainers.image.description="Laravel 12 + Inertia React attendance management system"

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
ENV PORT=8080

# System packages + PHP extensions required by Laravel, Excel, DomPDF, PostgreSQL/MySQL
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        git \
        unzip \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libzip-dev \
        libpq-dev \
        libonig-dev \
        libxml2-dev \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j"$(nproc)" \
        bcmath \
        exif \
        gd \
        opcache \
        pcntl \
        pdo_mysql \
        pdo_pgsql \
        zip \
    && a2enmod rewrite headers env \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/conf.d/laravel.ini /usr/local/etc/php/conf.d/laravel.ini
COPY docker/apache/000-default.conf /etc/apache2/sites-available/000-default.conf

WORKDIR /var/www/html

COPY --chown=www-data:www-data . .
COPY --chown=www-data:www-data --from=vendor /app/vendor ./vendor
COPY --chown=www-data:www-data --from=assets /app/public/build ./public/build

RUN mkdir -p storage/framework/{cache,sessions,views} storage/logs bootstrap/cache \
    && chown -R www-data:www-data storage bootstrap/cache \
    && chmod -R ug+rwx storage bootstrap/cache \
    && rm -rf node_modules tests .github

COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS "http://127.0.0.1:${PORT}/up" || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["apache2-foreground"]
