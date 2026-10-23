# Infinity Store

A static, single-page app store (Play Store + App Store style). No build step — host the folder anywhere (GitHub Pages, Netlify, etc.).

## Add / edit apps
Open `index.html` and edit the `APPS` array. For each app set:
- `play` – Google Play package name (from `play.google.com/store/apps/details?id=<this>`)
- `ios`  – App Store numeric id (from `apps.apple.com/.../id<this>`)

The **Get** button sends Android phones to Google Play, iPhones/iPads to the App Store, and opens a chooser (both stores) on desktop.

## StudyBuddyZone (direct APK)
Replace `app-release.apk` with a new build (same name). Users download it as `StudyBuddyPro.apk`.
