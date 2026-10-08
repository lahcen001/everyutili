# EveryUtili as an app (PWA)

EveryUtili can be installed on a phone or computer and opens like a normal app: full screen, its own icon, a bottom
tab bar, and it keeps working without a connection.

## What the app does

| Feature | How it works | Where |
|---|---|---|
| Install | Chrome / Android shows an install banner after about 25 seconds of use (and an "Install the app" button in **My data**). iPhone / iPad show the "Share → Add to Home Screen" steps. The banner stays away for 14 days if dismissed. | `components/pwa/InstallBanner.tsx`, `lib/appModeStore.ts` |
| App look | When opened from the home screen: no website footer, a bottom tab bar (Home, Focus, Search, Favourites, Settings), safe-area padding for notches, no pull-to-refresh bounce, no tap delay. | `components/pwa/BottomNav.tsx`, `app/globals.css` |
| Works offline | Pages you open and the files they need are saved on the phone; an offline page appears for anything not saved yet. | `public/sw.js`, `public/offline.html` |
| Light on storage | Saved copies are capped (140 build files, 40 pages, 40 images/fonts per cache); the oldest are dropped first. **My data → Clear offline copies** frees it all. | `public/sw.js` |
| Light on memory | **Lite mode** removes blur, glow, shadows and decorative animation. Automatic: on for phones with 2 GB of memory or less, 2 CPU cores or fewer, Data Saver, or a 2G connection. Can be forced on or off in **My data**. | `lib/appMode.ts`, `app/globals.css` |
| Updates | A new version downloads in the background; a bar says "A new version is ready" and **Update** reloads into it. It never swaps files while you work. | `components/pwa/AppRuntime.tsx`, `components/pwa/UpdateBar.tsx` |
| Share to the app | Android's "Share" sheet lists EveryUtili for photos and videos (and links / text). A photo or video opens a picker of tools; text becomes a QR code. The file stays on the device for 10 minutes. | `app/manifest.ts` (`share_target`), `public/sw.js`, `components/pwa/SharePicker.tsx` |
| Quick actions | Long-press the icon: Focus timer, Image compressor, Scientific calculator, QR code. | `app/manifest.ts` (`shortcuts`) |
| Icon badge | The icon shows how many reminders are waiting (installed app, browsers that support badges). | `components/ReminderNotifier.tsx` |
| Theme colour | Status bar follows light / dark mode. | `app/[locale]/layout.tsx` (`viewport`) |

## Testing it

1. `npm run build && npx next start -p 3100`, open it in Chrome on a phone (use the computer's network address, or a tunnel — installing needs HTTPS or `localhost`).
2. DevTools → Application: check **Manifest** (no errors), **Service workers** (activated), then tick **Offline** and reload a page you visited.
3. Install it, open from the home screen, and check the bottom tab bar and that the footer is gone.
4. Change `VERSION` in `public/sw.js`, rebuild and reload: the update bar should appear.
5. My data → Lite mode: choose **Always on** and compare memory use in DevTools → Memory.

## Not included (and why)

- Real push notifications while the app is closed need a server; reminders appear while the app is open and as the icon badge.
- Store screenshots in the manifest (they improve the Android install sheet) need real screenshots of the app; add them to `app/manifest.ts` (`screenshots`) when you have them.
- Installing from the Google Play Store (a "Trusted Web Activity") can be added later with Bubblewrap; the manifest is already compatible.
