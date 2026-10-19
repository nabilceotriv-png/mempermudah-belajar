// Status UI bersama: LoadingState, EmptyState, ErrorState.
import { h, icon } from '../utils/dom.js';

export function LoadingState(pesan = 'Memuat data…') {
  return h('div', { class: 'loading-box', role: 'status' },
    h('div', { class: 'spinner' }),
    h('p', { class: 'small' }, pesan)
  );
}

export function EmptyState({ iconName = 'inbox', title = 'Belum ada data', message = '', actions = [] }) {
  return h('div', { class: 'state-box' },
    h('div', { class: 'state-icon' }, icon(iconName, 26)),
    h('h3', {}, title),
    message ? h('p', { class: 'small', style: 'max-width:420px' }, message) : null,
    actions.length ? h('div', { class: 'state-actions' }, actions) : null
  );
}

export function ErrorState(message = 'Terjadi kesalahan saat memuat data.', onRetry = null) {
  return h('div', { class: 'state-box' },
    h('div', { class: 'state-icon', style: 'color:var(--danger)' }, icon('alert', 26)),
    h('h3', {}, 'Ups, terjadi kesalahan'),
    h('p', { class: 'small', style: 'max-width:460px' }, message),
    onRetry ? h('div', { class: 'state-actions' },
      h('button', { class: 'btn btn-primary btn-sm', onClick: onRetry }, icon('refresh', 15), 'Coba lagi')) : null
  );
}

/** Tangani promise: tampilkan loading, error, atau hasil. */
export async function withState(container, loader, render, { pesan = 'Memuat data…' } = {}) {
  container.replaceChildren(LoadingState(pesan));
  try {
    const data = await loader();
    const node = render(data);
    container.replaceChildren(node);
    return data;
  } catch (err) {
    console.error(err);
    container.replaceChildren(ErrorState(err?.message || 'Kesalahan tidak dikenal.', () => withState(container, loader, render, { pesan })));
    return null;
  }
}
