from app.agents.memory_manager import MasteryState, update_mastery


def test_update_mastery_first_correct_answer_raises_all_scores():
    initial = MasteryState()
    updated = update_mastery(initial, correctness=1.0, misconception=None)
    assert updated.exposure_count == 1
    assert updated.comprehension > 0
    assert updated.recall > 0
    assert updated.mastery > 0
    assert updated.error_count == 0


def test_update_mastery_wrong_answer_increments_error_count():
    initial = MasteryState()
    updated = update_mastery(initial, correctness=0.1, misconception="Myśli, że popyt zawsze rośnie z cena")
    assert updated.error_count == 1
    assert updated.misconception_flags == ["Myśli, że popyt zawsze rośnie z cena"]


def test_update_mastery_repeated_correct_answers_converge_upward():
    state = MasteryState()
    for _ in range(10):
        state = update_mastery(state, correctness=1.0, misconception=None)
    assert state.mastery > 0.7
    assert state.exposure_count == 10


def test_update_mastery_repeated_errors_keep_mastery_low():
    state = MasteryState()
    for _ in range(5):
        state = update_mastery(state, correctness=0.0, misconception=None)
    assert state.mastery < 0.3
    assert state.error_count == 5


def test_update_mastery_does_not_duplicate_same_misconception():
    state = MasteryState()
    state = update_mastery(state, correctness=0.2, misconception="Myli korelacje z przyczynowością")
    state = update_mastery(state, correctness=0.2, misconception="Myli korelacje z przyczynowością")
    assert state.misconception_flags == ["Myli korelacje z przyczynowością"]


def test_update_mastery_scores_stay_within_bounds():
    state = MasteryState()
    for correctness in [1.0, 0.0, 1.0, 0.0, 1.0]:
        state = update_mastery(state, correctness=correctness, misconception=None)
        assert 0.0 <= state.mastery <= 1.0
        assert 0.0 <= state.comprehension <= 1.0
        assert 0.0 <= state.recall <= 1.0
