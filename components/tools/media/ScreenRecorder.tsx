"use client";

import * as React from "react";
import { Circle, Download, Loader2, Mic, MicOff, Pause, Play, Square, Video } from "lucide-react";

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
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

type RecordingState = "idle" | "recording" | "paused";

export default function ScreenRecorder() {
  useTrackTool("screen-recorder");
  const [includeMic, setIncludeMic] = React.useState(false);
  const [state, setState] = React.useState<RecordingState>("idle");
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [videoUrl, setVideoUrl] = React.useState<string | null>(null);
  const [resultBlob, setResultBlob] = React.useState<Blob | null>(null);
  const [resultSize, setResultSize] = React.useState(0);
  const [isPreparing, setIsPreparing] = React.useState(false);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const displayStreamRef = React.useRef<MediaStream | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const videoUrlRef = React.useRef<string | null>(null);

  const stopInterval = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const stopAllTracks = () => {
    displayStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    displayStreamRef.current = null;
    micStreamRef.current = null;
  };

  React.useEffect(() => {
    return () => {
      stopInterval();
      stopAllTracks();
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    };
  }, []);

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
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
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

      // Combining tracks directly (rather than mixing via AudioContext) is a
      // deliberate simplification: MediaRecorder happily records multiple
      // audio tracks on one MediaStream without a true mix-down.
      const tracks = [
        ...displayStream.getVideoTracks(),
        ...displayStream.getAudioTracks(),
        ...(micStream ? micStream.getAudioTracks() : []),
      ];
      const combinedStream = new MediaStream(tracks);

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
        stopAllTracks();
        setState("idle");
      });

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setElapsed(0);
      stopInterval();
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } catch {
      setError("Screen recording was cancelled or permission was denied.");
      stopAllTracks();
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
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    setState("recording");
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    stopInterval();
    stopAllTracks();
    setState("idle");
  };

  const handleDownload = async () => {
    if (!resultBlob) return;
    const fileName = `screen-recording-${Date.now()}.webm`;
    downloadBlob(resultBlob, fileName);
    await saveToolResult("screen-recorder", {
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
            Clicking &quot;Start Recording&quot; opens your browser&apos;s native screen-share
            picker, where you choose a screen, window, or tab to record. Recording happens
            entirely on your device — nothing is uploaded.
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeMic}
              onChange={(e) => setIncludeMic(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            {includeMic ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4 text-muted-foreground" />}
            Include microphone audio
          </label>

          <Button onClick={startRecording} disabled={isPreparing}>
            {isPreparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Waiting for picker…
              </>
            ) : (
              <>
                <Video className="h-4 w-4" /> Start Recording
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
        <Card className="flex flex-wrap items-center gap-4 p-4">
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
                <Video className="h-3.5 w-3.5" /> Record Again
              </Button>
              <Button size="sm" onClick={handleDownload}>
                <Download className="h-3.5 w-3.5" /> Download
              </Button>
            </div>
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="screen-recorder" />
    </div>
  );
}
