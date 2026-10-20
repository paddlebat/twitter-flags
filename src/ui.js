// All floating UI (modal, tooltip, manager panel, launcher, toasts) lives in a
// Shadow DOM host appended to <html>, so X's CSS and keyboard shortcuts stay out.
window.XF = window.XF || {};
(() => {
  const { FLAGS } = XF.store;

  const CSS = `
    :host {
      all: initial;
      display: block;
      position: fixed; top: 0; left: 0; width: 0; height: 0;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 14px; line-height: 1.35;
      color: var(--fg);
      --bg: #ffffff; --fg: #0f1419; --muted: #536471; --border: #cfd9de;
      --accent: #1d9bf0; --accent-fg: #fff; --backdrop: rgba(0,0,0,.4);
      --hover: rgba(15,20,25,.06); --danger: #f4212e;
    }
    :host([data-theme="dark"]) {
      --bg: #16181c; --fg: #e7e9ea; --muted: #71767b; --border: #2f3336;
      --backdrop: rgba(91,112,131,.4); --hover: rgba(231,233,234,.08);
    }
    * { box-sizing: border-box; }
    button { font: inherit; }
    .backdrop { position: fixed; inset: 0; background: var(--backdrop); display: flex; align-items: center; justify-content: center; }
    .modal, .panel {
      background: var(--bg); color: var(--fg); border-radius: 16px;
      width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 32px);
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,.35);
    }
    .panel { width: min(680px, calc(100vw - 32px)); height: min(82vh, 760px); }
    .head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
    .head h2 { margin: 0; font-size: 17px; font-weight: 700; flex: 1; }
    .icon-btn { background: none; border: 0; color: var(--fg); font-size: 16px; cursor: pointer; width: 32px; height: 32px; border-radius: 50%; }
    .icon-btn:hover { background: var(--hover); }
    .body { padding: 12px 16px; display: flex; flex-direction: column; gap: 12px; overflow: auto; }
    .row { display: flex; align-items: center; gap: 8px; }
    .types { display: flex; gap: 8px; flex-wrap: wrap; }
    .type { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border: 1px solid var(--border); border-radius: 9999px; cursor: pointer; user-select: none; }
    .type:hover { background: var(--hover); }
    .type:has(input:checked) { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent) inset; }
    .type input { display: none; }
    .chip { display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; flex-shrink: 0; }
    .chip svg { display: block; }
    .notes { display: flex; flex-direction: column; gap: 10px; }
    .note { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; }
    .note-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .note textarea { min-height: 60px; }
    .icon-btn--small { width: 24px; height: 24px; font-size: 13px; color: var(--muted); }
    .tip-item { display: flex; flex-direction: column; gap: 2px; padding: 6px 0; border-top: 1px solid var(--border); }
    .tip-item:first-of-type { border-top: 0; padding-top: 0; }
    .tip-notes { max-height: 240px; overflow: auto; }
    .field { display: flex; flex-direction: column; gap: 4px; }
    .field > span { font-size: 12px; color: var(--muted); }
    textarea, input[type=url], input[type=search] {
      width: 100%; font: inherit; color: var(--fg); background: transparent;
      border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; outline: none;
    }
    textarea:focus, input:focus { border-color: var(--accent); }
    textarea { resize: vertical; min-height: 84px; }
    .foot { display: flex; gap: 8px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--border); }
    .spacer { flex: 1; }
    .btn { font-weight: 700; padding: 7px 14px; border-radius: 9999px; border: 1px solid var(--border); background: transparent; color: var(--fg); cursor: pointer; white-space: nowrap; }
    .btn:hover { background: var(--hover); }
    .btn--primary { background: var(--accent); border-color: var(--accent); color: var(--accent-fg); }
    .btn--primary:hover { filter: brightness(.92); background: var(--accent); }
    .btn--danger { color: var(--danger); border-color: var(--danger); }
    .btn--small { padding: 4px 10px; font-size: 12px; }
    .hint, .meta { font-size: 12px; color: var(--muted); }
    .kbd { font-size: 11px; color: var(--muted); }
    .launcher {
      position: fixed; left: 12px; bottom: 12px; width: 36px; height: 36px; border-radius: 50%;
      border: 1px solid var(--border); background: var(--bg); color: var(--fg); cursor: pointer;
      display: flex; align-items: center; justify-content: center; opacity: .45; font-size: 16px;
      box-shadow: 0 2px 8px rgba(0,0,0,.2);
    }
    .launcher:hover { opacity: 1; }
    .launcher-count { position: absolute; top: -6px; right: -6px; background: var(--accent); color: #fff; font-size: 10px; font-weight: 700; border-radius: 9999px; min-width: 16px; height: 16px; padding: 0 4px; display: flex; align-items: center; justify-content: center; }
    .launcher-count:empty { display: none; }
    .tip {
      position: fixed; display: none; width: 290px; background: var(--bg); color: var(--fg);
      border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,.3); gap: 6px; flex-direction: column;
    }
    .tip.is-open { display: flex; }
    .tip-head { display: flex; align-items: center; gap: 6px; }
    .tip-handle { color: var(--muted); margin-left: auto; font-size: 12px; }
    .tip-note { white-space: pre-wrap; word-break: break-word; font-size: 13px; max-height: 180px; overflow: auto; }
    .tip-note--empty { color: var(--muted); font-style: italic; }
    .tip-link { color: var(--accent); font-size: 12px; word-break: break-all; text-decoration: none; }
    .tip-link:hover { text-decoration: underline; }
    .tip-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .toolbar { display: flex; gap: 8px; padding: 10px 16px; flex-wrap: wrap; align-items: center; }
    .toolbar input[type=search] { flex: 1 1 160px; }
    .check { padding: 0 16px 8px; font-size: 12px; color: var(--muted); display: flex; gap: 6px; align-items: center; cursor: pointer; }
    .list { flex: 1; overflow: auto; border-top: 1px solid var(--border); }
    .item { display: flex; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); align-items: flex-start; }
    .item-main { flex: 1; min-width: 0; }
    .item-handle { color: var(--fg); font-weight: 700; text-decoration: none; }
    .item-handle:hover { text-decoration: underline; }
    .item-note { font-size: 13px; white-space: pre-wrap; word-break: break-word; margin: 2px 0; }
    .item-link { font-size: 12px; color: var(--accent); text-decoration: none; word-break: break-all; display: block; }
    .item-actions { display: flex; gap: 6px; }
    .empty { padding: 32px; text-align: center; color: var(--muted); }
    .panel-foot { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--border); }
    .toast { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); background: var(--accent); color: #fff; padding: 8px 16px; border-radius: 9999px; font-size: 14px; box-shadow: 0 4px 16px rgba(0,0,0,.3); }
  `;

  let host, root, launcher, tip, tipTimer, tipPinned = false, tipBadge = null;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function shortUrl(u) {
    try { const x = new URL(u); return (x.host + x.pathname).replace(/\/$/, ''); } catch { return u; }
  }

  function normalizeLink(v) {
    v = String(v || '').trim();
    if (v && !/^[a-z]+:\/\//i.test(v)) v = 'https://' + v;
    return v;
  }

  function isDarkPage() {
    const bg = getComputedStyle(document.body).backgroundColor || '';
    const m = bg.match(/\d+(\.\d+)?/g);
    if (!m || m.length < 3) return false;
    if (m.length >= 4 && parseFloat(m[3]) === 0) return false;
    const lum = 0.299 * m[0] + 0.587 * m[1] + 0.114 * m[2];
    return lum < 128;
  }

  function applyTheme() {
    const dark = isDarkPage();
    host.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.classList.toggle('xf-dark', dark);
  }

  function init() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'xf-root';
    root = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = CSS;
    root.appendChild(style);
    document.documentElement.appendChild(host);

    // Keep typing in our fields from triggering X's single-key shortcuts.
    for (const type of ['keydown', 'keyup', 'keypress']) {
      host.addEventListener(type, (e) => e.stopPropagation());
    }

    launcher = el(`<button class="launcher" type="button" title="Account flags: manage, export, import">⚑<span class="launcher-count"></span></button>`);
    launcher.addEventListener('click', () => openManager());
    root.appendChild(launcher);
    updateLauncher();
    applyTheme();
    setInterval(applyTheme, 5000);

    document.addEventListener('scroll', () => hideTooltip(true), true);
    document.addEventListener('click', (e) => {
      if (tipPinned && !(e.target && e.target.closest && e.target.closest('.xf-badge'))) hideTooltip(true);
    }, true);
  }

  function updateLauncher() {
    if (!launcher) return;
    const n = XF.store.count();
    launcher.querySelector('.launcher-count').textContent = n ? String(n) : '';
    const nav = document.getElementById('xf-nav-item');
    if (nav) nav.title = `Account flags (${n})`;
  }

  // The floating button is only a fallback for layouts without the sidebar nav.
  function setLauncherVisible(visible) {
    if (launcher) launcher.style.display = visible ? '' : 'none';
  }

  function toast(msg, ms = 1800) {
    const t = el(`<div class="toast">${esc(msg)}</div>`);
    root.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  // ---------- Modal ----------

  function closeModal() {
    const m = root.querySelector('[data-modal]');
    if (m) m.remove();
  }

  // opts: { handle, mode: 'block' | 'mute' | 'flag', link?, existing? }
  // Resolves with 'saved' | 'skipped' | 'deleted'.
  function openModal(opts) {
    return new Promise((resolve) => {
      closeModal();
      closeManager();
      hideTooltip(true);
      const handle = String(opts.handle || '').replace(/^@/, '');
      const existing = opts.existing || XF.store.get(handle);
      const isAction = opts.mode === 'block' || opts.mode === 'mute';
      const actionFlag = opts.mode === 'block' ? 'blocked' : 'muted';
      const types = ['warning', 'positive', 'neutral'];
      if (!isAction && existing && (existing.flag === 'blocked' || existing.flag === 'muted')) types.push(existing.flag);
      const flag = isAction ? actionFlag : (existing && existing.flag) || 'warning';
      const title = opts.mode === 'block' ? `Blocked @${handle}`
        : opts.mode === 'mute' ? `Muted @${handle}`
        : existing ? `Edit flag for @${handle}` : `Flag @${handle}`;
      const notes = (existing && existing.notes) || [];

      const noteCard = (n) => `
        <div class="note" data-note ${n.id ? `data-id="${esc(n.id)}"` : ''}>
          <div class="note-head"><span class="meta">${n.id ? `Added ${fmtDate(n.createdAt)}` : 'New note'}</span><button class="icon-btn icon-btn--small" type="button" data-remove title="Remove this note">✕</button></div>
          <textarea rows="3" placeholder="Why?">${esc(n.text || '')}</textarea>
          <input type="url" placeholder="Link (optional) https://x.com/…" value="${esc(n.link || '')}">
        </div>`;
      // Start with a fresh card when there is nothing yet, when the action
      // brought a tweet link, or right after a block/mute.
      const startFresh = isAction || !!opts.link || !notes.length;

      const wrap = el(`
        <div class="backdrop" data-modal>
          <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
            <div class="head"><h2>${esc(title)}</h2><button class="icon-btn" type="button" data-x title="Close">✕</button></div>
            <div class="body">
              ${isAction
                ? `<div class="row"><span class="chip">${XF.dom.badgeSVG(actionFlag, 18)}</span><span class="hint">The ${opts.mode} already went through. Add a private note on why, or skip.</span></div>`
                : `<div class="types">${types.map((t) => `
                    <label class="type"><input type="radio" name="flag" value="${t}" ${t === flag ? 'checked' : ''}><span class="chip">${XF.dom.badgeSVG(t, 18)}</span>${FLAGS[t].label}</label>`).join('')}</div>`}
              <div class="notes" data-notes>${notes.map(noteCard).join('')}${startFresh ? noteCard({ link: opts.link || '' }) : ''}</div>
              <div class="row"><button class="btn btn--small" type="button" data-add>+ Add note</button>${existing ? `<span class="meta">Flagged ${fmtDate(existing.createdAt)} · updated ${fmtDate(existing.updatedAt)}</span>` : ''}</div>
            </div>
            <div class="foot">
              ${existing ? `<button class="btn btn--danger" type="button" data-delete>Delete</button>` : ''}
              <span class="spacer"></span>
              <span class="kbd">⌘/Ctrl+Enter saves · Esc ${isAction ? 'skips' : 'cancels'}</span>
              <button class="btn" type="button" data-skip>${isAction ? 'Skip' : 'Cancel'}</button>
              <button class="btn btn--primary" type="button" data-save>Save</button>
            </div>
          </div>
        </div>`);

      const notesEl = wrap.querySelector('[data-notes]');
      const done = (result) => { wrap.remove(); resolve(result); };
      const addCard = (n = {}) => { notesEl.insertAdjacentHTML('beforeend', noteCard(n)); const c = notesEl.lastElementChild; c.querySelector('textarea').focus(); return c; };
      notesEl.addEventListener('click', (e) => {
        const rm = e.target.closest('[data-remove]');
        if (rm) rm.closest('[data-note]').remove();
      });
      wrap.querySelector('[data-add]').addEventListener('click', () => addCard());
      const collectNotes = () => [...notesEl.querySelectorAll('[data-note]')].map((c) => ({
        id: c.dataset.id || '',
        text: c.querySelector('textarea').value,
        link: normalizeLink(c.querySelector('input[type=url]').value),
      }));

      wrap.querySelector('[data-skip]').addEventListener('click', () => done('skipped'));
      wrap.querySelector('[data-x]').addEventListener('click', () => done('skipped'));
      wrap.querySelector('[data-save]').addEventListener('click', async () => {
        const chosen = isAction ? actionFlag : (wrap.querySelector('input[name=flag]:checked') || {}).value || flag;
        try {
          await XF.store.save({ handle, flag: chosen, notes: collectNotes() });
          toast(`Saved ${FLAGS[chosen].label.toLowerCase()} for @${handle}`);
          done('saved');
        } catch (e) {
          toast('Could not save: ' + e.message, 3000);
        }
      });
      const del = wrap.querySelector('[data-delete]');
      if (del) {
        let armed = false;
        del.addEventListener('click', async () => {
          if (!armed) { armed = true; del.textContent = 'Confirm delete'; return; }
          await XF.store.remove(handle);
          toast(`Removed flag for @${handle}`);
          done('deleted');
        });
      }
      wrap.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); done('skipped'); }
        else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); wrap.querySelector('[data-save]').click(); }
      });

      root.appendChild(wrap);
      const focusTarget = startFresh ? notesEl.lastElementChild : notesEl.firstElementChild;
      if (focusTarget) focusTarget.querySelector('textarea').focus();
    });
  }

  // ---------- Tooltip ----------

  function ensureTip() {
    if (tip) return tip;
    tip = el(`<div class="tip" data-tip></div>`);
    tip.addEventListener('mouseenter', () => clearTimeout(tipTimer));
    tip.addEventListener('mouseleave', () => { if (!tipPinned) scheduleHideTooltip(); });
    root.appendChild(tip);
    return tip;
  }

  function positionTip(badge) {
    const r = badge.getBoundingClientRect();
    const w = tip.offsetWidth, h = tip.offsetHeight;
    let left = r.left;
    let top = r.bottom + 6;
    if (left + w > innerWidth - 8) left = Math.max(8, innerWidth - 8 - w);
    if (top + h > innerHeight - 8) top = Math.max(8, r.top - 6 - h);
    tip.style.left = left + 'px';
    tip.style.top = top + 'px';
  }

  function showTooltip(badge, entry, pin = false) {
    if (!entry) return;
    clearTimeout(tipTimer);
    ensureTip();
    if (tipBadge === badge && tip.classList.contains('is-open')) { if (pin) tipPinned = true; return; }
    tipBadge = badge;
    tipPinned = !!pin;
    tip.innerHTML = `
      <div class="tip-head"><span class="chip">${XF.dom.badgeSVG(entry.flag, 18)}</span><b>${esc(FLAGS[entry.flag].label)}</b><span class="tip-handle">@${esc(entry.handle)}</span></div>
      <div class="tip-notes">${entry.notes.length ? entry.notes.map((n) => `
        <div class="tip-item">
          ${n.text ? `<div class="tip-note">${esc(n.text)}</div>` : ''}
          ${n.link ? `<a class="tip-link" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(n.link))}</a>` : ''}
          <span class="meta">${fmtDate(n.createdAt)}</span>
        </div>`).join('') : `<div class="tip-note tip-note--empty">No notes</div>`}</div>
      <div class="tip-foot"><span class="meta">${entry.notes.length} note${entry.notes.length === 1 ? '' : 's'} · updated ${fmtDate(entry.updatedAt)}</span><button class="btn btn--small" type="button" data-edit>Edit</button></div>`;
    tip.querySelector('[data-edit]').addEventListener('click', () => {
      hideTooltip(true);
      openModal({ handle: entry.handle, mode: 'flag', existing: entry });
    });
    tip.classList.add('is-open');
    positionTip(badge);
  }

  function scheduleHideTooltip() {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => hideTooltip(false), 250);
  }

  function hideTooltip(force) {
    if (!tip) return;
    if (tipPinned && !force) return;
    clearTimeout(tipTimer);
    tip.classList.remove('is-open');
    tipPinned = false;
    tipBadge = null;
  }

  // ---------- Manager panel (list / export / import) ----------

  function closeManager() {
    const m = root.querySelector('[data-manager]');
    if (m) m.remove();
  }

  function openManager() {
    closeManager();
    hideTooltip(true);
    const wrap = el(`
      <div class="backdrop" data-manager>
        <div class="panel" role="dialog" aria-modal="true" aria-label="Account flags">
          <div class="head"><h2>Account flags <span class="meta" data-count></span></h2><button class="icon-btn" type="button" data-x title="Close">✕</button></div>
          <div class="toolbar">
            <input type="search" placeholder="Search handle, note or link…" data-search>
            <button class="btn btn--small" type="button" data-export>Export file</button>
            <button class="btn btn--small" type="button" data-copy>Copy JSON</button>
            <button class="btn btn--small" type="button" data-import>Import file…</button>
            <input type="file" accept=".json,application/json" hidden data-file>
          </div>
          <label class="check"><input type="checkbox" data-replace> Replace everything on import (default merges, newest entry wins)</label>
          <div class="list" data-list></div>
          <div class="panel-foot">
            <span class="hint">Stored locally in this browser profile only. Export to back up or move devices.</span>
            <button class="btn btn--danger btn--small" type="button" data-clear>Delete all</button>
          </div>
        </div>
      </div>`);

    const list = wrap.querySelector('[data-list]');
    const search = wrap.querySelector('[data-search]');
    const close = () => wrap.remove();

    function render() {
      const q = search.value.trim().toLowerCase();
      const items = XF.store.all().filter((e) => !q || e.handle.toLowerCase().includes(q)
        || e.notes.some((n) => n.text.toLowerCase().includes(q) || n.link.toLowerCase().includes(q)));
      wrap.querySelector('[data-count]').textContent = `(${XF.store.count()})`;
      if (!items.length) {
        list.innerHTML = `<div class="empty">${q ? 'No matches.' : 'Nothing flagged yet. Use "Flag account" in a post’s … menu, or the flag button on a profile.'}</div>`;
        return;
      }
      list.innerHTML = items.map((e) => `
        <div class="item" data-handle="${esc(e.handle)}">
          <span class="chip" title="${esc(FLAGS[e.flag].label)}">${XF.dom.badgeSVG(e.flag, 18)}</span>
          <div class="item-main">
            <a class="item-handle" href="${location.origin}/${esc(e.handle)}">@${esc(e.handle)}</a>
            <span class="meta"> · ${esc(FLAGS[e.flag].label)} · ${fmtDate(e.updatedAt)}</span>
            ${e.notes.map((n) => `
              ${n.text ? `<div class="item-note">${esc(n.text)}</div>` : ''}
              ${n.link ? `<a class="item-link" href="${esc(n.link)}" target="_blank" rel="noopener noreferrer">${esc(shortUrl(n.link))}</a>` : ''}
              ${e.notes.length > 1 ? `<span class="meta">${fmtDate(n.createdAt)}</span>` : ''}`).join('')}
          </div>
          <div class="item-actions">
            <button class="btn btn--small" type="button" data-edit>Edit</button>
            <button class="btn btn--small btn--danger" type="button" data-del>Delete</button>
          </div>
        </div>`).join('');
    }

    list.addEventListener('click', async (e) => {
      const row = e.target.closest('.item');
      if (!row) return;
      const handle = row.dataset.handle;
      if (e.target.closest('[data-edit]')) {
        close();
        openModal({ handle, mode: 'flag', existing: XF.store.get(handle) }).then(() => openManager());
      } else if (e.target.closest('[data-del]')) {
        const b = e.target.closest('[data-del]');
        if (b.dataset.armed) { await XF.store.remove(handle); render(); }
        else { b.dataset.armed = '1'; b.textContent = 'Confirm'; setTimeout(() => { delete b.dataset.armed; b.textContent = 'Delete'; }, 3000); }
      }
    });

    search.addEventListener('input', render);
    wrap.querySelector('[data-x]').addEventListener('click', close);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

    wrap.querySelector('[data-export]').addEventListener('click', () => {
      const blob = new Blob([XF.store.exportJSON()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `x-account-flags-${new Date().toISOString().slice(0, 10)}.json`;
      root.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
    wrap.querySelector('[data-copy]').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(XF.store.exportJSON()); toast('Copied JSON to clipboard'); }
      catch { toast('Clipboard blocked. Use Export file instead.', 3000); }
    });
    const file = wrap.querySelector('[data-file]');
    wrap.querySelector('[data-import]').addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const mode = wrap.querySelector('[data-replace]').checked ? 'replace' : 'merge';
      try {
        const n = await XF.store.importJSON(await f.text(), mode);
        toast(`Imported ${n} account${n === 1 ? '' : 's'} (${mode})`);
        render();
      } catch (e) {
        toast('Import failed: ' + e.message, 3500);
      }
      file.value = '';
    });
    const clearBtn = wrap.querySelector('[data-clear]');
    clearBtn.addEventListener('click', async () => {
      if (clearBtn.dataset.armed) { await XF.store.clear(); render(); clearBtn.textContent = 'Delete all'; delete clearBtn.dataset.armed; return; }
      clearBtn.dataset.armed = '1';
      clearBtn.textContent = 'Really delete all?';
      setTimeout(() => { delete clearBtn.dataset.armed; clearBtn.textContent = 'Delete all'; }, 4000);
    });

    render();
    root.appendChild(wrap);
    search.focus();
  }

  XF.ui = { init, openModal, closeModal, showTooltip, scheduleHideTooltip, hideTooltip, openManager, closeManager, toast, updateLauncher, setLauncherVisible, applyTheme };
})();
