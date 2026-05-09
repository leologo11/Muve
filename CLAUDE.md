# MUVE — Contexto Completo de la Plataforma

> Este archivo es leído automáticamente en cada sesión de Claude Code.
> Mantenerlo actualizado es crítico para que la IA siempre tenga el contexto correcto.
> Última actualización: mayo 2026 (Post-migración MongoDB).

---

## ¿Qué es MUVE?

**MUVE** es una plataforma SaaS de logística y delivery construida para Chile. Gestiona tres tipos de servicio:

| Servicio | Descripción |
|---|---|
| **Paquetería** | Entrega de paquetes puerta a puerta (el negocio principal) |
| **Fletes** | Transporte de carga en furgón o camión |
| **Mudanzas** | Servicio completo de mudanza con inventario, pisos, ayudantes |

MUVE es una herramienta interna/operativa: NO es una app pública de tracking generalista. Es el sistema de gestión que usa la empresa MUVE para operar sus servicios.

---

## Visión y Dirección

El objetivo es tener **un sistema centralizado** donde:

1. **Los paquetes entran primero** — siempre por la vista Paquetes, nunca directamente desde una ruta
2. **Las rutas se arman después** — tomando paquetes del pool y asignándolos a una ruta/conductor
3. **El conductor opera desde su app** — solo ve su ruta asignada, registra entregas, sube fotos
4. **El admin tiene visibilidad total** — todas las vistas, mapa general, historial, estadísticas
5. **Los clientes (proveedores) reciben cotizaciones** — el flujo de ventas empieza con una cotización

La plataforma está en desarrollo activo y mejora constante. Se agregan funcionalidades sesión a sesión.

---

## Stack Técnico

### Infraestructura
- **Deploy:** Railway (producción)
- **Repositorio:** monorepo en `c:\PROYECTOS LEONARDO\muve`
- **Puerto:** 4000 (servidor Express sirve también el frontend compilado)

### Backend
- **Runtime:** Node.js con ES Modules (`import/export`)
- **Framework:** Express.js
- **Base de datos:** Supabase (PostgreSQL via REST API)
- **Almacenamiento de fotos:** Cloudinary
- **Geocodificación:** Nominatim (OpenStreetMap, gratis)
- **IA para importación:** Anthropic Claude API (`claude-opus-4-7`)
- **Auth:** JWT (jsonwebtoken), bcrypt para hashes

### Frontend
- **Framework:** React 18 (Vite)
- **Estilos:** CSS-in-JS inline (NO Tailwind, NO styled-components, NO CSS Modules)
- **Routing:** estado local en `AdminView.jsx` (`view` state), NO React Router
- **API calls:** `client/src/api/index.js` — objeto `api` con todos los métodos

