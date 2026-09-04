"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getTopicSources, type Source } from "@/lib/api";

const SOURCE_TYPE_LABELS: Record<string, string> = {
  paper: "Publikacja naukowa",
  book: "Książka",
  docs: "Dokumentacja",
  institutional: "Źródło instytucjonalne",
  report: "Raport",
  reputable_media: "Renomowane media",
  expert_blog: "Blog eksperta",
  other: "Inne",
};

function credibilityVariant(score: number | null): "success" | "warning" | "destructive" | "outline" {
  if (score === null) return "outline";
  if (score >= 0.7) return "success";
  if (score >= 0.4) return "warning";
  return "destructive";
}

export default function TopicSourcesPage() {
  const params = useParams<{ id: string }>();
  const [sources, setSources] = useState<Source[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getTopicSources(params.id)
      .then(setSources)
      .catch((e) => setError(e instanceof Error ? e.message : "Nie udało się pobrać źródeł"));
  }, [params.id]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Źródła</h1>
        <p className="text-sm text-muted-foreground">
          Przejrzystość: wszystkie źródła wykorzystane do zbudowania tego tematu, wraz z oceną wiarygodności.
        </p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {sources && sources.length === 0 && (
        <p className="text-sm text-muted-foreground">Brak zarejestrowanych źródeł dla tego tematu.</p>
      )}

      <div className="flex flex-col gap-3">
        {sources?.map((source) => (
          <Card key={source.id}>
            <CardContent className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline"
                >
                  {source.title || source.url}
                </a>
                <Badge variant={credibilityVariant(source.credibility_score)} className="shrink-0">
                  {source.credibility_score !== null ? `${Math.round(source.credibility_score * 100)}%` : "brak oceny"}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{SOURCE_TYPE_LABELS[source.source_type] ?? source.source_type}</Badge>
                {source.author && <span>Autor: {source.author}</span>}
                {source.publisher && <span>Wydawca: {source.publisher}</span>}
              </div>
              {source.credibility_rationale && (
                <p className="text-xs text-muted-foreground">{source.credibility_rationale}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
