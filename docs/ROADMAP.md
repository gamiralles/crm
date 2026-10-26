# Roadmap — CRM para productor de seguros

El proyecto se ejecuta de forma incremental. Cada etapa empieza solo cuando el usuario lo indique. La prioridad funcional es clientes, pólizas y renovaciones.

| Etapa | Alcance | Salida esperada |
|---|---|---|
| 0 | Inspección, documentación, arquitectura y roadmap | Diagnóstico, decisiones, riesgos y documentación base. |
| 1 | Estructura del frontend, navegación y diseño base | Aplicación web navegable, responsive y con estados de interfaz definidos; sin simular operaciones como si fueran persistentes. |
| 2 | Backend, MongoDB, autenticación, autorización y validaciones | API versionada, persistencia, validación y límites de acceso por organización. |
| 3 | Clientes | Ficha central, alta/edición/consulta, búsqueda, filtros y actividad. |
| 4 | Pólizas e historial de vigencias | Pólizas asociadas a clientes y compañías; vencimientos y conservación del historial. |
| 5 | Renovaciones, tareas y seguimiento | Estados, contactos, próximas acciones y generación idempotente de tareas. |
| 6 | Notificaciones, push, correo y Telegram | Centro interno y canales externos desacoplados, con entregas y errores registrados. |
| 7 | Calendario e integración con Outlook | Eventos y sincronización controlada, sin duplicados. |
| 8 | Cotizaciones, compañías y siniestros | Registros relacionados con clientes y pólizas. |
| 9 | Caja, comisiones e informes | Movimientos y estados financieros con informes filtrables. |
| 10 | PWA y optimización móvil | Instalación y experiencia móvil verificadas. |
| 11 | Pruebas, seguridad y corrección | Flujos críticos, aislamiento, permisos, fechas e integraciones verificados. |
| 12 | Documentación y preparación para despliegue | Instrucciones reproducibles para frontend, API, scheduler, base de datos y respaldos. |

## Criterio para cerrar cada etapa
Registrar en `docs/PROGRESS.md` el alcance realizado, verificaciones ejecutadas, resultado, limitaciones y cómo probarlo. Resolver errores importantes antes de proponer la etapa siguiente. Build, TypeScript, lint y pruebas se ejecutarán cuando exista código y sean pertinentes a la etapa.

## Orden de prioridad
1. Clientes, pólizas y renovaciones.
2. Notificaciones y tareas.
3. Calendario, cotizaciones y módulos financieros.

Las integraciones y el despliegue no se activan automáticamente. El usuario configura cuentas y credenciales por separado.
