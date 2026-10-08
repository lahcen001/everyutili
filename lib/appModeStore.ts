import { isInstalledApp, isIosDevice, parseLitePref, resolveLite, type DeviceSignals, type LitePref } from "@/lib/appMode";

export interface AppModeState {
  standalone: boolean;
  lite: boolean;
  litePref: LitePref;
  ios: boolean;
  /** the browser offered an install prompt we can trigger */
  canInstall: boolean;
  /** a newer service worker is waiting */
  updateReady: boolean;
}

const LITE_KEY = "everyutili_lite";
const SERVER_STATE: AppModeState = { standalone: false, lite: false, litePref: "auto", ios: false, canInstall: false, updateReady: false };

let state: AppModeState = SERVER_STATE;
let started = false;
let installEvent: (Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }) | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());
const set = (patch: Partial<AppModeState>) => {
  state = { ...state, ...patch };
  emit();
};

export const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const getSnapshot = (): AppModeState => state;
export const getServerSnapshot = (): AppModeState => SERVER_STATE;

function signals(): DeviceSignals {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean; effectiveType?: string } };
  return { deviceMemory: nav.deviceMemory, hardwareConcurrency: nav.hardwareConcurrency, saveData: nav.connection?.saveData, effectiveType: nav.connection?.effectiveType };
}

function applyAttributes() {
  const root = document.documentElement;
  root.dataset.standalone = String(state.standalone);
  root.dataset.lite = String(state.lite);
}

function readStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean };
  const q = (m: string) => window.matchMedia(`(display-mode: ${m})`).matches;
  return isInstalledApp({ matchesStandalone: q("standalone"), matchesFullscreen: q("fullscreen"), matchesMinimalUi: q("minimal-ui"), iosStandalone: nav.standalone === true });
}

/** Starts listening (once). Safe to call from an effect on every mount. */
export function startAppMode() {
  if (started || typeof window === "undefined") return;
  started = true;
  let pref: LitePref = "auto";
  try {
    pref = parseLitePref(window.localStorage.getItem(LITE_KEY));
  } catch {
    /* storage unavailable */
  }
  state = { ...state, standalone: readStandalone(), litePref: pref, lite: resolveLite(pref, signals()), ios: isIosDevice(navigator.userAgent, navigator.maxTouchPoints) };
  applyAttributes();
  emit();

  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    set({ standalone: readStandalone() });
    applyAttributes();
  });
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    installEvent = e as typeof installEvent;
    set({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    installEvent = null;
    set({ canInstall: false, standalone: readStandalone() });
    applyAttributes();
  });
}

export function setLitePref(pref: LitePref) {
  try {
    window.localStorage.setItem(LITE_KEY, pref);
  } catch {
    /* ignore */
  }
  set({ litePref: pref, lite: resolveLite(pref, signals()) });
  applyAttributes();
}

/** Shows the browser's install dialog. Returns true when the visitor accepted. */
export async function promptInstall(): Promise<boolean> {
  if (!installEvent) return false;
  await installEvent.prompt();
  const choice = await installEvent.userChoice;
  installEvent = null;
  set({ canInstall: false });
  return choice.outcome === "accepted";
}

/** Called by the service worker registration when a new version is waiting. */
export function markUpdateReady(worker: ServiceWorker) {
  waitingWorker = worker;
  set({ updateReady: true });
}

/** Activates the waiting worker; the page reloads itself when the new worker takes over. */
export function applyUpdate() {
  waitingWorker?.postMessage({ type: "SKIP_WAITING" });
}
