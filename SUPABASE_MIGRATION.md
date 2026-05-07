# Migracion MUVE a Supabase

## 1. Crear proyecto

1. Entra a Supabase y crea un proyecto nuevo.
2. Guarda estos valores del panel del proyecto:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

Importante: `SERVICE_ROLE_KEY` solo va en el backend. No la pongas en el frontend.

## 2. Crear tablas

1. Abre Supabase SQL Editor.
2. Copia y ejecuta el contenido de:

```text
supabase/schema.sql
```

Ese script crea las tablas principales de MUVE:

```text
companies
app_users
quotes
quote_items
routes
packages
tariffs
tariff_items
zones
price_configs
api_credentials
```

## 3. Configurar backend

Edita:

```text
server/.env
```

Agrega o reemplaza:

```env
DATABASE_PROVIDER=supabase
SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=una_clave_larga_y_segura
```

Con `DATABASE_PROVIDER=supabase`, el backend omite la conexion MongoDB.

## 4. Reiniciar backend

```powershell
cd "C:\PROYECTOS LEONARDO\muve\server"
npm.cmd run dev
```

Debe aparecer:

```text
Supabase configurado como base principal; se omite conexion MongoDB.
```

## 5. Crear admin inicial

En otra consola:

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/api/auth/seed-admin -ContentType "application/json" -Body '{"email":"admin@muve.cl","password":"Admin1234!"}'
```

Luego entra en:

```text
http://127.0.0.1:5173/login
```

Credenciales:

```text
admin@muve.cl
Admin1234!
```

## 6. Probar cotizador

```text
http://127.0.0.1:5173/cotizar
```

Al enviar una cotizacion se insertan registros en:

```text
quotes
quote_items
```

## Estado de la migracion

Ya migrado a Supabase con fallback Mongo:

```text
auth
seed-admin
cotizaciones publicas
listado/admin basico de cotizaciones
crear/editar/eliminar/rechazar/enviar cotizaciones
api_credentials
```

Pendiente para fase 2:

```text
routes
packages
companies
users manager
tariffs
zones
prices
photos/storage
invoice files
```
