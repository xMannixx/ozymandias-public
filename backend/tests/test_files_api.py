"""API tests for files endpoints."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient

from app.models.project import ProjectFile
from app.services.audit_service import AuditService
from app.services.errors import NotFoundError, ValidationError
from app.services.file_service import FileService
from app.services.project_service import ProjectService


def _file(project_id: str = "00000000-0000-0000-0000-000000000001") -> ProjectFile:
    return ProjectFile(
        file_id=uuid.uuid4(),
        project_id=uuid.UUID(project_id),
        user_id="test-user-id",
        filename="safe.pdf",
        original_name="invoice.pdf",
        content_type="application/pdf",
        size_bytes=7,
        minio_bucket="ozy-files",
        minio_key="projects/p/safe.pdf",
        created_at=datetime.now(tz=UTC),
    )


@pytest.mark.asyncio
async def test_post_file_upload_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = _file()
    monkeypatch.setattr(
        FileService,
        "upload_file",
        AsyncMock(
            return_value={
                "filename": row.filename,
                "original_name": row.original_name,
                "content_type": row.content_type,
                "size_bytes": row.size_bytes,
                "minio_bucket": row.minio_bucket,
                "minio_key": row.minio_key,
            }
        ),
    )
    monkeypatch.setattr(ProjectService, "create_file", AsyncMock(return_value=row))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.post(
        "/files/00000000-0000-0000-0000-000000000001/upload",
        files={"file": ("invoice.pdf", b"content", "application/pdf")},
    )
    assert response.status_code == 200
    assert response.json()["file_id"] == str(row.file_id)


@pytest.mark.asyncio
async def test_get_files_list_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = _file()
    monkeypatch.setattr(ProjectService, "list_files", AsyncMock(return_value=[row]))

    response = await client.get("/files/00000000-0000-0000-0000-000000000001/files")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_get_file_download_returns_200(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = _file()
    monkeypatch.setattr(ProjectService, "get_file", AsyncMock(return_value=row))
    monkeypatch.setattr(FileService, "download_file", AsyncMock(return_value=b"payload"))

    response = await client.get(
        f"/files/00000000-0000-0000-0000-000000000001/files/{row.file_id}/download"
    )
    assert response.status_code == 200
    assert response.content == b"payload"


@pytest.mark.asyncio
async def test_delete_file_returns_204(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    row = _file()
    monkeypatch.setattr(ProjectService, "get_file", AsyncMock(return_value=row))
    monkeypatch.setattr(FileService, "delete_file", AsyncMock(return_value=None))
    monkeypatch.setattr(ProjectService, "delete_file_record", AsyncMock(return_value=None))
    monkeypatch.setattr(AuditService, "log", AsyncMock())

    response = await client.delete(
        f"/files/00000000-0000-0000-0000-000000000001/files/{row.file_id}"
    )
    assert response.status_code == 204


@pytest.mark.asyncio
async def test_get_file_download_not_found_returns_404(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        ProjectService,
        "get_file",
        AsyncMock(side_effect=NotFoundError("File not found")),
    )

    response = await client.get(
        "/files/00000000-0000-0000-0000-000000000001/files/"
        "00000000-0000-0000-0000-000000000002/download"
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_post_file_upload_validation_error_returns_400(
    client: AsyncClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        FileService,
        "upload_file",
        AsyncMock(side_effect=ValidationError("bad file")),
    )

    response = await client.post(
        "/files/00000000-0000-0000-0000-000000000001/upload",
        files={"file": ("evil.bin", b"content", "application/x-executable")},
    )
    assert response.status_code == 400
