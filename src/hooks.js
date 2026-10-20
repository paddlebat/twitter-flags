// Hooks into X's own UI: block/mute detection, "Flag account" menu item,
// and the flag button on profile headers.
window.XF = window.XF || {};
(() => {
  const { sel, handleFromText, tweetUrlFromArticle, profileHandleFromPath, profileHandleFromPage, isOurs } = XF.dom;
  const { FLAGS, norm } = XF.store;

  const FLAG_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18"><path fill="currentColor" d="M5 2h2v20H5z M7 3h11l-2.5 5 2.5 5H7z"/></svg>`;

  // Where the last "…" click came from, so we know which tweet to link.
  const ctx = { article: null, source: null, at: 0 };
  // A Block click waiting for its confirmation dialog.
  let pendingBlock = null;

  function ctxLink() {
    if (ctx.source === 'tweet' && ctx.article && ctx.article.isConnected && Date.now() - ctx.at < 120000) {
      return tweetUrlFromArticle(ctx.article);
    }
    return '';
  }

  function ctxHandle() {
    if (ctx.source === 'tweet' && ctx.article) {
      const g = ctx.article.querySelector(sel.tweetUserName);
      return g ? XF.badges.groupHandle(g) : null;
    }
    if (ctx.source === 'profile') return profileHandleFromPage();
    return null;
  }

  function install() {
    document.addEventListener('click', onClickCapture, true);
  }

  function onClickCapture(e) {
    const t = e.target instanceof Element ? e.target : null;
    if (!t || isOurs(t)) return;

    const caret = t.closest(sel.caret);
    if (caret) {
      ctx.article = caret.closest('article');
      ctx.source = ctx.article ? 'tweet' : 'other';
      ctx.at = Date.now();
      return;
    }
    if (t.closest(sel.userActions)) {
      ctx.article = null; ctx.source = 'profile'; ctx.at = Date.now();
      return;
    }

    const blockItem = t.closest(sel.block);
    if (blockItem) {
      pendingBlock = {
        handle: handleFromText(blockItem.textContent) || ctxHandle(),
        link: ctxLink(),
        at: Date.now(),
      };
      return;
    }

    const muteItem = t.closest(sel.mute);
    if (muteItem) {
      const handle = handleFromText(muteItem.textContent) || ctxHandle();
      const link = ctxLink();
      if (handle) setTimeout(() => XF.ui.openModal({ handle, mode: 'mute', link }), 400);
      return;
    }

    if (t.closest(sel.confirmYes)) {
      const p = pendingBlock;
      pendingBlock = null;
      if (p && p.handle && Date.now() - p.at < 120000) {
        setTimeout(() => XF.ui.openModal({ handle: p.handle, mode: 'block', link: p.link }), 400);
      }
      return;
    }
    if (t.closest(sel.confirmNo)) {
      pendingBlock = null;
    }
  }

  // Ask X to close its menu. Escape first; then click the backdrop if it is still open.
  function closeMenus() {
    const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    setTimeout(() => {
      const dd = document.querySelector(sel.dropdown);
      if (!dd) return;
      const layer = dd.closest('#layers > *');
      if (!layer) return;
      for (const d of layer.querySelectorAll('div')) {
        if (d.contains(dd)) continue;
        const cs = getComputedStyle(d);
        if (cs.position === 'fixed' && d.offsetWidth >= innerWidth * 0.9) { d.click(); break; }
      }
    }, 60);
  }

  function injectMenuItem(dropdown) {
    if (dropdown.querySelector('[data-testid="xf-flag"]')) return;
    const actionItem = dropdown.querySelector(`${sel.block}, ${sel.unblock}, ${sel.mute}, ${sel.unmute}`);
    if (!actionItem) return; // not a menu about another account
    const handle = handleFromText(actionItem.textContent) || ctxHandle();
    if (!handle) return;
    const existing = XF.store.get(handle);
    const label = existing ? `Edit flag for @${handle}` : `Flag @${handle}`;

    const template = dropdown.querySelector(sel.menuItem);
    let item;
    if (template) {
      item = template.cloneNode(true);
      item.removeAttribute('id');
      for (const n of item.querySelectorAll('[id]')) n.removeAttribute('id');
      const svg = item.querySelector('svg');
      if (svg) {
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.innerHTML = '<g><path d="M5 2h2v20H5z M7 3h11l-2.5 5 2.5 5H7z"></path></g>';
      }
      const spans = [...item.querySelectorAll('span')].filter((s) => !s.children.length && s.textContent.trim());
      if (spans.length) {
        spans[0].textContent = label;
        for (const s of spans.slice(1)) s.remove();
      } else {
        item.textContent = label;
      }
    } else {
      item = document.createElement('div');
      item.setAttribute('role', 'menuitem');
      item.className = 'xf-menu-item--plain';
      item.innerHTML = `${FLAG_SVG}<span></span>`;
      item.querySelector('span').textContent = label;
    }
    item.setAttribute('data-testid', 'xf-flag');
    item.setAttribute('data-xf-ui', '1');
    item.setAttribute('tabindex', '0');
    if (existing) item.classList.add(`xf-menu-item--${existing.flag}`);

    const link = ctxLink();
    const activate = (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeMenus();
      setTimeout(() => XF.ui.openModal({ handle, mode: 'flag', link, existing: XF.store.get(handle) }), 80);
    };
    item.addEventListener('click', activate, true);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') activate(e); }, true);

    const anchor = actionItem.closest(`${sel.menuItem}, [role="menuitem"]`) || template;
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(item, anchor);
    else dropdown.appendChild(item);
  }

  function onAdded(node) {
    if (node.nodeType !== 1 || isOurs(node)) return;
    const dd = node.matches(sel.dropdown) ? node : node.querySelector(sel.dropdown);
    if (dd) { try { injectMenuItem(dd); } catch (e) { console.warn('[XF] menu inject', e); } }
  }

  function ensureProfileButton() {
    const pathHandle = profileHandleFromPath();
    const actions = document.querySelector(sel.userActions);
    const existingBtn = document.getElementById('xf-profile-btn');
    if (!pathHandle || !actions) { if (existingBtn) existingBtn.remove(); return; }
    const handle = profileHandleFromPage() || pathHandle;
    const entry = XF.store.get(handle);
    const flag = entry ? entry.flag : '';
    if (existingBtn && existingBtn.isConnected && existingBtn.nextElementSibling === actions
        && existingBtn.dataset.handle === norm(handle) && existingBtn.dataset.flag === flag) return;
    if (existingBtn) existingBtn.remove();

    const btn = document.createElement('button');
    btn.id = 'xf-profile-btn';
    btn.type = 'button';
    btn.setAttribute('data-xf-ui', '1');
    btn.className = 'xf-profile-btn' + (entry ? ` xf-profile-btn--${flag}` : '');
    btn.dataset.handle = norm(handle);
    btn.dataset.flag = flag;
    btn.title = entry ? `Edit flag (${FLAGS[flag].label})` : `Flag @${handle}`;
    btn.setAttribute('aria-label', btn.title);
    btn.innerHTML = FLAG_SVG;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      XF.ui.openModal({ handle, mode: 'flag', existing: XF.store.get(handle) });
    }, true);
    actions.parentNode.insertBefore(btn, actions);
  }

  // "Flags" entry in the left sidebar nav, cloned from the Profile link so it
  // picks up X's styling and the icon-only collapse at narrow widths.
  function ensureNavItem() {
    const nav = document.querySelector(sel.primaryNav);
    const existing = document.getElementById('xf-nav-item');
    if (!nav) { if (existing) existing.remove(); XF.ui.setLauncherVisible(true); return; }
    if (existing && existing.isConnected && nav.contains(existing)) { XF.ui.setLauncherVisible(false); return; }
    if (existing) existing.remove();

    const template = nav.querySelector(sel.navProfileLink) || nav.querySelector(sel.navAnyLink);
    if (!template) { XF.ui.setLauncherVisible(true); return; }

    const item = template.cloneNode(true);
    item.id = 'xf-nav-item';
    item.setAttribute('data-testid', 'xf-nav');
    item.setAttribute('data-xf-ui', '1');
    item.setAttribute('href', '#');
    item.setAttribute('aria-label', 'Account flags');
    item.removeAttribute('aria-current');
    for (const n of item.querySelectorAll('[id]')) n.removeAttribute('id');
    const svg = item.querySelector('svg');
    if (svg) {
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.innerHTML = '<g><path d="M5 2h2v20H5z M7 3h11l-2.5 5 2.5 5H7z"></path></g>';
    }
    const spans = [...item.querySelectorAll('span')].filter((s) => !s.children.length && s.textContent.trim());
    if (spans.length) {
      spans[0].textContent = 'Flags';
      for (const s of spans.slice(1)) s.remove();
    }
    const open = (e) => { e.preventDefault(); e.stopPropagation(); XF.ui.openManager(); };
    item.addEventListener('click', open, true);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }, true);

    const anchor = nav.querySelector(sel.navProfileLink);
    if (anchor && anchor.parentNode === nav) nav.insertBefore(item, anchor.nextSibling);
    else if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(item, anchor.nextSibling);
    else nav.appendChild(item);
    XF.ui.setLauncherVisible(false);
  }

  XF.hooks = { install, onAdded, ensureProfileButton, ensureNavItem, injectMenuItem };
})();
