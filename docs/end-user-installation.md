# End-User Installation Guide

This guide covers manual installation for:

- Chrome
- Edge
- Firefox
- Safari (macOS)

If official store listings are available, installing from each browser store is recommended over manual installation.
Store listing placeholders are in `README.md` under `Store install links`.

## Install files you need

Use one of these sources:

- GitHub Actions artifacts from `.github/workflows/build-extensions.yml`
- Local build output from:

```bash
npm install
npm run build:webext
npm run build:safari
```

Relevant outputs:

- `dist/chrome/unpacked`
- `dist/edge/unpacked`
- `dist/firefox/unpacked`
- `dist/firefox/crunchy-watchlist-curator-firefox.xpi`
- `dist/safari/crunchy-watchlist-curator-safari-macos-app.zip`

## Chrome (manual unpacked install)

1. Open `chrome://extensions`.
2. Enable `Developer mode` (top-right).
3. Click `Load unpacked`.
4. Select `dist/chrome/unpacked`.
5. Confirm the extension is enabled.

To update manually after a new build:

1. Rebuild artifacts.
2. Open `chrome://extensions`.
3. Click `Reload` on Crunchy Watchlist Curator.

## Edge (manual unpacked install)

1. Open `edge://extensions`.
2. Enable `Developer mode` (left sidebar).
3. Click `Load unpacked`.
4. Select `dist/edge/unpacked`.
5. Confirm the extension is enabled.

To update manually after a new build:

1. Rebuild artifacts.
2. Open `edge://extensions`.
3. Click `Reload` on Crunchy Watchlist Curator.

## Firefox

### Option A: Temporary install (developer mode)

This is best for local testing and usually resets after Firefox restart.

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Choose `dist/firefox/unpacked/manifest.json` (or any file in that folder).
4. Confirm the extension appears in the temporary add-ons list.

### Option B: Signed `.xpi` install

Use a signed package (`.xpi`) for persistent end-user installation.
Unsigned `.xpi` files are typically blocked in standard Firefox releases.

1. Open Firefox Add-ons Manager (`about:addons`) or drag-and-drop the signed `.xpi` into Firefox.
2. Approve installation prompts.

## Safari (macOS)

Safari web extensions are distributed through a macOS app wrapper.

1. Build or download `dist/safari/crunchy-watchlist-curator-safari-macos-app.zip`.
2. Unzip and move `Crunchy Watchlist Curator.app` to `Applications`.
3. Open the app once.
4. Open Safari, then go to `Safari > Settings > Extensions`.
5. Enable `Crunchy Watchlist Curator`.

Notes:

- Unsigned app builds may be blocked by Gatekeeper on end-user systems.
- For broad end-user distribution, use signed/notarized release builds.

## Local Safari testing workflow

For development testing on macOS:

1. Build the local wrapper:

   ```bash
   npm run build:safari
   ```

2. Unzip the wrapper:

   ```bash
   unzip -q dist/safari/crunchy-watchlist-curator-safari-macos-app.zip -d /tmp/cw-safari
   ```

3. Remove strict Gatekeeper flags (unsigned test build only):

   ```bash
   xattr -dr com.apple.quarantine /tmp/cw-safari/"Crunchy Watchlist Curator.app"
   ```

4. Replace your existing test copy and launch:

   ```bash
   rm -rf "/Applications/Crunchy Watchlist Curator.app"
   cp -R "/tmp/cw-safari/Crunchy Watchlist Curator.app" /Applications/
   open "/Applications/Crunchy Watchlist Curator.app"
   ```

5. In Safari, go to `Safari > Settings > Extensions` and enable the extension.

6. Open `https://www.crunchyroll.com/watchlist` and verify the `Curated` tab.

For faster iteration without re-running manual install every time, open the Xcode project and run the `Crunchy Watchlist Curator (macOS)` scheme directly:

```bash
open "Crunchy Watchlist Curator/Crunchy Watchlist Curator.xcodeproj"
```

Build and run from Xcode on `My Mac`, then use Safari extension toggles to pick up each build.

Use Console.app and Safari Extensions logs for runtime debugging when behavior differs from test expectations.

## Verify installation

1. Visit `https://www.crunchyroll.com/watchlist`.
2. Confirm `Curated` tab is visible.
3. Switch between `Crunchyroll` and `Curated` tabs.
4. Verify filters and sort controls appear and respond.

## Uninstall

- Chrome: `chrome://extensions` > Remove.
- Edge: `edge://extensions` > Remove.
- Firefox: `about:addons` or `about:debugging` > Remove.
- Safari: disable in Safari Extensions settings and remove app if desired.
