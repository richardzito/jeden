"""MemoryManager: deterministic update of a learner's per-concept mastery
state after an answered question (spec section H: "mastery = f(comprehension,
recall, confidence, error_count) -- prosta ważona funkcja w MVP").

Deliberately pure/deterministic code, not an LLM call: the qualitative
judgement (was the answer right, is there a misconception) already happened
in Quizmaster.evaluate_answer. MemoryManager's job is just the arithmetic
of turning that judgement into an updated mastery estimate, which is exactly
the kind of thing that should be reproducible and unit-testable rather than
left to a model's discretion.
"""

from dataclasses import dataclass

COMPREHENSION_EMA_ALPHA = 0.4
RECALL_EMA_ALPHA = 0.7
ERROR_THRESHOLD = 0.5
CONFIDENCE_SATURATION_K = 3.0
ERROR_PENALTY_PER_MISTAKE = 0.03
MAX_ERROR_PENALTY = 0.3

MASTERY_WEIGHTS = {"comprehension": 0.5, "recall": 0.3, "confidence": 0.2}


@dataclass
class MasteryState:
    exposure_count: int = 0
    comprehension: float = 0.0
    recall: float = 0.0
    confidence: float = 0.0
    mastery: float = 0.0
    error_count: int = 0
    misconception_flags: list[str] | None = None

    def __post_init__(self):
        if self.misconception_flags is None:
            self.misconception_flags = []


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def update_mastery(current: MasteryState, *, correctness: float, misconception: str | None) -> MasteryState:
    correctness = _clamp01(correctness)

    exposure_count = current.exposure_count + 1
    comprehension = _clamp01(
        current.comprehension * (1 - COMPREHENSION_EMA_ALPHA) + correctness * COMPREHENSION_EMA_ALPHA
    )
    recall = _clamp01(current.recall * (1 - RECALL_EMA_ALPHA) + correctness * RECALL_EMA_ALPHA)
    confidence = _clamp01(exposure_count / (exposure_count + CONFIDENCE_SATURATION_K))
    error_count = current.error_count + (1 if correctness < ERROR_THRESHOLD else 0)

    misconceptions = list(current.misconception_flags or [])
    if misconception and misconception not in misconceptions:
        misconceptions.append(misconception)

    error_penalty = min(MAX_ERROR_PENALTY, error_count * ERROR_PENALTY_PER_MISTAKE)
    mastery = _clamp01(
        MASTERY_WEIGHTS["comprehension"] * comprehension
        + MASTERY_WEIGHTS["recall"] * recall
        + MASTERY_WEIGHTS["confidence"] * confidence
        - error_penalty
    )

    return MasteryState(
        exposure_count=exposure_count,
        comprehension=comprehension,
        recall=recall,
        confidence=confidence,
        mastery=mastery,
        error_count=error_count,
        misconception_flags=misconceptions,
    )
