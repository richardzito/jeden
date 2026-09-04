"""Deterministic, rule-based part of source credibility scoring.

Per the product spec (risk A.2): an LLM is not trusted to be the sole judge
of a source's credibility -- it tends to over-trust confident prose and
under-weight structural signals. This module scores explicit, checkable
signals (domain type, author/date presence, source category) in plain
Python. `FactChecker` (app/agents/fact_checker.py) blends this score with a
smaller LLM-provided modifier, but this rule score is the majority weight
and is fully unit-testable without any network or model call.
"""

import hashlib
import re
from datetime import datetime, timezone
from urllib.parse import urlparse

from app.models.models import SourceType

_PRIMARY_TLD_SUFFIXES = (".gov", ".gov.pl", ".edu", ".ac.uk", ".mil", ".int")
_ACADEMIC_HINTS = (".ac.", "scholar.", "pubmed.", "doi.org", "arxiv.org")

_SOURCE_TYPE_BASE_SCORE = {
    SourceType.paper: 0.30,
    SourceType.institutional: 0.28,
    SourceType.docs: 0.25,
    SourceType.book: 0.22,
    SourceType.report: 0.18,
    SourceType.reputable_media: 0.10,
    SourceType.expert_blog: 0.0,
    SourceType.other: -0.10,
}


def _domain_bonus(url: str) -> float:
    host = urlparse(url).netloc.lower()
    if any(host.endswith(suf) for suf in _PRIMARY_TLD_SUFFIXES):
        return 0.30
    if any(hint in host for hint in _ACADEMIC_HINTS):
        return 0.25
    return 0.0


def compute_rule_based_credibility(
    *,
    url: str,
    author: str | None,
    publisher: str | None,
    published_at: datetime | None,
    source_type: SourceType,
) -> float:
    """Returns a score in [0, 1] from explicit, checkable signals only."""
    score = 0.35  # neutral baseline
    score += _domain_bonus(url)
    score += _SOURCE_TYPE_BASE_SCORE.get(source_type, -0.1)

    if author and author.strip():
        score += 0.15
    if publisher and publisher.strip():
        score += 0.05
    if published_at is not None:
        score += 0.10
        age_years = (datetime.now(timezone.utc) - published_at.replace(tzinfo=timezone.utc)).days / 365
        if age_years > 15:
            score -= 0.10

    return max(0.0, min(1.0, round(score, 3)))


def guess_source_type(url: str) -> SourceType:
    """Cheap, deterministic first guess from the URL alone, used before a
    source has been fetched/assessed. FactChecker's LLM assessment can
    still override this (see fact_checker.score_source) -- this is just a
    reasonable prior, not a final classification."""
    host = urlparse(url).netloc.lower()
    if any(host.endswith(suf) for suf in _PRIMARY_TLD_SUFFIXES):
        return SourceType.institutional
    if any(hint in host for hint in _ACADEMIC_HINTS):
        return SourceType.paper
    if "docs." in host or "/docs/" in url.lower() or "documentation" in host:
        return SourceType.docs
    if re.search(r"\b(reuters|apnews|bbc|nytimes|economist|ft\.com|bloomberg)\b", host):
        return SourceType.reputable_media
    if "blog" in host:
        return SourceType.expert_blog
    return SourceType.other


def normalize_query(text: str) -> str:
    return re.sub(r"\s+", " ", text.strip().lower())


def hash_query(normalized_text: str) -> str:
    return hashlib.sha256(normalized_text.encode("utf-8")).hexdigest()
