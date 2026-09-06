"use client";

import * as React from "react";
import { Download, Loader2, Pause, Play, Repeat, Scissors, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const THUMBNAIL_COUNT = 12;
const MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

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

export default function VideoTrimmer() {
  useTrackTool("video-trimmer");

  const [file, setFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [start, setStart] = React.useState(0);
  const [end, setEnd] = React.useState(0);
  const [startInput, setStartInput] = React.useState("00:00.00");
  const [endInput, setEndInput] = React.useState("00:00.00");
  const [thumbnails, setThumbnails] = React.useState<string[]>([]);
  const [isLooping, setIsLooping] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [isExporting, setIsExporting] = React.useState(false);
  const [exportProgress, setExportProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const animationFrameRef = React.useRef<number | null>(null);
  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const videoUrlRef = React.useRef<string | null>(null);
  const resultUrlRef = React.useRef<string | null>(null);
  const thumbnailUrlsRef = React.useRef<string[]>([]);

  React.useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      for (const url of thumbnailUrlsRef.current) URL.revokeObjectURL(url);
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  const handleFiles = React.useCallback((files: File[]) => {
    const f = files.find((f) => f.type.startsWith("video/"));
    if (!f) return;
    setError(null);
    setResultBlob(null);
    if (resultUrlRef.current) {
      URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = null;
      setResultUrl(null);
    }
    if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    const url = URL.createObjectURL(f);
    videoUrlRef.current = url;
    setFile(f);
    setVideoUrl(url);
    setThumbnails([]);
    setDuration(0);
    setStart(0);
    setEnd(0);
  }, []);

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    const d = video.duration;
    setDuration(d);
    setStart(0);
    setEnd(d);
    setStartInput(formatTimestamp(0));
    setEndInput(formatTimestamp(d));
    generateThumbnails(video, d);
  };

  const generateThumbnails = (video: HTMLVideoElement, d: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 54;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const originalTime = video.currentTime;
    const frames: string[] = [];
    let i = 0;

    function captureNext() {
      if (i >= THUMBNAIL_COUNT) {
        video.currentTime = originalTime;
        for (const url of thumbnailUrlsRef.current) URL.revokeObjectURL(url);
        thumbnailUrlsRef.current = frames;
        setThumbnails(frames);
        return;
      }
      const t = (d / THUMBNAIL_COUNT) * i;
      video.currentTime = t;
      i += 1;
    }

    function handleSeeked() {
      ctx!.drawImage(video, 0, 0, canvas.width, canvas.height);
      frames.push(canvas.toDataURL("image/jpeg", 0.6));
      captureNext();
    }

    video.addEventListener("seeked", handleSeeked);
    captureNext();

    // Cleanup listener once all frames are captured (loop condition itself stops calls).
    setTimeout(() => video.removeEventListener("seeked", handleSeeked), (d / THUMBNAIL_COUNT) * THUMBNAIL_COUNT * 200 + 3000);
  };

  // Loop playback within [start, end] while previewing.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !isPlaying) return;

    function tick() {
      if (!video) return;
      if (video.currentTime >= end || video.currentTime < start) {
        if (isLooping) {
          video.currentTime = start;
        } else {
          video.pause();
          setIsPlaying(false);
          return;
        }
      }
      animationFrameRef.current = requestAnimationFrame(tick);
    }
    animationFrameRef.current = requestAnimationFrame(tick);
    return () => {
      if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying, isLooping, start, end]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      if (video.currentTime < start || video.currentTime >= end) video.currentTime = start;
      video.play();
      setIsPlaying(true);
    }
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

  const handleExport = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || duration === 0) return;

    setIsExporting(true);
    setError(null);
    setExportProgress(0);

    try {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Could not acquire canvas context");

      const canvasStream = canvas.captureStream(30);
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(canvasStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      video.pause();
      setIsPlaying(false);
      video.currentTime = start;
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve(null);
        };
        video.addEventListener("seeked", onSeeked);
      });

      recorder.start();
      await video.play();

      const drawCtx = ctx;
      const drawCanvas = canvas;
      const drawVideo = video;
      await new Promise<void>((resolve) => {
        function draw() {
          if (drawVideo.currentTime >= end || drawVideo.paused) {
            resolve();
            return;
          }
          drawCtx.drawImage(drawVideo, 0, 0, drawCanvas.width, drawCanvas.height);
          setExportProgress(Math.min(100, ((drawVideo.currentTime - start) / (end - start)) * 100));
          animationFrameRef.current = requestAnimationFrame(draw);
        }
        draw();
      });

      video.pause();
      recorder.stop();
      const blob = await stopped;

      const url = URL.createObjectURL(blob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultBlob(blob);

      const fileName = `trimmed-${Date.now()}.webm`;
      await saveToolResult("video-trimmer", {
        title: fileName,
        summary: `${formatTimestamp(end - start)} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not export the trimmed video. Try a shorter selection.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `trimmed-${Date.now()}.webm`);
  };

  const startPct = duration > 0 ? (start / duration) * 100 : 0;
  const endPct = duration > 0 ? (end / duration) * 100 : 100;

  return (
    <div className="space-y-6">
      {!file && (
        <DropZone
          onFiles={handleFiles}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          multiple={false}
          label="Drag & drop a video here, or click to browse"
          hint="MP4, WebM, or MOV — trimmed and processed entirely in your browser"
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
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={togglePlay} disabled={duration === 0}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Pause" : "Preview"}
              </Button>
              <Button
                size="sm"
                variant={isLooping ? "default" : "outline"}
                onClick={() => setIsLooping((v) => !v)}
              >
                <Repeat className="h-3.5 w-3.5" /> Loop
              </Button>
              <span className="text-xs text-muted-foreground">
                Selection: {formatTimestamp(end - start)}
              </span>
            </div>

            {/* Dual-handle timeline with thumbnail strip */}
            <div className="relative h-16 select-none overflow-hidden rounded-lg border border-border bg-muted/30">
              {thumbnails.length > 0 && (
                <div className="absolute inset-0 flex">
                  {thumbnails.map((src, i) => (
                    <img key={i} src={src} alt="" className="h-full flex-1 object-cover opacity-60" />
                  ))}
                </div>
              )}
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

              <div className="ml-auto flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setFile(null)}>
                  <Upload className="h-3.5 w-3.5" /> New video
                </Button>
                <Button size="sm" onClick={handleExport} disabled={isExporting || duration === 0}>
                  {isExporting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Trimming… {Math.round(exportProgress)}%
                    </>
                  ) : (
                    <>
                      <Scissors className="h-3.5 w-3.5" /> Trim & Export
                    </>
                  )}
                </Button>
              </div>
            </div>
          </Card>

          {resultUrl && resultBlob && (
            <Card className="space-y-3 p-4">
              <video src={resultUrl} controls className="w-full rounded-lg border border-border" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {formatTimestamp(end - start)} · {formatBytes(resultBlob.size)}
                </p>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="video-trimmer" />
    </div>
  );
}
