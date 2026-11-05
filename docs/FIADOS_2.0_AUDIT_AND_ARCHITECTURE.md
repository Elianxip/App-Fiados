# Fiados 2.0 — Auditoría y arquitectura propuesta

## Estado de la auditoría (2026-11-05)

Repositorio: `Elianxip/App-Fiados`  
Rama de trabajo: `fiados-2.0-foundation`  
Aplicación publicada: GitHub Pages.

### Archivos inspeccionados

- `index.html`: vistas de Dashboard, Clientes y Detalle de cliente; formularios para clientes, fiados y abonos.
- `app.js`: lógica de interfaz y almacenamiento.
- `styles.css`: tema oscuro azul, navegación lateral y adaptación móvil básica.

### Almacenamiento actual (no modificar ni borrar durante la migración)

La aplicación usa `localStorage`:

- `fiado_clients`: arreglo de clientes con `id`, `name`, `phone` y `createdAt`.
- `fiado_txs`: arreglo de movimientos con `id`, `clientId`, `type` (DEBT/PAYMENT), `amount`, `desc` y `date`.

El saldo se calcula sumando movimientos DEBT y restando PAYMENT. Los datos actuales no contienen una fecha de vencimiento ni un registro de recordatorios.

### Riesgos detectados que deben corregirse

1. No hay copia de seguridad ni flujo de exportación/importación.
2. No existe sincronización entre navegadores o dispositivos.
3. Los abonos no se validan contra el saldo pendiente; un abono excesivo puede producir saldo negativo.
4. Se insertan algunos valores del usuario mediante `innerHTML`; deben escaparse o renderizarse mediante `textContent` para evitar inyección de HTML.
5. No hay autenticación ni reglas de acceso a datos.
6. No existe manifest ni Service Worker.
7. No hay fecha de vencimiento, preferencias de recordatorios ni agenda de cobros.
8. La marca y la moneda deben normalizarse a FIADOS 2.0 y DOP (RD$), conservando la estructura histórica.

## Arquitectura propuesta

### Frontend

Mantener GitHub Pages como alojamiento estático de la PWA. Conservar el frontend existente y migrar gradualmente sus vistas y lógica, sin reemplazar el almacenamiento local hasta completar una exportación y validación de datos.

### Backend recomendado

Supabase (PostgreSQL + Auth + Row Level Security + Edge Functions), con proyecto separado para Fiados. La base de datos relacional facilita consultar saldos, movimientos, vencimientos y auditoría. Las claves administrativas nunca deben llegar al navegador; el cliente utilizará únicamente la clave pública y políticas RLS estrictas.

### Recordatorios y notificaciones

- Los vencimientos se calculan y procesan en el servidor mediante tareas programadas; no depender de una pestaña abierta.
- Guardar preferencias, zona horaria `America/Santo_Domingo`, última ejecución y una clave de idempotencia por cliente/deuda/tipo/fecha para evitar duplicados.
- Las notificaciones push requieren permiso del usuario, Service Worker, suscripción Web Push y un proceso servidor que las envíe.
- WhatsApp utilizará enlaces `wa.me` con mensaje prellenado y revisión humana antes de abrir/enviar. La aplicación no afirmará que un mensaje fue enviado o leído si no existe confirmación verificable.

### Modelo de datos objetivo (borrador)

- `profiles`: propietario de los datos y configuración.
- `clients`: datos de contacto, observaciones y estado.
- `debts`: cuenta/fiado, descripción, importe original, fecha de creación y vencimiento.
- `payments`: abonos vinculados a deuda o cuenta, importe, fecha y nota.
- `reminder_preferences`: preferencias globales y por cliente.
- `reminder_events`: agenda e historial de recordatorios, estado e idempotencia.
- `push_subscriptions`: suscripciones por dispositivo.
- `audit_events`: eventos relevantes para trazabilidad.

Los registros históricos actuales se importarán como movimientos; no se inventarán fechas de vencimiento. Las cuentas antiguas sin vencimiento quedarán marcadas como “sin fecha de vencimiento” hasta que el usuario las complete.

## Plan de migración sin pérdida

1. Crear exportación JSON de `fiado_clients` y `fiado_txs` desde el navegador original.
2. Validar el archivo: cantidad de clientes, movimientos, referencias y suma de saldos.
3. Conservar el JSON original como respaldo inalterado.
4. Importar a tablas nuevas en una transacción, asignando propietario y preservando IDs y timestamps.
5. Comparar conteos y saldos antes/después.
6. Activar sincronización solo después de validar la importación.
7. Mantener exportación y restauración disponibles.

## Criterios de aceptación

- Los saldos coinciden con el cálculo histórico.
- Ningún cliente o movimiento desaparece durante la migración.
- Los abonos inválidos se rechazan.
- Los mensajes de WhatsApp se revisan antes de abrir el enlace.
- Los recordatorios se procesan en servidor y no se duplican.
- La app funciona como web y PWA; las funciones offline se limitan a lo que esté sincronizado en el dispositivo.
- Las pruebas cubren fechas de Santo Domingo, zona horaria, pagos parciales, liquidaciones, importación y restauración.

## Decisión pendiente antes de conectar datos reales

Crear/configurar el proyecto Supabase de Fiados 2.0 y sus credenciales públicas. No reutilizar credenciales de otros proyectos ni publicar claves secretas. La rama de trabajo no cambia todavía la aplicación publicada ni los datos de producción.
