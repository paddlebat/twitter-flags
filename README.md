# X Account Flags

Chrome/Brave extension (Manifest V3) that attaches private notes and flags to X/Twitter accounts.
All UI is injected into the page, so it works inside the X PWA window where the toolbar icon is out of reach.
Plain JS/CSS, no build step.

## Load it

1. Open `brave://extensions` (or `chrome://extensions`).
2. Turn on **Developer mode** (top right).
3. **Load unpacked** → pick this folder (the one containing `manifest.json`).
4. Reload any open x.com tab or PWA window. A **Flags** entry appears in the left sidebar under Profile; that is the manager (list / export / import). A faint ⚑ button bottom-left is the fallback on layouts without the sidebar.

After editing code: click the reload icon on the extension card, then reload the x.com page.

## What it does

| Where | What |
|---|---|
| Post "…" menu, profile "…" menu | **Flag @handle** / **Edit flag for @handle** item (only in menus that also contain Block/Mute, i.e. other people's accounts) |
| Profile header | Small ⚑ button to the left of the "…" button. Coloured when the account is flagged. |
| Block → confirm | After X's own confirmation, a modal asks for a reason and link (prefilled with the post URL when started from a post). Save or Skip. |
| Mute | Same modal right after the click. |
| Existing blocks/mutes | Visiting a profile that shows X's "Blocked" or unmute button, or opening a "…" menu that offers Unblock or Unmute, records it as blocked/muted, so older blocks get a badge. Never overrides a Warning/Positive/Neutral flag. |
| Blocked / muted entries | Type is fixed in the modal and they can't be deleted from the extension; only unblocking/unmuting on X clears them. Notes stay editable. |
| Unblock / unmute | Resets the entry: becomes Neutral if it has notes, removed if not. Also reconciles when a menu shows plain "Block"/"Mute" or a profile shows Follow for an entry still marked blocked/muted. |
| Everywhere a name/handle appears | Badge: `!` yellow warning, `+` green positive, `•` gray neutral, `B` / `M` dark red for blocked/muted. Hover or click for all notes with links and dates, and an Edit button. |
| **Flags** in the left sidebar (or ⚑ bottom-left fallback) | Search, edit and delete flags. The gear opens **Data & tools**: Export file, Copy JSON, Import (merge or replace), Copy debug info, Delete all. |

Links in the tooltip and manager open inside the X app (no new window) when they point at x.com; ⌘/Ctrl-click still opens a new tab. Other sites open in a new window.

Modal shortcuts: `⌘/Ctrl+Enter` saves, `Esc` skips/cancels. The modal never blocks X's own block/mute; it opens ~400 ms after X handled the click.

## Data

Stored in `chrome.storage.local` under one key (`xf_accounts`). One entry per handle, with one flag colour and any number of notes:

```json
{
  "handle": "SomeOne", "flag": "warning",
  "notes": [
    { "id": "…", "text": "…", "link": "https://x.com/…", "createdAt": "…", "updatedAt": "…" }
  ],
  "createdAt": "…", "updatedAt": "…"
}
```

In the modal, each note is a card with its own text and link. "+ Add note" appends one, ✕ removes one, and changes apply on Save. A block or mute always opens with a fresh card so the new reason lands as its own note. Older single-note data (and v1 exports) migrate automatically.

Export produces a JSON file you can import on another device. Import merges by default (newer `updatedAt` wins) or replaces everything when the checkbox is ticked.

Cross-device sync is not built yet; options, a recommended design and security notes are in `docs/sync-decision.md`.

Sync: Brave Sync does not carry extension storage, and `chrome.storage.sync` behaves like local storage in Brave, so there is no free cross-device sync. The storage backend is isolated in `src/storage.js` (one `area` constant) if you want to try `chrome.storage.sync` in Chrome (100 KB quota, ~500 small entries) or wire up something else later.

## Android (Firefox)

Brave and Chrome on Android cannot load extensions (Brave is building it, but it is not shipped). Firefox for Android installs a signed add-on from a file and auto-updates it from a URL, so that is the phone route.

One-time setup:

1. **GitHub repo.** Push this folder to `github.com/paddlebat/twitter-flags` (public, so the raw `updates.json` URL works). If the repo name or user differs, change `update_url` in `manifest.json` and the links in `updates.json`.
2. **Mozilla add-on account.** Sign in at https://addons.mozilla.org/developers/ (free).
3. **Firefox on the phone.** Settings → About Firefox → tap the logo five times. "Install extension from file" now appears under Settings.

Each release:

1. Bump `"version"` in `manifest.json` and run `./build.sh` → `dist/x-account-flags-<version>.zip`.
2. On addons.mozilla.org → Submit a New Add-on → **On your own** (self-distributed) → upload the zip. Signing is automatic and takes a minute; download the signed `.xpi`.
3. Create a GitHub release tagged `v<version>` and attach the `.xpi` named `x_account_flags-<version>.xpi`.
4. Add the version to `updates.json` (newest last) with its release download link, commit, push.

First install on the phone: open the `.xpi` link from the GitHub release in Firefox, or download it and use "Install extension from file". Approve access to x.com when asked. After that, Firefox checks `updates.json` on its own and installs new versions; Settings → Extensions → the add-on → "Check for updates" forces it.

Notes:
- The phone layout has no sidebar. The manager is a **Flags** entry in the account drawer (tap your avatar). The floating ⚑ button shows until that drawer entry has been tapped once on the device.
- The phone layout is X's responsive mode: narrow a desktop window below ~500px to reproduce it with DevTools.
- `host_permissions` is listed in the manifest so Firefox asks for x.com access at install instead of leaving it off. Chromium shows the same request.
- `web-ext lint --self-hosted` passes (needs Node 18+; `~/.nvm/versions/node/v20.20.1/bin` has one). The innerHTML warnings it prints are advisory; all dynamic values go through the escape helper in `ui.js`.

## Manual test checklist

1. **Block from a post**: "…" on someone's post → Block → confirm. Modal appears with the post URL in Link. Type a reason, Save. The account is actually blocked (X shows its toast) and a `B` badge appears on their name wherever it is still visible.
2. **Mute from a profile**: open a profile → "…" → Mute. Modal appears immediately (Link empty). Skip. No entry is created. Repeat and Save: `M` badge next to the profile name.
3. **Flag without action**: "…" on a post → **Flag @handle** → pick Warning, add a note, Save. The menu closes, the post is not affected, and a yellow `!` badge appears next to the name. Open "…" again: the item now says **Edit flag**, opens prefilled, and has Delete. Click **+ Add note**, write a second one, Save, and check the tooltip lists both with dates.
4. **Profile flag button**: on a profile, click ⚑ left of "…". Flag as Positive. The button turns green; the header name gets a `+` badge.
5. **Badge in timeline**: scroll Home / search / notifications / a thread with replies / a quote of the flagged account. Badge shows next to the name in each. Hover shows the tooltip with the link clickable; click pins it; click elsewhere closes it.
6. **Export/import**: sidebar **Flags** → gear → Export file (downloads `x-account-flags-YYYY-MM-DD.json`) → Delete all → Import file… → entries and badges come back.
7. **Two windows**: with the PWA and a browser tab both open, flag in one; the badge appears in the other within a few seconds.
8. **Theme**: switch X between Light / Dim / Lights out; the modal and tooltip follow.

## Selector map (for fixes)

Everything DOM-specific is in `src/dom.js`:

| Purpose | Selector |
|---|---|
| Post "…" button | `[data-testid="caret"]` |
| Profile "…" button | `[data-testid="userActions"]` |
| Opened menu | `[data-testid="Dropdown"]` (desktop) or whatever `[role="menu"]`/parent holds the Block/Mute item (mobile sheet) |
| Mobile account drawer | `[role="dialog"]` inside `#layers`; rows are `a[href]` containing `svg[data-testid="icon"]`, first is Profile; fallback `a[data-testid="settings"]` |
| Block / Mute items | `[data-testid="block"]`, `[data-testid="mute"]` (handle parsed from item text `… @handle`) |
| Block confirmation | `[data-testid="confirmationSheetConfirm"]` / `…Cancel` |
| Name block in posts | `[data-testid="User-Name"]` |
| Name block in profile header | `[data-testid="UserName"]` |
| Rows in people lists | `[data-testid="UserCell"]` |
| Post permalink | `a[href*="/status/"] time` inside `article` |
| Sidebar nav | `header[role="banner"] nav[role="navigation"]`, template `[data-testid="AppTabBar_Profile_Link"]` |

If a badge or menu item fails to show, open DevTools on x.com, inspect the element, and check which of these changed.

## Files

```
manifest.json      MV3 manifest, content scripts only
src/storage.js     chrome.storage.local wrapper, export/import, change events
src/dom.js         X selectors and handle/URL parsers
src/ui.js          Shadow DOM: modal, tooltip, manager panel, launcher, toasts
src/badges.js      Finds names/handles, places badges, tooltip events
src/hooks.js       Block/mute detection, "Flag account" menu item, profile button
src/content.js     Entry: MutationObserver, periodic rescans, URL change handling
src/content.css    Badge, menu item and profile button styles (inside X's DOM)
build.sh           Zips manifest + src into dist/ for upload
updates.json       Firefox self-hosted update manifest (served raw from GitHub)
```
