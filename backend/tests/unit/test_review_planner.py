import uuid
from datetime import datetime, timezone

from app.agents.review_planner import record_review
from app.models.models import UserConceptMastery


def _mastery_row():
    return UserConceptMastery(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        concept_id=uuid.uuid4(),
        fsrs_state=None,
        next_review_at=None,
        last_reviewed_at=None,
    )


def test_record_review_sets_next_review_in_future():
    row = _mastery_row()
    now = datetime.now(timezone.utc)
    updated_row, review = record_review(row, correctness=0.8, now=now)
    assert updated_row.next_review_at > now
    assert updated_row.last_reviewed_at == now
    assert review.scheduled_for == updated_row.next_review_at
    assert review.concept_id == row.concept_id
    assert review.user_id == row.user_id


def test_record_review_low_correctness_schedules_sooner_than_high():
    row_low = _mastery_row()
    row_high = _mastery_row()
    now = datetime.now(timezone.utc)
    row_low, _ = record_review(row_low, correctness=0.1, now=now)
    row_high, _ = record_review(row_high, correctness=0.95, now=now)
    assert row_low.next_review_at < row_high.next_review_at


def test_record_review_persists_fsrs_state_for_next_call():
    row = _mastery_row()
    now = datetime.now(timezone.utc)
    row, _ = record_review(row, correctness=0.9, now=now)
    assert row.fsrs_state is not None
    assert row.fsrs_state["reps"] == 1

    later = now.replace(day=now.day)
    row, _ = record_review(row, correctness=0.9, now=now)
    assert row.fsrs_state["reps"] == 2
