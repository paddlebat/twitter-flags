// Storage layer: the single source of truth for flagged accounts.
// Backed by chrome.storage.local under one key. To try a syncing backend
// later, change `area` (and the `areaName` check in onChanged) in one place.
window.XF = window.XF || {};
(() => {
  const KEY = 'xf_accounts';
  // Firefox exposes promise-based APIs on `browser`; Chrome on `chrome`.
  const api = (typeof browser !== 'undefined' && browser.storage) ? browser : chrome;
  const area = api.storage.local;
  const AREA_NAME = 'local';

  const FLAGS = {
    warning:  { label: 'Warning',  glyph: '!' },
    positive: { label: 'Positive', glyph: '+' },
    neutral:  { label: 'Neutral',  glyph: '•' },
    blocked:  { label: 'Blocked',  glyph: 'B' },
    muted:    { label: 'Muted',    glyph: 'M' },
  };
  const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

  const state = { accounts: {}, loaded: false };
  // Only http(s) links are kept. Anything else (javascript:, data:, …) from a
  // tampered import or sync file is dropped so it can never run on click.
  function safeLink(v) {
    const s = String(v || '').trim();
    if (!s) return '';
    try {
      const u = new URL(s);
      return (u.protocol === 'https:' || u.protocol === 'http:') ? u.href : '';
    } catch { return ''; }
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const listeners = new Set();

  const norm = (h) => String(h || '').replace(/^@/, '').trim().toLowerCase();

  function emit() {
    for (const fn of listeners) {
      try { fn(state.accounts); } catch (e) { console.error('[XF] listener failed', e); }
    }
  }

  // Notes: [{ id, text, link, createdAt, updatedAt }]. Entries saved by the
  // first version had a single note/link pair; those migrate into notes[0].
  function sanitizeNotes(v, now) {
    let notes = Array.isArray(v.notes) ? v.notes : [];
    if (!notes.length && (v.note || v.link)) {
      notes = [{ text: v.note, link: v.link, createdAt: v.createdAt, updatedAt: v.updatedAt }];
    }
    return notes
      .filter((n) => n && typeof n === 'object')
      .map((n) => ({
        id: typeof n.id === 'string' && n.id ? n.id : uid(),
        text: typeof n.text === 'string' ? n.text.trim() : '',
        link: safeLink(n.link),
        createdAt: n.createdAt || n.updatedAt || now,
        updatedAt: n.updatedAt || n.createdAt || now,
      }))
      .filter((n) => n.text || n.link);
  }

  function sanitize(obj) {
    const out = {};
    if (!obj || typeof obj !== 'object') return out;
    const now = new Date().toISOString();
    for (const [k, v] of Object.entries(obj)) {
      if (!v || typeof v !== 'object') continue;
      const handle = String(v.handle || k).replace(/^@/, '').trim();
      const key = norm(handle);
      if (!HANDLE_RE.test(key)) continue;
      out[key] = {
        handle,
        flag: FLAGS[v.flag] ? v.flag : 'neutral',
        notes: sanitizeNotes(v, now),
        createdAt: v.createdAt || v.updatedAt || now,
        updatedAt: v.updatedAt || v.createdAt || now,
      };
    }
    return out;
  }

  // Settings live under their own key so they never mix with account data
  // (and are not part of export/import).
  const SETTINGS_KEY = 'xf_settings';
  const settings = { enabled: true };
  const settingsListeners = new Set();
  const readSettings = (v) => ({ enabled: !(v && v.enabled === false) });

  async function load() {
    const res = await area.get([KEY, SETTINGS_KEY]);
    state.accounts = sanitize(res && res[KEY]);
    Object.assign(settings, readSettings(res && res[SETTINGS_KEY]));
    state.loaded = true;
    return state.accounts;
  }

  function isEnabled() { return settings.enabled; }

  async function setEnabled(on) {
    if (settings.enabled === !!on) return;
    settings.enabled = !!on;
    await area.set({ [SETTINGS_KEY]: { ...settings } });
    for (const fn of settingsListeners) { try { fn({ ...settings }); } catch (e) { console.error('[XF] settings listener', e); } }
  }

  async function persist() {
    await area.set({ [KEY]: state.accounts });
  }

  function get(handle) {
    return state.accounts[norm(handle)] || null;
  }

  function all() {
    return Object.values(state.accounts)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  }

  function count() {
    return Object.keys(state.accounts).length;
  }

  // entry: { handle, flag, notes: [{ id?, text, link }] }. Notes keep their
  // timestamps when unchanged; edited or new notes get fresh ones.
  async function save(entry) {
    const handle = String(entry.handle || '').replace(/^@/, '').trim();
    const key = norm(handle);
    if (!HANDLE_RE.test(key)) throw new Error('Invalid handle: ' + entry.handle);
    const prev = state.accounts[key];
    const prevNotes = new Map(((prev && prev.notes) || []).map((n) => [n.id, n]));
    const now = new Date().toISOString();
    const notes = [];
    for (const n of Array.isArray(entry.notes) ? entry.notes : []) {
      const text = String((n && n.text) || '').trim();
      const link = safeLink(n && n.link);
      if (!text && !link) continue;
      const old = n.id && prevNotes.get(n.id);
      if (old && old.text === text && old.link === link) { notes.push(old); continue; }
      notes.push({ id: (old && old.id) || uid(), text, link, createdAt: (old && old.createdAt) || now, updatedAt: now });
    }
    state.accounts[key] = {
      handle,
      flag: FLAGS[entry.flag] ? entry.flag : 'neutral',
      notes,
      createdAt: (prev && prev.createdAt) || now,
      updatedAt: now,
    };
    await persist();
    emit();
    return state.accounts[key];
  }

  async function remove(handle) {
    const key = norm(handle);
    if (!(key in state.accounts)) return false;
    delete state.accounts[key];
    await persist();
    emit();
    return true;
  }

  async function clear() {
    state.accounts = {};
    await persist();
    emit();
  }

  function exportJSON() {
    return JSON.stringify({
      app: 'x-account-flags',
      version: 2,
      exportedAt: new Date().toISOString(),
      accounts: state.accounts,
    }, null, 2);
  }

  // mode: 'merge' (newest updatedAt wins) or 'replace'
  async function importJSON(text, mode = 'merge') {
    let data;
    try { data = JSON.parse(text); } catch { throw new Error('File is not valid JSON'); }
    const incoming = sanitize(data && data.accounts ? data.accounts : data);
    const n = Object.keys(incoming).length;
    if (mode === 'replace') {
      state.accounts = incoming;
    } else {
      for (const [k, v] of Object.entries(incoming)) {
        const cur = state.accounts[k];
        if (!cur || (v.updatedAt || '') >= (cur.updatedAt || '')) state.accounts[k] = v;
      }
    }
    await persist();
    emit();
    return n;
  }

  // Picks up changes made from other windows (e.g. PWA window + browser tab).
  api.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== AREA_NAME) return;
    if (changes[SETTINGS_KEY]) {
      const next = readSettings(changes[SETTINGS_KEY].newValue);
      if (next.enabled !== settings.enabled) {
        Object.assign(settings, next);
        for (const fn of settingsListeners) { try { fn({ ...settings }); } catch (e) { console.error('[XF] settings listener', e); } }
      }
    }
    if (!changes[KEY]) return;
    const next = sanitize(changes[KEY].newValue);
    if (JSON.stringify(next) === JSON.stringify(state.accounts)) return;
    state.accounts = next;
    emit();
  });

  XF.store = {
    FLAGS, norm, load, get, all, count, save, remove, clear, exportJSON, importJSON,
    isEnabled, setEnabled,
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    onSettingsChange: (fn) => { settingsListeners.add(fn); return () => settingsListeners.delete(fn); },
  };
})();
