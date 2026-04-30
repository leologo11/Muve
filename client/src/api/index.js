const BASE = import.meta.env.VITE_API_URL || '/api';

function getToken() {
  return localStorage.getItem('rf_token');
}

function headers(extra = {}) {
  const h = { 'Content-Type': 'application/json', ...extra };
  const token = getToken();
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(method, path, body, isFormData = false) {
  const opts = { method, headers: headers(isFormData ? {} : {}) };
  if (isFormData) {
    delete opts.headers['Content-Type'];
    opts.body = body;
  } else if (body) {
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const api = {
  // Auth
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  me: () => request('GET', '/auth/me'),
  seedAdmin: (email, password) => request('POST', '/auth/seed-admin', { email, password }),

  // Routes
  getRoutes: () => request('GET', '/routes'),
  getRoute: (id) => request('GET', `/routes/${id}`),
  createRoute: (data) => request('POST', '/routes', data),
  updateRoute: (id, data) => request('PATCH', `/routes/${id}`, data),
  deleteRoute: (id) => request('DELETE', `/routes/${id}`),
  optimizeRoute: (id) => request('POST', `/routes/${id}/optimize`),
  geocodeRoute: (id) => request('POST', `/routes/${id}/geocode`),
  generateShareLink: (id) => request('POST', `/routes/${id}/share`),
  revokeShareLink: (id) => request('DELETE', `/routes/${id}/share`),
  getPublicRoute: (token) => request('GET', `/public/route/${token}`),

  // Packages
  getAllPackages: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, v));
    return request('GET', `/packages/all?${q}`);
  },
  getPackages: (routeId) => request('GET', `/packages?routeId=${routeId}`),
  createPackage: (data) => request('POST', '/packages', data),
  bulkCreatePackages: (routeId, packages) => request('POST', '/packages/bulk', { routeId, packages }),
  updatePackage: (id, data) => request('PATCH', `/packages/${id}`, data),
  deletePackage: (id) => request('DELETE', `/packages/${id}`),
  restorePackage: (id) => request('PATCH', `/packages/${id}/restore`),
  reorderPackages: (order) => request('PATCH', '/packages/reorder/batch', { order }),

  uploadPhoto: (packageId, file, n = 1) => {
    const fd = new FormData();
    fd.append('photo', file);
    return request('POST', `/packages/${packageId}/photo?n=${n}`, fd, true);
  },

  // Public tracking
  trackPackage: (trackingId) => request('GET', `/packages/track/${trackingId}`),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  // AI Import
  importPreview: (routeId, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', `/import/${routeId}/preview`, fd, true);
  },
  importConfirm: (routeId, packages) => request('POST', `/import/${routeId}/confirm`, { packages }),
  getPriceSuggestion: (commune) => request('GET', `/import/price-suggestion?commune=${encodeURIComponent(commune)}`),

  uploadInvoiceFile: (routeId, file, type = 'invoice') => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', `/routes/${routeId}/invoice-file?type=${type}`, fd, true);
  },

  // Commune prices
  getPrices: () => request('GET', '/prices'),
  upsertPrice: (data) => request('POST', '/prices', data),
  updatePrice: (id, data) => request('PATCH', `/prices/${id}`, data),
  deletePrice: (id) => request('DELETE', `/prices/${id}`),

  // Zones (geo zones — communes + custom)
  getZones: () => request('GET', '/zones'),
  createZone: (data) => request('POST', '/zones', data),
  updateZone: (id, data) => request('PATCH', `/zones/${id}`, data),
  deleteZone: (id) => request('DELETE', `/zones/${id}`),
  seedCommunes: (features) => request('POST', '/zones/seed-communes', features ? { features } : undefined),
  deleteAllCommunes: () => request('DELETE', '/zones/communes/all'),

  // Companies
  getCompanies: () => request('GET', '/companies'),
  createCompany: (data) => request('POST', '/companies', data),
  updateCompany: (id, data) => request('PATCH', `/companies/${id}`, data),
  deleteCompany: (id) => request('DELETE', `/companies/${id}`)
};
