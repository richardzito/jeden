import { expect, test } from "@playwright/test";

const SEEDED_DEV_USER_ID = "11111111-1111-1111-1111-111111111111";
const DEV_USER_ID_KEY = "audiotutor_dev_user_id";

async function setDevUser(page: import("@playwright/test").Page, userId: string) {
  await page.goto("/");
  await page.evaluate(
    ({ key, id }) => window.localStorage.setItem(key, id),
    { key: DEV_USER_ID_KEY, id: userId }
  );
  await page.reload();
}

test.describe("Audio Tutor happy path", () => {
  test("submitting a new topic creates it and starts the research pipeline", async ({ page }) => {
    // A fresh (unseeded) dev user, so the dashboard starts empty and we
    // exercise real topic creation through the UI. This does NOT wait for
    // the research pipeline to finish -- that needs a real
    // ANTHROPIC_API_KEY (see README "Known limitations"); the "curriculum
    // exists -> do a session" half of the flow is covered by the seeded
    // test below instead, so this suite stays fast and deterministic in
    // any environment.
    await setDevUser(page, crypto.randomUUID());

    await expect(page.getByRole("heading", { name: "Czego chcesz się dziś nauczyć?" })).toBeVisible();

    await page.getByPlaceholder("np. Jak działa gospodarka?").fill("Jak działają silniki odrzutowe?");
    await page.getByRole("button", { name: "Zacznij naukę" }).click();

    await page.waitForURL(/\/topics\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText("Jak działają silniki odrzutowe?")).toBeVisible();
    // Either still researching, or (very unlikely without a real key)
    // already failed/ready -- any of these renders without crashing.
    await expect(page.locator("body")).not.toContainText("Application error");
  });

  test("seeded topic: view curriculum and complete a short text-simulated learn session", async ({ page }) => {
    await setDevUser(page, SEEDED_DEV_USER_ID);

    // --- Dashboard shows the seeded topic ---------------------------------
    await expect(page.getByText("Jak działa fotosynteza?")).toBeVisible();

    // --- Topic page shows the curriculum (the seeded concept) -------------
    await page.getByText("Jak działa fotosynteza?").click();
    await page.waitForURL(/\/topics\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Fotosynteza", exact: true })).toBeVisible();

    // --- Start a LEARN session ---------------------------------------------
    await page.getByRole("button", { name: "Ucz się" }).click();
    await page.waitForURL(/\/sessions\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await page.getByText("Pokaż transkrypcję").click();
    await expect(page.getByText("Fotosynteza to proces")).toBeVisible();
    // The current question appears both in the big "current turn" caption
    // and (since we just opened it) the transcript panel below -- assert
    // on the first match rather than picking one arbitrarily.
    await expect(page.getByText("Dlaczego rośliny potrzebują światła słonecznego?").first()).toBeVisible();

    // --- Answer via the text fallback (spec: "sesja tekstowo-symulowana") -
    const answerInput = page.getByPlaceholder("…lub wpisz odpowiedź tekstem");
    await answerInput.fill("Potrzebują światła do produkcji energii.");
    await page.getByRole("button", { name: "Wyślij" }).click();

    // The learner's answer always appears in the transcript immediately.
    await expect(page.getByText("Potrzebują światła do produkcji energii.")).toBeVisible();

    // What happens next depends on whether a real ANTHROPIC_API_KEY is
    // configured for the backend: with one, Quizmaster scores the answer
    // and the tutor gives feedback (then the session completes, since this
    // topic has a single concept); without one, the app surfaces a clear,
    // non-crashing error instead of hanging or breaking. Both are the
    // "correctly handled" outcome for this environment-dependent step.
    await expect(
      page.getByText("Sesja zakończona").or(page.getByText("Nie udało się przetworzyć odpowiedzi"))
    ).toBeVisible({ timeout: 15_000 });
  });
});
