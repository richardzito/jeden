"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { createSession, type SessionType } from "@/lib/api";

function NewSessionInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const topicId = searchParams.get("topic");
    const type = (searchParams.get("type") as SessionType | null) ?? "learn";
    if (!topicId) {
      setError("Brak identyfikatora tematu.");
      return;
    }
    createSession(topicId, type)
      .then((res) => {
        try {
          window.sessionStorage.setItem(`session_init_${res.session_id}`, JSON.stringify(res));
        } catch {
          // sessionStorage unavailable (e.g. private mode) -- the session
          // screen will just start with an empty transcript and pick up
          // from the next WS/answer exchange.
        }
        router.replace(`/sessions/${res.session_id}`);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Nie udało się rozpocząć sesji"));
  }, [router, searchParams]);

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
          <p className="text-sm text-muted-foreground">Przygotowuję sesję…</p>
        </>
      )}
    </div>
  );
}

export default function NewSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        </div>
      }
    >
      <NewSessionInner />
    </Suspense>
  );
}
