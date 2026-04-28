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

  // Packages
  getPackages: (routeId) => request('GET', `/packages?routeId=${routeId}`),
  createPackage: (data) => request('POST', '/packages', data),
  bulkCreatePackages: (routeId, packages) => request('POST', '/packages/bulk', { routeId, packages }),
  updatePackage: (id, data) => request('PATCH', `/packages/${id}`, data),
  deletePackage: (id) => request('DELETE', `/packages/${id}`),
  restorePackage: (id) => request('PATCH', `/packages/${id}/restore`),
  reorderPackages: (order) => request('PATCH', '/packages/reorder/batch', { order }),

  uploadPhoto: (packageId, file) => {
    const fd = new FormData();
    fd.append('photo', file);
    return request('POST', `/packages/${packageId}/photo`, fd, true);
  },

  // Public tracking
  trackPackage: (trackingId) => request('GET', `/packages/track/${trackingId}`),

  // Users
  getUsers: () => request('GET', '/users'),
  createUser: (data) => request('POST', '/users', data),
  updateUser: (id, data) => request('PATCH', `/users/${id}`, data),
  deleteUser: (id) => request('DELETE', `/users/${id}`),

  // Companies
  getCompanies: () => request('GET', '/companies'),
  createCompany: (data) => request('POST', '/companies', data),
  updateCompany: (id, data) => request('PATCH', `/companies/${id}`, data),
  deleteCompany: (id) => request('DELETE', `/companies/${id}`)
};
