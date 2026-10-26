# Arquitectura propuesta — CRM para productor de seguros

## Estado y contexto
Documento de diseño inicial de la Etapa 0. El material recibido especifica React, TypeScript, Vite, Tailwind, Express, API REST `/api/v1`, MongoDB y una aplicación en español. No había un repositorio preexistente ni una exportación de Notion en el material disponible; el proyecto se inició en `outputs/CRM-Productor-Seguros` con la autorización implícita de continuar allí. La estructura frontend de la Etapa 1 ya está dentro de `apps/web`.

## Estructura objetivo

```text
/
  apps/
    web/                 # React + TypeScript + Vite
    api/                 # Express + TypeScript + API REST /api/v1
  packages/
    shared/              # Tipos/esquemas compartidos solo cuando convenga
  docs/
  scripts/
  .env.example
  .gitignore
  AGENTS.md
  README.md
```

Monorepo con límites claros entre presentación, API y lógica compartida. No compartir modelos de persistencia directamente con la interfaz. Mantener validaciones de entrada en servidor aunque haya validación de formularios en el cliente.

## Tecnologías base
- Web: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form y Zod.
- API: Node.js, TypeScript y Express; rutas bajo `/api/v1`, validación Zod, errores centralizados y logs estructurados.
- Datos: MongoDB con Mongoose (propuesta inicial acorde al requerimiento); identificadores para referencias, índices revisados según consultas y scripts versionados para cambios de estructura.
- Verificación: Vitest, Supertest y Playwright para flujos críticos cuando el entorno esté definido.
- Localización: español, zona horaria inicial `America/Argentina/Buenos_Aires` y moneda configurable con ARS inicial.

## Límites y flujo de datos
El navegador consume la API; el backend valida la entrada, autentica al usuario, comprueba membresía/permisos y organización, ejecuta reglas de negocio y recién entonces consulta MongoDB. Toda consulta de negocio queda limitada a la organización autorizada. Ningún secreto de proveedor se expone al frontend.

Entidades previstas: organizaciones, usuarios/membresías, clientes, pólizas, renovaciones, tareas, notificaciones/entregas, cotizaciones, compañías, siniestros, eventos, integraciones, comisiones, movimientos de caja, auditoría y configuración. Los clientes son registros centrales referenciados por los demás módulos.

### Clientes (Etapa 3)
- Cada cliente pertenece a una organización y conserva su tipo (persona/empresa), nombre o razón social, documento opcional, correo, teléfono, nacimiento, dirección, notas y estado activo/inactivo.
- Las rutas de clientes requieren sesión y rol propietario; el backend deriva la organización desde la sesión, nunca desde el cuerpo del navegador. Las búsquedas, detalles, modificaciones y actividad filtran por esa organización.
- Los documentos no vacíos son únicos dentro de una organización mediante índice parcial. Se admite omitirlos; correo y teléfono no se fuerzan como únicos para compartir contactos familiares o empresariales.
- El historial registra creación, nombres de campos modificados y cambios de estado, evitando copiar datos personales previos. Inactivar conserva el registro y su historial.
- La interfaz consume API con cookie de sesión incluida. La clave de bootstrap permanece solo en servidor; el primer propietario se crea por `POST /api/v1/auth/bootstrap`.
- Las secciones de pólizas, cotizaciones, tareas y siniestros se muestran como pendientes de sus etapas, sin datos de muestra.

