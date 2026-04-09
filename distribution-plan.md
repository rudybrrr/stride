# Stride Distribution Plan

## Goal

Turn Stride from a web-first product into something users can install and keep on their devices:

- desktop installable
- mobile installable
- later downloadable from app stores

The plan should preserve the current product momentum and avoid a rewrite.

## Current Reality

Stride is currently a Next.js 16 + Supabase web app.

Important constraints from the current architecture:

- route protection is server-gated through `src/lib/require-user.ts`
- auth uses Supabase web/session flows
- most interaction and realtime behavior already runs client-side
- the UI is already responsive enough to reuse on mobile
- there is no existing PWA, Capacitor, Tauri, Electron, or React Native layer

This means the shortest path is not "rewrite as a native app". The shortest path is to package the current app progressively.

## Recommended Strategy

### Phase 1: Installable PWA

Make the existing web app installable on desktop and mobile from the browser.

Why first:

- lowest engineering risk
- keeps the current Next + Supabase model intact
- fastest way to make Stride feel like an app
- gives us a usable install surface before app-store work

Target outcomes:

- browser install prompt support
- home-screen install on mobile
- desktop install via Chrome / Edge / Safari support where available
- branded app icons, manifest, splash metadata
- basic offline shell for already-visited screens

### Phase 2: Mobile Store Packaging

Wrap the hosted app with Capacitor for iOS and Android.

Why second:

- gets to App Store / Play Store without a React Native rewrite
- reuses almost all current UI and product logic
- gives access to native packaging, splash screens, deep links, camera/file integrations later

Target outcomes:

- iOS and Android builds from the existing hosted app
- auth/session flow verified inside native webviews
- file upload flow verified on device
- push notification groundwork possible later

### Phase 3: Desktop Installer Packaging

Package Stride for Windows and macOS with Tauri.

Why Tauri over Electron:

- lighter
- better fit for a web app with modest native requirements
- less overhead than shipping a full Electron runtime first

Target outcomes:

- downloadable Windows installer
- downloadable macOS app bundle
- native window chrome and app icon
- optional updater later, not in v1

## What We Should Not Do

- do not rewrite the app in React Native right now
- do not build Electron first
- do not try to make the product offline-first before packaging
- do not split into separate web and mobile feature codebases yet

That would create a large architecture tax before we have validated distribution demand.

## Phase 1 Scope: PWA

### Product Work

1. Add a web app manifest.
2. Add app icons and splash assets.
3. Add service worker support for installability and a minimal offline shell.
4. Add an install UX:
   - silent support where browsers handle it
   - optional lightweight "Install Stride" prompt later
5. Verify auth, deep links, and file uploads still work in installed mode.

### Technical Work

1. Add manifest metadata to the Next app.
2. Add PWA/service-worker integration compatible with Next 16.
3. Cache only safe assets and shell routes first.
4. Keep Supabase network-driven behavior online-only in v1.
5. Define fallback behavior for offline:
   - app loads shell
   - realtime and writes require connection
   - show connection state clearly later if needed

### Non-Goals For PWA v1

- full offline task editing
- background sync
- push notifications
- local database sync
- native share sheet integration

## Phase 2 Scope: Mobile Packaging

### Product Work

1. Add Capacitor project structure.
2. Point mobile shells at the deployed Stride web app.
3. Verify:
   - login/signup
   - task editing
   - planner interactions
   - file attachments
   - deep linking back into the app
4. Add proper app icons, splash screens, app name, and bundle IDs.

### Technical Work

1. Add Capacitor config and native shells.
2. Audit Supabase auth persistence inside iOS/Android webviews.
3. Confirm file and image upload behavior on physical devices.
4. Add mobile-specific URL handling if auth redirects need adjustment.

### Non-Goals For Mobile v1

- native offline database
- native-only navigation rewrite
- tablet-specific redesign
- push notifications in the first packaging pass

## Phase 3 Scope: Desktop Packaging

### Product Work

1. Add Tauri wrapper.
2. Produce Windows and macOS installers.
3. Verify install/update/launch flows.
4. Confirm auth, upload, and external-link behavior inside the desktop shell.

### Technical Work

1. Add Tauri configuration and app metadata.
2. Decide whether the shell points to:
   - the hosted production app first
   - or a bundled local build later
3. Keep v1 simple: hosted app is acceptable.

### Non-Goals For Desktop v1

- local embedded database
- native menubar app
- heavy OS-specific integrations
- auto-update system in the first release

## Architecture Gaps To Solve Before Packaging

These are the main things to address as part of the distribution effort:

1. PWA support does not exist yet.
2. Install assets do not exist yet.
3. Native packaging scaffolds do not exist yet.
4. Auth/session behavior needs validation inside wrappers.
5. Attachment flows need real-device verification.
6. Offline expectations need to be explicitly defined so users are not misled.

## Suggested Delivery Order

1. Ship installable PWA.
2. Validate that users actually want Stride as an installed app.
3. Add Capacitor mobile packaging.
4. Add Tauri desktop packaging.
5. Only then consider native-only capabilities like push or offline sync.

## Success Criteria

### PWA

- users can install Stride from desktop browsers
- users can add Stride to a phone home screen
- the installed app launches cleanly with correct branding
- auth and normal task flows still work

### Mobile Packaging

- an iOS build and Android build launch successfully
- auth works reliably
- file attachments work on device
- app is stable enough for TestFlight / internal testing

### Desktop Packaging

- Windows and macOS installers build successfully
- auth works
- links, uploads, and planner interactions behave normally

## Risks

1. Supabase auth redirect/session behavior inside native wrappers may need custom handling.
2. File uploads may behave differently in iOS webviews than in desktop browsers.
3. Service worker caching can create stale-app problems if done too aggressively.
4. Packaging too early without clear offline expectations may create user confusion.

## Final Recommendation

Build toward "real app" distribution in this order:

1. PWA first
2. Capacitor mobile second
3. Tauri desktop third

That gives Stride an app path without paying the cost of a rewrite.
