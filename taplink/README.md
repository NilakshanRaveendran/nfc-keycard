# Taplink — NFC link writer

A dependency-free, responsive PWA. Public files are in `dist/` (editable source; no build step).

## Run

`npm start` serves http://127.0.0.1:4173. `npm test` runs normalization and NFC adapter tests. `npm run zip` packages `dist/` as `taplink-dist.zip` for upload; zips are not committed.
Deploy `dist/` to HTTPS for phones. A plain HTTP LAN address will not enable Web NFC or service workers.

## Platform support

- Compatible Android browsers, notably Chrome: actual `NDEFReader.write()` of a URL record, permission handling, cancellation, 60-second timeout, and optional read-back verification. Requires NFC hardware, NFC enabled, and a writable NDEF tag with sufficient capacity.
- iOS/iPadOS: link preparation, copying, install instructions, and native NFC Tools handoff instructions. Safari/PWAs cannot directly write tags. A native iOS application using Core NFC is necessary for an integrated writer.
- Desktop: link preparation and copying. USB readers require compatible native software; a desktop browser alone is not an NFC writer.

## Links

There is one field: paste any `http`/`https` link (the `https://` is optional). Profile links for Instagram, YouTube, TikTok, Facebook, X, LinkedIn, Snapchat, Threads, WhatsApp, Telegram and GitHub are recognised (`PLATFORMS` in `dist/core.js`) and rewritten in canonical form, which drops tracking parameters. Every other link (videos, posts, any website) is written as given and labelled with its real host. Links with embedded credentials and non-http schemes are rejected. Long links show a size warning, since an NTAG213 holds about 137 bytes.

No account, analytics, database, API key, or profile persistence is used. URL formatting is validated, but account existence is not checked. Writing overwrites existing tag records; the app does not permanently lock tags. Write success means the browser's write promise resolved; verification requires a separate read. Cancellation cannot guarantee an already-started physical write was undone.

The service worker caches only app assets for offline use after a successful first load. An authentication redirect during precaching prevents offline installation; private hosting may require sign-in and should be checked on target devices. The linked site itself requires connectivity. Assets are fetched network-first and the cache is only the offline fallback, so deploys take effect on the next online load; bump the cache version when the asset list changes.

A feature-detected WebMCP `prepare_link` tool prepares the same visible form; it never starts an NFC write.

## Validation

Automated tests exercise link normalization for every platform, rejection of unsafe input, the size estimate, NDEF URL payload, awaited write completion, hardware rejection, read-back matching, and cancellation with injected NFC readers. These are mocks, not a claim of physical NFC testing. Test a real writable tag on an NFC-enabled Android phone before relying on the writer in production. Installability/offline operation should also be checked on actual target devices.
