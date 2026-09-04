"use client";

import * as React from "react";
import { Circle, Download, Loader2, Mic, MicOff, Monitor, Pause, Play, Square, Video, VideoOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const MIME_CANDIDATES = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=vp9",
  "video/webm",
];

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "video/webm";
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type RecordingState = "idle" | "recording" | "paused";

const PIP_SIZE = 160;
const PIP_MARGIN = 24;

export default function ScreenStudio() {
  useTrackTool("screen-studio");

  const [includeMic, setIncludeMic] = React.useState(true);
  const [includeWebcam, setIncludeWebcam] = React.useState(false);
  const [state, setState] = React.useState<RecordingState>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [resultSize, setResultSize] = React.useState(0);
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [audioLevel, setAudioLevel] = React.useState(0);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const displayStreamRef = React.useRef<MediaStream | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const webcamStreamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const videoUrlRef = React.useRef<string | null>(null);

  const compositeCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const compositeAnimationRef = React.useRef<number | null>(null);
  const sourceVideoRef = React.useRef<HTMLVideoElement | null>(null);
  const webcamVideoRef = React.useRef<HTMLVideoElement | null>(null);

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = React.useRef<number | null>(null);

  const stopInterval = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopVisualizer = () => {
    if (visualizerFrameRef.current !== null) {
      cancelAnimationFrame(visualizerFrameRef.current);
      visualizerFrameRef.current = null;
    }
    audioContextRef.current?.close().catch(() => {});
    audioContextRef.current = null;
    analyserRef.current = null;
    setAudioLevel(0);
  };

  const stopComposite = () => {
    if (compositeAnimationRef.current !== null) {
      cancelAnimationFrame(compositeAnimationRef.current);
      compositeAnimationRef.current = null;
    }
  };

  const stopAllTracks = () => {
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    webcamStreamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
    webcamStreamRef.current = null;
  };

  React.useEffect(() => {
    return () => {
      stopInterval();
      stopVisualizer();
      stopComposite();
      stopAllTracks();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

  function startAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioContextRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      function tick() {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setAudioLevel(avg / 255);
        visualizerFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch {
      // Visualizer is a nice-to-have; recording still works without it.
    }
  }

  /** Composites display + webcam PiP circle onto a canvas, streamed via captureStream for MediaRecorder. */
  function startCompositor(displayVideo: HTMLVideoElement, webcamVideo: HTMLVideoElement | null): MediaStream {
    const canvas = document.createElement("canvas");
    canvas.width = displayVideo.videoWidth || 1280;
    canvas.height = displayVideo.videoHeight || 720;
    compositeCanvasRef.current = canvas;
    const ctx = canvas.getContext("2d");

    function draw() {
      if (!ctx) return;
      ctx.drawImage(displayVideo, 0, 0, canvas.width, canvas.height);

      if (webcamVideo && webcamVideo.videoWidth > 0) {
        const cx = canvas.width - PIP_SIZE / 2 - PIP_MARGIN;
        const cy = canvas.height - PIP_SIZE / 2 - PIP_MARGIN;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, PIP_SIZE / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        const vw = webcamVideo.videoWidth;
        const vh = webcamVideo.videoHeight;
        const scale = Math.max(PIP_SIZE / vw, PIP_SIZE / vh);
        const dw = vw * scale;
        const dh = vh * scale;
        ctx.drawImage(webcamVideo, cx - dw / 2, cy - dh / 2, dw, dh);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(cx, cy, PIP_SIZE / 2, 0, Math.PI * 2);
        ctx.strokeStyle = "#6366f1";
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      compositeAnimationRef.current = requestAnimationFrame(draw);
    }
    draw();

    return canvas.captureStream(30);
  }

  const startRecording = async () => {
    setError(null);
    setIsPreparing(true);
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current);
      videoUrlRef.current = null;
      setVideoUrl(null);
    }
    setResultBlob(null);

    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      displayStreamRef.current = displayStream;

      let micStream: MediaStream | null = null;
      if (includeMic) {
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;
        } catch {
          setError("Could not access microphone — recording screen/tab audio only.");
        }
      }

      let webcamStream: MediaStream | null = null;
      if (includeWebcam) {
        try {
          webcamStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 320 } });
          webcamStreamRef.current = webcamStream;
        } catch {
          setError((prev) => prev ?? "Could not access webcam — recording screen only.");
        }
      }

      const displayVideoEl = document.createElement("video");
      displayVideoEl.srcObject = displayStream;
      displayVideoEl.muted = true;
      await displayVideoEl.play();
      sourceVideoRef.current = displayVideoEl;

      let webcamVideoEl: HTMLVideoElement | null = null;
      if (webcamStream) {
        webcamVideoEl = document.createElement("video");
        webcamVideoEl.srcObject = webcamStream;
        webcamVideoEl.muted = true;
        await webcamVideoEl.play();
        webcamVideoRef.current = webcamVideoEl;
      }

      const compositeVideoStream = startCompositor(displayVideoEl, webcamVideoEl);

      const audioTracks = [
        ...displayStream.getAudioTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
      ];
      const combinedStream = new MediaStream([...compositeVideoStream.getVideoTracks(), ...audioTracks]);

      if (audioTracks.length > 0) {
        startAudioVisualizer(new MediaStream(audioTracks));
      }

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        videoUrlRef.current = url;
        setVideoUrl(url);
        setResultBlob(blob);
        setResultSize(blob.size);
      };

      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        recorderRef.current?.stop();
        stopInterval();
        stopVisualizer();
        stopComposite();
        stopAllTracks();
        setState("idle");
      });

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setElapsed(0);
      stopInterval();
      intervalRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    } catch {
      setError("Screen recording was cancelled or permission was denied.");
      stopAllTracks();
      stopComposite();
    } finally {
      setIsPreparing(false);
    }
  };

  const pauseRecording = () => {
    recorderRef.current?.pause();
    stopInterval();
    setState("paused");
  };

  const resumeRecording = () => {
    recorderRef.current?.resume();
    intervalRef.current = setInterval(() => setElapsed((prev) => prev + 1), 1000);
    setState("recording");
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    stopInterval();
    stopVisualizer();
    stopComposite();
    stopAllTracks();
    setState("idle");
  };

  const handleDownload = async () => {
    if (!resultBlob) return;
    const fileName = `screen-studio-${Date.now()}.webm`;
    downloadBlob(resultBlob, fileName);
    await saveToolResult("screen-studio", {
      title: fileName,
      summary: `${formatElapsed(elapsed)} · ${formatBytes(resultSize)}`,
      blob: resultBlob,
    });
    historyRef.current?.refresh();
  };

  const isIdle = state === "idle" && !resultBlob;

  return (
    <div className="space-y-6">
      {isIdle && (
        <Card className="space-y-4 p-4">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Clicking &quot;Start Recording&quot; opens your browser&apos;s native screen-share picker.
            Recording, compositing, and encoding all happen on your device — nothing is uploaded.
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeMic}
                onChange={(e) => setIncludeMic(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {includeMic ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
              Microphone audio
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={includeWebcam}
                onChange={(e) => setIncludeWebcam(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              {includeWebcam ? <Video className="h-4 w-4 text-primary" /> : <VideoOff className="h-4 w-4 text-muted-foreground" />}
              Webcam picture-in-picture
            </label>
          </div>

          <Button onClick={startRecording} disabled={isPreparing}>
            {isPreparing ? (
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

      {(state === "recording" || state === "paused") && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Circle
                className={`h-3 w-3 fill-current text-destructive ${state === "recording" ? "animate-pulse" : ""}`}
              />
              {state === "recording" ? "Recording" : "Paused"} · {formatElapsed(elapsed)}
            </span>

            <div className="ml-auto flex items-center gap-2">
              {state === "recording" ? (
                <Button size="sm" variant="outline" onClick={pauseRecording}>
                  <Pause className="h-3.5 w-3.5" /> Pause
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={resumeRecording}>
                  <Play className="h-3.5 w-3.5" /> Resume
                </Button>
              )}
              <Button size="sm" variant="destructive" onClick={stopRecording}>
                <Square className="h-3.5 w-3.5" /> Stop Recording
              </Button>
            </div>
          </div>

          {/* Audio level visualizer bar */}
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-100"
                style={{ width: `${Math.min(100, audioLevel * 140)}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {videoUrl && resultBlob && (
        <Card className="space-y-4 p-4">
          <video src={videoUrl} controls className="w-full rounded-lg border border-border" />
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs text-muted-foreground">
              {formatElapsed(elapsed)} · {formatBytes(resultSize)}
            </p>
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="outline" onClick={startRecording} disabled={isPreparing}>
                <Monitor className="h-3.5 w-3.5" /> Record Again
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="screen-studio" />
    </div>
  );
}