### Pólizas, renovaciones, tareas y avisos (Etapas 4–6)
- La póliza referencia al cliente y a una aseguradora de la misma organización. Se creó el catálogo mínimo de aseguradoras para mantener una referencia real; su gestión ampliada queda para Etapa 8.
- `policies.terms` conserva cada vigencia en el mismo documento de póliza. Una renovación explícita agrega una nueva versión y actualiza la vigencia vigente en una sola operación atómica del documento. Editar fechas cambia la versión vigente y no marca por sí mismo una renovación como realizada.
- `policyRenewals` identifica el ciclo por póliza y versión con índice único. Contactos y próxima acción pertenecen al ciclo. `tasks.sourceKey` y `notifications.dedupeKey` tienen índices únicos para impedir duplicados al repetir el proceso.
- El barrido se ejecuta desde Vercel Cron en `GET /api/v1/scheduler/renewals/sweep`, autenticado por `CRON_SECRET` en Hobby; `POST` con `SCHEDULER_SECRET` sigue disponible para otros schedulers/manual. Usa la zona horaria de cada organización y los días configurables, que empiezan en 30, 15, 7 y 0. Cada ejecución deja registro en `scheduler-runs` y los fallos de entrega tienen intentos limitados y reprogramación exponencial.
- El centro interno no depende de canales externos. `notification-deliveries` conserva canal, estado, intentos y error; `provider_accepted` significa que el proveedor aceptó la solicitud y no garantiza que el destinatario la haya leído o recibido en su dispositivo.
- Email utiliza SMTP; Web Push utiliza claves VAPID y suscripciones por dispositivo; Telegram usa un bot en backend y un token de vinculación temporal de un solo uso por webhook. Las preferencias son por usuario, organización, canal y tipo. Sin credenciales los canales quedan inactivos o registran el intento fallido, mientras el aviso interno se conserva.
- El resumen diario de tareas y renovaciones se genera una vez por organización y día mediante el mismo barrido programado. Ninguna integración externa se activa hasta configurar sus variables privadas.

### Calendario, comercial y finanzas (Etapas 7–9)
- `calendarEvents`, `quotes`, `claims`, `cashTransactions` y `commissions` llevan `organizationId`; todas las rutas autentican al propietario y limitan lecturas/escrituras a la organización de sesión. Las referencias de cliente, póliza y compañía se vuelven a validar en el servidor.
- El calendario agrupa eventos locales, tareas activas y próximas acciones de renovaciones. Outlook usa OAuth 2.0 de autorización delegada para cuentas Microsoft personales y Microsoft Graph `Calendars.ReadWrite`; se implementó consulta por ventana, alta remota, eliminación de eventos creados por el CRM y sincronización bajo demanda. No hay sincronización bidireccional en tiempo real ni notificaciones de cambio de Microsoft.
- `MicrosoftOAuthState` es de un uso y vence a los diez minutos. Tokens de acceso y refresco se cifran con AES-256-GCM mediante una clave de 32 bytes en `MICROSOFT_TOKEN_ENCRYPTION_KEY`; la clave solo vive en backend. Los registros Microsoft se identifican por `(organizationId, externalProvider, externalId)` con índice único. Desconectar elimina tokens locales; retirar el consentimiento se hace en la cuenta Microsoft.
- Las cotizaciones pueden relacionar cliente, compañía y póliza emitida. Los siniestros requieren una póliza y verifican que cliente y compañía coincidan con ella. Caja conserva ingresos/gastos. Las comisiones separan `pending_invoice`, `invoiced` y `collected`; una nueva comisión no puede empezar cobrada. Informes agregan los registros de la organización en el período solicitado.

### PWA y publicación (Etapas 10–12)
- El manifiesto y service worker permiten instalar la aplicación en clientes compatibles. Un solo worker atiende PWA y Web Push para evitar dos registros con alcance `/`. Solo se cachea la interfaz estática y recursos compilados; `/api/` queda excluido para no persistir datos privados sin conexión.
- `apps/web/vercel.json` configura la reescritura de rutas de React Router y cabeceras básicas. El frontend se publica como estático; API, MongoDB y scheduler se ejecutan por separado según `docs/DEPLOYMENT.md`.
- Los índices de nuevas colecciones se aplican en migraciones `004-business-indexes` y `005-microsoft-indexes`.

