"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  authHeaders,
  endSession,
  getSttToken,
  submitAnswer,
  type SessionCreateResponse,
  type SessionTurn,
} from "@/lib/api";
import { deriveSessionUiState, turnsToEntries, type TranscriptEntry } from "@/lib/session-turns";

type Speaker = "agent" | "user" | "idle";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function SessionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const sessionId = params.id;

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [showTranscript, setShowTranscript] = useState(false);
  const [speaker, setSpeaker] = useState<Speaker>("idle");
  const [awaitingInput, setAwaitingInput] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [sending, setSending] = useState(false);

  const [micMode, setMicMode] = useState<"idle" | "requesting" | "recording" | "unavailable">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const deepgramSocketRef = useRef<WebSocket | null>(null);

  // --- Seed from sessionStorage (handed off by /sessions/new) -------------
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(`session_init_${sessionId}`);
      if (raw) {
        window.sessionStorage.removeItem(`session_init_${sessionId}`);
        const seed = JSON.parse(raw) as SessionCreateResponse;
        applyAgentTurns(seed.turns);
      }
    } catch {
      // no seed available -- fine, the transcript just starts empty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const playTts = useCallback(async (text: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/api/sessions/tts?text=${encodeURIComponent(text)}`, {
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error("tts_unavailable");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    await new Promise<void>((resolve) => {
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => resolve();
      audio.onerror = () => resolve();
      audio.play().catch(() => resolve());
    });
    URL.revokeObjectURL(url);
  }, []);

  const speakTurns = useCallback(
    async (turns: SessionTurn[]) => {
      for (const turn of turns) {
        if (!turn.content_text.trim()) continue;
        await playTts(turn.content_text).catch(() => {
          /* TTS unavailable (no ElevenLabs key configured) -- text is still shown */
        });
      }
      setSpeaker("idle");
    },
    [playTts]
  );

  const applyAgentTurns = useCallback(
    (turns: SessionTurn[]) => {
      if (turns.length === 0) return;
      setTranscript((prev) => [...prev, ...turnsToEntries(turns, "agent")]);
      const { awaitingInput: nextAwaiting, sessionComplete: nextComplete } = deriveSessionUiState(turns);
      setSessionComplete(nextComplete);
      setAwaitingInput(nextAwaiting);
      setSpeaker("agent");
      void speakTurns(turns);
    },
    [speakTurns]
  );

  const submitTranscript = useCallback(
    async (text: string) => {
      if (!text.trim() || sending || sessionComplete) return;
      setSending(true);
      setError(null);
      setTranscript((prev) => [...prev, { id: `user-${Date.now()}`, role: "user", text, turnType: "answer" }]);
      setAwaitingInput(false);
      setSpeaker("user");
      try {
        const res = await submitAnswer(sessionId, text);
        applyAgentTurns(res.turns);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Nie udało się wysłać odpowiedzi");
        setAwaitingInput(true);
      } finally {
        setSending(false);
        setTextAnswer("");
      }
    },
    [sessionId, sending, sessionComplete, applyAgentTurns]
  );

  // --- Real mic capture + Deepgram streaming STT ---------------------------
  // Requires a configured DEEPGRAM_API_KEY on the backend and microphone
  // access in the browser. Falls back to the text box below when either is
  // unavailable (no key configured, permission denied, no device) -- see
  // README "Known limitations" for why this can't be exercised live in the
  // sandboxed build/test environment.
  async function startRecording() {
    setMicMode("requesting");
    setError(null);
    try {
      const { access_token } = await getSttToken();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const socket = new WebSocket(
        "wss://api.deepgram.com/v1/listen?language=pl&smart_format=true&interim_results=true&endpointing=500",
        ["token", access_token]
      );
      deepgramSocketRef.current = socket;

      socket.onopen = () => {
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) socket.send(e.data);
        };
        recorder.start(250);
        setMicMode("recording");
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const alt = data.channel?.alternatives?.[0];
          const text: string | undefined = alt?.transcript;
          if (text && data.is_final && data.speech_final) {
            void submitTranscript(text);
          }
        } catch {
          // ignore malformed frames
        }
      };

      socket.onerror = () => {
        setMicMode("unavailable");
        setError("Połączenie z rozpoznawaniem mowy nie powiodło się. Możesz odpowiedzieć tekstowo poniżej.");
      };
      socket.onclose = () => {
        if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
        setMicMode((m) => (m === "recording" ? "idle" : m));
      };
    } catch {
      setMicMode("unavailable");
      setError("Mikrofon niedostępny (brak uprawnień lub klucza Deepgram). Możesz odpowiedzieć tekstowo poniżej.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    deepgramSocketRef.current?.close();
    setMicMode("idle");
  }

  useEffect(() => {
    return () => {
      mediaRecorderRef.current?.stop();
      deepgramSocketRef.current?.close();
    };
  }, []);

  async function handleEndSession() {
    try {
      await endSession(sessionId);
    } finally {
      router.push("/");
    }
  }

  const lastAgentText = [...transcript].reverse().find((t) => t.role === "agent")?.text;

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-between gap-6 py-4">
      <div className="flex w-full items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => setShowTranscript((s) => !s)}>
          {showTranscript ? "Ukryj transkrypcję" : "Pokaż transkrypcję"}
        </Button>
        <Button variant="ghost" size="sm" onClick={handleEndSession}>
          Zakończ sesję
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <SpeakerIndicator speaker={speaker} />
        <p className="max-w-md text-balance text-lg" aria-live="polite">
          {lastAgentText}
        </p>
        {error && <p className="max-w-sm text-sm text-destructive">{error}</p>}
        {sessionComplete && (
          <p className="text-sm font-medium text-success">Sesja zakończona — świetna robota!</p>
        )}
      </div>

      {showTranscript && (
        <div className="max-h-56 w-full overflow-y-auto rounded-lg border border-border bg-card p-3 text-sm">
          {transcript.map((entry) => (
            <p key={entry.id} className={entry.role === "agent" ? "text-foreground" : "mt-1 text-muted-foreground"}>
              <span className="font-medium">{entry.role === "agent" ? "Tutor: " : "Ty: "}</span>
              {entry.text}
            </p>
          ))}
        </div>
      )}

      {!sessionComplete && (
        <div className="flex w-full flex-col items-center gap-3">
          <div className="flex items-center gap-3">
            {micMode === "recording" ? (
              <Button size="lg" variant="destructive" onClick={stopRecording} className="rounded-full">
                ⏹ Zatrzymaj nagrywanie
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={startRecording}
                disabled={!awaitingInput || micMode === "requesting"}
                className="rounded-full"
              >
                🎙️ {micMode === "requesting" ? "Łączenie…" : "Odpowiedz głosowo"}
              </Button>
            )}
          </div>

          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitTranscript(textAnswer);
            }}
          >
            <input
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              disabled={!awaitingInput || sending}
              placeholder="…lub wpisz odpowiedź tekstem"
              className="flex-1 rounded-md border border-input bg-card px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
            <Button type="submit" variant="outline" disabled={!awaitingInput || sending}>
              Wyślij
            </Button>
          </form>
        </div>
      )}

      {sessionComplete && (
        <Button size="lg" onClick={() => router.push("/")}>
          Wróć do pulpitu
        </Button>
      )}
    </div>
  );
}

function SpeakerIndicator({ speaker }: { speaker: Speaker }) {
  const label = speaker === "agent" ? "Tutor mówi…" : speaker === "user" ? "Twoja kolej" : "…";
  return (
    <div className="relative flex h-32 w-32 items-center justify-center">
      {speaker !== "idle" && (
        <span
          className={`absolute inset-0 rounded-full ${
            speaker === "agent" ? "bg-primary/30" : "bg-accent/30"
          } animate-pulse-ring`}
        />
      )}
      <div
        className={`flex h-24 w-24 items-center justify-center rounded-full text-3xl text-white shadow-md transition-colors ${
          speaker === "agent" ? "bg-primary" : speaker === "user" ? "bg-accent" : "bg-muted-foreground/40"
        }`}
      >
        {speaker === "agent" ? "🎧" : speaker === "user" ? "🎙️" : "…"}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}
