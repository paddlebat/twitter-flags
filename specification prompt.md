Build a Chrome/Brave extension (Manifest V3) that lets me attach notes and flags to X/Twitter accounts.

## Context
- I use X as a PWA installed from Brave. Content scripts run in the PWA window, but the extension toolbar icon is hard to reach there, so ALL UI must be injected into the page. No reliance on the action popup.
- I'll install it via brave://extensions → Developer mode → Load unpacked.
- Target x.com (also match twitter.com).
- Plain JS/CSS, no build step, no frameworks.

## Features

### 1. Note on block/mute
- When I confirm a Block or click Mute (from a tweet's "…" menu or a profile page), show a small modal:
  - Reason (free text, multiline)
  - Link (prefilled with the tweet URL if the action came from a tweet; editable)
  - Save / Skip buttons
- The modal must never interfere with the block/mute itself going through.

### 2. Manual flags (no block/mute/follow change)
- Add a "Flag account" item to the tweet "…" menu, and a small flag button on profile pages.
- Opens the same modal plus a flag type: Warning (yellow), Positive (green), Neutral (gray).
- Editing an existing flag opens the modal prefilled. Include a Delete option.

### 3. Display
- Wherever a flagged account's name/handle appears (timeline, replies, quote tweets, profile header, search, notifications), show a small colored badge next to it. 
- Hover/tap the badge → tooltip with flag type, note, link (clickable), and date.
- Blocked/muted entries get their own badge style (e.g. dark red "B" / "M") when visible.

### 4. Data
- TBD. Is there a way I can have this sync over multiple devices? unsure if that's worth it.

## Process
1. Briefly outline the file structure and approach, then build it.
2. Tell me how to load it and give a short manual test checklist (block from a tweet, mute from a profile, flag without action, badge appears in timeline, export/import).
3. Iterate with me on selector fixes