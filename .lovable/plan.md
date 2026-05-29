## Alcance

Solo se modifica el panel administrador (`/admin`) y se añade un acceso desde la vista Perfil para usuarios con rol `admin`. **No se toca** la lógica de la app principal (préstamos, cronogramas, pagos, consentimiento, cálculos).

## Cambios

### 1. Backend (migración SQL — solo lectura para admin)

Ampliar / añadir funciones `SECURITY DEFINER` que validan `has_role(auth.uid(), 'admin')`:

- `admin_get_metrics()` — ampliar para incluir: usuarios activos (con al menos 1 operación), monto total prestado, monto pendiente total, recordatorios enviados, acuerdos enviados.
- `admin_list_users()` — añadir: monto total y pendiente por usuario, rol actual.
- `admin_list_clients()` — añadir: nº operaciones, monto pendiente, estado.
- `admin_list_operations()` — añadir: nº cuotas, saldo pendiente, próxima cuota (fecha + monto), nombre cliente.
- `admin_list_payments()` — añadir: nombre cliente, saldo después del pago, tipo de operación.
- Nuevo `admin_list_consents()` — préstamos con info de confirmación: estado, fechas envío/respuesta, correo, operación, cliente.
- Nuevo `admin_get_user_detail(_user_id)` — perfil + agregados + listas resumidas.
- Nuevo `admin_get_client_detail(_client_id)` — datos + operaciones asociadas + pagos.
- Nuevo `admin_get_operation_detail(_loan_id)` — operación + cuotas + pagos + evidencias (metadatos) + historial de confirmación.

Todas son **solo lectura**. No se exponen funciones de edición/eliminación.

### 2. Frontend — refactor de `src/pages/Admin.tsx`

Dividir en carpeta `src/pages/admin/`:

- `AdminLayout.tsx` — shell con sidebar (desktop) / tabs colapsables (mobile), header con buscador global.
- `AdminDashboard.tsx` — tarjetas de métricas ampliadas, agrupadas (Usuarios, Operaciones, Dinero, Consentimiento).
- `AdminUsers.tsx` — tabla con filtros y búsqueda.
- `AdminClients.tsx` — tabla global con filtros.
- `AdminOperations.tsx` — tabla con filtros por tipo, estado aceptación, estado pago, vencidas, pendientes, fecha.
- `AdminPayments.tsx` — tabla con filtros por fecha y usuario.
- `AdminConsents.tsx` — tabla de consentimientos digitales.
- `AdminUserDetail.tsx`, `AdminClientDetail.tsx`, `AdminOperationDetail.tsx` — vistas de soporte (solo lectura).
- `components/`: `MetricCard`, `DataTable` reutilizable con sort+filter+paginación cliente, `FilterBar`, `GlobalSearch`.

### 3. Rutas

En `App.tsx` añadir rutas anidadas bajo `/admin`:
- `/admin` (dashboard)
- `/admin/users`, `/admin/users/:id`
- `/admin/clients`, `/admin/clients/:id`
- `/admin/operations`, `/admin/operations/:id`
- `/admin/payments`
- `/admin/consents`

Todas protegidas por verificación de rol admin (igual que hoy en `Admin.tsx`).

### 4. Acceso desde Perfil

En `src/pages/Profile.tsx`, comprobar `has_role` para el usuario actual; si es admin, mostrar item "Panel administrador" que navega a `/admin`. Usuarios normales no lo ven.

### 5. UX

- Desktop-first con sidebar fija; en mobile usar drawer / bottom-sheet de navegación.
- Tema oscuro coherente con la app (tokens existentes).
- Sin acciones destructivas. Todos los botones de detalle son de solo lectura.

## Detalles técnicos

- Reutilizar `supabase.rpc(...)` con las nuevas funciones tipadas vía `as any` mientras se regenera `types.ts`.
- Búsqueda global: input en header llama a un nuevo RPC `admin_global_search(_q)` que devuelve coincidencias en usuarios/clientes/operaciones (limit 10 c/u).
- Filtros y paginación se hacen en cliente sobre los datos devueltos (volumen MVP bajo); si crece, mover a server-side.
- Sin cambios en RLS de tablas existentes ni en lógica de negocio.

## Fuera de alcance

- Edición de datos sensibles, eliminación, ajustes de saldos.
- Cambios en flujos de usuario, dashboard de usuario, autenticación, cálculo de cuotas, lógica de pagos o consentimiento.
