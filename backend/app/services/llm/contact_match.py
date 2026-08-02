"""Decide which stored contacts the current message is about.

Pure and deterministic: the same message and the same address book always
produce the same matches, so what reached a model can be reasoned about after
the fact. Matching reuses the German-aware normalization of memory recall, so
"Muellers Nummer" finds Mueller.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.memory.text_norm import fold, query_terms, stem, tokenize
from app.models.contact import Contact

#: Shorter tokens match by accident far too often ("Bo", "Li", "AG").
_MIN_TOKEN_LENGTH = 3

#: More than a handful of full entries would crowd out the rest of the context.
MAX_DETAILED_CONTACTS = 3

#: Best reason first: a name is a stronger signal than a shared employer.
_REASON_RANK = {"name": 0, "company": 1, "role": 2, "tag": 3}


@dataclass(frozen=True)
class ContactMatch:
    """One contact the message points at, plus why it was picked."""

    contact: Contact
    #: name | company | role | tag, for the audit trail and for ranking.
    reason: str


def _terms_of(value: str | None) -> set[str]:
    """Stemmed terms of a stored field, ignoring anything too short to trust."""
    if not value:
        return set()
    return {stem(token) for token in tokenize(value) if len(token) >= _MIN_TOKEN_LENGTH}


def _hits(field: str | None, terms: set[str]) -> bool:
    field_terms = _terms_of(field)
    return bool(field_terms and field_terms & terms)


def _first_name_is_unambiguous(contact: Contact, contacts: list[Contact]) -> bool:
    """True when exactly one contact carries this first name.

    Two Lisas in the address book mean a bare "Lisa" identifies nobody, and
    guessing the wrong one would put the wrong phone number in front of you.
    """
    folded = fold(contact.first_name)
    return sum(1 for other in contacts if fold(other.first_name) == folded) == 1


def _reason_for(contact: Contact, *, terms: set[str], contacts: list[Contact]) -> str | None:
    if _hits(contact.last_name, terms):
        return "name"
    if _hits(contact.first_name, terms) and _first_name_is_unambiguous(contact, contacts):
        return "name"
    if _hits(contact.company, terms):
        return "company"
    if _hits(contact.role, terms):
        return "role"
    for tag in contact.tags if isinstance(contact.tags, list) else []:
        if _hits(str(tag), terms):
            return "tag"
    return None


def match_contacts(
    query: str,
    contacts: list[Contact],
    *,
    limit: int = MAX_DETAILED_CONTACTS,
) -> list[ContactMatch]:
    """Contacts the message is about, strongest reason first.

    An empty result is the normal case: most messages are not about a person,
    and then no contact detail belongs in the prompt at all.
    """
    if not query.strip() or not contacts:
        return []
    terms = query_terms(query)
    if not terms:
        return []

    matches = [
        ContactMatch(contact=contact, reason=reason)
        for contact in contacts
        if (reason := _reason_for(contact, terms=terms, contacts=contacts)) is not None
    ]
    matches.sort(
        key=lambda match: (
            _REASON_RANK.get(match.reason, len(_REASON_RANK)),
            fold(match.contact.first_name),
            fold(match.contact.last_name or ""),
        )
    )
    return matches[:limit]
