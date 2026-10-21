// Keeps <meta name="theme-color"> matched to the page's real background, so
// the phone's status and navigation bars follow X's Dim / Lights out / light
// theme. X sets this tag from its own logic, which can pick light in dark mode.
// Unrelated to flags; kept in its own file so it is easy to remove.
window.XF = window.XF || {};
(() => {
  let applying = false;

  function pageBackground() {
    const pick = (el) => {
      if (!el) return null;
      const c = getComputedStyle(el).backgroundColor;
      return c && c !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(c) ? c : null;
    };
    return pick(document.body) || pick(document.documentElement);
  }

  function toHex(rgb) {
    const m = (rgb || '').match(/\d+/g);
    if (!m || m.length < 3) return null;
    return '#' + m.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('');
  }

  function sync() {
    const hex = toHex(pageBackground());
    if (!hex) return;
    let metas = [...document.querySelectorAll('meta[name="theme-color"]')];
    if (!metas.length) {
      const m = document.createElement('meta');
      m.name = 'theme-color';
      document.head.appendChild(m);
      metas = [m];
    }
    applying = true;
    for (const m of metas) {
      // Drop the light/dark media split so our colour applies regardless of
      // what the OS reports.
      if (m.hasAttribute('media')) m.removeAttribute('media');
      if (m.getAttribute('content') !== hex) m.setAttribute('content', hex);
    }
    applying = false;
  }

  function start() {
    sync();
    // X rewrites the tag when its theme changes; put ours back.
    new MutationObserver(() => { if (!applying) sync(); })
      .observe(document.head, { subtree: true, childList: true, attributes: true, attributeFilter: ['content', 'media'] });
    // Theme switches change body background without touching the tag.
    setInterval(sync, 3000);
  }

  XF.themeColor = { start, sync };
})();
