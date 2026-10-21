# Cross-device sync: decision notes

Status: **undecided** (as of 2026-10-20). The extension stores data locally per browser for now. Export/import in the manager's Data & tools view is the manual way to move data.

## Constraint

Devices are Brave on the laptop and Firefox for Android on the phone. Browser-native sync (`chrome.storage.sync`, Firefox Sync) never crosses between Brave and Firefox, and Brave Sync does not carry extension data at all. So any sync needs an external store.

## Options considered

| Option | Summary | Verdict |
|---|---|---|
| 1. File in a **private GitHub repo** | Separate private repo (e.g. `twitter-flags-data`), one JSON file, fine-grained token limited to that repo. Free, truly private, history for undo. | **Recommended** |
| 2. Secret GitHub Gist | Slightly simpler API. But a secret gist is *unlisted, not private*: anyone with the URL can read it. Token must cover all gists. | Rejected unless encrypted |
| 3. Option 1 or 2 **plus passphrase encryption** | Data encrypted on device before upload; GitHub only stores ciphertext. One extra secret per device; losing it loses the synced copy (local data and exports remain). | **Recommended on top of 1** |
| 4. Google Drive / Dropbox / own server | Drive and Dropbox need OAuth flows, fiddly in extensions and especially Firefox Android. A small server (e.g. Cloudflare Worker) works but is more to run than the problem warrants. | Rejected |

## Recommended design

- **Store**: one file in a new private repo, written through GitHub's contents API.
- **Token**: fine-grained personal access token, scoped to that single repo, *Contents: read and write* only, with an expiry (e.g. 1 year). Entered once per device in Data & tools. Revoke on GitHub if a device is lost.
- **Encryption**: passphrase per device, key derived with PBKDF2 (high iteration count), data encrypted with AES-GCM via WebCrypto. GitHub sees only ciphertext.
- **Where the token is used**: only in a background script, never in the content script running inside x.com, so the token stays out of the page's process.
- **Timing**: sync on page load, a few seconds after the last local change (batched, so several edits become one commit), and every few minutes while X is open. Reads never create commits; writes happen only when data changed.
- **Merge**: per note, not per account, so notes added on different devices are all kept. Deletions recorded as tombstones so a removed account does not come back from the other device. Blocked/muted still follow X's real state.
- **History**: keep normal commit history (undo after an accidental Delete all). Alternative: replace a single commit each time for a tidy repo, losing history.
- **Permissions**: adds `api.github.com` to host permissions, so both browsers ask once. Check whether Mozilla's `data_collection_permissions` declaration needs updating, since data leaves the device (even if only to the user's own account).

## Commit volume

Not a concern. Edits are batched, nothing is written without changes, typically a handful of commits on an active day and none on most days. Files are a few KB; GitHub API limit is 5,000 requests/hour.

## Security and privacy notes

1. **Data at rest on GitHub.** A private repo protects against strangers but GitHub can read it, and a breach or legal request would expose it. Commit history keeps deleted notes. If the repo were ever made public by mistake, all history would be exposed. Encryption removes all three concerns, which is why it is recommended from the start.
2. **Token at rest on devices.** Extension storage is not encrypted on disk; anyone with access to an unlocked device could read the token. Narrow scope and expiry limit the damage; with encryption a leaked token exposes only ciphertext.
3. **Update channel is a trust root.** The phone auto-updates from the public repo's `updates.json`. A takeover of the GitHub account could publish a malicious version, though it would also need the Mozilla account to sign it. Keep two-factor authentication on both GitHub and Mozilla.
4. **Untrusted input.** Synced or imported data is treated as untrusted. Since 0.3.0, only `http`/`https` note links are kept; anything else (`javascript:`, `data:`) is dropped on load, import and save. All rendering escapes text.
5. **Public code.** The extension source is public; it contains no secrets. The token is only ever entered in the UI and stored in browser storage.

## Open questions before building

- Encrypt from the start? (Recommended: yes.)
- Keep history or single-commit mode? (Recommended: keep history.)
- Repo name for the data repo.

## Setup steps once decided

1. Create a private repo, e.g. `github.com/paddlebat/twitter-flags-data`.
2. GitHub → Settings → Developer settings → Fine-grained tokens → Generate: repository access *only that repo*, permission *Contents: read and write*, set an expiry.
3. Enable two-factor authentication on GitHub and addons.mozilla.org if not already on.
4. Build the sync feature (background script, settings section in Data & tools, merge with tombstones, encryption).
5. On each device: paste token and passphrase into Data & tools → Sync.
