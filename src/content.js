// Entry point: loads data, builds UI, and keeps badges/menu items in sync with X's SPA DOM.
(async () => {
  if (window.top !== window) return;
  try {
    await XF.store.load();
  } catch (e) {
    console.error('[XF] storage load failed', e);
    return;
  }
  XF.ui.init();
  try { XF.themeColor.start(); } catch (e) { console.warn('[XF] theme-color', e); }
  XF.badges.installEvents();
  XF.hooks.install();

  const fullPass = () => {
    XF.badges.scan(document.body);
    XF.hooks.ensureProfileButton();
    XF.hooks.ensureNavItem();
  };
  fullPass();

  const queue = new Set();
  let scheduled = false;
  const flush = () => {
    scheduled = false;
    const nodes = [...queue];
    queue.clear();
    for (const n of nodes) {
      if (!n.isConnected) continue;
      XF.badges.scan(n);
      XF.hooks.onAdded(n);
    }
    XF.hooks.ensureProfileButton();
    XF.hooks.ensureNavItem();
  };
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1 || XF.dom.isOurs(n)) continue;
        queue.add(n);
      }
    }
    if (queue.size && !scheduled) { scheduled = true; setTimeout(flush, 80); }
  });
  mo.observe(document.body, { childList: true, subtree: true });

  XF.store.onChange(() => {
    XF.badges.refreshAll();
    XF.hooks.ensureProfileButton();
    XF.ui.updateLauncher();
  });

  // Catch in-place React updates that reuse nodes without adding any.
  setInterval(fullPass, 3000);

  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname === lastPath) return;
    lastPath = location.pathname;
    XF.ui.hideTooltip(true);
    XF.hooks.ensureProfileButton();
  }, 400);
})();
