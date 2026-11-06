# Fiados 2.0 — Estado de las 10 funciones

**Principio:** evolución incremental. Se conserva la aplicación original y sus claves fiado_clients y fiado_txs. Las funciones nuevas almacenan sus datos por separado.

## Estado funcional en la rama de trabajo

1. **Puntos y recompensas**
   - [x] Regla configurable de puntos por cada RD$100 abonados.
   - [x] Saldo de puntos calculado por cliente.
   - [x] Canje con validación de saldo e historial local.
   - Nota: cambiar la regla recalcula los puntos históricos; no altera deudas ni abonos.

2. **Planes de pago personalizados**
   - [x] Planes semanales, quincenales y mensuales con cuotas.
   - [x] Aplicación estimada de abonos posteriores al plan a las cuotas por orden.
   - [x] Cierre de planes sin borrar su historial.
   - [x] Estado de cuenta imprimible/Guardar PDF y mensaje de estado de cuenta prellenado para WhatsApp.
   - Nota: WhatsApp abre el mensaje para revisión; el usuario confirma el envío.

3. **Recibos con QR**
   - [x] Comprobante imprimible con QR generado localmente, incluso sin internet.
   - [x] Escaneo y contraste de código, cliente, importe y fecha con el movimiento guardado en este celular.
   - [ ] Verificación pública/fiscal desde otro dispositivo o internet; requiere endpoint seguro y backend.

4. **Proyección de ingresos**
   - [x] Proyección de cuotas pendientes a 30 y 90 días.
   - [x] Cuotas vencidas pendientes y descuentos estimados de abonos posteriores a la creación del plan.
   - [x] Comparativo de ingresos y gastos históricos y neto del mes.

5. **Bloqueo PIN / huella / rostro**
   - [x] PIN local protegido con PBKDF2; bloqueo al iniciar, al ocultar la app y por inactividad.
   - [ ] Biometría WebAuthn con verificación segura de credenciales; requiere diseño y validación criptográfica, no se simula.
   - Nota: el PIN protege esta instalación local; no sustituye autenticación del servidor ni protege frente a quien controle el almacenamiento del navegador.

6. **Escáner de códigos de barras**
   - [x] Cámara trasera y lectura de EAN, UPC, Code 128 y QR en navegadores compatibles.
   - [x] Inserción del código leído en la descripción del fiado y modo de lectura de QR de recibos.
   - Nota: depende de HTTPS, permiso de cámara y soporte de BarcodeDetector.

7. **Control de gastos**
   - [x] Alta, categorías, historial y eliminación de gastos.
   - [x] Cálculo del resultado neto con abonos y gastos.

8. **Estado de cuenta por WhatsApp / PDF**
   - [x] Estado de cuenta imprimible y opción del navegador para Guardar como PDF.
   - [x] Mensaje detallado prellenado para WhatsApp.
   - Nota: no se envía nada automáticamente.

9. **Estadísticas de cobradores**
   - [x] Alta y selección de cobrador activo.
   - [x] Atribución de abonos nuevos y totales/cantidad por cobrador.
   - Nota: los movimientos históricos anteriores a la atribución siguen sin cobrador.

10. **Centro de sincronización y dispositivos**
    - [x] Estado de conexión, navegador, cuenta y último respaldo.
    - [x] Descarga de respaldo JSON con clientes, movimientos y módulos.
    - [x] Importación aditiva validada: conserva los registros existentes y no reemplaza datos.
    - [ ] Sincronización adicional de módulos en Supabase: requiere revisar y ejecutar manualmente la migración 0003 en el proyecto correcto.
    - Nota: el uso de un solo celular no requiere sincronización multidispositivo para operar. Los datos siguen disponibles localmente sin internet.

## WhatsApp y funcionamiento sin internet

- Los recordatorios se preparan con nombre, saldo y vencimiento, se pueden editar y abren WhatsApp para confirmación manual.
- No se afirma que el mensaje fue enviado o leído.
- La PWA conserva recursos y datos locales offline. La primera carga de recursos necesita internet.
- Notificaciones con la app cerrada requieren servicio push, suscripción y backend; no están habilitadas por esta rama.

## Seguridad de datos y publicación

- No modificar ni borrar fiado_clients ni fiado_txs.
- No inventar vencimientos para deudas antiguas.
- No ejecutar migraciones SQL automáticamente. 0003_fiados_v2_modules_sync.sql es un paso manual y separado.
- No guardar claves secretas en el frontend.
- Antes de actualizar desde GitHub Pages, mantener un respaldo JSON fuera del celular.
- La rama debe pasar revisión de código y pruebas reales en Android antes de integrarse a main.
