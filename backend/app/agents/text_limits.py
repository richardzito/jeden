"""Programmatic enforcement of the hard "tutor speaks briefly" rule (spec
section 1/7): a single tutor utterance must never exceed a small number of
sentences / characters before handing the turn back to the learner. This is
deliberately NOT just a system-prompt instruction -- LLMs drift long over a
conversation, so every outgoing utterance is clipped here before being sent
to TTS, regardless of what the model produced.
"""

import re

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")


def split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def enforce_length_limit(text: str, *, max_sentences: int, max_chars: int) -> str:
    """Truncates `text` to at most `max_sentences` sentences, and further to
    `max_chars` characters (cutting at the last full sentence that still
    fits, never mid-word) if it's still too long."""
    sentences = split_sentences(text)
    if not sentences:
        return ""

    limited = sentences[:max_sentences]
    result = " ".join(limited)

    if len(result) <= max_chars:
        return result

    # Still too long even after the sentence cap: drop trailing sentences
    # until it fits, then hard-clip at a word boundary as a last resort.
    while len(limited) > 1 and len(" ".join(limited)) > max_chars:
        limited.pop()
    result = " ".join(limited)
    if len(result) <= max_chars:
        return result

    clipped = result[:max_chars].rsplit(" ", 1)[0].rstrip(",;:")
    return clipped + "…" if clipped else result[:max_chars]
