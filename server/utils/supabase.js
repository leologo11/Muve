const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function isSupabaseEnabled() {
  return process.env.DATABASE_PROVIDER === 'supabase' || Boolean(SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY);
}

function assertSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SERVICE_ROLE_KEY === 'ey...') {
    throw new Error('Supabase no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.');
  }
}

export async function supabaseRequest(path, options = {}) {
  assertSupabase();
  let res;
  try {
    res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
      ...options,
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers || {}),
      },
    });
  } catch (fetchErr) {
    console.error('❌ Error de conexión Supabase:', fetchErr.message);
    throw new Error('No se pudo conectar con la base de datos');
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || data?.error || `Supabase HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export function qs(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : '';
}

export function normalizeUser(row) {
  if (!row) return null;
  // vehicles is a JSON array [{ type, plate }]; back-compat: derive from legacy vehicle/license_plate
  const vehicles = Array.isArray(row.vehicles) && row.vehicles.length > 0
    ? row.vehicles
    : (row.vehicle ? [{ type: row.vehicle, plate: row.license_plate || '' }] : []);
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    companyId: row.company_id,
    active: row.active,
    phone: row.phone,
    vehicle: vehicles[0]?.type || row.vehicle || null,
    licensePlate: vehicles[0]?.plate || row.license_plate || null,
    vehicles,
    companyName: row.company_name,
    rut: row.rut,
    location: row.location || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeQuote(row, items = []) {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    quoteCode: row.quote_code,
    shareToken: row.share_token,
    serviceType: row.service_type,
    origin: row.origin,
    destination: row.destination,
    moveSize: row.move_size,
    status: row.status,
    tariffId: row.tariff_id,
    clientCompany: row.client_company,
    contactPerson: row.contact_person,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    deliveryDate: row.delivery_date,
    adminNotes: row.admin_notes,
    clientNotes: row.client_notes,
    driverId: row.driver_id,
    convertedRouteId: row.converted_route_id,
    // Flete/mudanza pricing fields
    vehicleType: row.vehicle_type || null,
    distanceKm: row.distance_km != null ? Number(row.distance_km) : null,
    originAddress: row.origin_address || null,
    originCoords: row.origin_coords || null,
    destinationAddress: row.destination_address || null,
    destinationCoords: row.destination_coords || null,
    driverHelps: row.driver_helps || false,
    numHelpers: row.num_helpers || 0,
    numFloors: row.num_floors || 0,
    originFloors: row.origin_floors || 0,
    destinationFloors: row.destination_floors || 0,
    needsPacking: row.needs_packing || false,
    isConserjeria: row.is_conserjeria || false,
    itemsDescription: row.items_description || null,
    priceMin:   row.price_min   != null ? Number(row.price_min)   : null,
    priceMax:   row.price_max   != null ? Number(row.price_max)   : null,
    priceFinal: row.price_final != null ? Number(row.price_final) : null,
    items: items.map(normalizeQuoteItem),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeQuoteItem(row) {
  return {
    _id: row.id,
    id: row.id,
    customerName: row.customer_name,
    customerLastName: row.customer_last_name,
    customerPhone: row.customer_phone,
    address: row.address,
    commune: row.commune,
    price: Number(row.price || 0),
    lat: row.lat,
    lng: row.lng,
    note: row.note,
  };
}

export function normalizeCredential(row) {
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    keyId: row.key_id,
    prefix: row.prefix,
    revoked: row.revoked,
    createdBy: row.created_by,
    lastUsedAt: row.last_used_at,
    revokedAt: row.revoked_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
