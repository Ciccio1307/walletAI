const BASE = import.meta.env.VITE_API_URL ?? '';

async function tryRefresh() {
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) { localStorage.removeItem('refresh_token'); return false; }
    const { token } = await res.json();
    localStorage.setItem('token', token);
    return true;
  } catch {
    return false;
  }
}

function makeHeaders(extra = {}) {
  return {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function apiFetch(url, opts = {}) {
  let res = await fetch(`${BASE}${url}`, { ...opts, headers: makeHeaders(opts.headers) });

  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await fetch(`${BASE}${url}`, { ...opts, headers: makeHeaders(opts.headers) });
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
