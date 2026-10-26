# Progreso

## Estado: Etapas 0–12 implementadas; pendientes validaciones de entorno e integraciones reales

### Inspección
- Se revisó el texto de requerimientos compartido.
- La carpeta de trabajo actual contiene únicamente directorios de trabajo y salida; no contiene un repositorio ni archivos de aplicación que inspeccionar.
- No hay una exportación de Notion entre los archivos disponibles para esta etapa.
- No se inspeccionó ni modificó ningún dato real de clientes.

### Entregables preparados
- `AGENTS.md`: reglas de colaboración, privacidad y etapas.
- `docs/ROADMAP.md`: etapas, prioridades y criterio de cierre.
- `docs/ARCHITECTURE.md`: estructura y arquitectura propuestas, decisiones pendientes y riesgos.

### Estado de verificación
- Documentación contrastada con los requerimientos pegados.
- En el cierre de Etapa 0 todavía no había código, por lo que TypeScript, lint, build y pruebas no aplicaban.

### Cierre de Etapa 0
- La carpeta `outputs/CRM-Productor-Seguros` se estableció como raíz del proyecto al continuar allí con la Etapa 1.
- Las decisiones que afectan autenticación, scheduler e integraciones siguen pendientes hasta las etapas en que sean necesarias.

### Etapa 1 — estructura del frontend, navegación y diseño base
- Creado monorepo inicial con `apps/web`, scripts raíz, README y `.gitignore`.
- Creada aplicación React + TypeScript + Vite + Tailwind con navegación responsive para las secciones previstas.
- Implementada una pantalla de inicio que prioriza vencimientos, renovaciones y tareas, con estados vacíos explícitos y sin registros ficticios.
- Las secciones se navegan y muestran el alcance previsto; las operaciones y datos quedan pendientes de sus etapas correspondientes.
- Instalación: `npm install` completado; auditoría informó cero vulnerabilidades.
- TypeScript: `npm run typecheck` completado sin errores.
- Build: `npm run build` completado; generado `apps/web/dist`.
- Para abrir localmente: desde la raíz, ejecutar `npm run dev` y visitar la URL local que indique Vite.
- Limitaciones: sin API, autenticación, formularios ni persistencia; no se ejecutó lint porque aún no está configurado. La PWA corresponde a Etapa 10. No se pudo abrir la vista local en el navegador integrado (timeout al acceder al puerto local); el build sí se verificó correctamente.

### Etapa 2 — backend, MongoDB, autenticación y validaciones
- Implementada API Express `/api/v1`, configuración tipada, conexión MongoDB y sesiones de autenticación.
- Decisiones del usuario: sesión almacenada en MongoDB; rol inicial único de propietario.
- Backend incluye modelos de usuario, organización y membresía; bootstrap de un primer propietario protegido por clave; login, consulta de sesión y logout; hash bcrypt; limitación de intentos; CORS; errores centralizados; logs estructurados; health checks y validación Zod.
- Las sesiones usan cookies `HttpOnly` persistidas en MongoDB; el middleware consulta usuario activo y membresía activa y fija el alcance a la organización de la sesión.
- Los índices iniciales y cambios estructurales se aplican mediante una migración versionada.
- Verificaciones: `npm run test:api` (12 pruebas aprobadas), `npm run typecheck`, `npm run lint` y `npm run build` completados.
- Instalación de dependencias: auditoría reportó cero vulnerabilidades.
- Pendiente para cerrar la etapa: ejecutar conexión, bootstrap y persistencia de sesiones contra una instancia real de MongoDB. No hay MongoDB instalado ni configurado en este entorno; no se creó `.env` ni se conectó a una base externa.

