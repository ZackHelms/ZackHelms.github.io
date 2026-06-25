// services.js — loads the streaming-service catalog (data/services.json) once and
// exposes lookup helpers used across views.

let _services = null;

export async function loadServices() {
  if (_services) return _services;
  const res = await fetch('./data/services.json');
  const json = await res.json();
  _services = json.services || [];
  return _services;
}

export function allServices() { return _services || []; }

export function serviceById(id) {
  return (_services || []).find(s => s.id === id) || null;
}

export function serviceByProviderId(providerId) {
  return (_services || []).find(s => s.providerId === providerId) || null;
}

// Build a "play" deep link for a service + title.
export function deepLink(serviceId, title) {
  const svc = serviceById(serviceId);
  if (!svc) return null;
  return svc.deepLink.replace('{query}', encodeURIComponent(title || ''));
}
