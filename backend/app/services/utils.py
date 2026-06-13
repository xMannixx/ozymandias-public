"""Shared helper utilities for service-layer code."""

from __future__ import annotations

import uuid


def normalize_user_id(value: str) -> uuid.UUID:
    """Convert arbitrary user identifiers into UUIDs for DB storage."""
    try:
        return uuid.UUID(value)
    except ValueError:
        return uuid.uuid5(uuid.NAMESPACE_URL, f"ozy-user:{value}")
