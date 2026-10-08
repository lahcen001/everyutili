/* EveryUtili service worker v2 — built to be light on phones with little memory and storage.
 *
 *  Strategy
 *   - /_next/static (build files) and /icons: cache first, kept to a fixed number of entries (oldest are dropped)
 *   - pages: network first with a short timeout, so a bad connection falls back to the saved copy quickly;
 *            only the pages you open are saved, never the whole site
 *   - fonts and small images from this site: stale-while-revalidate, capped
 *   - everything else (analytics, other sites, video/audio streams, range requests): untouched
 *   - shared files (Android "Share to…"): POST /share-target stores the file and opens the share page
 *
 *  Bump VERSION when this file changes. */
const VERSION = "v2";
const STATIC = `everyutili-static-${VERSION}`;
const PAGES = `everyutili-pages-${VERSION}`;
const MEDIA = `everyutili-media-${VERSION}`;
const LIMITS = { [STATIC]: 140, [PAGES]: 40, [MEDIA]: 40 };
const NAV_TIMEOUT_MS = 4000;
const CURRENT = [STATIC, PAGES, MEDIA];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => cache.addAll(["/offline.html", "/icons/icon-192.png", "/icons/icon-512.png"]))
    // no skipWaiting here: the page asks for it (so an update never swaps files under a tool you are using)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("everyutili-") && !CURRENT.includes(k)).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable().catch(() => {});
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  const type = event.data && event.data.type;
  if (type === "SKIP_WAITING") self.skipWaiting();
  if (type === "CLEAR_CACHES") {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("everyutili-")).map((k) => caches.delete(k)))));
  }
});

/** Keeps a cache to `max` entries by deleting the oldest ones. */
async function trim(name) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  const extra = keys.length - (LIMITS[name] || 40);
  for (let i = 0; i < extra; i++) await cache.delete(keys[i]);
}

async function put(name, request, response) {
  if (!response || !response.ok || response.status === 206) return;
  const cache = await caches.open(name);
  await cache.put(request, response);
  trim(name);
}

function cacheFirst(request, name) {
  return caches.open(name).then(async (cache) => {
    const hit = await cache.match(request);
    if (hit) return hit;
    const res = await fetch(request);
    put(name, request, res.clone());
    return res;
  });
}

function staleWhileRevalidate(request, name) {
  return caches.open(name).then(async (cache) => {
    const hit = await cache.match(request);
    const network = fetch(request)
      .then((res) => {
        put(name, request, res.clone());
        return res;
      })
      .catch(() => hit);
    return hit || network;
  });
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function navigate(event) {
  const request = event.request;
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : undefined;
    const res = preload || (await withTimeout(fetch(request), NAV_TIMEOUT_MS));
    // don't keep one-off pages (shared files, handoffs) — they would only fill up the phone's storage
    const oneOff = /[?&](from|text|kind)=/.test(new URL(request.url).search);
    if (res.ok && res.type === "basic" && !res.redirected && !oneOff) put(PAGES, request, res.clone());
    return res;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || (await caches.match("/offline.html")) || Response.error();
  }
}

/* ---------- receiving shared files (Web Share Target) ---------- */

function openHandoffDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("everyutili-pipeline");
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains("handoff")) req.result.createObjectStore("handoff");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function stashSharedFile(file) {
  const db = await openHandoffDb();
  const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random().toString(36).slice(2);
  await new Promise((resolve, reject) => {
    const tx = db.transaction("handoff", "readwrite");
    tx.objectStore("handoff").put({ id, handoff: { fileName: file.name || "shared", blob: file, fromSlug: "share", createdAt: Date.now() } }, "pending");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  return id;
}

async function handleShare(request) {
  try {
    const form = await request.formData();
    const files = form.getAll("media").filter((f) => f && typeof f === "object" && "size" in f);
    const file = files.find((f) => /^(image|video)\//.test(f.type));
    if (file) {
      const id = await stashSharedFile(file);
      const kind = file.type.startsWith("video/") ? "video" : "image";
      return Response.redirect(`/share?kind=${kind}&from=${encodeURIComponent(id)}`, 303);
    }
    const text = [form.get("title"), form.get("text"), form.get("url")].filter(Boolean).join(" ").trim();
    if (text) return Response.redirect(`/share?kind=text&text=${encodeURIComponent(text.slice(0, 1500))}`, 303);
  } catch {
    /* fall through */
  }
  return Response.redirect("/", 303);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.method === "POST" && url.origin === self.location.origin && url.pathname === "/share-target") {
    event.respondWith(handleShare(req));
    return;
  }
  if (req.method !== "GET" || url.origin !== self.location.origin || req.headers.has("range")) return;
  if (url.pathname === "/sw.js" || url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(req, STATIC));
    return;
  }
  if (req.mode === "navigate") {
    event.respondWith(navigate(event));
    return;
  }
  if (req.destination === "font" || (req.destination === "image" && !url.pathname.startsWith("/downloads/"))) {
    event.respondWith(staleWhileRevalidate(req, MEDIA));
  }
});
