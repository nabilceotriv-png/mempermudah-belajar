// Router hash — mendukung parameter, query string, rute privat, dan judul halaman.
import { mount } from './utils/dom.js';

let routes = [];
let outlet = null;
let onTitle = () => {};
let onNavigateEnd = () => {};
let authCheck = () => true;
let authRequiredHandler = () => {};
let currentCleanup = null;

export function configureRouter({ outletEl, routes: r, setTitle, afterRender, isAuthenticated, onAuthRequired }) {
  outlet = outletEl;
  routes = r;
  onTitle = setTitle || onTitle;
  onNavigateEnd = afterRender || onNavigateEnd;
  authCheck = isAuthenticated || authCheck;
  authRequiredHandler = onAuthRequired || authRequiredHandler;
}

export function parseHash(hash = location.hash) {
  let raw = hash.replace(/^#/, '') || '/dashboard';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : '/' + pathPart;
  const query = {};
  for (const [k, v] of new URLSearchParams(queryPart)) query[k] = v;
  return { path, query };
}

export function buildHash(path, query = {}) {
  const qs = new URLSearchParams(Object.entries(query).filter(([, v]) => v !== '' && v !== null && v !== undefined)).toString();
  return `#${path}${qs ? '?' + qs : ''}`;
}

export function navigate(path, query = {}, { replace = false } = {}) {
  const target = buildHash(path, query);
  if (replace) location.replace(target);
  else location.hash = target;
}

/** Perbarui query rute saat ini tanpa memicu render ulang penuh. */
export function setQuery(patch, { silent = true } = {}) {
  const { path, query } = parseHash();
  const next = { ...query, ...patch };
  const target = buildHash(path, next);
  if (silent) history.replaceState(null, '', target);
  return next;
}

function matchRoute(path) {
  for (const r of routes) {
    const rSeg = r.path.split('/').filter(Boolean);
    const pSeg = path.split('/').filter(Boolean);
    if (rSeg.length !== pSeg.length) continue;
    const params = {};
    let ok = true;
    for (let i = 0; i < rSeg.length; i++) {
      if (rSeg[i].startsWith(':')) params[rSeg[i].slice(1)] = decodeURIComponent(pSeg[i]);
      else if (rSeg[i] !== pSeg[i]) { ok = false; break; }
    }
    if (ok) return { route: r, params };
  }
  return null;
}

export function renderRoute() {
  const { path, query } = parseHash();
  const found = matchRoute(path);

  if (!found) {
    navigate('/404', {}, { replace: true });
    return;
  }
  const { route, params } = found;

  if (route.auth !== false && !authCheck()) {
    authRequiredHandler(path);
    return;
  }
  if (route.auth === false && authCheck() && route.redirectIfAuth) {
    navigate(route.redirectIfAuth, {}, { replace: true });
    return;
  }

  if (typeof currentCleanup === 'function') { try { currentCleanup(); } catch { /* abaikan */ } currentCleanup = null; }

  onTitle(route.title || 'TaskMate');
  const ctx = { params, query, path };
  const node = route.page(ctx);
  mount(outlet, node);
  outlet.scrollTop = 0;
  window.scrollTo({ top: 0 });
  onNavigateEnd(ctx, route);
  if (node && typeof node.__cleanup === 'function') currentCleanup = node.__cleanup;
}

export function startRouter() {
  window.addEventListener('hashchange', renderRoute);
  if (!location.hash) location.replace('#/dashboard');
  renderRoute();
}

/** Paksa render ulang rute saat ini (mis. setelah data berubah). */
export function refreshRoute() { renderRoute(); }
