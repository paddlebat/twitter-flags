// Finds account names/handles in X's DOM and places a badge next to flagged ones.
window.XF = window.XF || {};
(() => {
  const { sel, handleFromHref, handleFromText, isOurs } = XF.dom;
  const { FLAGS, norm } = XF.store;

  function makeBadge(entry) {
    const b = document.createElement('span');
    b.className = `xf-badge xf-badge--${entry.flag}`;
    b.dataset.xfHandle = norm(entry.handle);
    b.innerHTML = XF.dom.badgeSVG(entry.flag, 16);
    b.setAttribute('role', 'button');
    b.setAttribute('tabindex', '0');
    b.setAttribute('aria-label', `${FLAGS[entry.flag].label} flag for @${entry.handle}`);
    return b;
  }

  function groupHandle(group) {
    for (const a of group.querySelectorAll('a[href]')) {
      const h = handleFromHref(a.href);
      if (h) return h;
    }
    return handleFromText(group.textContent);
  }

  // Prefer the display-name link (text not starting with "@") that has no avatar image.
  function anchorForBadge(group, handle) {
    const key = handle.toLowerCase();
    const anchors = [...group.querySelectorAll('a[href]')]
      .filter((a) => (handleFromHref(a.href) || '').toLowerCase() === key && !a.querySelector('img'));
    return anchors.find((a) => !a.textContent.trim().startsWith('@')) || anchors[0] || null;
  }

  // Deepest element whose own text is the display name (profile header has no name link).
  function nameLeaf(group) {
    const walker = document.createTreeWalker(group, NodeFilter.SHOW_ELEMENT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.children.length) continue;
      const t = n.textContent.trim();
      if (t && !t.startsWith('@') && !n.closest('.xf-badge')) return n;
    }
    return null;
  }

  function placeInGroup(group) {
    const handle = groupHandle(group);
    const key = handle ? norm(handle) : '';
    let existingBadge = null;
    for (const b of group.querySelectorAll('.xf-badge')) {
      if (b.closest(sel.nameGroups) === group) { existingBadge = b; break; }
    }
    const entry = key ? XF.store.get(key) : null;
    if (existingBadge) {
      if (entry && existingBadge.dataset.xfHandle === key && existingBadge.classList.contains(`xf-badge--${entry.flag}`)) return;
      existingBadge.remove();
    }
    group.dataset.xfBadged = key;
    if (!entry) return;
    const badge = makeBadge(entry);
    const a = anchorForBadge(group, handle);
    if (a) {
      // The name link's first child is the flex row holding the name and the
      // verified check. Appending there keeps the badge on the same line.
      const row = a.firstElementChild && a.firstElementChild.tagName !== 'SPAN' ? a.firstElementChild : a;
      row.appendChild(badge);
      return;
    }
    const leaf = nameLeaf(group);
    if (leaf) {
      // Profile header: put the badge after the verified check when there is
      // one. Climb from the icon to the sibling that sits beside the name.
      const svg = group.querySelector('svg');
      if (svg && (leaf.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING)) {
        let target = svg;
        while (target.parentElement && !target.parentElement.contains(leaf)) target = target.parentElement;
        target.insertAdjacentElement('afterend', badge);
      } else {
        leaf.insertAdjacentElement('afterend', badge);
      }
      return;
    }
    group.appendChild(badge);
  }

  // Links to a profile that sit outside a name group: mentions in post text,
  // "X reposted", notification lines, etc.
  function placeStandalone(a) {
    if (isOurs(a) || a.closest(sel.nameGroups)) return;
    // Profile tabs ("Posts") and nav links point at /handle too; skip them.
    if (a.getAttribute('role') === 'tab' || a.closest('[role="tablist"], nav, [role="navigation"], header')) return;
    // Notification summary lines ("A and B liked your post"): a badge there
    // breaks the sentence onto two lines. Posts shown on the notifications
    // page still get badges through their name blocks, and @mentions inside
    // post text are kept.
    if (a.closest('[data-testid="notification"]')) return;
    if (location.pathname.startsWith('/notifications') && !a.closest('[data-testid="tweetText"]')) return;
    const h = handleFromHref(a.href);
    if (!h) return;
    if (a.querySelector('img') || !a.textContent.trim()) return;
    const key = norm(h);
    const entry = XF.store.get(key);
    const next = a.nextElementSibling;
    if (next && next.classList.contains('xf-badge')) {
      if (entry && next.dataset.xfHandle === key && next.classList.contains(`xf-badge--${entry.flag}`)) return;
      next.remove();
    }
    if (!entry) return;
    a.insertAdjacentElement('afterend', makeBadge(entry));
  }

  function scan(root) {
    if (!XF.store.isEnabled()) return;
    if (!root || root.nodeType !== 1) return;
    if (isOurs(root)) return;
    const groups = root.matches(sel.nameGroups) ? [root] : [];
    groups.push(...root.querySelectorAll(sel.nameGroups));
    for (const g of groups) { try { placeInGroup(g); } catch (e) { console.warn('[XF] badge group', e); } }
    const anchors = root.matches('a[href]') ? [root] : [];
    anchors.push(...root.querySelectorAll('a[href]'));
    for (const a of anchors) { try { placeStandalone(a); } catch (e) { console.warn('[XF] badge anchor', e); } }
  }

  function clearAll() {
    for (const b of document.querySelectorAll('.xf-badge')) b.remove();
    for (const g of document.querySelectorAll('[data-xf-badged]')) delete g.dataset.xfBadged;
  }

  function refreshAll() {
    clearAll();
    scan(document.body);
  }

  function installEvents() {
    const badgeOf = (e) => (e.target && e.target.closest ? e.target.closest('.xf-badge') : null);
    document.addEventListener('mouseover', (e) => {
      const b = badgeOf(e);
      if (b) XF.ui.showTooltip(b, XF.store.get(b.dataset.xfHandle));
    });
    document.addEventListener('mouseout', (e) => {
      if (badgeOf(e)) XF.ui.scheduleHideTooltip();
    });
    // Capture + stop so the tweet's own click handler does not navigate.
    document.addEventListener('click', (e) => {
      const b = badgeOf(e);
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      XF.ui.showTooltip(b, XF.store.get(b.dataset.xfHandle), true);
    }, true);
    document.addEventListener('keydown', (e) => {
      const b = badgeOf(e);
      if (b && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault(); e.stopPropagation();
        XF.ui.showTooltip(b, XF.store.get(b.dataset.xfHandle), true);
      }
    }, true);
  }

  XF.badges = { scan, refreshAll, clearAll, installEvents, groupHandle };
})();
