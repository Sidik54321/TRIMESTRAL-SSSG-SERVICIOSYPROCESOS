# GLOVEUP

**Autor:** Sidik Muniru Roca  
**Proyecto:** Aplicación web de boxeo y artes marciales  
**Curso:** Proyecto Trimestral  

---

## Índice

1. [Descripción general](#descripción-general)
2. [Tecnologías utilizadas](#tecnologías-utilizadas)
3. [Arquitectura del sistema](#arquitectura-del-sistema)
4. [Árbol de carpetas](#árbol-de-carpetas)
5. [Justificación de cada módulo](#justificación-de-cada-módulo)
6. [Base de datos](#base-de-datos)
7. [API REST](#api-rest)
8. [Seguridad](#seguridad)
9. [Despliegue con Docker](#despliegue-con-docker)
10. [Instalación y uso](#instalación-y-uso)

---

## Descripción general

**GloveUp** es una plataforma web de gestión deportiva enfocada en el mundo del boxeo. Permite a boxeadores encontrar compañeros de sparring, conectar con entrenadores, descubrir gimnasios y gestionar su actividad deportiva desde un único lugar.

La aplicación distingue entre tres tipos de usuario con paneles diferenciados:

- **Boxeador** — puede buscar sparrings, aceptar o rechazar retos, ver su historial de combates y gestionar su perfil deportivo.
- **Entrenador** — puede gestionar su calendario de clases, dar seguimiento a sus alumnos y recibir pagos mensuales.
- **Administrador** — puede supervisar y gestionar todos los usuarios de la plataforma.

El sistema incluye un chat interno, notificaciones en tiempo real, manejo de retos entre boxeadores y un sistema de pagos mensuales.

---

## Tecnologías utilizadas

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| HTML5 | — | Estructura semántica de las páginas |
| CSS3 | — | Estilos, Flexbox, Grid, animaciones |
| JavaScript (Vanilla) | ES6+ | Lógica del lado del cliente, sin frameworks |
| Font Awesome | 6.0 | Iconografía de la interfaz |
| Google Fonts (Inter, Outfit) | — | Tipografía corporativa |
| Nginx | Alpine | Servidor web en producción y proxy inverso |

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Node.js | 20 | Entorno de ejecución del servidor |
| Express.js | 4.18 | Framework HTTP para la API REST |
| MongoDB | 7.x | Base de datos NoSQL de documentos |
| Mongoose | 7.6 | ODM para modelar los datos en MongoDB |
| bcrypt | 6.0 | Hash seguro de contraseñas |
| Crypto (nativo) | — | Cifrado AES-256-CBC para datos sensibles |

### Infraestructura
| Tecnología | Uso |
|---|---|
| Docker | Contenerización de cada servicio |
| Docker Compose | Orquestación de los tres servicios (frontend, api, db) |
| MongoDB (contenedor) | Persistencia de datos con volumen nombrado |

### APIs externas
| API | Uso |
|---|---|
| OpenAI API | Funcionalidades de chat asistido por IA |

---

## Arquitectura del sistema

La aplicación sigue una arquitectura de **tres capas** completamente contenerizada:

```
┌─────────────────────────────────────────┐
│              USUARIO (navegador)         │
└──────────────────┬──────────────────────┘
                   │ HTTP :8080
┌──────────────────▼──────────────────────┐
│         FRONTEND  (Nginx :80)           │
│   Sirve HTML/CSS/JS estáticos           │
│   Actúa como proxy inverso a la API    │
└──────────────────┬──────────────────────┘
                   │ HTTP :3000
┌──────────────────▼──────────────────────┐
│          API  (Node.js/Express)         │
│   Gestiona lógica de negocio            │
│   Autenticación, rutas REST             │
└──────────────────┬──────────────────────┘
                   │ MongoDB :27017
┌──────────────────▼──────────────────────┐
│         BASE DE DATOS  (MongoDB)        │
│   Usuarios, boxeadores, entrenadores,   │
│   gimnasios, mensajes, notificaciones   │
└─────────────────────────────────────────┘
```

---

## Árbol de carpetas

```
GLOVEUP/
│
├── README.md                          # Documentación del proyecto
├── .gitignore
├── .gitattributes
│
├── docs/                              # Documentación adicional
│   └── Examen_GloveUp_Completo.pdf
│
├── tools/                             # Utilidades de desarrollo
│   ├── _patch_home.js
│   └── doc_generator.py
│
└── GLOVEUP/                           # Directorio principal de la aplicación
    │
    ├── index.html                     # Punto de entrada (redirección a /auth)
    │
    ├── assets/                        # Recursos estáticos globales
    │   ├── css/
    │   │   └── toasts.css             # Estilos de notificaciones toast
    │   ├── js/
    │   │   ├── auth-guard.js          # Protección de rutas autenticadas
    │   │   └── toasts.js              # Sistema de notificaciones toast
    │   ├── images/                    # Imágenes y fotografías
    │   │   ├── logo-fondo-blanco.jpg
    │   │   └── ...
    │   └── videos/                    # Vídeos de fondo
    │       └── ...
    │
    ├── auth/                          # Módulo de autenticación
    │   ├── index.html                 # Formulario de login y registro
    │   ├── auth.js                    # Lógica de autenticación (JWT local)
    │   └── auth.css                   # Estilos del módulo
    │
    ├── home/                          # Página principal post-login
    │   ├── home.html                  # Página de inicio / landing
    │   ├── dashboard.html             # Plantilla base del dashboard
    │   ├── home.js                    # Lógica de la página de inicio
    │   ├── chat.js                    # Funcionalidad del chat interno
    │   ├── sidebar.js                 # Navegación lateral dinámica
    │   ├── notifications.js           # Sistema de notificaciones
    │   ├── onboarding.js              # Flujo de bienvenida para nuevos usuarios
    │   ├── styles.css
    │   ├── notifications.css
    │   └── onboarding.css
    │
    ├── dashboard/                     # Paneles de control por rol
    │   ├── boxeador/                  # Dashboard del boxeador
    │   │   ├── dashboard.html
    │   │   ├── dashboard.react.js     # Componentes UI del panel
    │   │   └── dashboard.css
    │   └── entrenador/                # Dashboard del entrenador
    │       ├── dashboard.html
    │       ├── dashboard.react.js
    │       └── dashboard.css
    │
    ├── sparring/                      # Módulo de búsqueda de sparring
    │   ├── index.html                 # Buscador y listado de sparrings
    │   └── sparring.css
    │
    ├── gyms/                          # Módulo de gimnasios
    │   ├── index.html                 # Listado de gimnasios con filtros
    │   ├── gym.html                   # Vista individual de un gimnasio
    │   ├── gyms.js                    # Lógica de búsqueda y filtrado
    │   └── gyms.css
    │
    ├── profile/                       # Perfil de usuario
    │   ├── index.html                 # Vista y edición del perfil
    │   ├── profile.js
    │   └── profile.css
    │
    ├── settings/                      # Configuración de cuenta
    │   ├── index.html
    │   ├── settings.js
    │   └── settings.css
    │
    ├── onboarding/                    # Guías y tutoriales de inicio
    │   ├── index.html
    │   ├── faq.html                   # Preguntas frecuentes
    │   ├── manual-boxeador.html       # Manual de uso para boxeadores
    │   └── manual-entrenador.html     # Manual de uso para entrenadores
    │
    ├── admin/                         # Panel de administración
    │   └── users_list.html            # Listado y gestión de usuarios
    │
    ├── server/                        # Backend Node.js/Express
    │   ├── package.json
    │   ├── .env                       # Variables de entorno (no en git)
    │   └── src/
    │       ├── index.js               # Punto de entrada del servidor
    │       ├── models/                # Esquemas de MongoDB (Mongoose)
    │       │   ├── Usuario.js
    │       │   ├── Boxeador.js
    │       │   ├── Entrenador.js
    │       │   ├── Gimnasio.js
    │       │   ├── Mensaje.js
    │       │   └── Notificacion.js
    │       ├── routes/                # Endpoints de la API REST
    │       │   ├── auth.js
    │       │   ├── boxeadores.js
    │       │   ├── entrenadores.js
    │       │   ├── gimnasios.js
    │       │   ├── usuarios.js
    │       │   ├── chat.js
    │       │   └── notificaciones.js
    │       ├── seed/                  # Scripts de carga de datos de prueba
    │       │   ├── seedBoxeadores.js
    │       │   ├── seedMinimal.js
    │       │   └── seedTestUsers.js
    │       └── utils/                 # Utilidades internas
    │           ├── crypto.js          # Cifrado/descifrado AES-256
    │           └── cleanup.js         # Limpieza de datos obsoletos
    │
    └── docker/                        # Configuración de contenedores
        ├── .env                       # Variables de entorno para Docker
        ├── docker-compose.yml         # Orquestación de los tres servicios
        ├── api/
        │   ├── Dockerfile             # Imagen del backend (node:20-slim)
        │   └── .dockerignore
        └── frontend/
            ├── Dockerfile             # Imagen del frontend (nginx:alpine)
            ├── nginx.conf             # Configuración de Nginx y proxy
            └── .dockerignore
```

---

## Justificación de cada módulo

### `auth/` — Autenticación
Contiene el formulario unificado de registro e inicio de sesión. Se justifica como módulo independiente porque es la puerta de entrada obligatoria a toda la aplicación. El fichero `auth.js` gestiona el envío de credenciales a la API, el almacenamiento del token de sesión en `localStorage` y la redirección al panel según el rol recibido. Separarlo del resto evita que código de autenticación quede mezclado con la lógica de negocio.

### `assets/` — Recursos estáticos globales
Centraliza todos los recursos compartidos entre módulos: imágenes, vídeos de fondo, hojas de estilos comunes y scripts reutilizables. El script `auth-guard.js` merece especial mención: se incluye en cada página protegida y redirige automáticamente al login si no existe sesión activa, eliminando duplicación de código de seguridad en cada módulo.

### `home/` — Página principal
Es el hub central tras el login. Contiene la barra lateral de navegación, el sistema de notificaciones globales y el módulo de chat. Se agrupa aquí todo lo que es "estructura compartida" de la aplicación, de forma que los dashboards específicos de cada rol puedan reutilizar estas piezas sin duplicarlas.

### `dashboard/boxeador/` y `dashboard/entrenador/` — Paneles de rol
Cada rol tiene su propio panel con información y acciones pertinentes. El panel del boxeador muestra su historial de combates, retos activos, estadísticas y acceso rápido a la búsqueda de sparring. El del entrenador muestra su calendario, lista de alumnos y gestión de pagos. Separar ambos paneles en subcarpetas distintas facilita el mantenimiento independiente de cada flujo de usuario.

### `sparring/` — Búsqueda de sparring
Módulo clave de la aplicación. Permite a los boxeadores buscar compañeros filtrando por peso, nivel y ubicación, enviar retos y gestionar los recibidos. Al ser una funcionalidad con lógica propia y UI compleja, se aísla en su propio módulo para no contaminar otros.

### `gyms/` — Gimnasios
Proporciona un directorio de gimnasios con búsqueda, filtros y vista detallada de cada centro. Incluye integración con mapas para mostrar la ubicación. Este módulo es independiente y consulta directamente el endpoint `/api/gimnasios` sin acoplarse al resto de la lógica.

### `profile/` — Perfil de usuario
Permite visualizar y editar la información del perfil (datos personales, categoría de peso, foto, etc.). Gestiona el formulario de edición y la llamada al endpoint correspondiente de la API. Es un módulo independiente porque el perfil es accesible desde múltiples puntos de la aplicación.

### `settings/` — Configuración
Gestiona preferencias de cuenta: cambio de contraseña, notificaciones, visibilidad del perfil. Se mantiene separado del perfil porque afecta a configuración técnica de la cuenta, no a los datos deportivos del usuario.

### `onboarding/` — Guías de usuario
Contiene los manuales de uso diferenciados por rol y una sección de preguntas frecuentes. Su propósito es reducir la curva de aprendizaje de usuarios nuevos. Se justifica como módulo independiente porque su contenido es mayormente estático y no interactúa con la API.

### `admin/` — Panel de administración
Vista reservada para el rol administrador. Permite ver y gestionar todos los usuarios registrados en la plataforma. Se mantiene separado por razones de seguridad y de control de acceso, ya que solo debe ser accesible a administradores.

### `server/src/models/` — Modelos de datos
Define los esquemas de MongoDB mediante Mongoose. Cada modelo representa una entidad del dominio:

| Modelo | Descripción |
|---|---|
| `Usuario` | Credenciales de acceso, rol y referencia al perfil |
| `Boxeador` | Datos deportivos: peso, nivel, guardia, historial, retos |
| `Entrenador` | Especialidad, precio mensual, eventos de calendario |
| `Gimnasio` | Nombre, dirección, horario, coordenadas geográficas |
| `Mensaje` | Mensajes del chat interno entre usuarios |
| `Notificacion` | Alertas del sistema para cada usuario |

### `server/src/routes/` — Endpoints de la API
Organiza los controladores de la API por recurso, siguiendo convenciones REST. Cada fichero agrupa las rutas relacionadas con una entidad, lo que facilita localizar y modificar cualquier endpoint sin revisar un fichero monolítico.

### `server/src/seed/` — Datos de prueba
Scripts para poblar la base de datos con datos de ejemplo. Son fundamentales durante el desarrollo y las demostraciones, permitiendo probar la aplicación con datos realistas sin necesidad de registro manual.

### `server/src/utils/` — Utilidades del servidor
- `crypto.js`: implementa el cifrado y descifrado AES-256-CBC para proteger campos sensibles almacenados en la base de datos.
- `cleanup.js`: elimina registros obsoletos o huérfanos para mantener la integridad de los datos.

### `docker/` — Infraestructura de contenedores
Contiene toda la configuración necesaria para ejecutar la aplicación en cualquier entorno sin dependencias del sistema host. El fichero `docker-compose.yml` orquesta tres servicios:

| Servicio | Imagen base | Puerto |
|---|---|---|
| `db` | mongo:latest | 27018 → 27017 |
| `api` | node:20-slim | 3000 → 3000 |
| `frontend` | nginx:alpine | 8080 → 80 |

La configuración de Nginx actúa como proxy inverso, redirigiendo las peticiones `/api/*` al contenedor del backend sin exponer el servidor de Node directamente al navegador.

---

## Base de datos

GloveUp utiliza **MongoDB** como base de datos principal. La elección de una base de datos NoSQL se justifica por la naturaleza variable de los perfiles (un boxeador tiene campos distintos a un entrenador) y por la facilidad de escalar documentos con campos anidados sin migraciones de esquema.

**Colecciones principales:**

- `usuarios` — autenticación y rol
- `boxeadores` — perfiles deportivos con historial y retos
- `entrenadores` — perfiles de entrenadores con calendario
- `gimnasios` — directorio de centros deportivos
- `mensajes` — mensajes del chat
- `notificaciones` — alertas por usuario

---

## API REST

El servidor expone los siguientes grupos de endpoints:

| Endpoint | Descripción |
|---|---|
| `POST /api/auth/register` | Registro de nuevo usuario |
| `POST /api/auth/login` | Inicio de sesión, devuelve datos de sesión |
| `GET/POST /api/boxeadores` | Consulta y creación de perfiles de boxeador |
| `GET/POST /api/entrenadores` | Consulta y creación de perfiles de entrenador |
| `GET /api/gimnasios` | Listado y detalle de gimnasios |
| `GET/POST /api/usuarios` | Gestión de usuarios (admin) |
| `GET/POST /api/chat` | Mensajes del chat entre usuarios |
| `GET/POST /api/notificaciones` | Notificaciones del sistema |

---

## Seguridad

La aplicación implementa varias capas de seguridad:

- **Hashing de contraseñas** con bcrypt (10 rondas de sal), garantizando que las contraseñas nunca se almacenen en texto plano.
- **Cifrado AES-256-CBC** para campos sensibles en la base de datos mediante clave de entorno.
- **Cabeceras HTTP de seguridad**: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`.
- **Limitación de tasa (rate limiting)**: máximo 300 peticiones por IP en ventanas de 15 minutos.
- **Protección contra inyección NoSQL**: saneamiento de campos en las consultas de Mongoose.
- **CORS configurado**: el origen permitido se controla mediante variable de entorno.
- **Protección de rutas en el cliente**: `auth-guard.js` redirige al login si no existe sesión.

---

## Despliegue con Docker

### Prerrequisitos
- Docker Desktop instalado y en ejecución
- Git

### Pasos

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd GLOVEUP

# 2. Configurar las variables de entorno
#    Editar GLOVEUP/docker/.env con las claves necesarias

# 3. Construir e iniciar los contenedores
cd GLOVEUP/docker
docker compose up --build

# 4. Acceder a la aplicación
#    Abrir http://localhost:8080 en el navegador
```

### Variables de entorno necesarias

| Variable | Descripción |
|---|---|
| `ENCRYPTION_KEY` | Clave hexadecimal de 64 caracteres para AES-256 |
| `OPENAI_API_KEY` | Clave de API de OpenAI (opcional, para el chat IA) |
| `ALLOWED_ORIGINS` | Origen permitido en CORS (`*` para desarrollo) |

### Poblar la base de datos con datos de ejemplo

```bash
# Acceder al contenedor de la API
docker exec -it <nombre-contenedor-api> sh

# Ejecutar el script de seed
npm run seed
```

---

## Instalación y uso (desarrollo local)

Si se prefiere ejecutar sin Docker:

```bash
# Instalar dependencias del backend
cd GLOVEUP/server
npm install

# Configurar variables de entorno
# Copiar .env y ajustar MONGO_URI a una instancia local de MongoDB

# Iniciar el servidor de desarrollo
npm run dev

# Abrir GLOVEUP/index.html en el navegador
# (o usar un servidor estático como Live Server de VSCode)
```

---

*Proyecto desarrollado por **Sidik Muniru Roca** como proyecto trimestral.*
