// Every X/Twitter selector and page parser lives here so selector fixes are
// a one-file job.
window.XF = window.XF || {};
(() => {
  const sel = {
    tweet: 'article[data-testid="tweet"]',
    caret: '[data-testid="caret"]',               // "…" button on a tweet
    userActions: '[data-testid="userActions"]',   // "…" button on a profile header
    dropdown: '[data-testid="Dropdown"]',         // the opened menu
    menuItem: 'div[role="menuitem"]',
    block: '[data-testid="block"]',
    unblock: '[data-testid="unblock"]',
    mute: '[data-testid="mute"]',
    unmute: '[data-testid="unmute"]',
    confirmDialog: '[data-testid="confirmationSheetDialog"]',
    confirmYes: '[data-testid="confirmationSheetConfirm"]',
    confirmNo: '[data-testid="confirmationSheetCancel"]',
    tweetUserName: '[data-testid="User-Name"]',   // name + handle block in a tweet / quote
    profileUserName: '[data-testid="UserName"]',  // name + handle block in a profile header
    userCell: '[data-testid="UserCell"]',         // rows in follower lists, search people, who to follow
    nameGroups: '[data-testid="User-Name"], [data-testid="UserName"], [data-testid="UserCell"]',
    primaryNav: 'header[role="banner"] nav[role="navigation"]',   // left sidebar: Home, Explore, …
    navProfileLink: '[data-testid="AppTabBar_Profile_Link"]',    // template + insertion point
    navAnyLink: 'a[data-testid^="AppTabBar_"]',
  };

  // Top-level paths that look like handles but are not profiles.
  const RESERVED = new Set([
    'home', 'explore', 'notifications', 'messages', 'i', 'settings', 'search',
    'compose', 'login', 'logout', 'signup', 'about', 'privacy', 'tos', 'help',
    'jobs', 'download', 'intent', 'hashtag', 'share', 'account', 'lists',
    'bookmarks', 'communities', 'premium', 'premium_sign_up', 'verified', 'topics',
    'grok', 'business', 'en', 'es', 'ja', 'rules', 'who_to_follow', 'connect_people',
    'explore', 'moments', 'places', 'oauth', 'tweets', 'status', 'statuses',
  ]);

  function handleFromPath(pathname) {
    const m = /^\/([A-Za-z0-9_]{1,15})\/?$/.exec(pathname || '');
    if (!m) return null;
    if (RESERVED.has(m[1].toLowerCase())) return null;
    return m[1];
  }

  function handleFromHref(href) {
    try {
      const u = new URL(href, location.origin);
      if (u.origin !== location.origin) return null;
      return handleFromPath(u.pathname);
    } catch {
      return null;
    }
  }

  function handleFromText(text) {
    const m = /@([A-Za-z0-9_]{1,15})(?![A-Za-z0-9_])/.exec(text || '');
    return m ? m[1] : null;
  }

  const PROFILE_TABS = new Set([
    'with_replies', 'media', 'likes', 'highlights', 'articles', 'affiliates', 'superfollows',
  ]);

  function profileHandleFromPath(pathname = location.pathname) {
    const parts = pathname.split('/').filter(Boolean);
    if (!parts.length || parts.length > 2) return null;
    if (parts.length === 2 && !PROFILE_TABS.has(parts[1])) return null;
    return handleFromPath('/' + parts[0]);
  }

  function profileHandleFromPage() {
    const el = document.querySelector(sel.profileUserName);
    const fromText = el && handleFromText(el.textContent);
    return fromText || profileHandleFromPath();
  }

  function tweetUrlFromArticle(article) {
    if (!article) return '';
    const t = article.querySelector('a[href*="/status/"] time');
    const a = t && t.closest('a');
    if (a) {
      try { return new URL(a.getAttribute('href'), location.origin).href; } catch { /* fall through */ }
    }
    // Focal tweet on a status page has no permalink anchor on its timestamp.
    if (article.getAttribute('tabindex') === '-1' && /\/status\/\d+/.test(location.pathname)) {
      return location.origin + location.pathname;
    }
    return '';
  }

  // Badge artwork: circle + symbol in one 16x16 SVG, so the symbol is centred
  // geometrically instead of sitting on a text baseline.
  const BADGE_COLORS = { warning: '#e3b341', positive: '#2e9e5b', neutral: '#7a7f85', blocked: '#8b1a1a', muted: '#a0423b' };
  const BADGE_GLYPHS = {
    warning: '<rect x="7" y="3.5" width="2" height="6" rx="1" fill="#1a1a1a"/><circle cx="8" cy="12" r="1.25" fill="#1a1a1a"/>',
    positive: '<path d="M7 4h2v3h3v2H9v3H7V9H4V7h3z" fill="#fff"/>',
    neutral: '<circle cx="8" cy="8" r="2.4" fill="#fff"/>',
    blocked: '<text x="8" y="8.6" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="10.5" font-weight="700" fill="#fff">B</text>',
    muted: '<text x="8" y="8.6" text-anchor="middle" dominant-baseline="central" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif" font-size="10.5" font-weight="700" fill="#fff">M</text>',
  };
  function badgeSVG(flag, size = 16) {
    const color = BADGE_COLORS[flag] || BADGE_COLORS.neutral;
    const glyph = BADGE_GLYPHS[flag] || BADGE_GLYPHS.neutral;
    return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" aria-hidden="true" focusable="false"><circle cx="8" cy="8" r="8" fill="${color}"/>${glyph}</svg>`;
  }

  function isOurs(el) {
    return !!(el && el.closest && el.closest('#xf-root, .xf-badge, [data-xf-ui]'));
  }

  XF.dom = {
    sel, handleFromPath, handleFromHref, handleFromText,
    profileHandleFromPath, profileHandleFromPage, tweetUrlFromArticle, isOurs, badgeSVG,
  };
})();
