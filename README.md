# Infinity Store

A static, single-page app store (Play Store + App Store style). No build step — host the folder anywhere (GitHub Pages, Netlify, etc.).

## Add / edit apps
Open `index.html` and edit the `APPS` array. For each app set:
- `play` – Google Play package name (from `play.google.com/store/apps/details?id=<this>`)
- `ios`  – App Store numeric id (from `apps.apple.com/.../id<this>`)

The **Get** button sends Android phones to Google Play, iPhones/iPads to the App Store, and opens a chooser (both stores) on desktop.

## First-party apps (direct APK)
The page for each app lives at `?app=<id>` (no param = **StudyBuddyPro**, the default).
- **StudyBuddyPro** (`pro`): `studybuddypro.apk` -> saved as `StudyBuddyPro.apk`. Icon `icon-pro.png`, screenshots in `screenshots-pro/`.
- **StudyBuddyZone** (`zone`): `app-release.apk` -> saved as `StudyBuddyZone.apk`.

Edit text/screenshots in the `PAGES` object in `index.html`. Each app has its own reviews
(`reviews_pro` / `reviews` collections) — **redeploy `api/store.js` to Vercel** after updating.
Optional env vars for hosting the APK elsewhere: `APK_URL_PRO` / `APK_STORAGE_PATH_PRO` (Pro), `APK_URL` / `APK_STORAGE_PATH` (Zone).
