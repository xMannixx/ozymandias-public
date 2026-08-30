"""API tests for the chat starter endpoint."""

from __future__ import annotations

import pytest
from httpx import AsyncClient

from app.services.chat_starter_service import ChatStarter, ChatStarterService


@pytest.mark.asyncio
async def test_starters_are_returned_for_the_current_user(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def _suggest(
        self: ChatStarterService, *, user_id: str, limit: int = 4
    ) -> list[ChatStarter]:
        del self, limit
        assert user_id == "test-user-id"
        return [
            ChatStarter(
                id="proposals",
                icon="proposals",
                title="Review 3 proposals",
                prompt="Which memory proposals are waiting for me?",
            )
        ]

    monkeypatch.setattr(ChatStarterService, "suggest", _suggest)

    response = await client.get("/conversations/starters")

    assert response.status_code == 200
    assert response.json() == [
        {
            "id": "proposals",
            "icon": "proposals",
            "title": "Review 3 proposals",
            "prompt": "Which memory proposals are waiting for me?",
        }
    ]


@pytest.mark.asyncio
async def test_starters_is_not_read_as_a_conversation_id(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The route sits under /conversations, so ordering must keep it reachable."""

    async def _suggest(
        self: ChatStarterService, *, user_id: str, limit: int = 4
    ) -> list[ChatStarter]:
        del self, user_id, limit
        return []

    monkeypatch.setattr(ChatStarterService, "suggest", _suggest)

    response = await client.get("/conversations/starters")

    assert response.status_code == 200
    assert response.json() == []
