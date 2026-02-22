# Release Checklist

Use this checklist for each public release across Chrome, Edge, Firefox, and Safari.

## 1) Release planning

- [ ] Decide release version (for example `0.2.0`).
- [ ] Summarize user-facing changes and known limitations.
- [ ] Confirm extension/store IDs are stable and documented.
- [ ] Confirm support matrix (browser versions and macOS version for Safari).

## 2) Versioning and docs

- [ ] Update `version` in `/Users/matthewfrench/GitHub/Crunchy-Watchlist/extension/manifest.json`.
- [ ] Verify `/Users/matthewfrench/GitHub/Crunchy-Watchlist/README.md` is accurate for install/build/test steps.
- [ ] Verify `/Users/matthewfrench/GitHub/Crunchy-Watchlist/docs/end-user-installation.md` is accurate for end users.
- [ ] Update changelog/release notes (if maintained externally, prepare text now).

## 3) Local quality gates

- [ ] `npm install`
- [ ] `npm run lint:firefox`
- [ ] `npm run test:e2e`
- [ ] `npm run build:webext`
- [ ] `npm run build:safari` (on macOS with Xcode)

## 4) CI quality gates

- [ ] Ensure `.github/workflows/build-extensions.yml` passes on the target commit.
- [ ] Verify CI uploaded artifacts: `extension-chrome`, `extension-edge`, `extension-firefox`, `extension-safari`.
- [ ] Verify CI published a release to GitHub Releases for the `main` commit.
- [ ] Verify artifact contents: browser packages have expected `manifest.json`, `content.js`, `content.css`, and `icons/`.
- [ ] Verify artifact contents: Firefox package includes `browser_specific_settings.gecko.id`.
- [ ] Verify artifact contents: Safari package includes app wrapper build output.

## 5) Security, privacy, and policy

- [ ] Review permissions and host permissions in manifest for least privilege.
- [ ] Confirm privacy policy/support URLs are up to date in store listings.
- [ ] Confirm data-handling claims match implementation (local storage, API calls, no hidden telemetry).
- [ ] Confirm legal text/trademark disclaimers are current.

## 6) Store submission preparation

- [ ] Prepare listing assets (icon, screenshots, promo text, detailed description).
- [ ] Prepare release notes for this version.
- [ ] Prepare support/contact channel.

## 7) Publish by browser

- [ ] Chrome Web Store: upload package, complete listing metadata, submit.
- [ ] Edge Add-ons: upload package, complete listing metadata, submit.
- [ ] Firefox AMO: upload signed package flow, verify ID continuity, submit.
- [ ] Safari/macOS: sign and notarize app wrapper, upload via App Store Connect or chosen distribution path.

Safari/macOS hardening:

- [ ] Confirm Apple Developer membership and App Store Connect app record are active.
- [ ] Confirm app and extension bundle IDs match planned production values.
- [ ] Build archived/macOS App Store package in Xcode (`Product > Archive`) from the macOS scheme.
- [ ] Export and notarize a signed package suitable for distribution.
- [ ] Upload package, complete extension metadata, and set up a TestFlight or store review build.
- [ ] Verify extension controls and `Curated` tab in the signed artifact before requesting review.

## 8) Post-release validation

- [ ] Install released build from each channel in a clean profile.
- [ ] Verify extension loads on `https://www.crunchyroll.com/watchlist`.
- [ ] Verify `Curated` tab renders and controls behave.
- [ ] Verify no blocking console/runtime errors.
- [ ] Update store links in `/Users/matthewfrench/GitHub/Crunchy-Watchlist/README.md`.

## 9) Rollback and incident response

- [ ] Keep previous known-good artifact set available.
- [ ] Define rollback owner and decision criteria (for example auth/API breakage, install failures).
- [ ] Prepare emergency user notice template for store descriptions/release notes.
- [ ] Track incident actions and follow-up fixes.

## 10) Optional automation improvements

- [ ] Promote main-branch release artifacts to browser store channels when approved.
- [ ] Add release notes automation for GitHub release metadata and browser store drafts.
- [ ] Add checksums/signature metadata for distributed artifacts.
- [ ] Add automated smoke script for store-delivered packages (not only fixture-injected tests).
