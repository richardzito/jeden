"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { createTopic, getDashboard, getDevUserId, type DashboardResponse } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  researching: "Trwa research…",
  ready: "Gotowy",
  archived: "Zarchiwizowany",
};

export default function DashboardPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userId = getDevUserId();
    getDashboard(userId)
      .then(setDashboard)
      .catch((e) => setError(e instanceof Error ? e.message : "Nie udało się pobrać danych"))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 3) {
      setError("Wpisz temat (co najmniej 3 znaki).");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { topic_id } = await createTopic(query.trim());
      router.push(`/topics/${topic_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się utworzyć tematu");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section>
        <h1 className="mb-1 text-2xl font-semibold">Czego chcesz się dziś nauczyć?</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Podaj temat — zbadamy go, zbudujemy plan nauki i przeprowadzimy Cię przez niego głosowo.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="np. Jak działa gospodarka?"
            disabled={submitting}
            className="flex-1"
          />
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Tworzę…" : "Zacznij naukę"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {dashboard && dashboard.due_review_count > 0 && (
        <Card className="border-accent/40 bg-accent/5">
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="font-medium">Masz {dashboard.due_review_count} powtórek do zrobienia</p>
              <p className="text-sm text-muted-foreground">Wybierz temat poniżej i kliknij „Powtórka”.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Twoje tematy</h2>
        {loading && <p className="text-sm text-muted-foreground">Ładowanie…</p>}
        {!loading && dashboard && dashboard.topics.length === 0 && (
          <p className="text-sm text-muted-foreground">Nie masz jeszcze żadnych tematów. Zacznij powyżej!</p>
        )}
        <div className="flex flex-col gap-3">
          {dashboard?.topics.map((topic) => {
            const progress = topic.concept_count > 0 ? (topic.mastered_count / topic.concept_count) * 100 : 0;
            return (
              <Card key={topic.id}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>
                      <Link href={`/topics/${topic.id}`} className="hover:underline">
                        {topic.title}
                      </Link>
                    </CardTitle>
                    <Badge variant={topic.status === "ready" ? "success" : "secondary"} className="mt-2">
                      {STATUS_LABELS[topic.status] ?? topic.status}
                    </Badge>
                  </div>
                  {topic.status === "ready" && (
                    <div className="flex gap-2">
                      <Link href={`/sessions/new?topic=${topic.id}&type=review`}>
                        <Button variant="outline" size="sm">
                          Powtórka
                        </Button>
                      </Link>
                      <Link href={`/sessions/new?topic=${topic.id}&type=learn`}>
                        <Button size="sm">Ucz się</Button>
                      </Link>
                    </div>
                  )}
                </CardHeader>
                {topic.concept_count > 0 && (
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-3">
                      <Progress value={progress} className="flex-1" />
                      <span className="text-xs text-muted-foreground">
                        {topic.mastered_count}/{topic.concept_count} opanowane
                      </span>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
