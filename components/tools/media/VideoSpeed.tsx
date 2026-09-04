"use client";

import * as React from "react";
import { Download, Gauge, Loader2, Pause, Play, Upload } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const MIN_AUDIO_SPEED = 0.5;
const MAX_AUDIO_SPEED = 2;

function speedLabel(speed: number): string {
  return `${speed}x`;
}

/** Not all lib.dom.d.ts versions declare HTMLVideoElement.captureStream(). */
interface CaptureStreamVideoElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
}

export default function VideoSpeed() {
  useTrackTool("video-speed");

  const [file, setFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [speed, setSpeed] = React.useState(1);
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

  React.useEffect(() => {
    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
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
    setDuration(0);
    setSpeed(1);
  }, []);

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
    video.playbackRate = speed;
  };

  // Keep the live preview's playback rate in sync with the chosen speed.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = speed;
  }, [speed]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.playbackRate = speed;
      video.play();
      setIsPlaying(true);
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
      const includeAudio = speed >= MIN_AUDIO_SPEED && speed <= MAX_AUDIO_SPEED;

      const captureStreamVideo = video as CaptureStreamVideoElement;
      let combinedStream: MediaStream = canvasStream;
      if (includeAudio && typeof captureStreamVideo.captureStream === "function") {
        try {
          const mediaStream = captureStreamVideo.captureStream();
          const audioTracks = mediaStream.getAudioTracks();
          if (audioTracks.length > 0) {
            combinedStream = new MediaStream([...canvasStream.getVideoTracks(), ...audioTracks]);
          }
        } catch {
          // Fall back to video-only stream if audio capture isn't available.
        }
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      const stopped = new Promise<Blob>((resolve) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
      });

      video.pause();
      setIsPlaying(false);
      video.currentTime = 0;
      await new Promise((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve(null);
        };
        video.addEventListener("seeked", onSeeked);
      });

      video.muted = !includeAudio;
      video.playbackRate = speed;

      recorder.start();
      await video.play();

      const drawCtx = ctx;
      const drawCanvas = canvas;
      const drawVideo = video;
      await new Promise<void>((resolve) => {
        function draw() {
          if (drawVideo.paused || drawVideo.ended) {
            resolve();
            return;
          }
          drawCtx.drawImage(drawVideo, 0, 0, drawCanvas.width, drawCanvas.height);
          setExportProgress(Math.min(100, (drawVideo.currentTime / duration) * 100));
          animationFrameRef.current = requestAnimationFrame(draw);
        }
        draw();
      });

      video.pause();
      video.muted = false;
      recorder.stop();
      const blob = await stopped;

      const url = URL.createObjectURL(blob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultBlob(blob);

      const fileName = `speed-${speed}x-${Date.now()}.webm`;
      await saveToolResult("video-speed", {
        title: fileName,
        summary: `${speedLabel(speed)} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Could not export the sped-up video. Try a different speed or a shorter clip.");
    } finally {
      setIsExporting(false);
      setExportProgress(0);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    downloadBlob(resultBlob, `speed-${speed}x-${Date.now()}.webm`);
  };

  const audioWillBeOmitted = speed < MIN_AUDIO_SPEED || speed > MAX_AUDIO_SPEED;

  return (
    <div className="space-y-6">
      {!file && (
        <DropZone
          onFiles={handleFiles}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          multiple={false}
          label="Drag & drop a video here, or click to browse"
          hint="MP4, WebM, or MOV — sped up or slowed down entirely in your browser"
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
              onEnded={() => setIsPlaying(false)}
              className="w-full rounded-lg border border-border"
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex items-center gap-3">
              <Button size="sm" variant="outline" onClick={togglePlay} disabled={duration === 0}>
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                {isPlaying ? "Pause" : "Preview"}
              </Button>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Gauge className="h-3.5 w-3.5" /> Playing at {speedLabel(speed)}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {SPEED_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    size="sm"
                    variant={speed === preset ? "default" : "outline"}
                    onClick={() => setSpeed(preset)}
                    disabled={isExporting}
                  >
                    {speedLabel(preset)}
                  </Button>
                ))}
              </div>

              <label className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-muted-foreground">Fine-tune</span>
                <input
                  type="range"
                  min={0.25}
                  max={4}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  disabled={isExporting}
                  className="w-full accent-primary"
                />
                <span className="w-12 shrink-0 text-right font-mono text-xs">{speedLabel(speed)}</span>
              </label>
            </div>

            {audioWillBeOmitted && (
              <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                Audio may be omitted at extreme speeds — the exported file will be silent outside roughly
                0.5x–2x.
              </p>
            )}

            {isExporting && (
              <div className="space-y-1.5">
                <Progress value={exportProgress} />
                <p className="text-xs text-muted-foreground">Exporting… {Math.round(exportProgress)}%</p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setFile(null)} disabled={isExporting}>
                <Upload className="h-3.5 w-3.5" /> New video
              </Button>
              <Button size="sm" className="ml-auto" onClick={handleExport} disabled={isExporting || duration === 0}>
                {isExporting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Exporting…
                  </>
                ) : (
                  <>
                    <Gauge className="h-3.5 w-3.5" /> Export at {speedLabel(speed)}
                  </>
                )}
              </Button>
            </div>
          </Card>

          {resultUrl && resultBlob && (
            <Card className="space-y-3 p-4">
              <video src={resultUrl} controls className="w-full rounded-lg border border-border" />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {speedLabel(speed)} · {formatBytes(resultBlob.size)}
                </p>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="video-speed" />
    </div>
  );
}
