"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  RotateCw,
  Search,
  Settings2,
  Sparkles,
  Star,
  Tv,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

import { useTrackTool } from "@/hooks/useTrackTool";
import { cn } from "@/lib/utils";
import { loadIptvDirectory, type IptvChannel, type IptvDirectory } from "@/lib/iptv";
import { buildIndex, guessCountryCode, searchChannels, suggestCountries, type SearchEntry } from "@/lib/iptvSearch";

const FAVORITES_KEY = "onmitools:iptv-favorites";
const RECENT_KEY = "onmitools:iptv-recent";
const VOLUME_KEY = "onmitools:iptv-volume";
const MAX_RECENT = 24;
const ROW_HEIGHT = 64;
const EXAMPLES = ["morocco sports", "news uk", "bbc", "france cinema"];

interface Recent {
  id: string;
  t: number;
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* these are conveniences; failing to persist must never break playback */
  }
}

type LoadState = "loading" | "ready" | "error";
type PlaybackState = "idle" | "loading" | "playing" | "error";
type Tab = "all" | "recent" | "favorites";

interface QualityLevel {
  index: number;
  label: string;
}

/** A channel logo that falls back to a TV icon when the image is missing or broken. */
function ChannelLogo({ channel, className }: { channel: IptvChannel; className?: string }) {
  const [broken, setBroken] = React.useState(false);
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5", className)}>
      {channel.logo && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={channel.logo} alt="" className="h-full w-full object-contain p-1" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <Tv className="h-1/2 w-1/2 text-slate-400" />
      )}
    </span>
  );
}

