"""API tests for dashboard stats endpoint."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient

from app.schemas.api_models import AuditEntryResponse, CircuitBreakerStatusResponse, DashboardStats
from app.services.stats_service import StatsService


def _stats_payload() -> DashboardStats:
    return DashboardStats(
        claims_total=4,
        claims_by_verification={"tentative": 2, "confirmed": 2},
        claims_by_sensitivity={"S0": 1, "S1": 1, "S2": 1, "S3": 1, "S4": 0},
        proposals_pending=1,
        proposals_total=3,
        circuit_breaker=CircuitBreakerStatusResponse(
            current_count=2,
            is_tripped=False,
            max_actions=20,
            window_seconds=60,
            cooldown_seconds=120,
        ),
        recent_actions=[
            AuditEntryResponse(
                audit_id="a1",
                event_type="turn_processed",
                user_id="u1",
                channel="web",
                payload={"provider": "deepseek"},
                source_ref="turn-1",
                result="success",
                sensitivity="S1",
                created_at=datetime.now(tz=UTC),
            )
        ],
        provider_usage={"deepseek": 1},
        projects_active=2,
        projects_tasks_open=5,
        projects_risks_critical=1,
        projects_next_milestone="Release v1 (2026-04-12)",
        contacts_total=0,
    )


@pytest.mark.asyncio
async def test_get_stats_returns_dashboard_stats(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self
        assert user_id == "test-user-id"
        return _stats_payload()

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert response.json()["claims_total"] == 4


@pytest.mark.asyncio
async def test_get_stats_claims_total_field_present(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        payload = _stats_payload()
        payload.claims_total = 7
        return payload

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert response.json()["claims_total"] == 7


@pytest.mark.asyncio
async def test_get_stats_claims_by_verification(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        payload = _stats_payload()
        payload.claims_by_verification = {
            "tentative": 1,
            "confirmed": 2,
            "superseded": 0,
            "retracted": 0,
        }
        return payload

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert set(response.json()["claims_by_verification"].keys()) == {
        "tentative",
        "confirmed",
        "superseded",
        "retracted",
    }


@pytest.mark.asyncio
async def test_get_stats_claims_by_sensitivity(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        return _stats_payload()

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert set(response.json()["claims_by_sensitivity"].keys()) == {"S0", "S1", "S2", "S3", "S4"}


@pytest.mark.asyncio
async def test_get_stats_pending_and_total_proposals(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        payload = _stats_payload()
        payload.proposals_pending = 2
        payload.proposals_total = 5
        return payload

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert response.json()["proposals_pending"] == 2
    assert response.json()["proposals_total"] == 5


@pytest.mark.asyncio
async def test_get_stats_includes_circuit_breaker_state(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        payload = _stats_payload()
        payload.circuit_breaker.is_tripped = True
        return payload

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert response.json()["circuit_breaker"]["is_tripped"] is True


@pytest.mark.asyncio
async def test_get_stats_recent_actions_are_non_s4(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async def fake_get_stats(self: StatsService, user_id: str) -> DashboardStats:
        del self, user_id
        payload = _stats_payload()
        payload.recent_actions = payload.recent_actions[:1]
        payload.recent_actions[0].sensitivity = "S2"
        return payload

    monkeypatch.setattr(StatsService, "get_dashboard_stats", fake_get_stats)
    response = await client.get("/stats")
    assert response.status_code == 200
    assert len(response.json()["recent_actions"]) <= 10
    assert all(item["sensitivity"] != "S4" for item in response.json()["recent_actions"])
