"use client";

import * as React from "react";
import { Download, Film, Loader2, Scissors, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { encodeGif, type GifFrame } from "@/lib/gifEncoder";
import { cn } from "@/lib/utils";

const FPS_OPTIONS = [5, 8, 10, 15] as const;
const WIDTH_OPTIONS = [320, 480, 640] as const;

function formatTimestamp(seconds: number): string {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = (seconds % 60).toFixed(2).padStart(5, "0");
  return `${mm}:${ss}`;
}

function parseTimestamp(value: string): number | null {
  const match = value.trim().match(/^(\d{1,3}):(\d{1,2}(?:\.\d+)?)$/);
  if (!match) return null;
  const mm = Number(match[1]);
  const ss = Number(match[2]);
  if (Number.isNaN(mm) || Number.isNaN(ss)) return null;
  return mm * 60 + ss;
}

/** Waits for the video's next "seeked" event after setting currentTime. */
function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve) => {
    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      resolve();
    };
    video.addEventListener("seeked", onSeeked);
    video.currentTime = time;
  });
}

export default function VideoToGif() {
  useTrackTool("video-to-gif");

  const [file, setFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(0);
  const [startInput, setStartInput] = React.useState("00:00.00");
  const [endInput, setEndInput] = React.useState("00:00.00");
  const [fps, setFps] = React.useState<(typeof FPS_OPTIONS)[number]>(10);
  const [maxWidth, setMaxWidth] = React.useState<(typeof WIDTH_OPTIONS)[number]>(480);
  const [isEncoding, setIsEncoding] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [gifUrl, setGifUrl] = React.useState<string | null>(null);
  const [gifBlob, setGifBlob] = React.useState<Blob | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const videoUrlRef = React.useRef<string | null>(null);
  const gifUrlRef = React.useRef<string | null>(null);
  const cancelRef = React.useRef(false);

  React.useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
      cancelRef.current = true;
    };
  }, []);

  const handleFiles = React.useCallback((files: File[]) => {
    const f = files.find((f) => f.type.startsWith("video/"));
    if (!f) return;
    setError(null);
    setGifBlob(null);
    if (gifUrlRef.current) {
      URL.revokeObjectURL(gifUrlRef.current);
      gifUrlRef.current = null;
      setGifUrl(null);
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(f);
    videoUrlRef.current = url;
    setFile(f);
    setVideoUrl(url);
    setDuration(0);
    setStart(0);
    setEnd(0);
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    // Cap the default selection so a first-time export doesn't accidentally
    // try to encode a very long clip at full resolution.
    const defaultEnd = Math.min(d, 5);
    setDuration(d);
    setStart(0);
    setEnd(defaultEnd);
    setStartInput(formatTimestamp(0));
    setEndInput(formatTimestamp(defaultEnd));
  };

  const applyStartInput = () => {
    const parsed = parseTimestamp(startInput);
    if (parsed === null || parsed < 0 || parsed >= end) {
      setStartInput(formatTimestamp(start));
      return;
    }
    setStart(parsed);
  };

  const applyEndInput = () => {
    const parsed = parseTimestamp(endInput);
    if (parsed === null || parsed <= start || parsed > duration) {
      setEndInput(formatTimestamp(end));
      return;
    }
    setEnd(parsed);
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>, which: "start" | "end") => {
    const track = e.currentTarget.parentElement;
    if (!track || duration === 0) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const t = ratio * duration;
    if (which === "start") {
      const next = Math.min(t, end - 0.1);
      setStart(next);
      setStartInput(formatTimestamp(next));
    } else {
      const next = Math.max(t, start + 0.1);
      setEnd(next);
      setEndInput(formatTimestamp(next));
    }
  };

  const handleConvert = async () => {
    const video = videoRef.current;
    if (!video || duration === 0 || end <= start) return;

    setIsEncoding(true);
    setError(null);
    setProgress(0);
    cancelRef.current = false;

    const originalTime = video.currentTime;
    const wasPlaying = !video.paused;
    video.pause();

    try {
      const sourceWidth = video.videoWidth || maxWidth;
      const sourceHeight = video.videoHeight || maxWidth;
      const scale = Math.min(1, maxWidth / sourceWidth);
      const canvasWidth = Math.max(2, Math.round(sourceWidth * scale));
      const canvasHeight = Math.max(2, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Could not acquire canvas context");
      const drawCtx = ctx;

      const clipDuration = end - start;
      const frameCount = Math.max(1, Math.round(clipDuration * fps));
      const delayCs = Math.max(2, Math.round(100 / fps));

      const frames: GifFrame[] = [];
      for (let i = 0; i < frameCount; i++) {
        if (cancelRef.current) return;
        const t = Math.min(end, start + i / fps);
        await seekTo(video, t);
        drawCtx.drawImage(video, 0, 0, canvasWidth, canvasHeight);
        const imageData = drawCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        frames.push({
          data: imageData.data,
          width: canvasWidth,
          height: canvasHeight,
          delayCs,
        });
        setProgress(Math.round(((i + 1) / frameCount) * 90));
      }

      if (cancelRef.current) return;

      // Let the progress bar paint before the synchronous encode pass.
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const blob = encodeGif(frames);
      setProgress(100);

      const url = URL.createObjectURL(blob);
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
      gifUrlRef.current = url;
      setGifUrl(url);
      setGifBlob(blob);

      const fileName = `video-to-gif-${Date.now()}.gif`;
      await saveToolResult("video-to-gif", {
        title: fileName,
        summary: `${frameCount} frames · ${fps} fps · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not convert this clip. Try a shorter selection or lower fps.");
    } finally {
      video.currentTime = originalTime;
      if (wasPlaying) void video.play();
      setIsEncoding(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!gifBlob) return;
    downloadBlob(gifBlob, `video-to-gif-${Date.now()}.gif`);
  };

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;
  const selectionSeconds = Math.max(0, end - start);
  const estimatedFrames = Math.max(1, Math.round(selectionSeconds * fps));

  return (
    <div className="space-y-6">
      {!file && (
        <DropZone
          onFiles={handleFiles}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          multiple={false}
          label="Drag & drop a video here, or click to browse"
          hint="MP4, WebM, or MOV — converted to GIF entirely in your browser"
        />
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {file && videoUrl && (
        <>
          <Card className="space-y-4 p-4">
            <video
              ref={videoRef}
              src={videoUrl}
              onLoadedMetadata={handleLoadedMetadata}
              className="w-full rounded-lg border border-border"
              playsInline
              muted
            />

            <div className="relative h-10 select-none overflow-hidden rounded-lg border border-border bg-muted/30">
              <div className="absolute inset-y-0 bg-black/60" style={{ left: 0, width: `${startPct}%` }} />
              <div className="absolute inset-y-0 bg-black/60" style={{ right: 0, width: `${100 - endPct}%` }} />
              <div
                className="absolute inset-y-0 border-y-2 border-primary bg-primary/10"
                style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
              />
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const move = (ev: MouseEvent) => handleTrackClick(ev as unknown as React.MouseEvent<HTMLDivElement>, "start");
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
                className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize bg-primary"
                style={{ left: `${startPct}%` }}
              />
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  const move = (ev: MouseEvent) => handleTrackClick(ev as unknown as React.MouseEvent<HTMLDivElement>, "end");
                  const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                  };
                  window.addEventListener("mousemove", move);
                  window.addEventListener("mouseup", up);
                }}
                className="absolute inset-y-0 z-10 w-3 -translate-x-1/2 cursor-ew-resize bg-primary"
                style={{ left: `${endPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Start</span>
                <input
                  value={startInput}
                  onChange={(e) => setStartInput(e.target.value)}
                  onBlur={applyStartInput}
                  onKeyDown={(e) => e.key === "Enter" && applyStartInput()}
                  className="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
                />
              </label>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">End</span>
                <input
                  value={endInput}
                  onChange={(e) => setEndInput(e.target.value)}
                  onBlur={applyEndInput}
                  onKeyDown={(e) => e.key === "Enter" && applyEndInput()}
                  className="w-24 rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"
                />
              </label>
              <span className="text-xs text-muted-foreground">
                Selection: {formatTimestamp(selectionSeconds)} · ~{estimatedFrames} frames
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Frame rate</span>
                <div className="flex gap-1.5">
                  {FPS_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setFps(option)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        fps === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-foreground hover:bg-muted"
                      )}
                    >
                      {option} fps
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="text-sm font-medium">Max width</span>
                <div className="flex gap-1.5">
                  {WIDTH_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setMaxWidth(option)}
                      className={cn(
                        "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                        maxWidth === option
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border bg-transparent text-foreground hover:bg-muted"
                      )}
                    >
                      {option}px
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {isEncoding && (
              <div className="space-y-1.5">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">Converting… {progress}%</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setFile(null)} disabled={isEncoding}>
                <Upload className="h-3.5 w-3.5" /> New video
              </Button>
              <Button
                size="sm"
                className="ml-auto"
                onClick={handleConvert}
                disabled={isEncoding || duration === 0 || end <= start}
              >
                {isEncoding ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Converting… {progress}%
                  </>
                ) : (
                  <>
                    <Scissors className="h-3.5 w-3.5" /> Convert to GIF
                  </>
                )}
              </Button>
            </div>
          </Card>

          {gifUrl && gifBlob && (
            <Card className="space-y-3 p-4">
              <img src={gifUrl} alt="Converted GIF preview" className="w-full rounded-lg border border-border" />
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Film className="h-3.5 w-3.5" />
                  {formatTimestamp(selectionSeconds)} · {fps} fps · {formatBytes(gifBlob.size)}
                </p>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="video-to-gif" />
    </div>
  );
}
