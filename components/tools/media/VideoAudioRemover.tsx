"use client";

import * as React from "react";
import { Download, Loader2, Play, Upload, Volume2, VolumeX } from "lucide-react";

import { DropZone } from "@/components/tool-shell/DropZone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useTrackTool } from "@/hooks/useTrackTool";
import { useIncomingHandoff } from "@/hooks/useIncomingHandoff";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const VIDEO_MIME_CANDIDATES = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
const AUDIO_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];

function pickMimeType(candidates: string[], fallback: string): string {
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return fallback;
}

type Mode = "mute" | "extract";

/** Not all lib.dom.d.ts versions declare HTMLVideoElement.captureStream(). */
interface CaptureStreamVideoElement extends HTMLVideoElement {
  captureStream?: () => MediaStream;
}

export default function VideoAudioRemover() {
  useTrackTool("video-audio-remover");

  const [file, setFile] = React.useState<File | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [duration, setDuration] = React.useState(0);
  const [mode, setMode] = React.useState<Mode>("mute");
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [resultUrl, setResultUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [resultKind, setResultKind] = React.useState<Mode>("mute");

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
  }, []);

  // Picks up a "Send to..." handoff from another tool via ?from=<id>,
  // feeding it through the same path as a manual drop.
  useIncomingHandoff((file) => handleFiles([file]));

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (!video) return;
    setDuration(video.duration);
  };

  const handleMute = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || duration === 0) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not acquire canvas context");

    // Silent stream: only the canvas's video track, deliberately no audio track added.
    const canvasStream = canvas.captureStream(30);
    const silentStream = new MediaStream(canvasStream.getVideoTracks());
    const mimeType = pickMimeType(VIDEO_MIME_CANDIDATES, "video/webm");
    const recorder = new MediaRecorder(silentStream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    video.pause();
    video.muted = true;
    video.currentTime = 0;
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
        if (drawVideo.paused || drawVideo.ended) {
          resolve();
          return;
        }
        drawCtx.drawImage(drawVideo, 0, 0, drawCanvas.width, drawCanvas.height);
        setProgress(Math.min(100, (drawVideo.currentTime / duration) * 100));
        animationFrameRef.current = requestAnimationFrame(draw);
      }
      draw();
    });

    video.pause();
    video.muted = false;
    recorder.stop();
    const blob = await stopped;
    return blob;
  };

  const handleExtractAudio = async () => {
    const video = videoRef.current as CaptureStreamVideoElement | null;
    if (!video || duration === 0) return;
    if (typeof video.captureStream !== "function") {
      throw new Error("Audio extraction is not supported in this browser");
    }
    const captureStream = video.captureStream;

    video.pause();
    video.currentTime = 0;
    await new Promise((resolve) => {
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve(null);
      };
      video.addEventListener("seeked", onSeeked);
    });

    const fullStream = captureStream.call(video);
    const audioTracks = fullStream.getAudioTracks();
    if (audioTracks.length === 0) {
      throw new Error("This video has no audio track to extract");
    }
    const audioOnlyStream = new MediaStream(audioTracks);
    const mimeType = pickMimeType(AUDIO_MIME_CANDIDATES, "audio/webm");
    const recorder = new MediaRecorder(audioOnlyStream, { mimeType });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const stopped = new Promise<Blob>((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    });

    recorder.start();
    video.muted = false;
    video.volume = 0;
    await video.play();

    const trackVideo = video;
    await new Promise<void>((resolve) => {
      function tick() {
        if (trackVideo.paused || trackVideo.ended) {
          resolve();
          return;
        }
        setProgress(Math.min(100, (trackVideo.currentTime / duration) * 100));
        animationFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    });

    video.pause();
    video.volume = 1;
    recorder.stop();
    const blob = await stopped;
    return blob;
  };

  const handleProcess = async () => {
    const video = videoRef.current;
    if (!video || duration === 0) return;

    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const blob = mode === "mute" ? await handleMute() : await handleExtractAudio();
      if (!blob) throw new Error("Processing failed");

      const url = URL.createObjectURL(blob);
      if (resultUrlRef.current) URL.revokeObjectURL(resultUrlRef.current);
      resultUrlRef.current = url;
      setResultUrl(url);
      setResultBlob(blob);
      setResultKind(mode);

      const fileName = mode === "mute" ? `muted-${Date.now()}.webm` : `audio-${Date.now()}.webm`;
      await saveToolResult("video-audio-remover", {
        title: fileName,
        summary: `${mode === "mute" ? "Muted video" : "Extracted audio"} · ${formatBytes(blob.size)}`,
        blob,
      });
      historyRef.current?.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not process this video. Try a different file or browser."
      );
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const handleDownload = () => {
    if (!resultBlob) return;
    const fileName = resultKind === "mute" ? `muted-${Date.now()}.webm` : `audio-${Date.now()}.webm`;
    downloadBlob(resultBlob, fileName);
  };

  return (
    <div className="space-y-6">
      {!file && (
        <DropZone
          onFiles={handleFiles}
          accept="video/mp4,video/webm,video/quicktime,.mov"
          multiple={false}
          label="Drag & drop a video here, or click to browse"
          hint="MP4, WebM, or MOV — muted or extracted entirely in your browser"
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
              controls
              playsInline
            />
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant={mode === "mute" ? "default" : "outline"}
                onClick={() => setMode("mute")}
                disabled={isProcessing}
              >
                <VolumeX className="h-3.5 w-3.5" /> Mute video
              </Button>
              <Button
                size="sm"
                variant={mode === "extract" ? "default" : "outline"}
                onClick={() => setMode("extract")}
                disabled={isProcessing}
              >
                <Volume2 className="h-3.5 w-3.5" /> Extract audio only
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              {mode === "mute"
                ? "Produces a silent copy of this video with the audio track removed."
                : "Produces a standalone audio file (.webm) from this video's soundtrack."}
            </p>

            {isProcessing && (
              <div className="space-y-1.5">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">
                  {mode === "mute" ? "Muting" : "Extracting"}… {Math.round(progress)}%
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setFile(null)} disabled={isProcessing}>
                <Upload className="h-3.5 w-3.5" /> New video
              </Button>
              <Button size="sm" className="ml-auto" onClick={handleProcess} disabled={isProcessing || duration === 0}>
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" />
                    {mode === "mute" ? "Mute & Export" : "Extract Audio"}
                  </>
                )}
              </Button>
            </div>
          </Card>

          {resultUrl && resultBlob && (
            <Card className="space-y-3 p-4">
              {resultKind === "mute" ? (
                <video src={resultUrl} controls className="w-full rounded-lg border border-border" />
              ) : (
                <audio src={resultUrl} controls className="w-full" />
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {resultKind === "mute" ? "Silent video" : "Extracted audio"} · {formatBytes(resultBlob.size)}
                </p>
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-3.5 w-3.5" /> Download
                </Button>
              </div>
            </Card>
          )}
        </>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="video-audio-remover" />
    </div>
  );
}