export default function IptvPlayer() {
  useTrackTool("iptv-player");

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [directory, setDirectory] = React.useState<IptvDirectory | null>(null);
  const [query, setQuery] = React.useState("");
  const [countryFilter, setCountryFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [tab, setTab] = React.useState<Tab>("all");
  const [favorites, setFavorites] = React.useState<Set<string>>(() => (typeof window === "undefined" ? new Set() : new Set(readJson<string[]>(FAVORITES_KEY, []))));
  const [recent, setRecent] = React.useState<Recent[]>(() => (typeof window === "undefined" ? [] : readJson<Recent[]>(RECENT_KEY, [])));
  const [selected, setSelected] = React.useState<IptvChannel | null>(null);
  const [playback, setPlayback] = React.useState<PlaybackState>("idle");
  const [buffering, setBuffering] = React.useState(false);
  const [paused, setPaused] = React.useState(false);
  const [volume, setVolume] = React.useState(() => (typeof window === "undefined" ? 1 : readJson<number>(VOLUME_KEY, 1)));
  const [muted, setMuted] = React.useState(false);
  const [levels, setLevels] = React.useState<QualityLevel[]>([]);
  const [level, setLevel] = React.useState(-1);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [controlsOn, setControlsOn] = React.useState(true);
  const [qualityOpen, setQualityOpen] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsRef = React.useRef<import("hls.js").default | null>(null);
  const hideTimer = React.useRef<number | null>(null);
  const retries = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    loadIptvDirectory()
      .then((dir) => {
        if (cancelled) return;
        setDirectory(dir);
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- derived data ----------------------------------------------------
  const categoryNames = React.useMemo(() => new Map((directory?.categories ?? []).map((c) => [c.id, c.name])), [directory]);
  const index = React.useMemo<SearchEntry[]>(() => (directory ? buildIndex(directory.channels, categoryNames) : []), [directory, categoryNames]);
  const byId = React.useMemo(() => new Map((directory?.channels ?? []).map((c) => [c.id, c])), [directory]);
  const countryCounts = React.useMemo(() => {
    const m = new Map<string, number>();
    for (const c of directory?.channels ?? []) if (c.countryCode) m.set(c.countryCode, (m.get(c.countryCode) ?? 0) + 1);
    return m;
  }, [directory]);
  const topCountries = React.useMemo(
    () => (directory?.countries ?? []).slice().sort((a, b) => (countryCounts.get(b.code) ?? 0) - (countryCounts.get(a.code) ?? 0)).slice(0, 10),
    [directory, countryCounts]
  );
  const myCountry = React.useMemo(() => {
    if (!directory || typeof navigator === "undefined") return null;
    const code = guessCountryCode(navigator.languages ?? [navigator.language]);
    return directory.countries.find((c) => c.code === code) ?? null;
  }, [directory]);
  const suggestions = React.useMemo(() => (directory && !countryFilter ? suggestCountries(query, directory.countries) : []), [directory, query, countryFilter]);

  const recentChannels = React.useMemo(() => recent.map((r) => byId.get(r.id)).filter((c): c is IptvChannel => !!c), [recent, byId]);
  const favoriteChannels = React.useMemo(() => (directory?.channels ?? []).filter((c) => favorites.has(c.id)), [directory, favorites]);

  const filtered = React.useMemo(() => {
    const entries =
      tab === "all"
        ? index
        : tab === "recent"
          ? recentChannels.map((c) => index.find((e) => e.channel.id === c.id)).filter((e): e is SearchEntry => !!e)
          : index.filter((e) => favorites.has(e.channel.id));
    return searchChannels(entries, query, { countryCode: countryFilter || undefined, category: categoryFilter || undefined });
  }, [index, tab, recentChannels, favorites, query, countryFilter, categoryFilter]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  // ---- player ----------------------------------------------------------
  const destroyPlayer = React.useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }
  }, []);
  React.useEffect(() => destroyPlayer, [destroyPlayer]);

  const poke = React.useCallback(() => {
    setControlsOn(true);
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      setControlsOn(false);
      setQualityOpen(false);
    }, 3200);
  }, []);
  React.useEffect(
    () => () => {
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    },
    []
  );

  const playChannel = React.useCallback(
    async (channel: IptvChannel) => {
      setSelected(channel);
      setPlayback("loading");
      setBuffering(true);
      setLevels([]);
      setLevel(-1);
      retries.current = 0;
      destroyPlayer();
      setRecent((prev) => {
        const next = [{ id: channel.id, t: Date.now() }, ...prev.filter((r) => r.id !== channel.id)].slice(0, MAX_RECENT);
        writeJson(RECENT_KEY, next);
        return next;
      });
      poke();

      const video = videoRef.current;
      if (!video) return;

      const start = () =>
        video.play().then(
          () => setPlayback("playing"),
          // autoplay with sound can be blocked; the stream is still loaded, so let the user press play
          () => setPlayback("playing")
        );

      if (video.canPlayType("application/vnd.apple.mpegurl")) {
        video.src = channel.streamUrl;
        void start();
        return;
      }
      try {
        const { default: Hls } = await import("hls.js");
        if (!Hls.isSupported()) {
          setPlayback("error");
          return;
        }
        const hls = new Hls({ maxBufferLength: 30, enableWorker: true, lowLatencyMode: true });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR && retries.current < 3) {
            retries.current += 1;
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR && retries.current < 3) {
            retries.current += 1;
            hls.recoverMediaError();
          } else {
            setPlayback("error");
            setBuffering(false);
          }
        });
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
          const seen = new Set<number>();
          const list: QualityLevel[] = [];
          data.levels.forEach((l, i) => {
            if (l.height && !seen.has(l.height)) {
              seen.add(l.height);
              list.push({ index: i, label: `${l.height}p` });
            }
          });
          setLevels(list.sort((a, b) => parseInt(b.label) - parseInt(a.label)));
          void start();
        });
        hls.loadSource(channel.streamUrl);
        hls.attachMedia(video);
      } catch {
        setPlayback("error");
      }
    },
    [destroyPlayer, poke]
  );

  const retry = () => selected && void playChannel(selected);

  const step = React.useCallback(
    (dir: 1 | -1) => {
      if (filtered.length === 0) return;
      const i = selected ? filtered.findIndex((c) => c.id === selected.id) : -1;
      const next = filtered[i === -1 ? 0 : (i + dir + filtered.length) % filtered.length];
      void playChannel(next);
    },
    [filtered, selected, playChannel]
  );

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !selected) return;
    if (v.paused) void v.play();
    else v.pause();
  };
  const changeVolume = (v: number) => {
    const video = videoRef.current;
    const next = Math.min(1, Math.max(0, v));
    setVolume(next);
    setMuted(next === 0);
    if (video) {
      video.volume = next;
      video.muted = next === 0;
    }
    writeJson(VOLUME_KEY, next);
  };
  const toggleMute = () => {
    const video = videoRef.current;
    const next = !muted;
    setMuted(next);
    if (video) video.muted = next;
  };
  const chooseLevel = (idx: number) => {
    setLevel(idx);
    if (hlsRef.current) hlsRef.current.currentLevel = idx;
    setQualityOpen(false);
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
    else await stageRef.current?.requestFullscreen().catch(() => {});
  };
  const pip = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      /* not supported for this stream */
    }
  };
  React.useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === "INPUT" || (e.target as HTMLElement).tagName === "SELECT") return;
    const keys: Record<string, () => void> = {
      " ": togglePlay,
      k: togglePlay,
      m: toggleMute,
      f: () => void toggleFullscreen(),
      ArrowUp: () => changeVolume(volume + 0.1),
      ArrowDown: () => changeVolume(volume - 0.1),
      ArrowRight: () => step(1),
      ArrowLeft: () => step(-1),
    };
    const action = keys[e.key];
    if (action) {
      e.preventDefault();
      action();
      poke();
    }
  };

  const toggleFavorite = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeJson(FAVORITES_KEY, [...next]);
      return next;
    });
  const clearHistory = () => {
    setRecent([]);
    writeJson(RECENT_KEY, []);
  };
  const copyLink = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.streamUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  // ---- states ----------------------------------------------------------
  if (loadState === "loading") {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-card text-sm text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        Tuning in… loading the channel directory
      </div>
    );
  }
  if (loadState === "error" || !directory) {
    return (
      <div className="flex h-80 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        <AlertTriangle className="h-6 w-6 text-destructive" />
        Couldn&apos;t load the channel directory. Check your connection and reload the page.
      </div>
    );
  }

  const lastWatched = recentChannels[0] ?? null;
  const selectedCountry = directory.countries.find((c) => c.code === countryFilter);
  const selectedCategory = directory.categories.find((c) => c.id === categoryFilter);
  const isFav = selected ? favorites.has(selected.id) : false;
  const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: "all", label: "All", count: directory.channels.length, icon: <Tv className="h-3.5 w-3.5" /> },
    { id: "recent", label: "Recent", count: recentChannels.length, icon: <History className="h-3.5 w-3.5" /> },
    { id: "favorites", label: "Favorites", count: favoriteChannels.length, icon: <Star className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem]">
        {/* ------------------------------ player column ------------------------------ */}
        <div className="min-w-0 space-y-3">
          <div
            ref={stageRef}
            tabIndex={0}
            onKeyDown={onKeyDown}
            onMouseMove={poke}
            onTouchStart={poke}
            className={cn(
              "group relative overflow-hidden bg-black outline-none focus-visible:ring-4 focus-visible:ring-primary/30",
              fullscreen ? "h-screen w-screen" : "aspect-video w-full rounded-2xl shadow-2xl shadow-primary/10 ring-1 ring-white/10"
            )}
            style={{ cursor: controlsOn || !selected ? undefined : "none" }}
          >
            <video
              ref={videoRef}
              playsInline
              onClick={togglePlay}
              onDoubleClick={() => void toggleFullscreen()}
              onPlaying={() => {
                setPaused(false);
                setBuffering(false);
                setPlayback("playing");
              }}
              onPause={() => setPaused(true)}
              onWaiting={() => setBuffering(true)}
              onCanPlay={() => setBuffering(false)}
              className={cn("h-full w-full bg-black object-contain", !selected && "invisible")}
            />

            {/* idle hero */}
            {!selected && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[radial-gradient(ellipse_at_top,#312e81_0%,#0f172a_55%,#020617_100%)] p-6 text-center text-white">
                <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                  <Tv className="h-10 w-10" />
                </span>
                <div className="space-y-1">
                  <p className="text-2xl font-extrabold tracking-tight sm:text-3xl">Live TV, from anywhere</p>
                  <p className="text-sm text-white/70">{directory.channels.length.toLocaleString()} channels · {directory.countries.length} countries</p>
                </div>
                {lastWatched && (
                  <button
                    onClick={() => void playChannel(lastWatched)}
                    className="flex items-center gap-3 rounded-2xl bg-white/10 py-2 pl-2 pr-5 text-left ring-1 ring-white/20 backdrop-blur transition hover:bg-white/20"
                  >
                    <ChannelLogo channel={lastWatched} className="h-12 w-12" />
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-white/60">Continue watching</span>
                      <span className="block max-w-56 truncate text-base font-bold">{lastWatched.name}</span>
                    </span>
                    <Play className="ml-2 h-6 w-6 fill-white" />
                  </button>
                )}
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => setQuery(ex)} className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/15 transition hover:bg-white/20">
                      <Search className="mr-1 inline h-3 w-3" />
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected && (
              <>
                {/* top bar */}
                <div className={cn("pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/80 to-transparent p-4 text-white transition-opacity duration-300", controlsOn || paused ? "opacity-100" : "opacity-0")}>
                  <ChannelLogo channel={selected} className="h-10 w-10" />
                  <div className="min-w-0">
                    <p className="truncate text-base font-bold leading-tight">{selected.name}</p>
                    <p className="truncate text-xs text-white/70">
                      {selected.countryFlag} {selected.countryName}
                    </p>
                  </div>
                  <span className="ml-auto flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Live
                  </span>
                </div>

                {/* centre states */}
                {playback === "loading" || (buffering && playback !== "error") ? (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-12 w-12 animate-spin text-white/90 drop-shadow" />
                  </div>
                ) : null}
                {playback === "error" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 p-6 text-center text-white">
                    <AlertTriangle className="h-10 w-10 text-amber-400" />
                    <p className="max-w-sm text-sm">This stream couldn&apos;t be played. It may be offline or blocked in your region.</p>
                    <div className="flex gap-2">
                      <button onClick={retry} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-black hover:bg-white/90">
                        <RotateCw className="h-4 w-4" /> Retry
                      </button>
                      <button onClick={() => step(1)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/15 px-4 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/25">
                        Next channel <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {paused && playback === "playing" && !buffering && (
                  <button onClick={togglePlay} aria-label="Play" className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/30 backdrop-blur transition hover:scale-105 hover:bg-white/30">
                    <Play className="h-9 w-9 fill-white" />
                  </button>
                )}

                {/* controls */}
                <div className={cn("absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-10 text-white transition-opacity duration-300 sm:gap-2 sm:p-4", controlsOn || paused ? "opacity-100" : "pointer-events-none opacity-0")}>
                  <CtrlButton label="Previous channel" onClick={() => step(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                  </CtrlButton>
                  <CtrlButton label={paused ? "Play" : "Pause"} onClick={togglePlay}>
                    {paused ? <Play className="h-5 w-5 fill-white" /> : <Pause className="h-5 w-5 fill-white" />}
                  </CtrlButton>
                  <CtrlButton label="Next channel" onClick={() => step(1)}>
                    <ChevronRight className="h-5 w-5" />
                  </CtrlButton>
                  <div className="group/vol ml-1 flex items-center gap-1">
                    <CtrlButton label={muted ? "Unmute" : "Mute"} onClick={toggleMute}>
                      {muted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                    </CtrlButton>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={muted ? 0 : volume}
                      onChange={(e) => changeVolume(Number(e.target.value))}
                      aria-label="Volume"
                      className="hidden h-1 w-20 cursor-pointer accent-white sm:block"
                    />
                  </div>
                  <span className="ml-auto" />
                  {levels.length > 1 && (
                    <div className="relative">
                      <CtrlButton label="Quality" onClick={() => setQualityOpen((o) => !o)}>
                        <Settings2 className="h-5 w-5" />
                        <span className="ml-1 hidden text-xs font-semibold sm:inline">{level === -1 ? "Auto" : levels.find((l) => l.index === level)?.label}</span>
                      </CtrlButton>
                      {qualityOpen && (
                        <div className="absolute bottom-full right-0 mb-2 min-w-28 overflow-hidden rounded-xl bg-black/90 py-1 text-sm shadow-xl ring-1 ring-white/15 backdrop-blur">
                          {[{ index: -1, label: "Auto" }, ...levels].map((l) => (
                            <button key={l.index} onClick={() => chooseLevel(l.index)} className="flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left hover:bg-white/15">
                              {l.label}
                              {level === l.index && <Check className="h-4 w-4" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  {typeof document !== "undefined" && document.pictureInPictureEnabled && (
                    <CtrlButton label="Picture in picture" onClick={() => void pip()}>
                      <PictureInPicture2 className="h-5 w-5" />
                    </CtrlButton>
                  )}
                  <CtrlButton label={fullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>
                    {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                  </CtrlButton>
                </div>
              </>
            )}
          </div>

          {/* now playing */}
          {selected && (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <ChannelLogo channel={selected} className="h-14 w-14" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold leading-tight">{selected.name}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>
                    {selected.countryFlag} {selected.countryName ?? "Unknown"}
                  </span>
                  {selected.quality && <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-semibold text-primary">{selected.quality}</span>}
                  {selected.categories.slice(0, 3).map((c) => (
                    <span key={c} className="rounded-md bg-muted px-1.5 py-0.5 capitalize">
                      {categoryNames.get(c) ?? c}
                    </span>
                  ))}
                </div>
              </div>
              <button onClick={() => toggleFavorite(selected.id)} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors", isFav ? "border-amber-400 bg-amber-400/10 text-amber-600" : "border-border hover:bg-muted")}>
                <Star className={cn("h-4 w-4", isFav && "fill-current")} /> {isFav ? "Saved" : "Favorite"}
              </button>
              <button onClick={() => void copyLink()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-sm font-medium hover:bg-muted" title="Copy the stream address (.m3u8)">
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Stream link"}
              </button>
            </div>
          )}

          {/* recently watched */}
          {recentChannels.length > 0 && (
            <section className="rounded-2xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold">
                  <History className="h-4 w-4 text-primary" /> Recently watched
                </h3>
                <button onClick={clearHistory} className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  Clear
                </button>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {recentChannels.slice(0, 14).map((c) => (
                  <button key={c.id} onClick={() => void playChannel(c)} className={cn("group/card w-24 shrink-0 text-center", selected?.id === c.id && "opacity-100")} title={c.name}>
                    <span className={cn("relative block overflow-hidden rounded-2xl ring-2 transition", selected?.id === c.id ? "ring-primary" : "ring-transparent group-hover/card:ring-primary/40")}>
                      <ChannelLogo channel={c} className="h-16 w-24 rounded-2xl" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover/card:opacity-100">
                        <Play className="h-6 w-6 fill-white text-white" />
                      </span>
                    </span>
                    <span className="mt-1 block truncate text-xs font-medium">{c.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <p className="rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Channel listings and streams come live from the community-maintained{" "}
            <a href="https://github.com/iptv-org/iptv" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              iptv-org
            </a>{" "}
            project — not hosted or verified by this site. Availability, legality and quality vary by region and channel, and some streams may be offline. Shortcuts: Space play/pause · M mute · F fullscreen · ←/→ change channel · ↑/↓ volume.
          </p>
        </div>

        {/* ------------------------------ channel browser ------------------------------ */}
        <aside className="flex min-h-[28rem] min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card xl:h-[calc(100vh-9rem)] xl:min-h-[34rem]">
          <div className="space-y-3 border-b border-border p-3">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search a channel, country or topic…"
                aria-label="Search channels"
                className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70"
              />
              {query && (
                <button onClick={() => setQuery("")} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {suggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {suggestions.map((c) => (
                  <button
                    key={c.code}
                    onClick={() => {
                      setCountryFilter(c.code);
                      setQuery("");
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/20"
                  >
                    {c.flag} All of {c.name} <span className="font-normal opacity-70">· {countryCounts.get(c.code) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            {/* quick country chips */}
            <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
              {myCountry && (
                <button
                  onClick={() => setCountryFilter(countryFilter === myCountry.code ? "" : myCountry.code)}
                  className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold", countryFilter === myCountry.code ? "border-primary bg-primary text-primary-foreground" : "border-primary/40 text-primary hover:bg-primary/10")}
                >
                  {myCountry.flag} Near you
                </button>
              )}
              {topCountries
                .filter((c) => c.code !== myCountry?.code)
                .map((c) => (
                  <button
                    key={c.code}
                    onClick={() => setCountryFilter(countryFilter === c.code ? "" : c.code)}
                    title={c.name}
                    className={cn("shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium", countryFilter === c.code ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted")}
                  >
                    {c.flag} {c.code}
                  </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} aria-label="Country" className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
                <option value="">🌍 All countries</option>
                {directory.countries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({countryCounts.get(c.code) ?? 0})
                  </option>
                ))}
              </select>
              <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} aria-label="Category" className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-sm">
                <option value="">All categories</option>
                {directory.categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {(selectedCountry || selectedCategory) && (
              <div className="flex flex-wrap gap-1.5">
                {selectedCountry && (
                  <button onClick={() => setCountryFilter("")} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {selectedCountry.flag} {selectedCountry.name} <X className="h-3 w-3" />
                  </button>
                )}
                {selectedCategory && (
                  <button onClick={() => setCategoryFilter("")} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {selectedCategory.name} <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors", tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}
                >
                  {t.icon} {t.label}
                  <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[10px] tabular-nums">{t.count > 9999 ? "10k+" : t.count}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground" role="status">
              {filtered.length.toLocaleString()} channel{filtered.length === 1 ? "" : "s"}
              {query.trim() && " match"}
            </p>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto">
            <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
              {virtualizer.getVirtualItems().map((row) => {
                const channel = filtered[row.index];
                const fav = favorites.has(channel.id);
                const active = selected?.id === channel.id;
                return (
                  <div
                    key={channel.id}
                    style={{ position: "absolute", top: 0, left: 0, width: "100%", height: ROW_HEIGHT, transform: `translateY(${row.start}px)` }}
                    className={cn("flex items-center gap-1 border-b border-border/60 px-2 transition-colors", active ? "bg-primary/10" : "hover:bg-muted/50")}
                  >
                    <button onClick={() => void playChannel(channel)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg py-2 text-left">
                      <ChannelLogo channel={channel} className="h-11 w-11" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("truncate text-sm font-semibold", active && "text-primary")}>{channel.name}</span>
                          {channel.quality && <span className="shrink-0 rounded bg-muted px-1 text-[10px] font-bold text-muted-foreground">{channel.quality}</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {channel.countryFlag ? `${channel.countryFlag} ` : ""}
                          {channel.countryName ?? "Unknown"}
                          {channel.categories.length > 0 ? ` · ${categoryNames.get(channel.categories[0]) ?? channel.categories[0]}` : ""}
                        </span>
                      </span>
                      {active ? <span className="flex items-end gap-0.5" aria-label="Now playing"><i className="h-3 w-0.5 animate-pulse rounded bg-primary" /><i className="h-4 w-0.5 animate-pulse rounded bg-primary [animation-delay:150ms]" /><i className="h-2 w-0.5 animate-pulse rounded bg-primary [animation-delay:300ms]" /></span> : <Play className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                    </button>
                    <button onClick={() => toggleFavorite(channel.id)} aria-label={fav ? "Remove from favorites" : "Add to favorites"} className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                      <Star className={cn("h-4 w-4", fav && "fill-amber-400 text-amber-500")} />
                    </button>
                  </div>
                );
              })}
            </div>
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
                {tab === "recent" ? <Clock className="h-6 w-6" /> : <Search className="h-6 w-6" />}
                {tab === "recent" ? "Channels you watch will show up here." : tab === "favorites" ? "Tap the star on a channel to save it here." : "No channels match. Try another word or clear the filters."}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function CtrlButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-9 min-w-9 items-center justify-center rounded-full px-2 text-white transition hover:bg-white/20 focus-visible:bg-white/20 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