### Etapa 3 — Clientes
- API de clientes con alta, edición, consulta individual, listado paginado, búsqueda por nombre/documento/correo/teléfono y filtros por estado y tipo.
- Toda operación consulta usando el `organizationId` de la sesión; alta/edición/status requieren autenticación y rol propietario. Los campos de organización y auditoría no son aceptados desde el navegador.
- Campos opcionales vacíos se permiten. Los documentos normalizados son únicos por organización con índice parcial; los errores de duplicado se presentan como conflicto.
- Inactivar/reactivar conserva cliente e historial. La actividad registra creación, campos editados y cambios de estado. El detalle deja claras las relaciones futuras sin simular pólizas, cotizaciones, tareas ni siniestros.
- Interfaz conectada: inicio de sesión por cookie, tabla con búsqueda/filtros/paginación, ficha, alta/edición, consulta de actividad e inactivación/reactivación. No expone la clave inicial de configuración.
- Migración `002-client-indexes` agrega índices de clientes y actividad.
- Verificaciones: `npm run test:api` (14 pruebas aprobadas), `npm run typecheck`, `npm run lint` y `npm run build` completados sin errores.
- Pendiente de entorno: verificar migración, CRUD, índices y sesión contra MongoDB real; no hay instancia Mongo configurada en este entorno.

### Etapa 4 — Pólizas e historial de vigencias
- API e interfaz para crear, editar, buscar/listar, consultar y cancelar/reactivar pólizas asociadas a clientes y aseguradoras de la organización. Catálogo mínimo de aseguradoras incluido para guardar referencias reales.
- El número de póliza no es globalmente único. Fechas se validan en servidor; los días restantes se calculan usando el huso de la organización (Buenos Aires por defecto).
- Cada póliza guarda términos versionados. Renovar desde el seguimiento agrega la nueva vigencia sin borrar las anteriores; una edición ordinaria de fechas no completa por sí sola una renovación.
- Ficha del cliente muestra sus pólizas y tareas reales cuando existen.

### Etapa 5 — Renovaciones, tareas y seguimiento
- Al crear una póliza se genera un ciclo de renovación. Se registran estado, contactos con fecha/medio/resultado/notas y próxima acción/fecha.
- Completar renovación explícitamente conserva el término viejo, agrega el nuevo, cierra tareas previas y abre el ciclo siguiente. Modificar solo fechas no marca el ciclo como renovado.
- Tareas manuales se pueden relacionar con cliente y póliza; se pueden iniciar, pausar, completar o cancelar por API. Los avisos de renovación generan tareas con `sourceKey` único; repetir el barrido no las duplica.
- Barrido de vencimientos protegido por `SCHEDULER_SECRET`, alertas iniciales configurables (30, 15, 7 y 0 días), zona horaria organizacional, tareas del día/atrasadas y resumen diario. Cada ejecución deja resultado, duración, conteos y estado.

### Etapa 6 — Notificaciones y canales externos
- Centro de notificaciones con filtro leído/sin leer, contador, navegación al registro relacionado y preferencias por tipo/canal.
- Registro independiente de entregas, intentos, momento y error. `provider_accepted` evita afirmar entrega confirmada al usuario. Fallos reintentan hasta cinco veces con espera exponencial.
- Implementados adaptadores backend para SMTP, Web Push (VAPID, suscripciones por dispositivo y service worker) y Telegram Bot API. Vinculación Telegram usa token temporal de un solo uso recibido por webhook autenticado.
- Los canales externos requieren configuración privada en `.env`; este entorno no tiene SMTP, VAPID, Telegram ni MongoDB configurados, así que no se hicieron envíos reales ni se confirmó entrega externa.
- Configuración documentada en `.env.example` y README. Los avisos internos se siguen generando ante error o falta de credenciales.

- Verificaciones de las etapas 4–6: `npm run test:api` (18 pruebas aprobadas), `npm run typecheck`, `npm run lint` y `npm run build` completados sin errores.
- `npm install` al agregar SMTP/Web Push reportó cero vulnerabilidades. Una consulta posterior de `npm audit` no pudo acceder al registro por un error DNS (`ENOTFOUND`), así que no se pudo refrescar el informe en esa última pasada.
- Pendiente de entorno: probar migración `003`, operaciones y barrido contra MongoDB, ejecutar un scheduler real, configurar VAPID/SMTP/Telegram y comprobar proveedor. No se usaron ni enviaron credenciales reales.

