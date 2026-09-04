"""ReviewPlanner: after a concept is exposed/answered, recompute when it
should next be reviewed using the FSRS-style scheduler (app/core/fsrs.py)
and record a due `Review` entry. Fully deterministic given the mastery
row's stored FSRS state and the answer's correctness -- no LLM call.
"""

from datetime import datetime, timezone

from app.core.fsrs import FSRSState, correctness_to_rating, schedule_next_review
from app.models.models import Review, UserConceptMastery


def record_review(
    mastery_row: UserConceptMastery, correctness: float, now: datetime | None = None
) -> tuple[UserConceptMastery, Review]:
    """Mutates `mastery_row` in place (fsrs_state, next_review_at,
    last_reviewed_at) and returns it along with a new (unpersisted) `Review`
    row the caller should `db.add()`. The caller is responsible for
    committing -- this keeps the function testable without a DB session."""
    now = now or datetime.now(timezone.utc)
    rating = correctness_to_rating(correctness)
    state = FSRSState.from_dict(mastery_row.fsrs_state)
    new_state, next_review_at = schedule_next_review(state, rating, now)

    mastery_row.fsrs_state = new_state.to_dict()
    mastery_row.next_review_at = next_review_at
    mastery_row.last_reviewed_at = now

    review = Review(
        user_id=mastery_row.user_id,
        concept_id=mastery_row.concept_id,
        scheduled_for=next_review_at,
        type="review",
        result={"rating": rating.name, "correctness": correctness},
    )
    return mastery_row, review
