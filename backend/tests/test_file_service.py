"""Unit tests for MinIO-backed file service."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from app.services.errors import ValidationError
from app.services.file_service import FileService


class _FakeResponse:
    def __init__(self, payload: bytes) -> None:
        self.payload = payload
        self.closed = False
        self.released = False

    def read(self) -> bytes:
        return self.payload

    def close(self) -> None:
        self.closed = True

    def release_conn(self) -> None:
        self.released = True


@pytest.mark.asyncio
async def test_upload_file_stores_object_and_returns_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="../evil.pdf",
        data=b"content",
        content_type="application/pdf",
    )
    assert result["size_bytes"] == 7
    assert str(result["original_name"]) == "evil.pdf"
    assert "projects/proj-1/" in str(result["minio_key"])
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_custom_prefix_in_minio_key(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="cid-1",
        user_id="user-1",
        filename="face.png",
        data=b"x",
        content_type="image/png",
        prefix="contacts",
    )
    assert "contacts/cid-1/" in str(result["minio_key"])
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_download_file_returns_bytes(monkeypatch: pytest.MonkeyPatch) -> None:
    service = FileService()
    response = _FakeResponse(b"hello")
    monkeypatch.setattr(service.client, "get_object", lambda *_args, **_kwargs: response)

    data = await service.download_file(minio_key="projects/p/file.bin")
    assert data == b"hello"
    assert response.closed is True
    assert response.released is True


@pytest.mark.asyncio
async def test_delete_file_calls_remove_object(monkeypatch: pytest.MonkeyPatch) -> None:
    service = FileService()
    calls: list[tuple[object, ...]] = []

    def remove_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "remove_object", remove_object)

    await service.delete_file(minio_key="projects/p/file.bin")
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_ensure_bucket_creates_missing_bucket(monkeypatch: pytest.MonkeyPatch) -> None:
    service = FileService()
    monkeypatch.setattr(service.client, "bucket_exists", lambda _bucket: False)
    calls: list[str] = []

    def make_bucket(bucket: str) -> None:
        calls.append(bucket)

    monkeypatch.setattr(service.client, "make_bucket", make_bucket)

    await service.ensure_bucket()
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_allows_word_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="report.docx",
        data=b"content",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    )
    assert str(result["original_name"]) == "report.docx"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_allows_yaml_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="config.yaml",
        data=b"foo: bar",
        content_type="text/yaml",
    )
    assert str(result["original_name"]) == "config.yaml"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_rejects_exe_extension(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]

    def put_object(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("put_object should not be called for rejected files")

    monkeypatch.setattr(service.client, "put_object", put_object)

    with pytest.raises(ValidationError, match=r"Disallowed file extension: \.exe"):
        await service.upload_file(
            project_id="proj-1",
            user_id="user-1",
            filename="report.exe",
            data=b"content",
            content_type="text/plain",
        )


@pytest.mark.asyncio
async def test_upload_file_rejects_executable_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]

    def put_object(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("put_object should not be called for rejected files")

    monkeypatch.setattr(service.client, "put_object", put_object)

    with pytest.raises(ValidationError, match="Disallowed content type: application/x-executable"):
        await service.upload_file(
            project_id="proj-1",
            user_id="user-1",
            filename="report.bin",
            data=b"content",
            content_type="application/x-executable",
        )


@pytest.mark.asyncio
async def test_upload_file_rejects_msi_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]

    def put_object(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("put_object should not be called for rejected files")

    monkeypatch.setattr(service.client, "put_object", put_object)

    with pytest.raises(ValidationError, match="Disallowed content type: application/x-msi"):
        await service.upload_file(
            project_id="proj-1",
            user_id="user-1",
            filename="setup.pkg",
            data=b"content",
            content_type="application/x-msi",
        )


@pytest.mark.asyncio
async def test_upload_file_allows_octet_stream_with_safe_extension(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="config.yaml",
        data=b"foo: bar",
        content_type="application/octet-stream",
    )
    assert str(result["original_name"]) == "config.yaml"
    assert str(result["content_type"]) == "text/yaml"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_rejects_octet_stream_unknown_extension(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]

    def put_object(*_args: object, **_kwargs: object) -> None:
        raise AssertionError("put_object should not be called for rejected files")

    monkeypatch.setattr(service.client, "put_object", put_object)

    with pytest.raises(ValidationError, match="Unsupported content type: application/octet-stream"):
        await service.upload_file(
            project_id="proj-1",
            user_id="user-1",
            filename="payload.unknown",
            data=b"content",
            content_type="application/octet-stream",
        )


@pytest.mark.asyncio
async def test_upload_file_accepts_video_mp4_with_codecs_parameter(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="clip.mp4",
        data=b"\x00\x00\x00",
        content_type='video/mp4; codecs="avc1.42E01E"',
    )
    assert str(result["content_type"]) == "video/mp4"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_normalizes_image_jpg_alias(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="photo.jpg",
        data=b"\xff\xd8\xff",
        content_type="image/jpg",
    )
    assert str(result["content_type"]) == "image/jpeg"
    assert len(calls) == 1


@pytest.mark.asyncio
async def test_upload_file_allows_video_mpeg_content_type(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    service = FileService()
    service.ensure_bucket = AsyncMock()  # type: ignore[method-assign]
    calls: list[tuple[object, ...]] = []

    def put_object(*args: object, **_kwargs: object) -> None:
        calls.append(args)

    monkeypatch.setattr(service.client, "put_object", put_object)

    result = await service.upload_file(
        project_id="proj-1",
        user_id="user-1",
        filename="clip.mp4",
        data=b"\x00\x00\x00",
        content_type="video/mpeg",
    )
    assert str(result["content_type"]) == "video/mpeg"
    assert len(calls) == 1
