"""German-aware text normalization for deterministic recall.

No embeddings: recall relevance is computed from token overlap after folding
umlauts, lowercasing, light stemming and synonym expansion. Everything here is
pure and deterministic so retrieval scoring is reproducible and testable.
"""

from __future__ import annotations

import re

from app.memory.synonyms import SYNONYMS

_WORD_RE = re.compile(r"[a-z0-9äöüß]+", re.IGNORECASE)

# Common German suffixes, longest first, stripped once for light stemming.
_SUFFIXES: tuple[str, ...] = (
    "ungen",
    "lich",
    "isch",
    " keit",
    "heit",
    "ende",
    "ern",
    "est",
    "en",
    "er",
    "es",
    "em",
    "et",
    "st",
    "e",
    "s",
    "n",
)

_STOPWORDS: frozenset[str] = frozenset(
    {
        "der",
        "die",
        "das",
        "und",
        "oder",
        "ist",
        "war",
        "ein",
        "eine",
        "einen",
        "im",
        "in",
        "an",
        "am",
        "zu",
        "fuer",
        "mit",
        "von",
        "the",
        "a",
        "of",
        "to",
        "is",
        "are",
        "was",
    }
)

_FOLD = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})

# Reverse synonym index: every variant points at its base plus siblings.
_VARIANT_INDEX: dict[str, set[str]] = {}
for _base, _variants in SYNONYMS.items():
    _group = {_base, *_variants}
    for _term in _group:
        _VARIANT_INDEX.setdefault(_term, set()).update(_group)


def fold(text: str) -> str:
    """Lowercase and transliterate umlauts/ß for stable matching."""
    return text.lower().translate(_FOLD)


def stem(token: str) -> str:
    """Strip one common suffix; keep tokens of length >= 3 intact at the root."""
    folded = fold(token)
    for suffix in _SUFFIXES:
        suffix = suffix.strip()
        if len(folded) > len(suffix) + 2 and folded.endswith(suffix):
            return folded[: -len(suffix)]
    return folded


def tokenize(text: str) -> list[str]:
    """Split text into folded word tokens, dropping stopwords."""
    tokens = [fold(match.group(0)) for match in _WORD_RE.finditer(text)]
    return [token for token in tokens if token not in _STOPWORDS]


def expand(token: str) -> set[str]:
    """Return the stemmed token plus stemmed synonym variants."""
    folded = fold(token)
    group = set(_VARIANT_INDEX.get(folded, {folded}))
    group.add(folded)
    return {stem(item) for item in group}


def query_terms(text: str) -> set[str]:
    """Build the expanded, stemmed term set for a query or document."""
    terms: set[str] = set()
    for token in tokenize(text):
        terms.update(expand(token))
    return terms