## Etapa 7 — Calendario y Outlook
- El calendario ahora combina eventos propios, tareas abiertas y próximas acciones de renovación. Permite crear, editar y cancelar eventos locales.
- Integración Microsoft Graph para cuentas personales: autorización delegada Authorization Code + PKCE, estado de un uso con vencimiento, consulta paginada por rango, alta, edición y eliminación de eventos. Sincronizar actualiza los eventos ya importados y elimina del rango los que fueron cancelados o ya no están en Outlook, sin duplicarlos. La API guarda identificadores externos únicos por organización.
- Tokens de acceso y renovación se cifran con AES-256-GCM en MongoDB; se exige una clave aleatoria Base64 de 32 bytes. Desconectar borra tokens y copias de eventos guardadas localmente, pero no modifica eventos que permanecen en Outlook.
- Pendiente de entorno: registrar la app Microsoft, configurar los cuatro valores `MICROSOFT_*`, y probar consentimiento, consulta y cambios con una cuenta de prueba. No hay sync en tiempo real ni webhook; el usuario sincroniza desde Calendario. Desconectar en el CRM no retira por sí mismo el consentimiento de Microsoft.

## Etapa 8 — Cotizaciones, compañías y siniestros
- Cotizaciones manuales asociadas a cliente y aseguradora, con póliza emitida opcional, importe, estado comercial y notas. Se puede actualizar el estado.
- Catálogo central de aseguradoras con datos de contacto, correo, teléfono y notas, conectado a pólizas/cotizaciones.
- Siniestros asociados a una póliza; el servidor comprueba que cliente y compañía coincidan con esa póliza. Estados actualizables y notas.
- Las rutas y relaciones filtran por organización autenticada. No se realizan inicios de sesión ni automatizaciones en portales de aseguradoras.

## Etapa 9 — Caja, comisiones e informes
- Registro de ingresos y gastos con fecha, categoría e importes, con vínculos opcionales a cliente/póliza.
- Comisiones con compañía, póliza y cliente opcionales, período `AAAA-MM`, importe y fecha prevista. Los estados son pendiente de facturación, facturada y cobrada; el alta no acepta el estado cobrada. Las modificaciones de estado registran fecha de facturación/cobro.
- Informes con rango de fechas: vencimientos de pólizas, ciclos de renovación, clientes nuevos, resultados de cotizaciones, comisiones por estado e importes de caja.
- El Inicio muestra vencimientos, seguimientos de hoy, próximos eventos y total/cantidad de comisiones aún no cobradas. Los importes usan la moneda configurada en la organización (ARS por defecto); editarla desde una pantalla de preferencias sigue pendiente.

## Etapa 10 — PWA y móvil
- Añadidos manifiesto, icono, registro de service worker y cabeceras para instalación. El mismo worker atiende Push y caché PWA para no competir por el alcance `/`. Las rutas SPA reciben fallback y la API queda excluida de caché.
- Se cachea la carcasa de la app y sus recursos estáticos para abrir la interfaz sin conexión; las operaciones requieren conectividad y no se guarda información personal localmente.
- CSS responsive aplicado a formularios, catálogos, agenda e informes. Build completado; no se verificó instalación en un teléfono físico, los requisitos del navegador, ni el modo sin conexión en un navegador interactivo de este entorno.

## Etapa 11 — Pruebas, seguridad y correcciones
- Se agregaron pruebas de validación de cotizaciones, período de calendario/informes, rechazo de alta de comisión como cobrada, límite organizacional de consultas, y configuración completa/incompleta de Microsoft.
- Correcciones: se exigen relaciones cliente/póliza/compañía coherentes al crear siniestros, comisiones y movimientos; el callback Outlook vuelve a validar membresía activa; el estado OAuth es de un uso y PKCE protege el intercambio del código. Se mantiene autorización en backend y filtros por organización.
- Verificación final: `npm run test:api` (24 pruebas aprobadas), `npm run typecheck`, `npm run lint` y `npm run build` completados sin errores. La primera ejecución de pruebas dentro del sandbox devolvió `EACCES` por el puerto local de Supertest; repetidas con acceso local, las 24 pasaron.
- Pendiente de entorno: revisar dependencias contra el registro cuando haya red (la consulta de auditoría anterior falló por DNS); no hay MongoDB de prueba local ni cuentas Microsoft configuradas para las pruebas integrales. La PWA tampoco se probó en un dispositivo físico.

