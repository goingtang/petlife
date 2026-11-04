This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npm test                    # unit tests (src/lib/__tests__)
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- PetPal uses a small built-in navigator (`src/nav.tsx`) instead of Expo Router, so the same code runs in Expo Go, Expo Snack and the web preview without extra native dependencies.
- Five bottom tabs live in `App.tsx`; every pushable screen is registered by name in `src/screens/registry.ts` and opened with `useNav().push('<name>', params)`.
- If the app later moves to Expo Router, keep screens in `src/screens/` and add thin route files under `src/app/`.

## Project layout

- `src/lib/` — data model (`types.ts`), storage (`store.tsx` + `persist.ts`, JSON file), business rules (`domain.ts`), dates, notifications, files/PDF/sharing, sample data (`seed.ts`).
- `src/ui/` — theme and the shared component kit (`kit.tsx`). Build screens from these components.
- `src/screens/` — tab screens and core screens; `src/screens/tools/` — the tools under 更多 (and 用藥／報告／文件 linked from 健康).
- `src/data/content.ts` — toxic-food list, first aid, starter articles and ingredient rules (extracted from the web prototype).
- UI copy is Traditional Chinese.

## Data & conventions

- All data is one `Store` object (`src/lib/types.ts`), saved by `src/lib/persist.ts` to a JSON file in the app's documents folder (temp file + backup). Mutate only via `useStore().update(d => …)` (immer). New fields must get a default in `seed.ts emptyStore()` and, for per-item fields, in `store.tsx migrate()`.
- Backups (`src/lib/backup.ts`, unit-tested): a .zip with `data.json` + `files/`; data refers to files as `petpal-file:<name>`. Every place that stores a file must be listed in `mapFileUris()` (`src/lib/life.ts`) — it drives backups, restores and the launch-time path fix (`rebaseUri`, only for `…/Documents|files/petpal/<name>`) when the iOS documents folder moves. Full backups are capped at `FULL_BACKUP_MAX_BYTES` (120 MB of files) and streamed to disk; a restore writes every file or none (`writeAllOrNothing`) before the data is replaced.
- Tapping a notification opens `content.data.route` (`noteRoute()` in notify.ts; a tab name or a registry screen), handled by `NotificationRouter` in `App.tsx`. `data.petId` selects the pet first; each tap is handled once (`firstTap()`), and nothing happens while a form is open (`useNav().hasOpenForm()`).
- Photos/files: pick with `choosePhotos`/`pickDocument` (`src/lib/files.ts`, photos are shrunk); track them in forms with `usePendingFiles()` so removed or unsaved files are deleted.
- Sub-views inside a screen (edit forms, detail views) must call `useBackHandler()` from `src/nav.tsx` so the header back button / Android back key close the sub-view first.
- Feedback: confirm a reversible action with `toast(msg, { action: { label: '復原', onPress } })` and restore the captured item in `onPress`. Keep `confirm()` (kit) for things that can't be undone, e.g. deletes that also remove photos; pass `{ destructive: false }` for plain questions.
- Pet pickers: use `PetChips` (with `allowAll` for filters). Day counts use `daysTogether()` in `domain.ts`.
- Privacy: anything that changes what leaves the phone must be reflected in `docs/privacy.html` (GitHub Pages), `src/screens/PrivacyScreen.tsx` and the store forms described in `RELEASE.md`.
- Notifications are planned by the pure `planNotifications()` in `src/lib/notify.ts` (unit-tested) and re-synced automatically from `App.tsx`; a sync with the same plan is skipped, so pass `force` after the user changes notification settings.
- The symptom checker's text for external AI apps is built by `buildAiPrompt()` in `src/lib/aiPrompt.ts` (unit-tested: no phone numbers, addresses, URLs or photos). Toxic content in `src/data/` is checked by `__tests__/content.test.ts`: an item listed because it is toxic must never use level 1 (「少量可」).
- Saves are debounced 1 s (`update(fn, { soon: true })` → 300 ms for single taps such as check-ins); `dailyMaintenance` prunes `taskDone` (60 days) and `doses` (90 days). Keep new per-day maps pruned the same way so the JSON file stays small.

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally (there is no `development` profile in `eas.json` and `expo-dev-client` is not installed; add both if you need cloud dev builds). Prefer libraries included in Expo Go (e.g. `expo-image`).
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
