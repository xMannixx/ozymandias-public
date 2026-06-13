"""Tests for German-aware text normalization."""

from app.memory.text_norm import expand, fold, query_terms, tokenize


def test_fold_umlauts() -> None:
    assert fold("Wohnort Köln Straße") == "wohnort koeln strasse"


def test_tokenize_drops_stopwords() -> None:
    tokens = tokenize("der Nutzer wohnt in Berlin")
    assert "der" not in tokens
    assert "berlin" in tokens


def test_synonym_expansion() -> None:
    terms = expand("wohnt")
    assert "wohnort" in terms or any(t.startswith("wohnort") for t in terms)


def test_query_terms_overlap_across_synonyms() -> None:
    q = query_terms("Wo wohnt er?")
    doc = query_terms("Seine Adresse ist in Berlin")
    assert q & doc


def test_query_terms_empty() -> None:
    assert query_terms("der die das und") == set()
