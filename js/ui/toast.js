// Toast sederhana untuk umpan balik singkat.
import { h, icon } from '../utils/dom.js';

const ICON_BY_TYPE = { success: 'check', error: 'alert', warning: 'alert', info: 'info' };

export function toast(message, type = 'info', duration = 3800) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = h('div', { class: `toast ${type}` },
    h('span', { class: 'grow', style: 'display:flex;gap:8px;align-items:flex-start' },
      icon(ICON_BY_TYPE[type] || 'info', 18),
      h('span', { class: 'toast-msg' }, message)),
    h('button', { class: 'toast-close', 'aria-label': 'Tutup pesan', onClick: () => el.remove() }, icon('x', 16))
  );
  root.appendChild(el);
  setTimeout(() => el.remove(), duration);
  return el;
}

export const toastSuccess = (m) => toast(m, 'success');
export const toastError = (m) => toast(m, 'error', 5200);
export const toastWarning = (m) => toast(m, 'warning', 4600);
