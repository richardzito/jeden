"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getTopic, type Concept, type TopicStatusResponse } from "@/lib/api";

const IMPORTANCE_LABELS: Record<string, string> = {
  core: "Kluczowe",
  secondary: "Uzupełniające",
  peripheral: "Dodatkowe",
};

const IMPORTANCE_ORDER: Record<string, number> = { core: 0, secondary: 1, peripheral: 2 };

const RESEARCH_STATUS_MESSAGES: Record<string, string> = {
  pending: "Kolejkuję zadanie…",
  running: "Szukam źródeł, sprawdzam wiarygodność i buduję plan nauki…",
  done: "Gotowe!",
  failed: "Coś poszło nie tak podczas researchu.",
};

export default function TopicPage() {
  const params = useParams<{ id: string }>();
  const [topic, setTopic] = useState<TopicStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const data = await getTopic(params.id);
        if (cancelled) return;
        setTopic(data);
        if (data.status !== "researching" && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Nie udało się pobrać tematu");
      }
    }

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [params.id]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (!topic) {
    return <p className="text-sm text-muted-foreground">Ładowanie…</p>;
  }

  if (topic.status === "researching") {
    const message = topic.research_run_status
      ? RESEARCH_STATUS_MESSAGES[topic.research_run_status]
      : RESEARCH_STATUS_MESSAGES.pending;
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary" />
        <h1 className="text-xl font-semibold">{topic.title}</h1>
        <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
        <p className="text-xs text-muted-foreground">
          Możesz spokojnie odejść — status zaktualizuje się automatycznie, gdy wrócisz.
        </p>
      </div>
    );
  }

  if (topic.research_run_status === "failed") {
    return (
      <div className="py-10 text-center">
        <h1 className="mb-2 text-xl font-semibold">{topic.title}</h1>
        <p className="text-sm text-destructive">{RESEARCH_STATUS_MESSAGES.failed}</p>
        {topic.research_run_error && <p className="mt-2 text-xs text-muted-foreground">{topic.research_run_error}</p>}
      </div>
    );
  }

  const sortedConcepts = [...topic.concepts].sort((a, b) => {
    if (a.order_index !== null && b.order_index !== null) return a.order_index - b.order_index;
    return IMPORTANCE_ORDER[a.importance] - IMPORTANCE_ORDER[b.importance];
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{topic.title}</h1>
          <p className="text-sm text-muted-foreground">{topic.concepts.length} konceptów</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/topics/${topic.id}/sources`}>
            <Button variant="outline">Źródła</Button>
          </Link>
          <Link href={`/sessions/new?topic=${topic.id}&type=review`}>
            <Button variant="outline">Powtórka</Button>
          </Link>
          <Link href={`/sessions/new?topic=${topic.id}&type=learn`}>
            <Button>Ucz się</Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {sortedConcepts.map((concept) => (
          <ConceptCard key={concept.id} concept={concept} />
        ))}
      </div>
    </div>
  );
}

function ConceptCard({ concept }: { concept: Concept }) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle>{concept.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{concept.definition}</p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {IMPORTANCE_LABELS[concept.importance] ?? concept.importance}
        </Badge>
      </CardHeader>
      <CardContent className="flex items-center gap-3 pt-0">
        <Progress value={concept.mastery * 100} className="flex-1" />
        <span className="w-20 text-right text-xs text-muted-foreground">
          {Math.round(concept.mastery * 100)}% opanowane
        </span>
      </CardContent>
    </Card>
  );
}
