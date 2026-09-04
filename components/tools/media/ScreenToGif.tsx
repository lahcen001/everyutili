"use client";

import * as React from "react";
import { Circle, Download, Loader2, Monitor, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";
import { encodeGif, type GifFrame } from "@/lib/gifEncoder";

const FPS_OPTIONS = [5, 8, 10, 15] as const;
const MAX_DURATION_OPTIONS = [5, 10, 15] as const;
const MAX_CANVAS_WIDTH = 640;

type Stage = "idle" | "preparing" | "recording" | "encoding" | "done";

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function ScreenToGif() {
  useTrackTool("screen-to-gif");

  const [fps, setFps] = React.useState<(typeof FPS_OPTIONS)[number]>(8);
  const [maxDuration, setMaxDuration] = React.useState<(typeof MAX_DURATION_OPTIONS)[number]>(10);
  const [stage, setStage] = React.useState<Stage>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [encodeProgress, setEncodeProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [gifUrl, setGifUrl] = React.useState<string | null>(null);
  const [gifBlob, setGifBlob] = React.useState<Blob | null>(null);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const displayStreamRef = React.useRef<MediaStream | null>(null);
  const sourceVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const captureCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const framesRef = React.useRef<GifFrame[]>([]);
  const captureTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = React.useRef(0);
  const gifUrlRef = React.useRef<string | null>(null);

  const stopAllTracks = () => {
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current = null;
  };

  const stopCaptureLoop = () => {
    if (captureTimeoutRef.current !== null) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    if (tickIntervalRef.current !== null) {
      clearInterval(tickIntervalRef.current);
      tickIntervalRef.current = null;
    }
  };

  React.useEffect(() => {
    return () => {
      stopCaptureLoop();
      stopAllTracks();
      if (gifUrlRef.current) URL.revokeObjectURL(gifUrlRef.current);
    };
  }, []);

  const finishAndEncode = React.useCallback(async () => {
    stopCaptureLoop();
    stopAllTracks();
    setStage("encoding");
    setEncodeProgress(0);

    const frames = framesRef.current;
    if (frames.length === 0) {
      setError("No frames were captured — try recording again.");
      setStage("idle");
      return;
    }

    // Encode off the main thread's synchronous stack in chunks so the
    // progress bar can actually paint between steps (encodeGif itself is
    // synchronous CPU work; yielding via rAF between a fake "prepare" tick
    // keeps the UI responsive without adding worker infrastructure for a
    // capped, ~15s-of-frames workload).
    await new Promise((resolve) => requestAnimationFrame(resolve));
    setEncodeProgress(0.3);
    await new Promise((resolve) => requestAnimationFrame(resolve));

    try {
      const blob = encodeGif(frames);
      setEncodeProgress(1);
      const url = URL.createObjectURL(blob);
      gifUrlRef.current = url;
      setGifUrl(url);
      setGifBlob(blob);
      setStage("done");

      const fileName = `screen-to-gif-${Date.now()}.gif`;
      await saveToolResult("screen-to-gif", {
        title: fileName,
        summary: `${frames.length} frames · ${fps} fps · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch {
      setError("Encoding the GIF failed — try a shorter duration or lower fps.");
      setStage("idle");
    } finally {
      framesRef.current = [];
    }
  }, [fps]);

  const startRecording = async () => {
    setError(null);
    setStage("preparing");
    if (gifUrlRef.current) {
      URL.revokeObjectURL(gifUrlRef.current);
      gifUrlRef.current = null;
      setGifUrl(null);
    }
    setGifBlob(null);
    framesRef.current = [];

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      displayStreamRef.current = displayStream;

      const video = document.createElement("video");
      video.srcObject = displayStream;
      video.muted = true;
      await video.play();
      sourceVideoRef.current = video;

      const sourceWidth = video.videoWidth || 1280;
      const sourceHeight = video.videoHeight || 720;
      const scale = Math.min(1, MAX_CANVAS_WIDTH / sourceWidth);
      const canvasWidth = Math.max(2, Math.round(sourceWidth * scale));
      const canvasHeight = Math.max(2, Math.round(sourceHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      captureCanvasRef.current = canvas;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) {
        throw new Error("Canvas context unavailable");
      }
      const drawCtx = ctx;
      const drawVideo = video;
      const delayCs = Math.round(100 / fps);
      const frameIntervalMs = 1000 / fps;
      const maxDurationMs = maxDuration * 1000;

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        void finishAndEncode();
      });

      startTimeRef.current = performance.now();

      const captureFrame = () => {
        const elapsedMs = performance.now() - startTimeRef.current;
        if (elapsedMs >= maxDurationMs) {
          void finishAndEncode();
          return;
        }

        drawCtx.drawImage(drawVideo, 0, 0, canvasWidth, canvasHeight);
        const imageData = drawCtx.getImageData(0, 0, canvasWidth, canvasHeight);
        framesRef.current.push({
          data: imageData.data,
          width: canvasWidth,
          height: canvasHeight,
          delayCs,
        });

        captureTimeoutRef.current = setTimeout(captureFrame, frameIntervalMs);
      };

      setStage("recording");
      setElapsed(0);
      captureFrame();
      tickIntervalRef.current = setInterval(() => {
        setElapsed(Math.min(maxDuration, (performance.now() - startTimeRef.current) / 1000));
      }, 200);
    } catch {
      setError("Screen recording was cancelled or permission was denied.");
      stopAllTracks();
      setStage("idle");
    }
  };

  const stopRecording = () => {
    void finishAndEncode();
  };

  const handleDownload = async () => {
    if (!gifBlob) return;
    downloadBlob(gifBlob, `screen-to-gif-${Date.now()}.gif`);
  };

  const showSetup = (stage === "idle" || stage === "preparing") && !gifBlob;
  const remaining = Math.max(0, maxDuration - elapsed);

  return (
    <div className="space-y-6">
      {showSetup && (
        <Card className="space-y-4 p-4">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Clicking &quot;Start Recording&quot; opens your browser&apos;s native screen-share picker.
            Capture, quantization, and GIF encoding all happen on your device — nothing is uploaded.
          </div>

          <div className="flex flex-wrap gap-6">
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Frame rate</span>
              <div className="flex gap-1.5">
                {FPS_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFps(option)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      fps === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-foreground hover:bg-muted"
                    }`}
                  >
                    {option} fps
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-sm font-medium">Max duration</span>
              <div className="flex gap-1.5">
                {MAX_DURATION_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setMaxDuration(option)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                      maxDuration === option
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-transparent text-foreground hover:bg-muted"
                    }`}
                  >
                    {option}s
                  </button>
                ))}
              </div>
            </div>
          </div>

          <Button onClick={startRecording} disabled={stage === "preparing"}>
            {stage === "preparing" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for picker…
              </>
            ) : (
              <>
                <Monitor className="h-4 w-4" /> Start Recording
              </>
            )}
          </Button>
        </Card>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {stage === "recording" && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Circle className="h-3 w-3 animate-pulse fill-current text-destructive" />
              Recording · {formatElapsed(elapsed)} / {formatElapsed(maxDuration)}
            </span>

            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="destructive" onClick={stopRecording}>
                <Square className="h-3.5 w-3.5" /> Stop &amp; Encode
              </Button>
            </div>
          </div>

          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${(elapsed / maxDuration) * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-stops and encodes in {formatElapsed(remaining)}.
          </p>
        </Card>
      )}

      {stage === "encoding" && (
        <Card className="space-y-3 p-4">
          <span className="flex items-center gap-2 text-sm font-medium">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Encoding GIF…
          </span>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-150"
              style={{ width: `${encodeProgress * 100}%` }}
            />
          </div>
        </Card>
      )}

      {gifUrl && gifBlob && stage === "done" && (
        <Card className="space-y-4 p-4">
          <img src={gifUrl} alt="Recorded GIF preview" className="w-full rounded-lg border border-border" />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">{formatBytes(gifBlob.size)}</p>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={startRecording}>
                <Monitor className="h-3.5 w-3.5" /> Record Again
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="screen-to-gif" />
    </div>
  );
}
