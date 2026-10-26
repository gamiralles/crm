# Checklist de publicación del CRM

Estados: `pendiente`, `en curso`, `completado` (cambio hecho) y `verificado` (comprobado en el entorno indicado).

Última actualización: 2026-10-26.

## A. Revisión local

- [verificado] Inspeccionar monorepo, scripts, `.gitignore`, `.env.example`, configuración Vercel, autenticación, base, migraciones y scheduler.
- [verificado] `npm ci` reinstaló los paquetes desde `package-lock.json`.
- [verificado] `npm run verify`: 28 pruebas API, typecheck frontend/backend, lint y build pasan (2026-10-26).
- [verificado] `npm audit fix` resolvió la vulnerabilidad alta transitiva; `npm audit` reporta cero vulnerabilidades.
- [verificado] Revisión de archivos y patrones de secretos: no hay archivos `.env` reales ni credenciales reales detectadas; las coincidencias están en fixtures de pruebas.
- [verificado] El repositorio Git local fue inicializado en `main`; todavía no hay commits ni remoto. `.env`, `node_modules` y `dist` están ignorados.
- [en curso] Persisten pendientes las pruebas contra MongoDB real y las integrales de sesiones/scheduler en hosting.

## B. Decisión de arquitectura y hosting

- [completado] Elegido Vercel Hobby para la prueba personal; web y API como proyectos separados desde `apps/web` y `apps/api`.
- [completado] API adaptada a Express Function con inicio diferido de Mongo/migraciones, cron GET autenticado y programación diaria Hobby.
- [pendiente] Configurar el acceso de red de Atlas: Vercel Hobby no ofrece IP de salida fija. No abrir `0.0.0.0/0` sin una decisión consciente del propietario; preferir datos ficticios y usuario de base con privilegios mínimos durante la prueba.
- [pendiente] Definir dominios finales para web y API, región próxima a Atlas, CORS, HTTPS, cookies y `SameSite`.
- [verificado] Scheduler Hobby configurado en Vercel Cron; se ejecuta una vez por día con precisión horaria y no reintenta fallos automáticamente.

## C. GitHub

- [pendiente] Crear repositorio remoto privado y autorizar explícitamente la publicación del código.
- [completado] Escanear archivos y secretos; el resultado local fue limpio.
- [pendiente] Crear el primer commit local después de revisar el diff; no existe historial previo.
- [pendiente] Subir rama inicial sin archivos `.env`, credenciales, datos personales ni artefactos `dist`/`node_modules`.
- [pendiente] Verificar instalación desde cero con el lockfile y build reproducible.

## D. MongoDB Atlas

- [pendiente] Identificar cluster existente y confirmar que la base deseada sea `crm_seguros` (nombre que figura en la URI local de ejemplo).
- [pendiente] Crear/confirmar usuario de base dedicado con privilegio mínimo sobre `crm_seguros`; nunca usar el usuario propietario de Atlas en la aplicación.
- [pendiente] Permitir solamente el origen de red estable del backend mediante IP de salida fija o red privada aprobada; no habilitar `0.0.0.0/0`.
- [pendiente] Introducir `MONGODB_URI` solo en el almacén de secretos del servidor de API y verificar conexión TLS.
- [pendiente] Confirmar copia automática/retención disponible en el plan de Atlas y practicar restauración en una base separada.
- [pendiente] Ejecutar migraciones y verificar índices sin sobrescribir datos existentes.

## E. Variables y secretos

- [completado] Separar la plantilla del servidor (`.env.example`) de la variable pública de build web (`apps/web/.env.example`) y documentar alcance/formato de las variables.
- [pendiente] Generar en forma segura valores distintos para `SESSION_SECRET`, `INITIAL_SETUP_KEY` y `SCHEDULER_SECRET`.
- [pendiente] Configurar secretos de backend en el proveedor de API; no pegarlos en el chat ni subirlos a GitHub.
- [pendiente] Configurar `VITE_API_BASE_URL` como variable pública de build en Vercel, apuntando al origen HTTPS de API y `/api/v1`.
- [pendiente] Definir valores separados para Preview y Production; no conectar Preview a la base productiva.

## F. Publicación y propietario inicial

- [pendiente] Importar el repositorio en Vercel y configurar root, instalación, build y directorio de salida según la arquitectura elegida.
- [pendiente] Configurar `WEB_ORIGIN`, cookies seguras, `SESSION_SAME_SITE`, `TRUST_PROXY` y dominio HTTPS.
- [pendiente] Desplegar un entorno de prueba y comprobar `/api/v1/health/live` y `/api/v1/health/ready`.
- [pendiente] Crear al único propietario mediante `/api/v1/auth/bootstrap` usando `INITIAL_SETUP_KEY` y una contraseña definitiva elegida por el propietario.
- [pendiente] Probar inicio/cierre de sesión y persistencia de sesión después de reiniciar o escalar la API.
- [pendiente] Deshabilitar/quitar `INITIAL_SETUP_KEY` del entorno tras verificar el propietario y confirmar que el bootstrap ya no admite altas.

## G. Renovaciones y operación

- [pendiente] Configurar ejecución diaria del scheduler en zona horaria acordada, con `SCHEDULER_SECRET` únicamente en el servidor de tareas.
- [pendiente] Verificar respuesta HTTP, registro de ejecución, idempotencia, reintentos, concurrencia y alertas ante fallo.
- [pendiente] Probar CRUD de clientes/pólizas, aislamiento de organización y el recorrido completo de renovación en datos de prueba.
- [pendiente] Definir monitoreo, responsable de incidentes, retención, RPO/RTO y procedimiento de borrado/recuperación.
- [pendiente] Verificar instalación PWA y uso móvil en dispositivo real.

## H. Integraciones opcionales

- [pendiente] Decidir si se activará correo SMTP, Web Push, Telegram o Microsoft Outlook.
- [pendiente] Si se activan, configurar cada secreto en el servidor y probar con cuentas de prueba; no son requisito para la primera publicación.

## Estado actual comprobado

- El frontend genera un sitio estático en `apps/web/dist`; existe `apps/web/vercel.json` con fallback de rutas SPA y cabeceras básicas.
- La API actual es Express con arranque persistente, conexión a MongoDB, migraciones al iniciar y sesiones `connect-mongo`; la API no está desplegada ni validada en Vercel.
- La configuración local declara `crm_seguros` como nombre de base de ejemplo. El cluster y los permisos de Atlas no están comprobados.
- Vercel documenta soporte para Express como una Function y Cron diario. El barrido actual es `POST`, pero Vercel Cron envía `GET` y no reintenta una ejecución fallida; requiere adaptación y verificación si se elige Vercel para la API.
- El plan Hobby de Vercel se restringe a uso personal/no comercial. Pro cuesta actualmente USD 20/mes con crédito de USD 20 para uso; el add-on de IP estática cuesta USD 100/mes por proyecto más consumo. Confirmar antes de habilitarlo.
- El proyecto ya tiene repositorio Git local en `main`, pero aún no tiene commit ni remoto.
- La revisión local de secretos no encontró credenciales reales; los valores con forma de token aparecen en fixtures de pruebas.
- El scheduler de renovaciones usa un bloqueo distribuido de MongoDB con vencimiento para evitar ejecuciones concurrentes entre instancias.
- La configuración Hobby de Vercel quedó preparada, pero no desplegada; falta elegir/configurar el acceso de red de Atlas y cargar las variables secretas en los proyectos.
- No se desplegó, conectó Atlas ni activó scheduler/integraciones. La vista local de desarrollo no guarda datos.
