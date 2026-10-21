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

  // Ask X to close its menu/sheet/drawer. Escape first; then click the
  // backdrop if it is still open. `menuEl` is any element inside the overlay.
  function closeMenus(menuEl) {
    const ev = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true });
    (document.activeElement || document.body).dispatchEvent(ev);
    setTimeout(() => {
      const inner = (menuEl && menuEl.isConnected) ? menuEl : document.querySelector(sel.dropdown);
      if (!inner) return;
      const layer = inner.closest('#layers > *');
      if (!layer) return;
      for (const d of layer.querySelectorAll('div')) {
        if (d.contains(inner)) continue;
        const cs = getComputedStyle(d);
        if (cs.position === 'fixed' && d.offsetWidth >= innerWidth * 0.9) { d.click(); break; }
      }
    }, 60);
  }

  // `dropdown` is the menu container: the desktop dropdown or, on the phone
  // layout, the bottom sheet that holds the same Block/Mute items.
  function injectMenuItem(dropdown) {
    if (dropdown.querySelector('[data-testid="xf-flag"]')) return;
    const actionItem = dropdown.querySelector(sel.actionItems);
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
      closeMenus(dropdown);
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
    // Any Block/Mute item appearing means a menu about another account opened
    // (desktop dropdown or mobile bottom sheet). Inject next to it.
    const action = node.matches(sel.actionItems) ? node : node.querySelector(sel.actionItems);
    if (action) {
      const menu = action.closest('[role="menu"]') || action.closest(sel.dropdown) || action.parentElement;
      if (menu) { try { injectMenuItem(menu); } catch (e) { console.warn('[XF] menu inject', e); } }
    }
    try { injectDrawerItem(node); } catch (e) { console.warn('[XF] drawer inject', e); }
  }

  // Remember, per device, that the mobile drawer entry works so the floating
  // fallback button can stay hidden there.
  function drawerKnownGood() {
    try { return localStorage.getItem('xf_drawer_ok') === '1'; } catch { return false; }
  }
  function updateLauncherVisibility() {
    const sidebar = document.getElementById('xf-nav-item');
    XF.ui.setLauncherVisible(!(sidebar && sidebar.isConnected) && !drawerKnownGood());
  }

  // Clone a nav/drawer link into a "Flags" entry that opens the manager.
  function makeNavClone(template, label, testid) {
    const item = template.cloneNode(true);
    item.removeAttribute('id');
    item.setAttribute('data-testid', testid);
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
      spans[0].textContent = label;
      for (const s of spans.slice(1)) s.remove();
    } else {
      item.textContent = label;
    }
    return item;
  }

  // Mobile layout: the account drawer that slides in from the avatar. It is
  // rendered in #layers each time it opens, so this runs on every open.
  function injectDrawerItem(node) {
    const layers = document.querySelector(sel.layers);
    if (!layers || !layers.contains(node)) return;
    const scope = node.closest('#layers > *') || node;
    if (scope.querySelector('[data-testid="xf-drawer"]')) return;
    const template = scope.querySelector(sel.drawerLink);
    if (!template || template.closest(sel.primaryNav)) return;
    const item = makeNavClone(template, 'Flags', 'xf-drawer');
    item.id = 'xf-drawer-item';
    const open = (e) => { e.preventDefault(); e.stopPropagation(); closeMenus(template); setTimeout(() => XF.ui.openManager(), 80); };
    item.addEventListener('click', open, true);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }, true);
    template.parentNode.insertBefore(item, template.nextSibling);
    try { localStorage.setItem('xf_drawer_ok', '1'); } catch { /* ignore */ }
    updateLauncherVisibility();
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
    if (!nav) { if (existing) existing.remove(); updateLauncherVisibility(); return; }
    if (existing && existing.isConnected && nav.contains(existing)) { updateLauncherVisibility(); return; }
    if (existing) existing.remove();

    const template = nav.querySelector(sel.navProfileLink) || nav.querySelector(sel.navAnyLink);
    if (!template) { updateLauncherVisibility(); return; }

    const item = makeNavClone(template, 'Flags', 'xf-nav');
    item.id = 'xf-nav-item';
    const open = (e) => { e.preventDefault(); e.stopPropagation(); XF.ui.openManager(); };
    item.addEventListener('click', open, true);
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') open(e); }, true);

    const anchor = nav.querySelector(sel.navProfileLink);
    if (anchor && anchor.parentNode === nav) nav.insertBefore(item, anchor.nextSibling);
    else if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(item, anchor.nextSibling);
    else nav.appendChild(item);
    updateLauncherVisibility();
  }

  XF.hooks = { install, onAdded, ensureProfileButton, ensureNavItem, injectMenuItem };
})();
