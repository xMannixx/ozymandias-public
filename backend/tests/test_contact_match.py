"""Tests for deciding which contacts a message is about."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from app.models.contact import Contact
from app.services.llm.contact_match import match_contacts


def _contact(
    *,
    first_name: str = "Lisa",
    last_name: str | None = "Schmidt",
    company: str | None = None,
    role: str | None = None,
    tags: list[str] | None = None,
) -> Contact:
    now = datetime.now(tz=UTC)
    return Contact(
        contact_id=uuid.uuid4(),
        user_id="user-1",
        first_name=first_name,
        last_name=last_name,
        company=company,
        role=role,
        phones=[],
        emails=[],
        address=None,
        birthday=None,
        notes=None,
        tags=tags if tags is not None else [],
        avatar_minio_key=None,
        sensitivity="S2",
        created_at=now,
        updated_at=now,
    )


def test_last_name_is_the_strongest_signal() -> None:
    contact = _contact()

    matches = match_contacts("Hast du Schmidts Nummer?", [contact])

    assert [match.reason for match in matches] == ["name"]
    assert matches[0].contact is contact


def test_matching_survives_german_case_and_umlauts() -> None:
    contact = _contact(first_name="Jörg", last_name="Müller")

    matches = match_contacts("ruf mueller an", [contact])

    assert len(matches) == 1


def test_company_role_and_tag_also_find_a_contact() -> None:
    by_company = _contact(last_name="Weber", company="Muster GmbH")
    by_role = _contact(first_name="Ada", last_name="Berger", role="Steuerberaterin")
    by_tag = _contact(first_name="Bob", last_name="Klein", tags=["Handwerker"])
    contacts = [by_company, by_role, by_tag]

    assert match_contacts("Was macht Muster eigentlich?", contacts)[0].reason == "company"
    assert match_contacts("Wie erreiche ich meine Steuerberaterin?", contacts)[0].reason == "role"
    assert match_contacts("Kennst du einen Handwerker?", contacts)[0].reason == "tag"


def test_a_bare_first_name_is_ignored_when_two_people_share_it() -> None:
    """Handing out the wrong Lisa's number is worse than handing out none."""
    one = _contact(first_name="Lisa", last_name="Schmidt")
    two = _contact(first_name="Lisa", last_name="Berger")

    assert match_contacts("Schreib Lisa", [one, two]) == []
    assert len(match_contacts("Schreib Lisa", [one])) == 1


def test_short_tokens_do_not_match() -> None:
    """Two-letter fragments would tie half the address book to any sentence."""
    contact = _contact(first_name="Bo", last_name=None, company="AG")

    assert match_contacts("bo und ag", [contact]) == []


def test_a_message_about_nothing_personal_matches_nobody() -> None:
    contact = _contact()

    assert match_contacts("Wie wird das Wetter morgen?", [contact]) == []
    assert match_contacts("", [contact]) == []
    assert match_contacts("Schmidt", []) == []


def test_name_matches_outrank_company_matches_and_the_list_is_capped() -> None:
    colleagues = [
        _contact(first_name="Ada", last_name="Berger", company="Muster GmbH"),
        _contact(first_name="Bob", last_name="Klein", company="Muster GmbH"),
        _contact(first_name="Cleo", last_name="Nowak", company="Muster GmbH"),
        _contact(first_name="Dora", last_name="Roth", company="Muster GmbH"),
    ]

    matches = match_contacts("Termin bei Muster mit Nowak", colleagues)

    assert len(matches) == 3
    assert matches[0].reason == "name"
    assert matches[0].contact.last_name == "Nowak"
    assert {match.reason for match in matches[1:]} == {"company"}