## Reglas de dominio críticas
- Vencimientos y alertas se calculan en el servidor con la zona horaria configurada, no con el reloj local del navegador.
- Una renovación crea trazabilidad de la nueva vigencia y conserva las anteriores.
- La generación programada de alertas/tareas debe ser idempotente: reintentar no crea duplicados y deja registro del resultado.
- Número de póliza no se trata como identificador global único sin validar reglas de negocio con compañías.
- Inactivar clientes conserva pólizas y actividad asociadas.
- Una comisión registrada no equivale a una comisión cobrada.

## Decisiones acordadas
1. **Autenticación:** sesión de servidor persistida en MongoDB, cookie `HttpOnly`, renovación deslizante de 12 horas y regeneración al iniciar sesión. `SameSite` es configurable; `none` activa `Secure`.
2. **Alta inicial:** endpoint temporal protegido por `INITIAL_SETUP_KEY`, limitado a crear el primer propietario y una organización; queda cerrado cuando esa organización existe. No hay registro público.
3. **Roles iniciales:** solo `owner`. Las membresías ya separan usuario, organización y rol para permitir ampliar permisos con políticas explícitas más adelante.
4. **Organización:** el primer bootstrap crea una organización. Toda autorización posterior se valida contra la membresía de la organización guardada en la sesión; los parámetros enviados por el navegador no seleccionan ni amplían ese alcance.
5. **Migraciones:** scripts numerados y registrados en `schemaMigrations`; la API aplica los pendientes antes de aceptar tráfico.

## Decisiones pendientes antes de las etapas dependientes
- **Ejecución del scheduler:** definir dónde correrá el proceso persistente de vencimientos y con qué garantías de reintento; no asumir que una función serverless de Vercel permanece activa.
- **Correo y notificaciones:** escoger proveedor, remitente y política de consentimiento/reintentos antes de activar envíos.
- **Outlook:** la primera versión consulta/crea/edita/elimina eventos mediante Graph delegado `Calendars.ReadWrite` y sincroniza bajo demanda. Pendiente probar con la aplicación y la cuenta personal Microsoft reales; no tiene webhook ni sync continuo.
- **Importación Notion:** inspeccionar esquema/exportación cuando el usuario provea el material, sin tocar originales ni importar automáticamente.

## Riesgos técnicos y mitigaciones
- **Fechas, husos y cambios de día:** persistir instantes/fechas de negocio con reglas explícitas; probar límites de día y zona horaria en servidor.
- **Alertas duplicadas o perdidas:** claves de idempotencia, historial de ejecución y reintentos observables.
- **Aislamiento de datos:** organización y autorización obligatorias en cada operación de backend; pruebas cruzadas entre organizaciones.
- **Cookies entre dominios:** elegir `SESSION_SAME_SITE`, `WEB_ORIGIN` y proxy confiable de acuerdo con los dominios de despliegue; `SameSite=none` requiere HTTPS.
- **Alta inicial:** proteger la configuración del primer propietario con una clave aleatoria fuera del repositorio y retirarla/deshabilitarla después del bootstrap.
- **Intentos de autenticación:** límites de intentos en memoria por instancia; si se despliega más de una instancia, evaluar un almacén compartido para el rate limit.
- **Datos personales:** minimizar datos, restringir registros/logs, mantener secretos fuera del repositorio y definir backups/restauración.
- **Scheduler y hosting:** separar el procesamiento programado de solicitudes web si la plataforma no garantiza procesos permanentes.
- **Integraciones externas:** desacoplar proveedores mediante adaptadores y registrar estados/errores sin guardar tokens en el cliente.
- **Crecimiento del alcance:** mantener el orden del roadmap y cerrar cada etapa antes de la siguiente.

## Configuración y despliegue
Las plantillas `.env.example` y `apps/web/.env.example` separan variables privadas del servidor y la URL pública de API. Para una prueba personal se eligió Vercel Hobby con dos proyectos, la API Express ejecutada como Function y cron diario. La conexión directa a Atlas queda sujeta a definir el acceso de red porque Hobby no proporciona una IP de salida fija. No se desplegó ni conectó una cuenta externa.
