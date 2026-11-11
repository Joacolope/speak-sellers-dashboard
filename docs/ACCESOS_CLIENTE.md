# Lo que tiene que pasarnos el cliente

Una página para mandarle al cliente antes de montar el dashboard. Son 4 cosas; ninguna le da acceso a su plata ni a publicar nada: todo es **solo lectura**.

## 1. Quién entra al dashboard

- El **email de Google** de cada persona que va a entrar, y si **administra**, **carga datos** (ventas, cobros) o **solo mira**.
- El dashboard no tiene contraseñas: se entra con la cuenta de Google.

## 2. GoHighLevel (agendas, leads, estados de las llamadas)

En la sub-cuenta del negocio: **Settings → Private Integrations → Create new integration**

- Nombre: `Dashboard`
- Permisos (todos de **solo lectura**): `calendars.readonly`, `calendars/events.readonly`, `contacts.readonly`, `opportunities.readonly`, `locations.readonly`, `locations/customFields.readonly`
- Copiar el token que empieza con `pit-` y mandarlo **por un canal seguro** (no por WhatsApp ni mail: un gestor de contraseñas o un link que caduque).

También necesitamos saber:
- qué **calendario(s)** usan para las llamadas de venta y cuál es el **pipeline** comercial (con el nombre alcanza);
- qué **closer** atiende cada calendario, o si se reparten (round robin).

De dónde viene cada venta no se pregunta en el formulario: sale de la conversación de ManyChat de cada lead (etiquetas) y de lo que el equipo pasa por chat.

## 3. Meta (anuncios e Instagram)

Hace falta un token de **usuario del sistema** (no vence). Son 4 pasos en Meta Business, 10 minutos:

1. <https://business.facebook.com/settings/system-users> → **Agregar** → nombre `dashboard`, rol **Empleado**.
2. **Asignar activos** a ese usuario: la **cuenta publicitaria** (permiso *Ver rendimiento*), la **página de Facebook** del negocio y el **Instagram** (permiso *Ver estadísticas*).
3. **Generar token** → elegir la app (si no hay una, crear una de tipo **Empresa** en <https://developers.facebook.com/apps>) → caducidad **Nunca** → permisos:
   `ads_read`, `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list`, `business_management`.
4. Mandar el token por un canal seguro, más el **ID de la cuenta publicitaria** (`act_…`) y el **ID de la página de Facebook** conectada al Instagram (Meta Business Suite → Configuración → Páginas).

Importante: las campañas que llevan al perfil tienen que tener **"Follow Me"** en el nombre (o decirnos qué palabra usan), y las de webinar, **"Webinar"**. Así el dashboard sabe cuál es cuál.

## 4. Datos del negocio

- Closers: nombre, si está activo, % de comisión sobre lo cobrado.
- Objetivos de **% de asistencia** y **% de cierre** (si no tienen, usamos 60 % y 30 %).
- Metas del mes (facturación, cash, ventas, agendas): se cargan después desde el dashboard.
- Software que pagan y cuánto (GHL, ManyChat, Zoom…): también se carga desde el dashboard.
- Si vienen de una planilla: el archivo, para migrar el histórico.

## Qué NO pedimos

- Contraseñas de ninguna cuenta.
- Acceso de administrador a Meta ni a GHL.
- Permisos para publicar, mandar mensajes o gastar.
