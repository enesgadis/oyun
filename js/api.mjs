import { buildBootstrap, defaultRuntime, getCase } from '../shared/content.mjs';
import { validateBlocks } from '../shared/schema.mjs';
import { loadCachedBootstrap, saveCachedBootstrap } from './store.mjs';

const CONSOLE_CODE = '1995';

export const api = {
  async bootstrap() {
    try {
      const res = await fetch('/api/bootstrap', { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data || typeof data.revision !== 'number' || !Array.isArray(data.homeBlocks)) throw new Error('Şema geçersiz');
      saveCachedBootstrap(data);
      return { data, source: 'live', error: null };
    } catch (error) {
      const cached = loadCachedBootstrap();
      if (cached && Array.isArray(cached.homeBlocks)) {
        return { data: cached, source: 'cache', error: error.message };
      }
      return { data: buildBootstrap(defaultRuntime()), source: 'seed', error: error.message };
    }
  },

  async caseDetail(id) {
    try {
      const res = await fetch(`/api/case/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
      if (res.ok) return { data: await res.json(), source: 'live' };
    } catch {
      /* offline */
    }
    const local = getCase(id);
    return local ? { data: local, source: 'seed' } : { data: null, source: 'missing' };
  },

  connect(onRevision) {
    if (typeof EventSource === 'undefined') return () => {};
    let es;
    try {
      es = new EventSource('/api/stream');
    } catch {
      return () => {};
    }
    let last = 0;
    const handler = (event) => {
      try {
        const payload = JSON.parse(event.data || '{}');
        if (payload.revision && payload.revision !== last) {
          last = payload.revision;
          onRevision(payload);
        }
      } catch {
        /* ignore malformed frame */
      }
    };
    es.addEventListener('revision', handler);
    es.onerror = () => {
      // EventSource reconnects automatically; app remains usable offline.
    };
    return () => {
      es.removeEventListener('revision', handler);
      es.close();
    };
  },

  async event(type, payload = {}) {
    const body = JSON.stringify({ type, ...payload, at: new Date().toISOString() });
    try {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  async mentor(payload) {
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch {
      return { source: 'local', error: true };
    }
  },

  async consoleState(code = CONSOLE_CODE) {
    const res = await fetch('/api/console/state', { headers: { 'x-console-code': code } });
    if (!res.ok) throw new Error(res.status === 401 ? 'Kod yanlış.' : `HTTP ${res.status}`);
    return res.json();
  },

  async applyPatch(patch, code = CONSOLE_CODE) {
    const res = await fetch('/api/console/apply', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-console-code': code },
      body: JSON.stringify(patch),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || (data.errors || []).join(' ') || `HTTP ${res.status}`);
    return data;
  },

  async generate(prompt, code = CONSOLE_CODE) {
    const res = await fetch('/api/console/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-console-code': code },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    return data;
  },

  async consoleStats(code = CONSOLE_CODE) {
    const res = await fetch('/api/stats', { headers: { 'x-console-code': code } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  async resetConsole(code = CONSOLE_CODE) {
    const res = await fetch('/api/console/reset', {
      method: 'POST',
      headers: { 'x-console-code': code },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || data.error || `HTTP ${res.status}`);
    return data;
  },

  async health() {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return { ok: false };
      return { ...(await res.json()), ok: true };
    } catch {
      return { ok: false };
    }
  },

  validateBlocks,
  CONSOLE_CODE,
};
