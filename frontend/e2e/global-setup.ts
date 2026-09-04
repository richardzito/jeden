import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Seeds a deterministic "ready" topic (concept + full Lesson Plan) for a
 * fixed dev user id, by running the backend's seed script directly against
 * the configured database. This keeps the "curriculum already exists ->
 * do a session" part of the e2e happy path fast and independent of a real
 * LLM/search API key being configured -- see
 * backend/scripts/seed_demo_topic.py for why, and happy-path.spec.ts for
 * the companion test that exercises real topic *creation* through the UI.
 *
 * Requires the backend's Python venv to already be set up
 * (`pip install -r requirements.txt` in backend/) and a reachable
 * Postgres matching DATABASE_URL / the backend's default.
 */
export default function globalSetup(): void {
  const backendDir = path.resolve(__dirname, "../../backend");
  const pythonBin = path.join(backendDir, ".venv/bin/python");

  execFileSync(pythonBin, ["scripts/seed_demo_topic.py"], {
    cwd: backendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      PYTHONPATH: backendDir,
      DATABASE_URL:
        process.env.DATABASE_URL ?? "postgresql+asyncpg://audiotutor:audiotutor@localhost:5432/audiotutor",
    },
  });
}
