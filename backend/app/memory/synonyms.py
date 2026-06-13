"""Editable synonym map for German-aware recall.

Maps a normalized base term to equivalent terms. Used to expand both stored
content tokens and query terms so deterministic recall matches across common
German/English variants without embeddings.
"""

from __future__ import annotations

SYNONYMS: dict[str, list[str]] = {
    "name": ["vorname", "nachname", "heisst", "heisse"],
    "wohnort": ["wohnt", "wohne", "adresse", "stadt", "ort"],
    "arbeit": ["job", "beruf", "arbeitet", "arbeite", "firma", "arbeitgeber"],
    "sprache": ["language", "deutsch", "englisch", "spreche"],
    "telefon": ["handy", "nummer", "mobil", "phone"],
    "mail": ["email", "e-mail", "mailadresse"],
    "projekt": ["project", "vorhaben"],
    "geburtstag": ["geboren", "geburtsdatum", "birthday"],
    "server": ["vps", "host", "maschine"],
    "passwort": ["password", "kennwort", "credentials", "zugang"],
}
