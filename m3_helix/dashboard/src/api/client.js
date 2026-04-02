const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';

export async function getJson(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`);
  }

  return res.json();
}

export async function postJson(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      Accept: 'application/json' 
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`);
  }

  return res.json();
}
