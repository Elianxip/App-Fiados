# Configurar Supabase para Fiados 2.0

## 1. Ejecutar la migración SQL

1. Abre el proyecto Supabase de Fiados 2.0.
2. Entra en **SQL Editor**.
3. Abre en GitHub el archivo `supabase/migrations/0001_fiados_v2_schema.sql` de la rama `fiados-2.0-foundation`.
4. Copia el contenido completo, pégalo en una consulta nueva y pulsa **Run**.
5. Comprueba en **Table Editor** que aparecen `clients`, `transactions`, `reminder_preferences`, `reminder_events`, `push_subscriptions` y `audit_events`.

No ejecutes scripts SQL de otras aplicaciones ni cambies el proyecto que contiene datos ajenos.

## 2. Configurar autenticación

En **Authentication → URL Configuration**:

- Site URL: `https://elianxip.github.io/App-Fiados/`
- Redirect URLs: añade `https://elianxip.github.io/App-Fiados/`

En **Authentication → Providers → Email**, habilita Email si deseas iniciar sesión con correo y contraseña. Si la confirmación por correo está habilitada, confirma el correo recibido antes de iniciar sesión.

## 3. Revisar seguridad

- Mantén habilitada la confirmación de correo si es apropiado para tu cuenta.
- No desactives Row Level Security (RLS).
- No agregues políticas públicas para `anon`.
- Nunca copies `service_role`, secret keys ni contraseñas al repositorio.
- La clave `sb_publishable_` de `supabase-config.js` es una clave pública de cliente; RLS y Auth son los controles que protegen los datos.

## 4. Activar Realtime

La migración intenta añadir `clients` y `transactions` a la publicación `supabase_realtime`. Verifica en **Database → Publications** que ambas tablas estén incluidas.

## 5. Primera conexión y migración

1. Publica la rama de pruebas o abre el sitio de preview de esa rama.
2. Inicia sesión o crea una cuenta en el panel **Sincronización segura**.
3. Si la nube está vacía y este navegador tiene registros, elige **Subir datos de este dispositivo**.
4. Si la nube tiene datos y este navegador está vacío, elige **Descargar datos de la nube**.
5. Si ambos lados tienen datos distintos, detente y exporta respaldos de ambos. La aplicación pausa la sincronización para evitar sobrescribir información.

Los IDs y fechas originales se conservan al migrar. Las fechas de vencimiento antiguas no se inventan: los movimientos existentes quedan sin vencimiento hasta que se agregue esa función.

## 6. Limitaciones de esta etapa

- La sincronización automática cubre altas y cambios de clientes/movimientos guardados por la interfaz actual.
- No se ha implementado resolución automática de conflictos ni borrado sincronizado.
- Los cambios locales realizados sin conexión no se envían hasta recuperar una sesión y conexión; revisa el estado de sincronización antes de cambiar de dispositivo.
- Esta etapa no programa recordatorios de cobro ni envía WhatsApp.
- GitHub Pages sigue siendo alojamiento estático; las tareas programadas y notificaciones push requieren funciones de servidor y configuración adicional.