### Variables de Entorno (servidor)
```
DATABASE_PROVIDER=supabase     # Activa Supabase como DB principal
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ey...
MONGODB_URI=mongodb+srv://...  # Fallback si Supabase no está activo
JWT_SECRET=...
CLAUDE_API_KEY=sk-ant-...      # Para importación con IA
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

---

## Arquitectura del Proyecto

```
muve/
├── server/
│   ├── index.js               # Punto de entrada Express
│   ├── middleware/            # requireAuth, requireRole
│   ├── routes/
│   │   ├── auth.js            # Login, me, seed-admin
│   │   ├── packages.js        # CRUD paquetes + /all + /pool + /map
│   │   ├── deliveryRoutes.js  # CRUD rutas + optimizar + share link
│   │   ├── importAI.js        # Importación con Claude (fotos, Excel, CSV)
│   │   ├── companies.js       # CRUD empresas (proveedores)
│   │   ├── users.js           # CRUD usuarios
│   │   ├── quoteRoutes.js     # Cotizaciones fletes/mudanzas
│   │   ├── priceRoutes.js     # Precios por comuna (paquetería)
│   │   ├── zoneRoutes.js      # Zonas geográficas con polígonos
│   │   ├── tariffRoutes.js    # Tarifarios (agrupan precios por cliente)
│   │   ├── publicRoutes.js    # Rutas públicas sin auth (tracking, cotizador)
│   │   ├── credentials.js     # API keys para integraciones externas
│   │   └── vehicleConfigRoutes.js  # Configuración de precios fletes/mudanzas
│   └── utils/
│       ├── supabase.js        # supabaseRequest(), qs(), isSupabaseEnabled()
│       ├── geocode.js         # geocodeAddress() via Nominatim
│       ├── cloudinary.js      # uploadToCloudinary(), deletePhoto()
│       ├── priceByCommune.js  # suggestPrice(), roundPrice()
│       └── zones.js           # pointInPolygon()
│
├── client/
│   └── src/
│       ├── api/index.js       # Todas las llamadas al servidor (objeto `api`)
│       ├── views/
│       │   ├── admin/
│       │   │   ├── AdminView.jsx        # Shell principal admin — maneja navegación
│       │   │   ├── AllPackagesView.jsx  # Vista paquetes — ÚNICO punto de ingreso
│       │   │   ├── PoolAssignModal.jsx  # Asignar paquetes del pool a una ruta
│       │   │   ├── PackageTable.jsx     # Tabla editable de paquetes dentro de ruta
│       │   │   ├── AddRouteModal.jsx    # Crear nueva ruta
│       │   │   ├── CompaniesView.jsx    # CRUD empresas (proveedores)
│       │   │   ├── UserManager.jsx      # CRUD usuarios y conductores
│       │   │   ├── QuotesView.jsx       # Gestión de cotizaciones
│       │   │   ├── GeneralMapView.jsx   # Mapa con todos los paquetes geocodificados
│       │   │   ├── SectorMap.jsx        # Mapa de zonas/comunas con precios
│       │   │   ├── InvoiceView.jsx      # Facturación de rutas
│       │   │   ├── MovePricingView.jsx  # Config precios fletes/mudanzas por vehículo
│       │   │   └── CredentialsView.jsx  # API keys
│       │   ├── DriverView.jsx           # App del conductor (solo su ruta activa)
│       │   └── LandingView.jsx          # Landing público con cotizador
│       └── components/
│           ├── Toast.jsx           # Sistema de notificaciones
│           ├── RouteMap.jsx        # Mapa leaflet de ruta activa
│           ├── PackageCard.jsx     # Card de paquete para conductor
│           ├── DeliveryModal.jsx   # Modal de entrega del conductor
│           ├── PriceSettings.jsx   # Configuración precios comunas
│           ├── AddressAutocomplete.jsx  # Autocompletado dirección via Nominatim
│           └── InventoryPicker.jsx # Selector de inventario para mudanzas
│
├── supabase/
│   ├── schema.sql              # Schema completo Supabase (ejecutar al crear DB)
│   └── migration_001_company_pool.sql  # PENDIENTE DE EJECUTAR si no se hizo
│
└── CLAUDE.md                   # Este archivo
```

---

## Roles de Usuario

| Rol | Acceso | Descripción |
|---|---|---|
| `admin` | Todo | Ve y gestiona toda la plataforma |
| `driver` | Solo su ruta activa | App conductora — entrega, foto, estado |
| `company` | (futuro) | Portal para el proveedor ver sus paquetes |
| `customer` | Tracking público | Solo tracking por ID sin auth |

---

## Modelo de Datos Central

### Package (paquete) — entidad más importante
```
trackingId    — ID público (PKG-XXXXXXXX), único
companyId     — empresa/proveedor (OBLIGATORIO en todos los paquetes)
routeId       — ruta asignada (NULL = en el pool, sin ruta)
customerName/LastName/Phone — datos del destinatario
address/commune/aptFloor    — dirección de entrega
lat/lng       — coordenadas geocodificadas
price         — precio de entrega
status        — pendiente | entregado | no-entregado | devuelto | eliminado
failReason    — razón si no se entregó
note          — nota interna
photoUrl/photo2Url — fotos de evidencia (Cloudinary)
aiFlags       — campos que Claude marcó como dudosos en importación AI
history[]     — log de todos los eventos: {event, description, from, to, by, at}
createdAt/updatedAt — timestamps automáticos
```

### Route (ruta)
```
routeCode     — código único (RT-001)
name          — nombre opcional
date          — fecha de la ruta
driverId      — conductor asignado
companyId     — empresa cliente (clientCompany)
tariffId      — tarifario aplicado
status        — draft | active | paused | completed | cancelled
stats         — {total, delivered, failed, pending, totalAmount, collectedAmount}
shareToken    — token para link compartido con cliente
startPoint    — punto de inicio (lat/lng)
```

### Company (empresa / proveedor)
```
name, rut, address
contactPerson, contactEmail, contactPhone
notes, active
```

### Quote (cotización)
```
quoteCode     — código único
serviceType   — flete | mudanza | paqueteria
origin/destination
status        — draft | sent | submitted | approved | rejected
shareToken    — link para que el cliente complete datos
convertedRouteId — ruta creada a partir de esta cotización
items[]       — direcciones de entrega (para paquetería)
```

---

## Flujo Operativo (el más importante de entender)

### Flujo de Paquetería (core del negocio)
```
1. INGRESO DE PAQUETES (vista "Paquetes")
   ├── Manual (➕): 1 paquete a la vez, empresa obligatoria
   └── IA (🤖): foto/screenshot/Excel/CSV → Claude extrae → preview editable → confirmar
       Los paquetes quedan en el POOL (routeId = null)

