// ui.js — small DOM helpers shared by views (element creation, poster cards,
// service badges, lazy images).

import { posterUrl } from './tmdb.js';
import { serviceById } from './services.js';

// el('div', {class:'x', onclick:fn}, [children]) -> HTMLElement
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return node;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

// Lazy poster image with a generated placeholder fallback (first letter on a hue
// derived from the title, so cards look distinct even with no artwork).
export function poster(item) {
  const url = posterUrl(item.poster, 'w185');
  if (url) {
    return el('img', {
      class: 'poster', src: url, alt: item.title,
      loading: 'lazy', decoding: 'async',
    });
  }
  const hue = [...(item.title || '?')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return el('div', {
    class: 'poster placeholder',
    style: `background:linear-gradient(150deg,hsl(${hue} 45% 22%),hsl(${(hue + 40) % 360} 45% 12%))`,
  }, [el('span', { text: (item.title || '?')[0] })]);
}

// Small colored badge for a streaming service.
export function serviceBadge(serviceId) {
  const svc = serviceById(serviceId);
  if (!svc) return el('span', { class: 'svc-badge unknown', text: '—' });
  return el('span', {
    class: 'svc-badge', title: svc.name,
    style: `background:${svc.color}`,
    text: svc.short,
  });
}

export function serviceName(serviceId) {
  const svc = serviceById(serviceId);
  return svc ? svc.name : 'Unknown';
}
