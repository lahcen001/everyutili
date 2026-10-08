import { describe, expect, it } from "vitest";
import { DISMISS_DAYS, canShowInstallBanner, isInstalledApp, isIosDevice, looksLowEnd, parseLitePref, resolveLite, shareKindFor } from "@/lib/appMode";

describe("low-end detection", () => {
  it("flags phones with little memory, few cores, data saver or a very slow network", () => {
    expect(looksLowEnd({ deviceMemory: 1 })).toBe(true);
    expect(looksLowEnd({ deviceMemory: 2 })).toBe(true);
    expect(looksLowEnd({ hardwareConcurrency: 2 })).toBe(true);
    expect(looksLowEnd({ saveData: true })).toBe(true);
    expect(looksLowEnd({ effectiveType: "2g" })).toBe(true);
    expect(looksLowEnd({ effectiveType: "slow-2g" })).toBe(true);
  });
  it("does not flag normal devices or unknown signals", () => {
    expect(looksLowEnd({})).toBe(false);
    expect(looksLowEnd({ deviceMemory: 8, hardwareConcurrency: 8, effectiveType: "4g" })).toBe(false);
    expect(looksLowEnd({ hardwareConcurrency: 0 })).toBe(false);
  });
  it("lets the visitor override the automatic choice", () => {
    expect(resolveLite("on", {})).toBe(true);
    expect(resolveLite("off", { deviceMemory: 1 })).toBe(false);
    expect(resolveLite("auto", { deviceMemory: 1 })).toBe(true);
    expect(resolveLite("auto", { deviceMemory: 8 })).toBe(false);
    expect(parseLitePref("on")).toBe("on");
    expect(parseLitePref("junk")).toBe("auto");
    expect(parseLitePref(null)).toBe("auto");
  });
});

describe("installed-app detection", () => {
  const base = { matchesStandalone: false, matchesFullscreen: false, matchesMinimalUi: false, iosStandalone: false };
  it("recognises every installed display mode", () => {
    expect(isInstalledApp(base)).toBe(false);
    expect(isInstalledApp({ ...base, matchesStandalone: true })).toBe(true);
    expect(isInstalledApp({ ...base, matchesFullscreen: true })).toBe(true);
    expect(isInstalledApp({ ...base, matchesMinimalUi: true })).toBe(true);
    expect(isInstalledApp({ ...base, iosStandalone: true })).toBe(true);
  });
  it("detects iPhones and iPads, including iPadOS", () => {
    expect(isIosDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIosDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIosDevice("Mozilla/5.0 (Linux; Android 13)", 5)).toBe(false);
  });
});

describe("install banner", () => {
  it("stays hidden for two weeks after it was dismissed", () => {
    const now = Date.UTC(2026, 9, 8);
    expect(canShowInstallBanner(null, now)).toBe(true);
    expect(canShowInstallBanner(now - 86400000, now)).toBe(false);
    expect(canShowInstallBanner(now - (DISMISS_DAYS + 1) * 86400000, now)).toBe(true);
  });
});

describe("shared items", () => {
  it("classifies what was shared to the app", () => {
    expect(shareKindFor(["image/png"], false)).toBe("image");
    expect(shareKindFor(["application/pdf", "video/mp4"], false)).toBe("video");
    expect(shareKindFor([], true)).toBe("text");
    expect(shareKindFor(["application/pdf"], false)).toBeNull();
    expect(shareKindFor([], false)).toBeNull();
  });
});
