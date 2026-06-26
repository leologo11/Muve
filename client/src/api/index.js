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
  changePassword: (currentPassword, newPassword) => request('PUT', '/auth/change-password', { currentPassword, newPassword }),
  updateProfile: (data) => request('PATCH', '/auth/profile', data),

  // Routes
  getRoutes: () => request('GET', '/routes'),
  getRoute: (id) => request('GET', `/routes/${id}`),
  createRoute: (data) => request('POST', '/routes', data),
  updateRoute: (id, data) => request('PATCH', `/routes/${id}`, data),
  deleteRoute: (id) => request('DELETE', `/routes/${id}`),
  permanentDeleteRoute: (id) => request('DELETE', `/routes/${id}/permanent`),
  optimizeRoute: (id) => request('POST', `/routes/${id}/optimize`),
  geocodeRoute: (id) => request('POST', `/routes/${id}/geocode`),
  generateShareLink: (id) => request('POST', `/routes/${id}/share`),
  revokeShareLink: (id) => request('DELETE', `/routes/${id}/share`),
  getPublicRoute: (token, companies = null) => {
    const suffix = companies?.length ? `?c=${companies.join(',')}` : '';
    return request('GET', `/public/route/${token}${suffix}`);
  },

  // Packages
  getMapPackages: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, String(v)));
    return request('GET', `/packages/map?${q}`);
  },
  getPoolPackages: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, String(v)));
    return request('GET', `/packages/pool?${q}`);
  },
  getAllPackages: (params = {}) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v != null && v !== '' && q.set(k, String(v)));
    return request('GET', `/packages/all?${q}`);
  },
  getPackages: (routeId) => request('GET', `/packages?routeId=${routeId}`),
  createPackage: (data) => request('POST', '/packages', data),
  bulkCreatePackages: (routeId, packages) => request('POST', '/packages/bulk', { routeId, packages }),
  updatePackage: (id, data) => request('PATCH', `/packages/${id}`, data),
  deletePackage: (id) => request('DELETE', `/packages/${id}`),
  bulkDeletePackages: (ids) => request('POST', '/packages/bulk-delete', { ids }),
  bulkAssignPackages: (ids, routeId) => request('POST', '/packages/bulk-assign', { ids, routeId }),
  getPoolSummary: () => request('GET', '/packages/pool-summary'),
  geocodeBatch: () => request('POST', '/packages/geocode-batch'),
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

  // Pool import (no route)
  importPoolPreview: (file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', '/import/pool/preview', fd, true);
  },
  importPoolConfirm: (packages, companyId) => request('POST', '/import/pool/confirm', { packages, companyId }),
  getPriceSuggestion: (commune) => request('GET', `/import/price-suggestion?commune=${encodeURIComponent(commune)}`),

  uploadInvoiceFile: (routeId, file, type = 'invoice') => {
    const fd = new FormData();
    fd.append('file', file);
    return request('POST', `/routes/${routeId}/invoice-file?type=${type}`, fd, true);
  },

  // Commune prices
  getPrices: () => request('GET', '/prices'),
  upsertPrice: (data) => request('POST', '/prices', data),
  bulkUpsertPrices: (items) => request('POST', '/prices/bulk', items),
  updatePrice: (id, data) => request('PATCH', `/prices/${id}`, data),
  deletePrice: (id) => request('DELETE', `/prices/${id}`),

  // Zones (geo zones — communes + custom)
  getZones: () => request('GET', '/zones'),
  createZone: (data) => request('POST', '/zones', data),
  updateZone: (id, data) => request('PATCH', `/zones/${id}`, data),
  deleteZone: (id) => request('DELETE', `/zones/${id}`),
  seedCommunes: (features) => request('POST', '/zones/seed-communes', features ? { features } : undefined),
  deleteAllCommunes: () => request('DELETE', '/zones/communes/all'),
  parsePricesAI: (source) => {
    if (source instanceof File) {
      const fd = new FormData();
      fd.append('file', source);
      return request('POST', '/zones/parse-prices-ai', fd, true);
    }
    return request('POST', '/zones/parse-prices-ai', { text: source });
  },
  bulkZoneTiers: (items) => request('POST', '/zones/bulk-tiers', items),

  // Tier templates (saved generalizer presets)
  getTierTemplates: () => request('GET', '/tier-templates'),
  createTierTemplate: (data) => request('POST', '/tier-templates', data),
  updateTierTemplate: (id, data) => request('PATCH', `/tier-templates/${id}`, data),
  deleteTierTemplate: (id) => request('DELETE', `/tier-templates/${id}`),

  // Quotes
  saveLead: (data) => request('POST', '/public/lead', data),
  testWebhook: (companyId) => request('POST', `/packages/webhook-test/${companyId}`),
  createPublicQuote: (data) => request('POST', '/public/quotes', data),
  getQuotes: () => request('GET', '/quotes'),
  getQuote: (id) => request('GET', `/quotes/${id}`),
  createQuote: (data) => request('POST', '/quotes', data),
  updateQuote: (id, data) => request('PATCH', `/quotes/${id}`, data),
  deleteQuote: (id) => request('DELETE', `/quotes/${id}`),
  sendQuote: (id) => request('POST', `/quotes/${id}/send`),
  approveQuote: (id, data) => request('POST', `/quotes/${id}/approve`, data),
  rejectQuote: (id) => request('POST', `/quotes/${id}/reject`),
  // Public quote (no auth)
  getPublicQuote: (token) => request('GET', `/public/quote/${token}`),
  savePublicQuote: (token, data) => request('PATCH', `/public/quote/${token}`, data),
  submitPublicQuote: (token, data) => request('POST', `/public/quote/${token}/submit`, data),

  // Tariffs
  getTariffs: () => request('GET', '/tariffs'),
  createTariff: (data) => request('POST', '/tariffs', data),
  updateTariff: (id, data) => request('PATCH', `/tariffs/${id}`, data),
  deleteTariff: (id) => request('DELETE', `/tariffs/${id}`),
  duplicateTariff: (id) => request('POST', `/tariffs/${id}/duplicate`),

  // Companies
  getCompanies: () => request('GET', '/companies'),
  createCompany: (data) => request('POST', '/companies', data),
  updateCompany: (id, data) => request('PATCH', `/companies/${id}`, data),
  deleteCompany: (id) => request('DELETE', `/companies/${id}`),

  // Driver real-time location
  updateDriverLocation: (data) => request('PATCH', '/users/me/location', data),
  getDriverLocation: (routeId) => request('GET', `/routes/${routeId}/driver-location`),

  // API credentials
  getCredentials: () => request('GET', '/credentials'),
  createCredential: (data) => request('POST', '/credentials', data),
  revokeCredential: (id) => request('DELETE', `/credentials/${id}`),

  // Admin reset
  resetAllData: (targets) => request('POST', '/admin/reset-data', targets ? { targets } : undefined),

  // Vehicle configs (flete/mudanza pricing)
  getVehicleConfigs: () => request('GET', '/vehicle-configs'),
  updateVehicleConfig: (id, data) => request('PATCH', `/vehicle-configs/${id}`, data),
  getInventoryConfigs: () => request('GET', '/inventory-configs'),
  createInventoryConfig: (data) => request('POST', '/inventory-configs', data),
  updateInventoryConfig: (id, data) => request('PATCH', `/inventory-configs/${id}`, data),

  // Analytics funnel (admin)
  getAnalyticsFunnel: (days = 7) => request('GET', `/analytics/funnel?days=${days}`),

  // Presupuestos manuales (admin)
  getPresupuestos:    ()     => request('GET',    '/presupuestos'),
  createPresupuesto:  (data) => request('POST',   '/presupuestos', data),
  updatePresupuesto:  (id, data) => request('PATCH', `/presupuestos/${id}`, data),
  deletePresupuesto:  (id)   => request('DELETE', `/presupuestos/${id}`),

  // Public pricing helpers (no auth required)
  getPublicVehicleConfigs: () => request('GET', '/public/vehicle-configs'),
  getPublicInventoryConfigs: () => request('GET', '/public/inventory-configs'),
  calculateDistance: (data) => request('POST', '/public/distance', data),
  getQuoteEstimate: (data) => request('POST', '/public/quote-estimate', data),
  estimateLoad: (data) => request('POST', '/public/estimate-load', data),
  reviewPrice: (data) => request('POST', '/public/price-review', data),
  aiQuote: (data) => request('POST', '/public/ai-quote', data),
  aiQuoteFeedback: (data) => request('POST', '/public/ai-quote-feedback', data),
};
