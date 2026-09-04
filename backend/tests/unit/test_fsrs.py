from datetime import datetime, timedelta, timezone

from app.core.fsrs import (
    FSRSState,
    Rating,
    correctness_to_rating,
    next_review_interval_days,
    next_state,
    retrievability,
    schedule_next_review,
)


def test_retrievability_is_full_confidence_with_no_history():
    state = FSRSState()
    assert retrievability(state, datetime.now(timezone.utc)) == 0.0


def test_retrievability_decays_over_time():
    now = datetime.now(timezone.utc)
    state = FSRSState(difficulty=5.0, stability=5.0, last_review_at=now)
    r_immediately = retrievability(state, now)
    r_later = retrievability(state, now + timedelta(days=10))
    assert r_immediately > r_later
    assert 0 <= r_later <= r_immediately <= 1


def test_first_review_initializes_state_from_rating():
    now = datetime.now(timezone.utc)
    state = FSRSState()
    updated = next_state(state, Rating.good, now)
    assert updated.stability is not None
    assert updated.reps == 1
    assert updated.lapses == 0


def test_again_rating_shrinks_stability_and_counts_lapse():
    now = datetime.now(timezone.utc)
    state = FSRSState(difficulty=5.0, stability=10.0, last_review_at=now - timedelta(days=5), reps=3)
    updated = next_state(state, Rating.again, now)
    assert updated.stability < state.stability
    assert updated.lapses == 1


def test_good_rating_grows_stability():
    now = datetime.now(timezone.utc)
    state = FSRSState(difficulty=5.0, stability=5.0, last_review_at=now - timedelta(days=5), reps=2)
    updated = next_state(state, Rating.good, now)
    assert updated.stability > state.stability


def test_next_review_interval_scales_with_stability():
    short = next_review_interval_days(2.0)
    long = next_review_interval_days(20.0)
    assert long > short > 0


def test_schedule_next_review_returns_future_datetime():
    now = datetime.now(timezone.utc)
    state = FSRSState()
    updated, next_at = schedule_next_review(state, Rating.good, now)
    assert next_at > now
    assert updated.reps == 1


def test_fsrs_state_round_trips_through_dict():
    now = datetime.now(timezone.utc)
    state = FSRSState(difficulty=6.5, stability=3.2, reps=4, lapses=1, last_review_at=now)
    restored = FSRSState.from_dict(state.to_dict())
    assert restored.difficulty == state.difficulty
    assert restored.stability == state.stability
    assert restored.reps == 4
    assert restored.last_review_at == now


def test_fsrs_state_from_empty_dict():
    state = FSRSState.from_dict(None)
    assert state.stability is None
    assert state.reps == 0


def test_correctness_to_rating_thresholds():
    assert correctness_to_rating(0.1) == Rating.again
    assert correctness_to_rating(0.5) == Rating.hard
    assert correctness_to_rating(0.75) == Rating.good
    assert correctness_to_rating(0.95) == Rating.easy
