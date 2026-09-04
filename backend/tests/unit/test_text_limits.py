from app.agents.text_limits import enforce_length_limit, split_sentences


def test_split_sentences_basic():
    assert split_sentences("Zdanie pierwsze. Zdanie drugie! Trzecie?") == [
        "Zdanie pierwsze.",
        "Zdanie drugie!",
        "Trzecie?",
    ]


def test_split_sentences_empty():
    assert split_sentences("   ") == []


def test_enforce_length_limit_within_bounds_unchanged():
    text = "To jest krótkie zdanie. I drugie."
    result = enforce_length_limit(text, max_sentences=4, max_chars=200)
    assert result == text


def test_enforce_length_limit_caps_sentence_count():
    text = "Jeden. Dwa. Trzy. Cztery. Pięć. Sześć."
    result = enforce_length_limit(text, max_sentences=2, max_chars=200)
    assert result == "Jeden. Dwa."


def test_enforce_length_limit_caps_char_count_without_cutting_word():
    text = "To jest bardzo długie zdanie, które na pewno przekroczy limit znaków ustawiony w teście."
    result = enforce_length_limit(text, max_sentences=4, max_chars=30)
    assert len(result) <= 31  # ellipsis char may push it by 1
    assert not result.endswith(" ")


def test_enforce_length_limit_empty_input():
    assert enforce_length_limit("", max_sentences=4, max_chars=100) == ""
