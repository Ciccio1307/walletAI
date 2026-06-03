const BASE = import.meta.env.VITE_API_URL ?? '';

export function apiFetch(url, opts = {}) {
  return fetch(`${BASE}${url}`, {
    ...opts,
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
}

export function publicFetch(url, opts = {}) {
  return fetch(`${BASE}${url}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...opts.headers,
    },
  });
}
