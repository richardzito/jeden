/**
 * Typed API client for the FastAPI backend.
 *
 * Auth: this MVP frontend talks to the backend's dev-mode auth bypass
 * (DEV_AUTH_BYPASS=true, see backend README) via an `X-Dev-User-Id` header
 * -- a per-browser random id persisted in localStorage, standing in for a
 * real signed-in user. Wiring a real Supabase session (NEXT_PUBLIC_SUPABASE_URL
 * / NEXT_PUBLIC_SUPABASE_ANON_KEY) would replace `authHeaders()` below with
 * a Supabase JWT `Authorization: Bearer <token>` header; the backend already
 * verifies that path (app/core/security.py), it just isn't wired up in this
 * UI without real credentials to test against -- see README "Known limitations".
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000";
const DEV_USER_ID_KEY = "audiotutor_dev_user_id";

export function getDevUserId(): string {
  if (typeof window === "undefined") return "00000000-0000-0000-0000-000000000001";
  let id = window.localStorage.getItem(DEV_USER_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(DEV_USER_ID_KEY, id);
  }
  return id;
}

function authHeaders(): Record<string, string> {
  return { "X-Dev-User-Id": getDevUserId() };
}

export function wsUrl(path: string): string {
  // Native browser WebSocket can't set custom headers, so auth travels as
  // a query param instead (the backend accepts both -- see
  // backend/app/api/sessions.py session_stream).
  const separator = path.includes("?") ? "&" : "?";
  return `${WS_BASE}${path}${separator}dev_user_id=${encodeURIComponent(getDevUserId())}`;
}

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// --- Types (mirroring backend/app/schemas/api.py) --------------------------

export type TopicStatus = "researching" | "ready" | "archived";
export type ResearchRunStatus = "pending" | "running" | "done" | "failed";
export type ConceptImportance = "core" | "secondary" | "peripheral";
export type ClaimConfidence = "established" | "moderate" | "contested" | "hypothesis" | "opinion" | "uncertain";
export type SourceType = "paper" | "book" | "docs" | "institutional" | "report" | "reputable_media" | "expert_blog" | "other";
export type SessionType = "learn" | "review" | "quiz" | "deep_dive" | "connections" | "teach_back" | "exam" | "discovery";

export interface Concept {
  id: string;
  name: string;
  definition: string;
  importance: ConceptImportance;
  examples: string[];
  counterexamples: string[];
  misconceptions: string[];
  applications: string[];
  mastery: number;
  order_index: number | null;
}

export interface TopicStatusResponse {
  id: string;
  title: string;
  raw_query: string;
  status: TopicStatus;
  research_run_status: ResearchRunStatus | null;
  research_run_error: string | null;
  concepts: Concept[];
}

export interface Source {
  id: string;
  url: string;
  title: string | null;
  author: string | null;
  publisher: string | null;
  published_at: string | null;
  source_type: SourceType;
  credibility_score: number | null;
  credibility_rationale: string | null;
}

export interface Claim {
  id: string;
  text: string;
  confidence: ClaimConfidence;
}

export interface DashboardTopic {
  id: string;
  title: string;
  status: TopicStatus;
  concept_count: number;
  mastered_count: number;
}

export interface DashboardResponse {
  topics: DashboardTopic[];
  due_review_count: number;
  recent_sessions: string[];
}

export interface ReviewDue {
  concept_id: string;
  concept_name: string;
  scheduled_for: string;
  mastery: number;
}

export interface SessionTurn {
  turn_type: string;
  content_text: string;
  concept_id: string | null;
  session_complete: boolean;
}

export interface SessionCreateResponse {
  session_id: string;
  type: SessionType;
  turns: SessionTurn[];
}

export interface SessionAnswerResponse {
  turns: SessionTurn[];
}

// --- API calls ---------------------------------------------------------

export function createTopic(rawQuery: string): Promise<{ topic_id: string; status: TopicStatus }> {
  return apiFetch("/api/topics", { method: "POST", body: JSON.stringify({ raw_query: rawQuery }) });
}

export function getTopic(topicId: string): Promise<TopicStatusResponse> {
  return apiFetch(`/api/topics/${topicId}`);
}

export function getTopicSources(topicId: string): Promise<Source[]> {
  return apiFetch(`/api/topics/${topicId}/sources`);
}

export function getTopicClaims(topicId: string): Promise<Claim[]> {
  return apiFetch(`/api/topics/${topicId}/claims`);
}

export function getDashboard(userId: string): Promise<DashboardResponse> {
  return apiFetch(`/api/users/${userId}/dashboard`);
}

export function getReviewsDue(userId: string): Promise<ReviewDue[]> {
  return apiFetch(`/api/users/${userId}/reviews/due`);
}

export function createSession(topicId: string, type: SessionType = "learn"): Promise<SessionCreateResponse> {
  return apiFetch("/api/sessions", { method: "POST", body: JSON.stringify({ topic_id: topicId, type }) });
}

export function submitAnswer(sessionId: string, transcript: string): Promise<SessionAnswerResponse> {
  return apiFetch(`/api/sessions/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ transcript }),
  });
}

export function endSession(sessionId: string): Promise<{ status: string; summary: string | null }> {
  return apiFetch(`/api/sessions/${sessionId}/end`, { method: "POST" });
}

export function getSttToken(): Promise<{ access_token: string; expires_in: number }> {
  return apiFetch("/api/sessions/stt-token");
}

export { ApiError, authHeaders, API_BASE };
