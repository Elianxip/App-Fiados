# Fiados 2.0 — Hoja de ruta de producto

**Rama:** `fiados-2.0-foundation`  
**Principio rector:** evolución incremental; no reemplazar la aplicación ni borrar datos históricos.

## Etapa 1 — Cobros organizados (en desarrollo)
- [x] Planes de pago personalizados por cliente, con cuotas y fechas programadas.
- [x] Estado de cuenta imprimible y compartible.
- [ ] Validar en navegador real y comprobar respaldo/restauración en móvil y escritorio.
- [ ] Sincronizar los nuevos planes entre dispositivos con esquema y RLS revisados.

## Etapa 2 — Comprobantes
- [ ] Recibos digitales con identificador y código QR verificable.
- [ ] Historial de recibos y opción de imprimir/compartir.

## Etapa 3 — Control financiero
- [ ] Registro de gastos con categorías.
- [ ] Reporte de ingresos, gastos y utilidad neta.
- [ ] Proyección de cobros e ingresos basada en vencimientos y cuotas.

## Etapa 4 — Seguridad
- [ ] Bloqueo de la aplicación con PIN.
- [ ] Biometría cuando el dispositivo y el navegador la soporten.
- [ ] Recuperación segura y límites de intentos; nunca almacenar PIN en texto plano.

## Etapa 5 — Operación y equipo
- [ ] Escáner de códigos de barras para agilizar la selección/captura de productos.
- [ ] Usuarios/cobradores, asignación de cartera y estadísticas por cobrador.

## Etapa 6 — Fidelización
- [ ] Puntos configurables por pagos realizados.
- [ ] Recompensas y reglas transparentes, sin alterar saldos contables.

## Etapa 7 — Sincronización multidispositivo
- [ ] Centro de dispositivos y sesiones activas.
- [ ] Estado de sincronización, conflictos y última copia.
- [ ] Sincronización de nuevos módulos bajo políticas RLS por propietario.

## Reglas de seguridad y compatibilidad
1. Mantener intactas las claves históricas `fiado_clients` y `fiado_txs`.
2. No inventar fechas de vencimiento para deudas antiguas.
3. Las funciones nuevas guardan sus datos por separado y deben entrar en respaldos.
4. No ejecutar migraciones SQL ni publicar/desplegar sin autorización expresa.
5. No afirmar que push funciona con la app cerrada hasta configurar backend, cron y suscripciones.
6. Antes de sincronizar módulos nuevos, revisar esquema, aislamiento multiusuario y RLS.
