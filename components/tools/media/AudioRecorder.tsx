"use client";

import * as React from "react";
import { Circle, Download, Loader2, Mic, MicOff, Pause, Play, Square, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useTrackTool } from "@/hooks/useTrackTool";
import { saveToolResult } from "@/lib/storage/toolHistoryDb";
import { ToolHistoryList, type ToolHistoryListHandle } from "@/components/tools/shared/ToolHistoryList";
import { downloadBlob } from "@/lib/downloadBlob";
import { formatBytes } from "@/lib/format";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

function pickMimeType(): string {
  for (const candidate of MIME_CANDIDATES) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return "audio/webm";
}

function extensionFor(mimeType: string): string {
  if (mimeType.includes("mp4")) return "m4a";
  return "webm";
}

function formatElapsed(seconds: number): string {
  const mm = Math.floor(seconds / 60).toString().padStart(2, "0");
  const ss = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

type RecordingState = "idle" | "recording" | "paused";

interface Take {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  createdAt: number;
}

export default function AudioRecorder() {
  useTrackTool("audio-recorder");

  const [state, setState] = React.useState<RecordingState>("idle");
  const [isPreparing, setIsPreparing] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [takes, setTakes] = React.useState<Take[]>([]);

  const historyRef = React.useRef<ToolHistoryListHandle>(null);
  const recorderRef = React.useRef<MediaRecorder | null>(null);
  const micStreamRef = React.useRef<MediaStream | null>(null);
  const chunksRef = React.useRef<BlobPart[]>([]);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedAtPauseRef = React.useRef(0);

  const audioContextRef = React.useRef<AudioContext | null>(null);
  const analyserRef = React.useRef<AnalyserNode | null>(null);
  const visualizerFrameRef = React.useRef<number | null>(null);

  const takesRef = React.useRef<Take[]>([]);
  React.useEffect(() => {
    takesRef.current = takes;
  }, [takes]);

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

  const stopMicTrack = () => {
    micStreamRef.current?.getTracks().forEach((track) => track.stop());
    micStreamRef.current = null;
  };

  React.useEffect(() => {
    return () => {
      stopInterval();
      stopVisualizer();
      stopMicTrack();
      for (const take of takesRef.current) URL.revokeObjectURL(take.url);
    };
  }, []);

  function startAudioVisualizer(stream: MediaStream) {
    try {
      const AudioCtx =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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

  const startRecording = async () => {
    setError(null);
    setIsPreparing(true);

    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = micStream;

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(micStream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        const url = URL.createObjectURL(blob);
        const take: Take = {
          id: crypto.randomUUID(),
          blob,
          url,
          duration: elapsedAtPauseRef.current,
          createdAt: Date.now(),
        };
        setTakes((prev) => [take, ...prev]);
      };

      startAudioVisualizer(micStream);

      recorderRef.current = recorder;
      recorder.start();
      setState("recording");
      setElapsed(0);
      elapsedAtPauseRef.current = 0;
      stopInterval();
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          elapsedAtPauseRef.current = next;
          return next;
        });
      }, 1000);
    } catch {
      setError("Could not access the microphone — check your browser permissions.");
      stopMicTrack();
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
      setElapsed((prev) => {
        const next = prev + 1;
        elapsedAtPauseRef.current = next;
        return next;
      });
    }, 1000);
    setState("recording");
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    stopInterval();
    stopVisualizer();
    stopMicTrack();
    setState("idle");
  };

  const handleDownloadTake = async (take: Take, index: number) => {
    const mimeType = take.blob.type || pickMimeType();
    const fileName = `audio-recorder-take-${index + 1}-${take.createdAt}.${extensionFor(mimeType)}`;
    downloadBlob(take.blob, fileName);
    await saveToolResult("audio-recorder", {
      title: fileName,
      summary: `${formatElapsed(take.duration)} · ${formatBytes(take.blob.size)}`,
      blob: take.blob,
    });
    historyRef.current?.refresh();
  };

  const handleDeleteTake = (id: string) => {
    setTakes((prev) => {
      const toDelete = prev.find((take) => take.id === id);
      if (toDelete) URL.revokeObjectURL(toDelete.url);
      return prev.filter((take) => take.id !== id);
    });
  };

  const isIdle = state === "idle";

  return (
    <div className="space-y-6">
      {isIdle && (
        <Card className="space-y-4 p-4">
          <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            Clicking &quot;Start Recording&quot; asks for microphone access. Recording and playback happen
            entirely on your device — nothing is uploaded.
          </div>

          <Button onClick={startRecording} disabled={isPreparing}>
            {isPreparing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Requesting microphone…
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Start Recording
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
                <Square className="h-3.5 w-3.5" /> Stop
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {state === "recording" ? (
              <Mic className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <MicOff className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-100"
                style={{ width: `${Math.min(100, audioLevel * 140)}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {takes.length > 0 && (
        <Card className="space-y-3 p-4">
          <h3 className="text-sm font-semibold">Takes ({takes.length})</h3>
          <div className="space-y-3">
            {takes.map((take, reverseIndex) => {
              const index = takes.length - 1 - reverseIndex;
              return (
                <div key={take.id} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-medium">Take {index + 1}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatElapsed(take.duration)} · {formatBytes(take.blob.size)}
                    </p>
                    <div className="ml-auto flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleDownloadTake(take, index)}>
                        <Download className="h-3.5 w-3.5" /> Download
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTake(take.id)}
                        aria-label={`Delete take ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <audio src={take.url} controls className="w-full" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ToolHistoryList ref={historyRef} toolSlug="audio-recorder" />
    </div>
  );
}
