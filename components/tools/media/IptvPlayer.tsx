"use client";

import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { AlertTriangle, Loader2, Play, Search, Star, Tv, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { cn } from "@/lib/utils";
import { loadIptvDirectory, type IptvChannel, type IptvDirectory } from "@/lib/iptv";

const FAVORITES_KEY = "onmitools:iptv-favorites";
const ROW_HEIGHT = 56;

function loadFavorites(): Set<string> {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveFavorites(favorites: Set<string>) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  } catch {
    // Favorites are a nice-to-have; failing to persist shouldn't break playback.
  }
}

type LoadState = "loading" | "ready" | "error";
type PlaybackState = "idle" | "loading" | "playing" | "error";

export default function IptvPlayer() {
  useTrackTool("iptv-player");

  const [loadState, setLoadState] = React.useState<LoadState>("loading");
  const [directory, setDirectory] = React.useState<IptvDirectory | null>(null);
  const [search, setSearch] = React.useState("");
  const [countryFilter, setCountryFilter] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [favoritesOnly, setFavoritesOnly] = React.useState(false);
  const [favorites, setFavorites] = React.useState<Set<string>>(() => new Set());
  const [selected, setSelected] = React.useState<IptvChannel | null>(null);
  const [playback, setPlayback] = React.useState<PlaybackState>("idle");

  const scrollRef = React.useRef<HTMLDivElement | null>(null);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const hlsRef = React.useRef<import("hls.js").default | null>(null);

  React.useEffect(() => {
    setFavorites(loadFavorites());
  }, []);

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

  const playChannel = React.useCallback(
    async (channel: IptvChannel) => {
      setSelected(channel);
      setPlayback("loading");
      destroyPlayer();

      const video = videoRef.current;
      if (!video) return;

      const canPlayNative = video.canPlayType("application/vnd.apple.mpegurl");
      if (canPlayNative) {
        video.src = channel.streamUrl;
        try {
          await video.play();
          setPlayback("playing");
        } catch {
          setPlayback("error");
        }
        return;
      }

      try {
        const { default: Hls } = await import("hls.js");
        if (!Hls.isSupported()) {
          setPlayback("error");
          return;
        }
        const hls = new Hls({ maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setPlayback("error");
        });
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().then(
            () => setPlayback("playing"),
            () => setPlayback("error")
          );
        });
        hls.loadSource(channel.streamUrl);
        hls.attachMedia(video);
      } catch {
        setPlayback("error");
      }
    },
    [destroyPlayer]
  );

  const toggleFavorite = React.useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }, []);

  const filtered = React.useMemo(() => {
    if (!directory) return [];
    const normalizedSearch = search.trim().toLowerCase();
    return directory.channels.filter((channel) => {
      if (favoritesOnly && !favorites.has(channel.id)) return false;
      if (countryFilter && channel.countryCode !== countryFilter) return false;
      if (categoryFilter && !channel.categories.includes(categoryFilter)) return false;
      if (normalizedSearch && !channel.name.toLowerCase().includes(normalizedSearch)) return false;
      return true;
    });
  }, [directory, search, countryFilter, categoryFilter, favoritesOnly, favorites]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  if (loadState === "loading") {
    return (
      <Card className="flex h-80 flex-col items-center justify-center gap-3 p-4 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading channel directory…
      </Card>
    );
  }

  if (loadState === "error" || !directory) {
    return (
      <Card className="flex h-80 flex-col items-center justify-center gap-2 p-4 text-center text-sm text-muted-foreground">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        Couldn&apos;t load the channel directory. Check your connection and reload the page.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        Channel listings and streams are sourced live from the community-maintained{" "}
        <a
          href="https://github.com/iptv-org/iptv"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          iptv-org
        </a>{" "}
        project — not hosted or verified by this site. Availability, legality, and quality vary by
        region and channel, and some streams may be offline.
      </div>

      <Card className="space-y-4 p-4">
        <video
          ref={videoRef}
          controls
          playsInline
          className={cn(
            "aspect-video w-full rounded-lg border border-border bg-black",
            !selected && "hidden"
          )}
        />

        {!selected && (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm text-muted-foreground">
            <Tv className="h-6 w-6" />
            Select a channel below to start watching
          </div>
        )}

        {selected && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{selected.name}</p>
            {playback === "loading" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Connecting…
              </span>
            )}
            {playback === "error" && (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <AlertTriangle className="h-3 w-3" /> This stream couldn&apos;t be played — try another
                channel.
              </span>
            )}
          </div>
        )}
      </Card>

      <Card className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search channels…"
              className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={countryFilter}
            onChange={(e) => setCountryFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">All countries</option>
            {directory.countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
          >
            <option value="">All categories</option>
            {directory.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <Button
            size="sm"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((v) => !v)}
          >
            <Star className="h-3.5 w-3.5" /> Favorites
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {filtered.length.toLocaleString()} channel{filtered.length === 1 ? "" : "s"}
        </p>

        <div ref={scrollRef} className="max-h-[480px] overflow-auto rounded-lg border border-border">
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const channel = filtered[virtualRow.index];
              const isFavorite = favorites.has(channel.id);
              const isSelected = selected?.id === channel.id;
              return (
                <div
                  key={channel.id}
                  data-index={virtualRow.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: ROW_HEIGHT,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    "flex items-center gap-3 border-b border-border px-3 last:border-b-0",
                    isSelected && "bg-muted/40"
                  )}
                >
                  <button
                    onClick={() => playChannel(channel)}
                    className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                      {channel.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={channel.logo}
                          alt=""
                          className="h-full w-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <Tv className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{channel.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {channel.countryFlag ? `${channel.countryFlag} ` : ""}
                        {channel.countryName ?? "Unknown"}
                        {channel.categories.length > 0 ? ` · ${channel.categories[0]}` : ""}
                      </p>
                    </div>
                    <Play className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                  <button
                    onClick={() => toggleFavorite(channel.id)}
                    aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <Star className={cn("h-4 w-4", isFavorite && "fill-current text-primary")} />
                  </button>
                </div>
              );
            })}
          </div>
          {filtered.length === 0 && (
            <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
              No channels match your filters.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
