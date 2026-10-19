// Dialog konfirmasi & dialog umum (a11y: fokus, Escape, backdrop).
import { h, icon } from '../utils/dom.js';

function openDialog({ title, body, actions, onClose }) {
  const root = document.getElementById('overlay-root');
  const prevFocus = document.activeElement;

  const dialog = h('div', { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'dialog-title' }, title),
    h('div', { class: 'dialog-body' }, body),
    h('div', { class: 'dialog-actions' }, actions)
  );
  const backdrop = h('div', { class: 'dialog-backdrop' }, dialog);

  function close(result) {
    backdrop.remove();
    document.removeEventListener('keydown', onKey);
    if (onClose) onClose(result);
    if (prevFocus && prevFocus.focus) prevFocus.focus();
  }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(null); }
    if (e.key === 'Tab') {
      const focusables = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
      if (!focusables.length) return;
      const first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(null); });
  document.addEventListener('keydown', onKey);
  root.appendChild(backdrop);

  const safeClose = close;
  queueMicrotask(() => {
    const btn = dialog.querySelector('[data-autofocus]') || dialog.querySelector('button');
    if (btn) btn.focus();
  });
  return { close: safeClose, dialog };
}

/**
 * Konfirmasi tindakan destruktif.
 * @returns {Promise<boolean>}
 */
export function confirmDialog({
  title = 'Konfirmasi',
  message = 'Lanjutkan tindakan ini?',
  confirmLabel = 'Ya, lanjutkan',
  cancelLabel = 'Batal',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (val) => { if (!settled) { settled = true; resolve(val); } };
    const { close } = openDialog({
      title,
      body: h('p', {}, message),
      actions: [
        h('button', { class: 'btn', onClick: () => { done(false); close(false); } }, cancelLabel),
        h('button', {
          class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, 'data-autofocus': true,
          onClick: () => { done(true); close(true); },
        }, confirmLabel),
      ],
      onClose: () => done(false),
    });
  });
}

/** Dialog dengan konten kustom; resolve dengan hasil aksi pertama. */
export function customDialog({ title, buildBody, actions, width }) {
  return new Promise((resolve) => {
    const { close } = openDialog({
      title,
      body: buildBody(() => close(null)),
      actions,
      onClose: (r) => resolve(r),
    });
  });
}

export { openDialog, icon, h };
