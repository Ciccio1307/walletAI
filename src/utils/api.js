const BASE = import.meta.env.VITE_API_URL ?? '';

export function getToken() {
  return localStorage.getItem('token');
}

export function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('wai_templates');
}

/**
 * Removes API response caches (transactions / user profile).
 * Called on login and logout so a shared browser cannot show another
 * account's cached data offline.
 */
export async function clearApiCaches() {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith('api-'))
        .map((key) => caches.delete(key))
    );
  } catch {
    // Cache API unavailable (e.g. private mode): nothing to do.
  }
}

// Several requests can expire at the same moment (a page loads ~5 in
// parallel): they all wait on the same refresh instead of sending one each.
let refreshInFlight = null;

function tryRefresh() {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

async function doRefresh() {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      clearSession();
      return false;
    }

    const data = await res.json();
    if (!data.token) return false;

    localStorage.setItem('token', data.token);
    if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
    return true;
  } catch {
    // Network error: keep the session, it may simply be offline.
    return false;
  }
}

function makeHeaders(extra = {}) {
  const headers = { ...extra };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
  return headers;
}

export async function apiFetch(url, opts = {}) {
  let res = await fetch(`${BASE}${url}`, { ...opts, headers: makeHeaders(opts.headers) });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(`${BASE}${url}`, { ...opts, headers: makeHeaders(opts.headers) });
    } else if (!localStorage.getItem('refresh_token') && window.location.pathname !== '/login') {
      // No refresh token and access token rejected: force a clean login.
      clearSession();
      window.location.assign('/login');
    }
  }

  return res;
}

export function publicFetch(url, opts = {}) {
  return fetch(`${BASE}${url}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts.headers },
  });
}
