# Instrucciones para agentes y colaboradores

## Alcance y forma de trabajo
- Trabajar estrictamente por etapas según `docs/ROADMAP.md`. Esperar la indicación del usuario antes de iniciar una etapa nueva.
- Antes de modificar archivos existentes, inspeccionar el repositorio y conservar el código funcional.
- No importar clientes ni otros datos personales reales. No modificar exportaciones originales de Notion.
- No desplegar ni usar credenciales reales. Mantener secretos fuera del repositorio.
- Documentar decisiones técnicas y riesgos en `docs/ARCHITECTURE.md` y el estado verificado en `docs/PROGRESS.md`.
- No declarar una etapa terminada sin comprobar sus criterios de salida. Ejecutar verificaciones pertinentes a la etapa y resumir resultados.
- Cuando una decisión afecte arquitectura, privacidad o costos, presentar alternativas y esperar definición del usuario antes de implementarla.

## Reglas del producto
- Priorizar vencimientos, renovaciones y contacto oportuno con clientes.
- Mantener historial de vigencias y trazabilidad; no borrar historial al actualizar una póliza.
- Aislar los datos por organización y hacer cumplir permisos en el backend.
- Usar español, fechas y hora de Argentina por defecto (`America/Argentina/Buenos_Aires`); zona horaria y moneda deben ser configurables.
- No agregar módulos ni integraciones fuera del alcance acordado.
