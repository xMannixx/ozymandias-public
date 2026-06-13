"""Tests for query-aware retrieval scoring and budgeted assembly."""

from app.memory.lanes import AuthorityClass
from app.memory.retrieval import Candidate, assemble, rank


def _corpus() -> list[Candidate]:
    return [
        Candidate("id", AuthorityClass.identity, "Name", "Der Nutzer heisst Alex", 0.99),
        Candidate("wo", AuthorityClass.evidence, "Wohnort", "Alex wohnt in Berlin", 0.8),
        Candidate("job", AuthorityClass.evidence, "Beruf", "Alex arbeitet als Entwickler", 0.7),
        Candidate("kaffee", AuthorityClass.preference, "Hobby", "Alex mag Kaffee", 0.6),
        Candidate("pw", AuthorityClass.authorization, "Zugang", "Server Passwort lautet X", 0.95),
    ]


def test_identity_floor_always_present() -> None:
    result = assemble("Erzähl mir etwas Zufälliges", _corpus())
    assert any(c.lane == AuthorityClass.identity for c in result.identity)


def test_authorization_never_injected() -> None:
    result = assemble("Wie lautet das Server Passwort?", _corpus())
    lanes = {sc.candidate.lane for sc in result.relevant}
    assert AuthorityClass.authorization not in lanes


def test_query_relevance_ranks_correct_fact() -> None:
    eval_set = [
        ("Wo wohnt Alex?", "wo"),
        ("Was arbeitet er?", "job"),
        ("Was mag er gern zu trinken?", "kaffee"),
    ]
    for query, expected_id in eval_set:
        ranked = [sc for sc in rank(query, _corpus()) if sc.score > 0]
        assert ranked, f"no result for {query!r}"
        assert ranked[0].candidate.id == expected_id, query


def test_negative_query_returns_no_relevant_facts() -> None:
    result = assemble("Quantenphysik Vorlesung Mittwoch", _corpus())
    assert result.relevant == []


def test_per_lane_budget_limits_output() -> None:
    big = [
        Candidate(f"e{i}", AuthorityClass.evidence, "Notiz", "Berlin " * 50, 0.7) for i in range(20)
    ]
    result = assemble("Berlin", big, per_lane_char_budget=400)
    rendered_len = sum(len(sc.candidate.content) for sc in result.relevant)
    assert rendered_len <= 400 + 200
