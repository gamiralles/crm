# CRM para productor de seguros

Monorepo inicial del CRM. El frontend y la API se ejecutan por separado durante el desarrollo.

## Requisitos

- Node.js 20.19 o superior.
- npm 10 o superior.
- MongoDB local o una instancia MongoDB configurada por el usuario.

## Configurar el backend

Desde la raíz, copiar `.env.example` a `.env` y completar `SESSION_SECRET` con un valor aleatorio de al menos 32 caracteres. Si se va a crear el primer propietario por API, completar también `INITIAL_SETUP_KEY` con otro valor aleatorio distinto. No guardar el archivo `.env` en el repositorio.

Completar `MONGODB_URI` con la conexión elegida; su ruta identifica la base (`crm_seguros` era el ejemplo local anterior, no se ha confirmado que sea la base existente en Atlas). `WEB_ORIGIN` debe coincidir con el origen del frontend. En producción, configurar el proxy de confianza y el atributo `SESSION_SAME_SITE` según los dominios elegidos; `SameSite=none` requiere HTTPS. El listado y alcance de las variables está en `docs/DEPLOYMENT.md`.

Los cambios estructurales se versionan en `apps/api/src/migrations/`. La API aplica las migraciones pendientes al iniciar; también se pueden aplicar manualmente con `npm run migrate --workspace @crm/api`.

## Instalar y ejecutar

```bash
npm install
npm run dev
```

Esto abre la interfaz en modo de vista local (sin iniciar sesión y sin guardar cambios), para recorrer las pantallas sin configurar MongoDB. Vite mostrará la dirección local en la terminal, normalmente `http://localhost:5173`. Este acceso de vista previa solo existe durante el desarrollo y no se incluye en producción.

Para usar el CRM con datos y operaciones guardadas, primero configurar MongoDB y las variables requeridas en `.env`; luego iniciar la API en otra terminal:

```bash
npm run dev:api
```

El frontend usa por defecto `http://localhost:3001/api/v1`; para otro origen, definir `VITE_API_BASE_URL` en `apps/web/.env.local` o en el entorno de build. Las solicitudes usan la cookie de sesión del backend. Solo es una URL pública; nunca poner secretos en variables `VITE_*`.

## Renovaciones y canales de aviso

La API ejecuta el barrido de vencimientos al recibir `POST /api/v1/scheduler/renewals/sweep` con `Authorization: Bearer <SCHEDULER_SECRET>`. Para Vercel Cron también acepta `GET`; definir `CRON_SECRET` en el proyecto API y Vercel lo envía como Bearer token. La configuración diaria Hobby queda en `apps/api/vercel.json` (11:00 UTC, que corresponde a las 08:00 de Buenos Aires; Hobby puede ejecutarla dentro de esa hora). Las claves deben ser aleatorias y tener al menos 32 caracteres. Los plazos iniciales son 30, 15, 7 y 0 días; el propietario puede ajustarlos en Notificaciones.

### Prueba personal en Vercel Hobby

El monorepo queda preparado para dos proyectos Vercel con Root Directory `apps/web` y `apps/api`, usando un repositorio Git personal. Para la API, definir `MONGODB_URI`, `SESSION_SECRET`, `WEB_ORIGIN`, `TRUST_PROXY=1`, `SESSION_SAME_SITE=lax`, `INITIAL_SETUP_KEY` y `CRON_SECRET`; para la web, definir `VITE_API_BASE_URL=https://<dominio-api>/api/v1`. No enviar secretos en el chat ni ponerlos en el proyecto web. Vercel Hobby no ofrece IP de salida fija para Atlas, de modo que la conexión de red de Atlas debe decidirse antes del primer acceso; la guía en `docs/DEPLOYMENT.md` explica el límite.

Los avisos internos funcionan sin proveedores. Para activar canales externos, configurar SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`), Web Push (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) o Telegram (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`). Para Telegram, registrar `https://<dominio-api>/api/v1/telegram/webhook` como webhook del bot usando el secreto configurado; luego el propietario inicia la vinculación desde Notificaciones y confirma el inicio en Telegram. No colocar tokens en el frontend.

El estado `provider_accepted` indica que el proveedor aceptó el envío; no confirma la entrega en el dispositivo ni la lectura. Las entregas fallidas se reintentan en el siguiente barrido, con un máximo de cinco intentos.

## Calendario, Outlook y módulos comerciales

El calendario combina eventos locales, tareas abiertas y próximos seguimientos de renovación. Para conectar Outlook personal, registrar una aplicación en Microsoft Entra con audiencia de cuentas personales, agregar el permiso delegado `Calendars.ReadWrite`, configurar la URI de redirección igual a `MICROSOFT_REDIRECT_URI` y completar las cuatro variables `MICROSOFT_*` en el backend. La clave de cifrado debe ser Base64 de 32 bytes aleatorios; los tokens se cifran con AES-256-GCM en MongoDB. El usuario autoriza la conexión desde Calendario. Se pueden consultar/sincronizar eventos del período y crear, editar o eliminar eventos de Outlook confirmados por Microsoft. La sincronización no es en tiempo real; debe ejecutarse desde Calendario. Desconectar elimina los tokens y copias locales del CRM; si también se quiere retirar el consentimiento, hacerlo desde la cuenta Microsoft.

Cotizaciones, aseguradoras (con datos de contacto), siniestros, caja, comisiones e informes requieren inicio de sesión. Las comisiones empiezan pendientes de facturación; el usuario avanza su estado a facturada y luego cobrada. Informes se filtran por fechas y reflejan solo datos guardados.

La PWA se instala en navegadores compatibles al publicar por HTTPS. La versión sin conexión guarda únicamente la carcasa de la interfaz y archivos estáticos; no almacena respuestas de la API ni datos personales.

El frontend queda en la URL local que indique Vite. La API escucha en `http://localhost:3001` y ofrece `GET /api/v1/health/live` y `GET /api/v1/health/ready`. En producción, después de `npm run build`, iniciar la API con `npm run start:api`.

### Crear el primer propietario

El alta pública está cerrada. Configurar `INITIAL_SETUP_KEY` con una clave aleatoria habilita temporalmente `POST /api/v1/auth/bootstrap`; la ruta crea el único espacio inicial y deja de aceptar altas después de que exista una organización. El cuerpo requiere `setupKey`, `organizationName`, `fullName`, `email` y una contraseña de entre 12 y 72 bytes UTF-8. Luego se inicia una sesión.

Las sesiones se guardan en MongoDB, usan una cookie `HttpOnly` con vencimiento móvil de 12 horas y se regeneran al iniciar sesión. El inicio de sesión acepta `email` y `password` en `POST /api/v1/auth/login`; `GET /api/v1/auth/me` consulta la sesión actual y `POST /api/v1/auth/logout` la cierra.

## Verificaciones

```bash
npm run test:api
npm run typecheck
npm run lint
npm run build
npm run preview
```

La configuración de la aplicación Microsoft usa autorización delegada y PKCE. Microsoft documenta el flujo de autorización [OAuth 2.0](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow), la consulta de eventos por rango ([calendarView](https://learn.microsoft.com/en-us/graph/api/calendar-list-calendarview?view=graph-rest-1.0)) y el permiso de calendario para [crear eventos](https://learn.microsoft.com/en-us/graph/api/calendar-post-events?view=graph-rest-1.0).

El estado de implementación y las verificaciones por etapa están en [`docs/PROGRESS.md`](docs/PROGRESS.md). La guía de preparación para despliegue está en [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Las integraciones requieren configuración externa y no se activan durante la instalación.
