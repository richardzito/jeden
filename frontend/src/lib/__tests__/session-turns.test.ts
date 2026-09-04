import { describe, expect, it } from "vitest";

import type { SessionTurn } from "@/lib/api";
import { deriveSessionUiState, turnsToEntries } from "@/lib/session-turns";

function turn(overrides: Partial<SessionTurn>): SessionTurn {
  return {
    turn_type: "explain",
    content_text: "text",
    concept_id: null,
    session_complete: false,
    ...overrides,
  };
}

describe("deriveSessionUiState", () => {
  it("returns idle state for an empty turn list", () => {
    expect(deriveSessionUiState([])).toEqual({ awaitingInput: false, sessionComplete: false });
  });

  it("awaits input after a question turn", () => {
    const result = deriveSessionUiState([turn({ turn_type: "explain" }), turn({ turn_type: "question" })]);
    expect(result).toEqual({ awaitingInput: true, sessionComplete: false });
  });

  it("awaits input after a checkin turn (e.g. asking to repeat)", () => {
    const result = deriveSessionUiState([turn({ turn_type: "checkin" })]);
    expect(result.awaitingInput).toBe(true);
  });

  it("does not await input after a transition/explain turn", () => {
    expect(deriveSessionUiState([turn({ turn_type: "explain" })]).awaitingInput).toBe(false);
    expect(deriveSessionUiState([turn({ turn_type: "transition" })]).awaitingInput).toBe(false);
  });

  it("never awaits input once the session is complete, even on a question turn", () => {
    const result = deriveSessionUiState([turn({ turn_type: "question", session_complete: true })]);
    expect(result).toEqual({ awaitingInput: false, sessionComplete: true });
  });
});

describe("turnsToEntries", () => {
  it("maps backend turns to transcript entries with the given role", () => {
    const entries = turnsToEntries([turn({ turn_type: "explain", content_text: "Cześć!" })], "agent", 1);
    expect(entries).toEqual([{ id: "agent-1-0", role: "agent", text: "Cześć!", turnType: "explain" }]);
  });

  it("produces unique ids for multiple turns in the same batch", () => {
    const entries = turnsToEntries([turn({ content_text: "a" }), turn({ content_text: "b" })], "agent", 1);
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(2);
  });
});