2. CREACIÓN DE RUTA (vista "Rutas")
   ├── Crear nueva ruta (fecha, conductor, empresa)
   └── Asignar paquetes del pool (📦 PoolAssignModal)
       Selección por checkbox, filtro por empresa

3. DESPACHO (conductor)
   ├── Conductor ve su ruta en DriverView
   ├── Registra entrega: foto + estado
   └── Admin ve progreso en tiempo real

4. CIERRE Y FACTURACIÓN
   ├── Admin marca ruta como completada
   ├── Genera factura en InvoiceView
   └── Estadísticas en route.stats
```

### Flujo de Cotizaciones (fletes y mudanzas)
```
1. Cliente pide cotización (landing público o admin la crea manualmente)
2. Admin configura precio y envía link al cliente
3. Cliente abre link, ve cotización, puede completar/aceptar
4. Si aceptada → se convierte en ruta automáticamente
```

---

## Reglas de Negocio Críticas

1. **Ningún paquete puede existir sin empresa (companyId)** — es obligatorio en toda creación
2. **Los paquetes entran SIEMPRE por la vista Paquetes** — nunca directamente desde una ruta
3. **Eliminar una ruta NO elimina los paquetes** — quedan en el pool (routeId = null)
4. **El conductor NO puede cambiar un estado final** — si está `entregado`, no puede revertir
5. **Ruta `completed` bloquea al conductor** — admin debe activarla de nuevo para cambios
6. **Todo movimiento se registra en `history[]`** — estados, asignación de ruta, fotos

---

## Importación con IA (Claude)

El flujo de importación masiva usa Claude para leer cualquier tipo de documento:

- **Endpoint preview:** `POST /api/import/pool/preview` — recibe archivo, devuelve packages[]
- **Endpoint confirm:** `POST /api/import/pool/confirm` — recibe packages[] + companyId, guarda
- **Campos que Claude extrae:** nombre, apellido, dirección, teléfono, comuna, depto/casa
- **Campos que Claude NO extrae:** precio, zona, lat/lng (se calculan después)
- **`_flags`:** array de nombres de campos que Claude marcó como dudosos/ilegibles
- **Formatos soportados:** JPG, PNG, GIF, WebP (fotos/screenshots), .xlsx, .xls, .csv
- **Model usado:** `claude-opus-4-7`
- En preview, el usuario puede editar cada campo antes de confirmar
- Campos con `_flags` se muestran en amber (⚠) para revisión manual

---

## Base de Datos (Supabase)

El sistema utiliza exclusivamente **Supabase** (PostgreSQL).

**Detección:** `isSupabaseEnabled()` en `server/utils/supabase.js`
- Activo si `DATABASE_PROVIDER=supabase` O si `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` están definidos

**Nombres de columnas:** Supabase usa `snake_case` (e.g. `customer_name`, `route_id`).
La función `normalizePackage()` convierte de snake a camel para respuestas uniformes.

**Migraciones pendientes/ejecutadas:**
- `supabase/schema.sql` — schema completo inicial
- `supabase/migration_001_company_pool.sql` — agrega `company_id`, hace `route_id` nullable,
  cambia cascade a SET NULL, agrega columna `history`. **EJECUTAR si no se hizo.**

---

## Pricing (precios de entrega)

Hay tres sistemas de precios que coexisten (prioridad de menor a mayor):

1. **Precios por comuna** (`price_configs`) — tabla base por nombre de comuna
2. **Tarifarios** (`tariffs` + `tariff_items`) — agrupaciones de precios por cliente/empresa
3. **Zonas geográficas** (`zones`) — polígonos GeoJSON con precio, más específicos que comuna

Al importar paquetes, se intenta asignar precio en este orden:
- ¿Tiene coordenadas y hay zona que las cubra? → precio de zona
- ¿Tiene comuna en price_configs? → precio de esa comuna
- Fallback → `suggestPrice()` (estimación por zona general)

---

## Convenciones de Código

### General
- ES Modules (`import/export`) en todo el proyecto
- Sin comentarios excepto WHY no-obvio (no explicar QUÉ hace el código)
- Sin Tailwind, sin CSS Modules — estilos inline con objetos JS
- Variables CSS: `var(--accent)` (#0052FF azul), `var(--border)`, `var(--muted)`, `var(--card2)`, `var(--text)`

### Frontend
- Navegación por estado `view` en `AdminView.jsx`, NO React Router
- Cada vista es un componente que recibe `onBack` o similar si necesita volver
- Toast notifications: `import { toast } from '../../components/Toast.jsx'`
- API calls: `import { api } from '../../api/index.js'` — agregar métodos ahí cuando se necesitan nuevos endpoints
- Formularios: sin librerías de formularios, estado local con `useState`

### Backend
- Siempre implementar el bloque Supabase PRIMERO, MongoDB como fallback
- `requireAuth` + `requireRole('admin')` en todos los endpoints admin
- `syncRouteStats(routeId)` después de cualquier cambio en packages de una ruta

---

## Estado Actual de Desarrollo (mayo 2026)

### Implementado y funcionando
- ✅ Auth JWT (login, roles)
- ✅ Gestión de empresas (proveedores)
- ✅ Vista Paquetes (ingreso único): manual + AI bulk import
- ✅ Pool de paquetes (sin ruta asignada)
- ✅ Gestión de rutas (crear, editar, optimizar, compartir)
- ✅ PoolAssignModal — asignar del pool a ruta desde la vista de ruta
- ✅ App del conductor (DriverView) — entrega, fotos, estado, bloqueo final
- ✅ Mapa general (GeneralMapView) — todos los paquetes geocodificados
- ✅ Mapa de sectores (SectorMap) — zonas con polígonos y precios
- ✅ Precios por comuna + tarifarios + zonas geográficas
- ✅ Cotizaciones (fletes/mudanzas) con link público para el cliente
- ✅ Facturación de rutas (InvoiceView)
- ✅ Tracking público por trackingId (sin auth)
- ✅ Landing público con cotizador flete/mudanza/paquetería
- ✅ Historial de eventos en paquetes (history[])
- ✅ Importación IA: foto/Excel/CSV → preview editable → confirmar
- ✅ Geocodificación automática al confirmar importación

### Pendiente / En radar
- ⏳ Portal para empresa (rol `company`) — ver sus propios paquetes
- ⏳ Notificaciones al destinatario (WhatsApp/SMS) cuando el paquete está en camino
- ⏳ Reportes y analytics de rendimiento por conductor y empresa
- ⏳ Multi-ruta por día (varios conductores en paralelo por empresa)
- ⏳ Integración webhook para recibir paquetes desde sistemas externos (ya hay API credentials)

---

## Supabase — Tablas y Estructura

Las tablas principales (todas con RLS activo, el backend usa service_role_key):

| Tabla | Propósito |
|---|---|
| `companies` | Empresas/proveedores |
| `app_users` | Todos los usuarios (admin, driver, company) |
| `packages` | Paquetes de delivery |
| `routes` | Rutas de entrega |
| `tariffs` + `tariff_items` | Tarifarios por cliente |
| `price_configs` | Precios por comuna |
| `zones` | Zonas geográficas con polígonos |
| `quotes` + `quote_items` | Cotizaciones |
| `api_credentials` | API keys para integraciones |

---

## Decisiones de Arquitectura ya tomadas (NO revertir)

1. **Paquetes son independientes de rutas** — `routeId` es nullable. Borrar ruta → paquetes quedan en pool
2. **Un solo endpoint de importación** — `/api/import/pool/*` para pool, `/api/import/:routeId/*` para ruta directa
3. **Claude extrae solo 6 campos** en importación — nombre, apellido, dirección, teléfono, comuna, depto. NO precio ni coordenadas
4. **`/pool/preview` y `/pool/confirm` se registran ANTES de `/:routeId/preview`** en Express para evitar que "pool" sea interpretado como routeId
5. **Frontend sin React Router** — toda la navegación admin es estado en `AdminView.jsx`
6. **Estilos 100% inline** — no agregar CSS files ni librerías de estilos

---

## Comandos Útiles

```bash
# Desarrollo local
cd client && npm run dev      # Frontend en localhost:5173
cd server && npm start        # Backend en localhost:4000

# Build producción
npm run build                 # Compila client/dist, luego Express lo sirve

# Railway (deploy automático en push a main)
```

---

## Contacto del Proyecto
- **Desarrollador:** Leonardo (leologo11 en git)
- **Email:** mendozaleologo@gmail.com
- **Generación de IDs:** `crypto` nativo de Node.js (se eliminó `nanoid`)
- **Plataforma:** MUVE — empresa de logística y delivery en Chile
