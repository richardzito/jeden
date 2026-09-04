import type { SessionTurn } from "@/lib/api";

export type TranscriptEntry = {
  id: string;
  role: "agent" | "user";
  text: string;
  turnType: string;
};

/** Turns that expect the learner to respond before the tutor continues. */
const INPUT_AWAITING_TURN_TYPES = new Set(["question", "checkin"]);

export function turnsToEntries(turns: SessionTurn[], role: "agent" | "user", seed = Date.now()): TranscriptEntry[] {
  return turns.map((t, i) => ({
    id: `${role}-${seed}-${i}`,
    role,
    text: t.content_text,
    turnType: t.turn_type,
  }));
}

/** Given the latest batch of agent turns, derive whether the UI should
 * wait for a learner answer next, and whether the session has ended.
 * Pulled out of the session page component so it's independently testable
 * (spec section 11: frontend unit tests). */
export function deriveSessionUiState(turns: SessionTurn[]): {
  awaitingInput: boolean;
  sessionComplete: boolean;
} {
  if (turns.length === 0) {
    return { awaitingInput: false, sessionComplete: false };
  }
  const last = turns[turns.length - 1];
  return {
    sessionComplete: last.session_complete,
    awaitingInput: !last.session_complete && INPUT_AWAITING_TURN_TYPES.has(last.turn_type),
  };
}
