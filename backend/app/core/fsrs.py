"""Self-contained spaced-repetition scheduler, structured after the FSRS
(Free Spaced Repetition Scheduler) algorithm: a per-concept (difficulty,
stability) state and a power-law forgetting curve, rather than SM-2's fixed
ease-factor multiplier (spec section B.3: "FSRS zamiast prostego SM-2").

Honesty note on the constants below (see also requirements.txt and README
"Technical decisions"): we deliberately did not depend on the `fsrs` PyPI
package here, because its public API changed incompatibly across the major
versions released while this was being built (1.x through 6.x), and we
could not verify against the live package which surface to target. This
module reimplements FSRS's *mechanics* -- the power-law retrievability
curve, and difficulty/stability updated per review rating -- which is what
actually makes spaced repetition work. The specific default constants
below (initial stability per rating, difficulty deltas) are reasonable,
hand-chosen values in the same ballpark as published FSRS defaults, NOT a
byte-for-byte reproduction of py-fsrs's ML-fitted weights (reproducing
those exactly from memory, unverified, would risk presenting wrong numbers
as fact). Swapping in the real `fsrs` package's optimizer later -- to fit
weights per-user from review history -- is a natural follow-up (see README
"Next steps") and would not require changing the surrounding scheduling
code, only `next_state`/`retrievability` below.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from enum import IntEnum

DEFAULT_REQUESTED_RETENTION = 0.9
# Power-law forgetting curve: R(t, S) = (1 + FACTOR * t / S) ** DECAY.
# FACTOR is chosen so that R(t=S, S) == DEFAULT_REQUESTED_RETENTION.
DECAY = -0.5
FACTOR = DEFAULT_REQUESTED_RETENTION ** (1 / DECAY) - 1

MIN_DIFFICULTY = 1.0
MAX_DIFFICULTY = 10.0


class Rating(IntEnum):
    again = 1
    hard = 2
    good = 3
    easy = 4


_INITIAL_STABILITY_DAYS = {
    Rating.again: 0.4,
    Rating.hard: 1.0,
    Rating.good: 2.5,
    Rating.easy: 5.0,
}

_INITIAL_DIFFICULTY_DELTA = {
    Rating.again: 3.0,
    Rating.hard: 1.0,
    Rating.good: 0.0,
    Rating.easy: -1.0,
}
_INITIAL_DIFFICULTY_BASE = 5.0

_DIFFICULTY_DELTA_ON_REVIEW = {
    Rating.again: 1.2,
    Rating.hard: 0.4,
    Rating.good: 0.0,
    Rating.easy: -0.6,
}

_LAPSE_STABILITY_MULTIPLIER = 0.5
_GROWTH_RATE_BY_RATING = {
    Rating.hard: 0.6,
    Rating.good: 1.2,
    Rating.easy: 1.8,
}


@dataclass
class FSRSState:
    difficulty: float | None = None
    stability: float | None = None
    reps: int = 0
    lapses: int = 0
    last_review_at: datetime | None = None

    def to_dict(self) -> dict:
        return {
            "difficulty": self.difficulty,
            "stability": self.stability,
            "reps": self.reps,
            "lapses": self.lapses,
            "last_review_at": self.last_review_at.isoformat() if self.last_review_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict | None) -> "FSRSState":
        if not data:
            return cls()
        last_review = data.get("last_review_at")
        return cls(
            difficulty=data.get("difficulty"),
            stability=data.get("stability"),
            reps=data.get("reps", 0),
            lapses=data.get("lapses", 0),
            last_review_at=datetime.fromisoformat(last_review) if last_review else None,
        )


def _clamp_difficulty(value: float) -> float:
    return max(MIN_DIFFICULTY, min(MAX_DIFFICULTY, value))


def retrievability(state: FSRSState, now: datetime) -> float:
    """Estimated probability of successful recall right now, in [0, 1]."""
    if state.stability is None or state.last_review_at is None:
        return 0.0
    elapsed_days = max(0.0, (now - state.last_review_at).total_seconds() / 86400)
    return (1 + FACTOR * elapsed_days / state.stability) ** DECAY


def next_state(state: FSRSState, rating: Rating, now: datetime) -> FSRSState:
    if state.stability is None or state.difficulty is None:
        new_stability = _INITIAL_STABILITY_DAYS[rating]
        new_difficulty = _clamp_difficulty(_INITIAL_DIFFICULTY_BASE + _INITIAL_DIFFICULTY_DELTA[rating])
    else:
        r = retrievability(state, now)
        new_difficulty = _clamp_difficulty(state.difficulty + _DIFFICULTY_DELTA_ON_REVIEW[rating])
        if rating == Rating.again:
            new_stability = max(0.1, state.stability * _LAPSE_STABILITY_MULTIPLIER)
        else:
            # Recalling a nearly-forgotten item (low R) is a stronger signal
            # than recalling a fresh one, and easier (lower-difficulty)
            # items grow faster -- both standard FSRS intuitions.
            forgetting_bonus = 1 + (1 - r)
            ease_bonus = 1 + (MAX_DIFFICULTY - new_difficulty) / MAX_DIFFICULTY
            growth = 1 + (_GROWTH_RATE_BY_RATING[rating] - 1) * forgetting_bonus * ease_bonus
            new_stability = state.stability * max(growth, 1.01)

    return FSRSState(
        difficulty=new_difficulty,
        stability=new_stability,
        reps=state.reps + 1,
        lapses=state.lapses + (1 if rating == Rating.again else 0),
        last_review_at=now,
    )


def next_review_interval_days(
    stability: float, requested_retention: float = DEFAULT_REQUESTED_RETENTION
) -> float:
    """Inverts the forgetting curve to find the interval at which
    retrievability drops to `requested_retention`."""
    return stability / FACTOR * (requested_retention ** (1 / DECAY) - 1)


def schedule_next_review(
    state: FSRSState,
    rating: Rating,
    now: datetime | None = None,
    requested_retention: float = DEFAULT_REQUESTED_RETENTION,
) -> tuple[FSRSState, datetime]:
    now = now or datetime.now(timezone.utc)
    updated = next_state(state, rating, now)
    interval_days = next_review_interval_days(updated.stability, requested_retention)
    next_review_at = now + timedelta(days=max(interval_days, 1 / 24))  # never less than 1 hour out
    return updated, next_review_at


def correctness_to_rating(correctness: float) -> Rating:
    """Maps Quizmaster's continuous 0-1 correctness score onto an FSRS
    rating. Thresholds are deliberately conservative (biased toward "hard"
    over "good") since a wrong rating costs a learner a wasted review much
    less than it costs them forgetting something the app thought was solid.
    """
    if correctness < 0.4:
        return Rating.again
    if correctness < 0.65:
        return Rating.hard
    if correctness < 0.9:
        return Rating.good
    return Rating.easy
