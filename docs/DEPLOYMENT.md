# Preparación para despliegue

Esta guía deja pasos reproducibles sin publicar el proyecto ni usar credenciales reales. Primero desplegar en un entorno de prueba y confirmar la restauración de una copia.

## Componentes

- **Web:** sitio estático generado en `apps/web/dist`. Puede alojarse en Vercel u otro alojamiento estático. El dominio debe usar HTTPS.
- **API:** Function de Vercel desde `apps/api/src/server.ts`. Inicializa MongoDB y migraciones al primer pedido de cada instancia caliente, y conserva la conexión entre solicitudes de esa instancia.
- **MongoDB:** instancia administrada o propia con autenticación, acceso de red restringido, cifrado en tránsito y almacenamiento persistente.
- **Scheduler:** Vercel Cron diario invoca `GET /api/v1/scheduler/renewals/sweep`. En Hobby se ejecuta una vez por día con precisión horaria; el endpoint valida `CRON_SECRET` enviado como `Authorization: Bearer ...` y también conserva `POST` para ejecuciones manuales.

## Arquitectura elegida para prueba personal en Hobby

La web y la API se despliegan como dos proyectos del mismo monorepo, con Root Directory `apps/web` y `apps/api` respectivamente. Vercel admite Express en Functions y detecta `src/server.ts`; la API inicializa conexión y migraciones de forma diferida para el ciclo serverless. La ruta del scheduler admite GET y POST; Cron queda configurado a las 11:00 UTC (08:00 en Buenos Aires), pero Hobby puede invocarlo dentro de toda esa hora. Cron es best-effort y no reintenta fallos. Fuentes: [Express en Vercel](https://vercel.com/docs/frameworks/backend/express), [monorepos](https://vercel.com/docs/monorepos), [límites de Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

Configurar `VITE_API_BASE_URL` en el proyecto web con el dominio HTTPS del proyecto API y `/api/v1`; en la API configurar `WEB_ORIGIN` con el origen exacto de la web, `SESSION_SAME_SITE=lax` y `TRUST_PROXY=1`. Vercel Hobby no ofrece IP de salida fija para la Function, así que no se puede dar a Atlas una IP de Vercel exclusiva para allowlist. Atlas requiere entradas de acceso de red; permitir `0.0.0.0/0` habilita intentos desde cualquier dirección y MongoDB advierte sobre el riesgo. No abrir esa regla sin que el propietario decida aceptarla para esta prueba y use un usuario de base con privilegios mínimos, contraseña larga y datos ficticios. Fuentes: [IP estática de Vercel](https://vercel.com/kb/guide/can-i-get-a-fixed-ip-address), [lista de acceso de Atlas y advertencia sobre `/0`](https://www.mongodb.com/docs/atlas/security/ip-access-list/).

Crear ambos proyectos desde un repositorio Git personal. Hobby no permite conectar repositorios propiedad de una organización de Git; también exige uso personal/no comercial y aplica límites de recursos. Si el CRM pasa a uso profesional, migrar antes de usarlo en esa actividad a un plan/proveedor que lo permita.

## Build local reproducible

1. Instalar Node.js `>=20.19` y npm `>=10`.
2. Desde la raíz, ejecutar `npm ci`.
3. Configurar el backend en un almacén de secretos y verificar las variables requeridas con el esquema de inicio. Nunca subir `.env`.
4. Ejecutar `npm run test:api`, `npm run typecheck`, `npm run lint` y `npm run build`.
5. Crear proyecto Vercel para `apps/api`; Vercel detecta la Function Express en `src/server.ts` y el Cron de `apps/api/vercel.json`.
6. Crear proyecto Vercel para `apps/web`; definir `VITE_API_BASE_URL` como `https://<dominio-api>/api/v1` antes del build.
7. En el proyecto API, cargar `MONGODB_URI`, `SESSION_SECRET`, `WEB_ORIGIN`, `TRUST_PROXY=1`, `SESSION_SAME_SITE=lax`, `INITIAL_SETUP_KEY` y `CRON_SECRET` en el entorno Production. No cargar secretos de API en el proyecto web.
8. Probar `GET /api/v1/health/live` y `GET /api/v1/health/ready`, bootstrap del propietario, login, persistencia de sesión y ejecución manual/diaria del scheduler.

## Variables de entorno

La API lee el `.env` de la raíz solo en desarrollo local. En producción, cargar sus variables en el almacén privado del host de la API. La web usa `apps/web/.env.example` localmente; `VITE_API_BASE_URL` debe definirse en el entorno de build de Vercel. No copiar secretos a las variables `VITE_*`: Vite las incorpora al JavaScript público.

| Variable | Aplicación / finalidad | Obligatoria y formato |
|---|---|---|
| `NODE_ENV` | API; activa ajustes de producción | En producción, `production`; local usa `development`. |
| `PORT` | API; puerto HTTP | Opcional; entero 1–65535, predeterminado 3001. |
| `WEB_ORIGIN` | API; origen permitido por CORS | Configurar en producción con el origen HTTPS exacto de la web; local predeterminado `http://localhost:5173`. |
| `MONGODB_URI` | API; conexión y nombre de base en la ruta de la URI | Obligatoria; URI TLS de Atlas. La ruta de ejemplo previa indicaba `crm_seguros`, pero el cluster/base existentes deben confirmarse antes de conectar. Secreto. |
| `SESSION_SECRET` | API; firma de cookies de sesión | Obligatoria; mínimo 32 caracteres aleatorios. Secreto. |
| `SESSION_COOKIE_NAME` | API; nombre de cookie | Opcional; predeterminado `crm.sid`. |
| `SESSION_SAME_SITE` | API; política de cookies | Opcional; `lax`, `strict` o `none`; en `none` se exige HTTPS y `Secure`. |
| `INITIAL_SETUP_KEY` | API; autoriza el alta inicial del propietario | Solo necesaria para bootstrap; mínimo 32 caracteres aleatorios, retirar del entorno después del alta. Secreto. |
| `TRUST_PROXY` | API; proxies inversos confiables | Opcional; entero 0–10. Mantener 0 salvo que la topología desplegada requiera confiar en un proxy. |
| `LOG_LEVEL` | API; detalle de registros | Opcional; `fatal`, `error`, `warn`, `info`, `debug`, `trace` o `silent`; predeterminado `info`. |
| `SCHEDULER_SECRET` | API y servicio que invoca el scheduler | Necesaria para ejecutar barridos; mínimo 32 caracteres aleatorios. Solo en servidor/servicio de tareas. Secreto. |
| `CRON_SECRET` | API de Vercel; protege el endpoint invocado por Vercel Cron | En Hobby, necesaria para el Cron; mínimo 32 caracteres aleatorios. Vercel la envía como Bearer token. Secreto. |
| `VAPID_PUBLIC_KEY` | API; Web Push | Opcional; clave pública VAPID. Configurar junto con la privada. Pública, pero se guarda en el backend. |
| `VAPID_PRIVATE_KEY` | API; firma Web Push | Opcional; clave privada VAPID; junto con la pública. Secreto. |
| `VAPID_SUBJECT` | API; contacto VAPID | Opcional; URI `mailto:` de contacto. |
| `SMTP_HOST` | API; host SMTP | Opcional; configurar con usuario/contraseña/remitente si se activa correo. |
| `SMTP_PORT` | API; puerto SMTP | Opcional; entero 1–65535, predeterminado 587. |
| `SMTP_USER` | API; autenticación SMTP | Opcional; credencial. Secreto cuando el proveedor la usa. |
| `SMTP_PASSWORD` | API; autenticación SMTP | Opcional; credencial. Secreto. |
| `SMTP_FROM` | API; remitente | Opcional; dirección de correo válida autorizada por el proveedor. |
| `TELEGRAM_BOT_TOKEN` | API; Bot API de Telegram | Opcional; token del bot. Configurar junto con nombre y secreto del webhook. Secreto. |
| `TELEGRAM_BOT_USERNAME` | API; enlace de vinculación | Opcional; nombre de usuario del bot sin `@`, 5–32 caracteres alfanuméricos o `_`. |
| `TELEGRAM_WEBHOOK_SECRET` | API; autentica webhooks entrantes | Opcional; 16–256 caracteres alfanuméricos, `_` o `-`. Secreto. |
| `MICROSOFT_CLIENT_ID` | API; identifica la app Entra | Opcional; configurar junto con las otras tres variables Microsoft. Identificador, no contraseña; mantenerlo solo en API. |
| `MICROSOFT_CLIENT_SECRET` | API; OAuth Microsoft | Opcional; secreto de aplicación. Secreto. |
| `MICROSOFT_REDIRECT_URI` | API y app Entra; callback OAuth exacto | Opcional; URL HTTPS en producción. |
| `MICROSOFT_TOKEN_ENCRYPTION_KEY` | API; cifra tokens guardados en Atlas | Opcional; Base64 de exactamente 32 bytes aleatorios. Secreto irrecuperable si se pierde. |
| `VITE_API_BASE_URL` | Web; origen y prefijo API incluido en el bundle | En Vercel, obligatoria antes del build; URL HTTPS de API con `/api/v1`. Pública. Local puede omitirla para usar `http://localhost:3001/api/v1`. |

Generar secretos al momento de configurarlos, sin pegarlos en el chat ni guardarlos en Git. Con Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Usar un valor nuevo para cada secreto y ambiente. Para `MICROSOFT_TOKEN_ENCRYPTION_KEY`, generar Base64 estándar de 32 bytes:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Los campos `SESSION_SECRET`, `MONGODB_URI` y secretos de integraciones van solo en el host API. En Preview, usar una base de prueba separada y claves distintas de Production.

## MongoDB y migraciones

La API espera que MongoDB esté disponible antes de iniciar y aplica las migraciones versionadas durante el arranque. Conservar `schemaMigrations` junto con el resto de la base. No ejecutar migraciones manuales sobre producción sin respaldo y ventana de mantenimiento.

## Respaldos y restauración

- Programar copias cifradas de MongoDB con retención y acceso limitado; incluir sesiones e integraciones cifradas si la política exige conservarlas.
- Guardar `MICROSOFT_TOKEN_ENCRYPTION_KEY` y los secretos del resto de integraciones en un gestor de secretos respaldado. Sin la clave de Microsoft no se pueden descifrar los tokens restaurados; el propietario tendrá que reconectar Outlook si se pierde.
- Practicar una restauración en una base separada. Verificar conteos generales, índices, migraciones y acceso del propietario sin exponer datos personales en los logs.
- Definir RPO/RTO, retención, responsables y procedimiento de eliminación conforme a la política de datos del productor antes de producción.

## Scheduler y observabilidad

Invocar diariamente el endpoint protegido, alertar si la ejecución no devuelve HTTP 2xx y consultar los registros de ejecución para detectar errores. Usar una clave larga y rotarla coordinando el scheduler y el servidor. El endpoint es idempotente para alertas y tareas. No publicar el secreto en la configuración del frontend.

## Microsoft Outlook

Registrar una aplicación Microsoft Entra que admita cuentas personales, agregar una plataforma Web y registrar la URI de callback exacta. Conceder el permiso delegado `Calendars.ReadWrite`. El flujo es OAuth 2.0 Authorization Code con PKCE y usa el endpoint de consumidores. Configurar `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI` y una clave Base64 de 32 bytes en `MICROSOFT_TOKEN_ENCRYPTION_KEY`; las cuatro variables deben configurarse juntas. Guardar el secreto y la clave de cifrado en un gestor de secretos, nunca en Vercel ni en el frontend. La conexión aún no debe considerarse probada hasta autorizar una cuenta de prueba y verificar consulta, creación, edición, eliminación y reconexión ante revocación.

## Go-live checklist

- [ ] Dominio HTTPS y CORS revisados.
- [ ] MongoDB accesible solo desde la API y con copia/restauración comprobadas.
- [ ] Secretos únicos de producción guardados fuera del repositorio.
- [ ] Bootstrap inicial deshabilitado después de crear al propietario.
- [ ] Scheduler configurado y ejecución observada.
- [ ] Correo, Push, Telegram y Outlook probados con cuentas de prueba y consentimiento adecuado.
- [ ] `npm run test:api`, `npm run typecheck`, `npm run lint` y `npm run build` pasan en el artefacto que se publicará.
- [ ] Flujo de renovación, aislamiento y PWA verificados en un entorno de ensayo.
- [ ] Responsable de incidentes y recuperación definido.

El despliegue queda a cargo del propietario. Esta guía no crea servicios, bases ni cuentas.