## Etapa 12 — Documentación y preparación de despliegue
- README actualizado con los módulos, variables y comandos de producción. `npm run start:api` inicia la API construida; `npm run verify` agrupa pruebas, TypeScript, lint y build.
- Añadida configuración base de Vercel para frontend estático, rutas React Router y cabeceras de seguridad.
- Añadida `docs/DEPLOYMENT.md` con separación frontend/API/MongoDB/scheduler, build, salud, CORS/cookies, migraciones, secretos, respaldo y ensayo de restauración.
- No se desplegó el sistema, no se crearon servicios externos ni se conectó una base o cuenta real. El go-live requiere completar la lista de verificación con el propietario.

## Estado de cierre de etapas 7–12
- Implementación y verificaciones locales completadas en la medida posible sin credenciales ni servicios de terceros.
- Preparación no equivale a puesta en producción: siguen pendientes MongoDB real, ejecución del scheduler, verificación de Outlook y canales externos, prueba móvil real y despliegue controlado.

## Ajuste de arranque local
- La vista de desarrollo (`npm run dev`) ya abre directamente la interfaz aunque no haya MongoDB ni API configurados. Se identifica visiblemente como vista local y advierte que las operaciones no guardan cambios.
- El bypass solo está disponible con el servidor de desarrollo de Vite; el build de producción conserva el inicio de sesión y la protección del backend.
- Para usar datos persistentes siguen siendo necesarios MongoDB y las variables privadas documentadas en `.env.example`.

## Revisión local para publicación — 2026-10-26
- Se reinstalaron las dependencias con `npm ci`; `npm audit fix` actualizó la dependencia transitiva vulnerable y la auditoría final reporta cero vulnerabilidades.
- Verificación final de preparación Hobby: `npm run verify` aprobó 28 pruebas API, typecheck de frontend/backend, lint y build.
- Se añadió un bloqueo distribuido MongoDB con lease para impedir ejecuciones simultáneas del barrido de renovaciones; la verificación final incluye sus pruebas.
- Se separaron las variables privadas del servidor de `VITE_API_BASE_URL`, se retiraron los valores de conexión de ejemplo y se actualizaron README y guías de despliegue.
- Revisión local de secretos: sin archivos `.env` reales ni credenciales reales detectadas; solo valores de fixtures de pruebas.
- Se inicializó Git local en `main`; todavía no hay commit ni remoto. No se publicó código ni se desplegó.
- Pendiente: configurar Atlas con permisos y acceso de red, introducir secretos en Vercel, desplegar un entorno de prueba y ejecutar pruebas reales de MongoDB, bootstrap, sesión, renovaciones e integraciones elegidas. El propietario conserva el control de credenciales y despliegue.

## Adaptación a Vercel Hobby para prueba personal — 2026-10-26
- Se adaptó la entrada Express para Vercel Functions: inicializa MongoDB y migraciones al primer pedido de cada instancia y conserva la instancia preparada entre solicitudes calientes. El servidor persistente local sigue disponible mediante su entrada separada.
- `apps/api/vercel.json` configura la Function y un Vercel Cron diario a las 11:00 UTC (08:00 Buenos Aires); el endpoint acepta GET y POST, y el GET valida `CRON_SECRET` de Vercel.
- README y guía de despliegue detallan los dos proyectos Hobby, raíces del monorepo, variables públicas/privadas y pruebas posteriores. No se conectó cuenta ni se publicó código.
- Limitación a resolver por el propietario: Hobby no ofrece IP de salida fija para Atlas. Atlas no tendrá una IP individual de Vercel para permitir por lista de acceso; la guía documenta el riesgo de permitir desde cualquier dirección y recomienda probar únicamente con datos ficticios y usuario Mongo de privilegio mínimo.
