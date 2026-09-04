# Audio Tutor

An audio-first AI tutor. You give it a topic; it researches the web,
cross-checks and synthesizes what it finds into a set of teachable
concepts, builds a learning path, and then teaches you **through a spoken
conversation** — explaining briefly, asking questions, listening to your
answers, adapting when you're confused, and scheduling spaced-repetition
reviews so what you learn actually sticks.

This is the MVP described in the product spec: one full loop —
**topic → async research → synthesis → curriculum/lesson plan → voice LEARN
session → active questioning → answer evaluation → mastery memory → FSRS
scheduling → voice REVIEW session** — built end to end, tested, and run
locally.

## Table of contents

- [Quick start](#quick-start)
- [Environment variables](#environment-variables)
- [Architecture](#architecture)
- [Model routing](#model-routing)
- [Technical decisions](#technical-decisions-and-why)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Out of scope for this MVP](#out-of-scope-for-this-mvp-and-why)
- [What's next](#whats-next)

## Quick start

```bash
cp .env.example .env
# edit .env: at minimum set ANTHROPIC_API_KEY. See "Environment variables"
# below for what everything else needs and where to get it.

docker compose up
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000 (docs at `/docs`)
- Backend applies Alembic migrations automatically on startup.

Local auth: with `DEV_AUTH_BYPASS=true` (the `.env.example` default) the
app runs without a real Supabase project — each browser gets a random id
persisted in `localStorage`, sent as `X-Dev-User-Id`, and the backend
auto-provisions a matching `users` row. Set up a real Supabase project and
flip `DEV_AUTH_BYPASS=false` for anything beyond local development (see
"Known limitations" for what that would additionally require on the
frontend).

### Running without Docker

If you don't have a Docker daemon available (this is how the app was
actually built and verified in this repository's development sandbox —
see "Known limitations"), run the pieces directly:

```bash
# Postgres 16 + pgvector extension, and Redis, running locally on their
# default ports, with a database/user matching DATABASE_URL in .env.example.

cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload &
arq app.workers.research_worker.WorkerSettings &

cd ../frontend
npm install
npm run dev
```

## Environment variables

Full list with comments on where to get each one: [`.env.example`](.env.example).
Summary:

| Variable | Required for | Get it at |
|---|---|---|
| `ANTHROPIC_API_KEY` | Everything (all agents) | console.anthropic.com |
| `DEEPGRAM_API_KEY` | Live voice input (STT) | console.deepgram.com |
| `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID` | Tutor speech (TTS) | elevenlabs.io |
| `TAVILY_API_KEY` | Web research, only if `SEARCH_PROVIDER=tavily` | tavily.com |
| `SUPABASE_*` | Real auth/DB in production | supabase.com |

Without `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY`, the app still fully
works — sessions fall back to a text input box for answers and skip audio
playback (see the session screen's mic-unavailable path). Without
`ANTHROPIC_API_KEY`, nothing that needs the model will work (research,
question generation/evaluation) — the app fails those specific requests
clearly rather than silently.

## Architecture

```
Next.js frontend  ──REST + WS──►  FastAPI backend  ──arq──►  Research worker
                                        │                          │
                                        ▼                          ▼
                              SessionService (live)      Research pipeline
                              Tutor / Quizmaster /        Researcher → FactChecker
                              MemoryManager /              → Synthesizer →
                              ReviewPlanner (FSRS)         KnowledgeArchitect →
                                        │                  CurriculumDesigner
                                        ▼                          │
                              Postgres + Redis  ◄──────────────────┘
                              Anthropic / Deepgram / ElevenLabs / Search
```

**The one architectural rule everything else follows**: research and live
tutoring are different latency regimes (spec risk A.1). Deep research
(decomposition, multi-source search, cross-checking, synthesis) realistically
takes 30s–minutes; a voice turn needs to respond in ~1-2s. So:

- The research pipeline (`backend/app/workers/pipeline.py`) runs
  **asynchronously**, as an arq background job, and writes its output —
  concepts, relationships, curriculum, and an initial **Lesson Plan** (a
  scripted sequence of beats: explain → question → rubric → follow-up →
  transition) — to Postgres.
- The live Tutor (`backend/app/services/session_service.py`,
  `backend/app/agents/tutor.py`) **only reads from that pre-built Lesson
  Plan** during a session. It never does web search or full synthesis
  live. The one live LLM call it does make — generating a fresh
  explanation for the "I don't understand" escalation ladder, or a
  Quizmaster question/evaluation — is a small, single Sonnet call, the same
  latency class as any other per-turn interaction.

### Backend layout

```
backend/app/
  agents/        Researcher, FactChecker, Synthesizer, KnowledgeArchitect,
                 CurriculumDesigner, Tutor, Quizmaster, MemoryManager,
                 ReviewPlanner — one class per agent, explicit Pydantic
                 input/output, no agent logic inline in an API route.
  api/           FastAPI routers (topics, sessions incl. WebSocket, users).
  core/          config, db, security (Supabase JWT + dev bypass), FSRS
                 scheduler, session-state (Redis), logging, arq queue.
  integrations/  Anthropic client (with llm_calls cost logging), search
                 provider (Anthropic web_search/web_fetch + Tavily
                 fallback), Deepgram, ElevenLabs.
  models/        SQLAlchemy models (the full schema from the spec).
  schemas/       Pydantic models: LLM structured-output contracts and the
                 REST API request/response shapes.
  services/      SessionService: the live-session state machine that wires
                 Tutor/Quizmaster/MemoryManager/ReviewPlanner together.
  workers/       arq worker entrypoint + the research pipeline orchestrator.
```

### Frontend layout

```
frontend/src/
  app/
    page.tsx                    Dashboard (new topic, topic list, due reviews)
    topics/[id]/page.tsx        Research status (live-polled) → concept list
    topics/[id]/sources/page.tsx  Source transparency + credibility scores
    sessions/new/page.tsx       Creates a session, hands off to the session screen
    sessions/[id]/page.tsx      Audio-first session: speaking indicator, mic
                                 capture (Deepgram), TTS playback, text fallback
  components/ui/                Small hand-built shadcn/ui-style primitives
  lib/api.ts                    Typed REST client
  lib/session-turns.ts          Pure session-turn logic (unit tested)
```

## Model routing

| Tier | Used for | Why |
|---|---|---|
| Haiku | Sub-question decomposition, transcript cleanup | Cheap, high-volume, low-reasoning tasks |
| Sonnet | Source selection, credibility scoring, claim extraction, relationship graph, curriculum rationale, Lesson Plan drafting, live Tutor/Quizmaster calls | The bulk of the reasoning work, at a turn-latency-friendly cost |
| Opus | `Synthesizer.build_concepts` | The one call that most benefits from a stronger model — run once per topic, cached |

Configured via `ANTHROPIC_MODEL_{HAIKU,SONNET,OPUS}` in `.env`, so the
exact snapshot can be pinned/updated without a code change. Every call is
logged to the `llm_calls` table (agent name, model, tokens, latency, an
approximate USD cost) for later cost analysis.

## Technical decisions (and why)

- **FSRS is a from-scratch, dependency-free implementation**
  (`backend/app/core/fsrs.py`), not the `fsrs` PyPI package. While building
  this, that package's public API changed incompatibly across the major
  versions released (1.x → 6.x), and we had no way to verify which surface
  to target without live docs access matching the installed version. The
  module reimplements FSRS's actual *mechanics* — a difficulty/stability
  state per concept, updated per review rating, and a power-law
  retrievability/forgetting curve used to compute the next interval —
  which is what makes spaced repetition work; the specific default
  constants are reasonable hand-chosen values in the right ballpark,
  **not** a byte-for-byte reproduction of `py-fsrs`'s ML-fitted weights.
  Swapping in the real package's optimizer later (to fit weights from
  actual review history) is a natural follow-up that wouldn't require
  touching the surrounding scheduling code.

- **shadcn/ui components are hand-built, not pulled via the shadcn CLI.**
  `npx shadcn init` needs to fetch templates from `ui.shadcn.com`, which
  wasn't reachable from the sandbox this was built in. `frontend/src/components/ui/`
  instead has a small set of the same-pattern components (Button, Card,
  Progress, Badge, Input) built directly with `class-variance-authority` +
  `tailwind-merge`, which is exactly what the CLI would have generated.

- **Credibility scoring is majority rule-based, not LLM-judged** (spec risk
  A.2). `app/agents/credibility.py` scores explicit, checkable signals
  (TLD/domain type, author/publisher/date presence, source category) in
  plain Python; `FactChecker` blends in a smaller LLM-provided modifier
  score. A claim can only be labeled `established` if corroborated by ≥2
  sources whose credibility clears a floor, and any claim with a
  contradicting source is always forced to `contested` — regardless of
  what the model itself suggested. This is a hard-coded guardrail, not a
  prompt instruction.

- **The tutor's utterance-length limit is enforced in code**
  (`app/agents/text_limits.py::enforce_length_limit`), applied to every
  outgoing utterance — pre-scripted Lesson Plan text and live-generated
  escalation text alike — right before it's returned, not left to the
  system prompt.

- **Answer evaluation always goes through a rubric with a confidence
  guardrail** (spec risk A.3). `Quizmaster.evaluate_answer` never scores an
  empty/near-empty transcript (STT silence) — it returns
  `needs_clarification` immediately instead of asking the model to judge
  nothing. And when the model's own reported confidence in its evaluation
  is low, the result is downgraded to `needs_clarification` rather than
  trusted at face value, so the Tutor asks the learner to repeat instead of
  silently recording a possibly-wrong mastery update.

- **The research cache** (`research_cache` table, spec section 10) stores
  the synthesized concepts/relationships per normalized topic query hash;
  a new topic matching an existing entry skips Researcher/FactChecker/
  Synthesizer/KnowledgeArchitect entirely and just re-curricularizes for
  the new user. Fetched source *content* is separately deduplicated at the
  `sources.url` level regardless of this cache, since that's a cheaper and
  more precise dedup key.

- **Live-session position lives in Redis, not Postgres**
  (`app/core/session_state.py`): which beat/concept/escalation-rung a
  session is on right now is exactly the kind of hot, short-lived,
  session-scoped state Redis is for. The durable record of what happened
  (`session_turns`, updated mastery, scheduled reviews) is still written
  to Postgres as each turn completes.

- **Async engines/pools use `NullPool` / are recreated per test**
  (`app/core/db.py`, `tests/conftest.py`): an asyncpg connection (or a
  Redis connection) created under one asyncio event loop breaks if reused
  under another. This bites both pytest-asyncio's per-test event loops and,
  in production, a worker restart — `NullPool` opens a fresh connection per
  checkout instead of pooling one across loops.

- **WebSocket auth travels as a query param, not a header.** Browsers can't
  set custom headers on a WebSocket handshake, so
  `WS /api/sessions/{id}/stream` accepts `?dev_user_id=` / `?token=` in
  addition to the header-based path (kept for non-browser clients).

- **TTS is proxied through the backend** (`GET /api/sessions/tts`) rather
  than the frontend calling ElevenLabs directly, so the API key never
  reaches the browser.

## Testing

Backend (84 tests: unit — every agent, mocked Anthropic API, plus a
credibility-scoring edge case and a contested-claim edge case for
FactChecker, and a no-answer-from-the-user edge case for the session
service; integration — full research pipeline raw_query→concepts with
mocked search/LLM, full LEARN session including the escalation ladder, and
HTTP-level API tests):

```bash
cd backend
source .venv/bin/activate
pytest
```

Frontend unit tests (Vitest — pure session-turn logic, the `cn()` class
merger, the dev-user-id helper, a Progress component test):

```bash
cd frontend
npm run test
```

Frontend e2e (Playwright — see `frontend/e2e/happy-path.spec.ts`):

```bash
cd frontend
npm run e2e
```

The e2e suite has two scenarios: creating a new topic through the UI
(verifies the research pipeline is kicked off, without waiting for it to
finish, since that needs a real `ANTHROPIC_API_KEY`), and — against a topic
seeded directly via `backend/scripts/seed_demo_topic.py` so this half of
the flow is deterministic and key-independent — viewing the curriculum and
completing a short **text-simulated** learn session, per the spec's own
testing guidance.

All of the above were run and passed locally while building this (84
pytest + 16 Vitest + 2 Playwright, plus a clean `tsc --noEmit`, `next
lint`, and `next build`), against real local Postgres/Redis and a real
running FastAPI + Next.js stack — see "Known limitations" for the one
piece that couldn't be exercised.

## Known limitations

- **This repository was built and verified in a sandbox with no Docker
  daemon and no real Anthropic/Deepgram/ElevenLabs credentials.**
  `docker compose config` validates the compose file's syntax cleanly, and
  every service in it (Postgres+pgvector, Redis, backend, worker, frontend)
  was run and verified as an equivalent set of native processes — including
  starting the arq worker for real and watching it pick up and correctly
  fail queued research jobs against the real Anthropic API (a clean 401 for
  an invalid key, handled and surfaced exactly as designed: `research_runs.status`
  → `failed`, error message stored, frontend shows a clear error instead of
  hanging). What could not be verified here is an actual successful
  research run or a scored answer, since that requires a real
  `ANTHROPIC_API_KEY` (and, for audio, real `DEEPGRAM_API_KEY` /
  `ELEVENLABS_API_KEY`) that this environment doesn't have. Every call site
  is wired to the real APIs' actual contracts as documented; the risk is
  narrower than "untested" — it's "not exercised against a live response
  from this exact deployment's keys."
- **No real Supabase Auth UI.** The frontend only implements the dev-bypass
  auth path (a per-browser random id persisted in `localStorage`). The
  backend fully supports verifying a real Supabase JWT
  (`app/core/security.py`); wiring `@supabase/supabase-js` and a sign-in
  page into the frontend is what's left to use a real Supabase project (see
  "What's next").
- **A LEARN session always starts its curriculum from the beginning** —
  there's no "resume where I left off" if a session is abandoned partway
  through. The next session for that topic re-walks the curriculum from
  index 0 (concepts already mastered still get a full explain/question
  pass, just a shorter fallback rationale).
- **Refreshing the session screen mid-conversation loses the visible
  transcript** (it's handed off via `sessionStorage` from session creation,
  not re-fetched). The session's actual state (Redis) and progress
  (Postgres) are unaffected — answering would still work correctly if the
  page were reloaded and the WS/REST answer endpoint used directly — but
  the UI doesn't currently rehydrate the transcript display on a fresh
  load.
- **The Anthropic `web_search`/`web_fetch` server-tool identifiers are
  pinned to the versions current when this was built**
  (`app/integrations/search.py`); if Anthropic ships a newer tool version,
  these may need a one-line bump.

## Out of scope for this MVP (and why)

Per spec section 2/9/I, deliberately not built now, modeled so adding them
later doesn't require a schema rework:

- Session types beyond LEARN/REVIEW (`quiz`, `deep_dive`, `connections`,
  `teach_back`, `exam`, `discovery`) — the `sessions.type` enum already has
  room for them.
- Knowledge graph **visualization** — the graph itself
  (`concept_relationships`, adjacency-list style) is fully built and
  populated; only a visual UI for it is missing (the topic page shows it as
  an ordered/flat list instead).
- Cross-domain connection engine, gamification, advanced analytics
  dashboards.
- Cross-user shared research cache with no personal data (the current
  cache is already de-facto shared across users for the same normalized
  query, just not yet exposed/managed as a distinct product feature).

## What's next

1. Real Supabase Auth on the frontend (sign-in page, session JWT in
   `lib/api.ts`'s `authHeaders()`).
2. Verify a real end-to-end research run and a real scored voice answer
   once real `ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` / `ELEVENLABS_API_KEY`
   are available, in an environment with a Docker daemon and mic access
   for a full `docker compose up` + live-browser pass.
3. Session resume (persist and restore curriculum/beat position instead of
   always restarting from index 0).
4. Swap the hand-implemented FSRS constants for the `fsrs` package's
   optimizer, fitting weights from real per-user review history once
   there's enough of it to fit against.
5. Knowledge graph visualization and the remaining session types, per
   "Out of scope" above.
