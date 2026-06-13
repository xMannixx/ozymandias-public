"""MinIO-backed project file service."""

from __future__ import annotations

import asyncio
import io
import mimetypes
import re
from datetime import timedelta
from pathlib import PurePosixPath
from uuid import uuid4

from minio import Minio
from minio.error import S3Error

from app.config import get_settings
from app.services.errors import NotFoundError, ValidationError

# Screen recordings exceed legacy 50MB caps; align with nginx client_max_body_size.
_MAX_FILE_SIZE_BYTES = 512 * 1024 * 1024
_DANGEROUS_CONTENT_TYPES = {
    "application/x-executable",
    "application/x-msdownload",
    "application/x-sh",
    "application/x-bat",
    "application/x-csh",
    "application/x-dosexec",
    "application/x-elf",
    "application/x-msi",
    "application/x-dll",
    "application/x-python-code",
    "application/wasm",
}
_ALLOWED_EXACT_CONTENT_TYPES = {
    # Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.oasis.opendocument.text",
    "application/vnd.oasis.opendocument.spreadsheet",
    "application/vnd.oasis.opendocument.presentation",
    "application/rtf",
    "application/epub+zip",
    # Data and config
    "application/json",
    "application/xml",
    "application/x-yaml",
    "application/toml",
    "application/zip",
    "text/csv",
    "text/markdown",
    "text/plain",
    "text/html",
    "text/css",
    "text/javascript",
    "text/typescript",
    "text/x-python",
    "text/x-rust",
    "text/x-sql",
    "text/x-shellscript",
    "text/xml",
    "text/yaml",
    "text/x-toml",
    # Diagrams
    "text/vnd.mermaid",
    "application/x-mermaid",
    "application/x-drawio",
    # Archives
    "application/gzip",
    "application/x-tar",
    "application/x-7z-compressed",
    "application/x-rar-compressed",
    "application/x-bzip2",
    # Audio
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/webm",
    "audio/flac",
    "audio/aac",
    # Video
    "video/mp4",
    "video/mpeg",
    "video/webm",
    "video/x-matroska",
    "video/quicktime",
    "video/x-msvideo",
    # Calendar
    "text/calendar",
}
_DANGEROUS_EXTENSIONS = {
    ".exe",
    ".bat",
    ".cmd",
    ".com",
    ".msi",
    ".dll",
    ".scr",
    ".ps1",
    ".vbs",
    ".wsf",
    ".cpl",
    ".reg",
    ".inf",
    ".hta",
    ".jse",
    ".wsh",
    ".pif",
}
_CONTENT_TYPE_FALLBACK_BY_EXTENSION = {
    ".csv": "text/csv",
    ".drawio": "application/x-drawio",
    ".ics": "text/calendar",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".jpe": "image/jpeg",
    ".jfif": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".svg": "image/svg+xml",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".mp4": "video/mp4",
    ".m4v": "video/mp4",
    ".mov": "video/quicktime",
    ".webm": "video/webm",
    ".mkv": "video/x-matroska",
    ".avi": "video/x-msvideo",
    ".json": "application/json",
    ".md": "text/markdown",
    ".mmd": "text/vnd.mermaid",
    ".sql": "text/x-sql",
    ".toml": "application/toml",
    ".ts": "text/typescript",
    ".yaml": "text/yaml",
    ".yml": "text/yaml",
}

# Browsers and OSes sometimes emit non-canonical or legacy MIME names.
_CONTENT_TYPE_ALIASES = {
    "image/jpg": "image/jpeg",
    "image/pjpeg": "image/jpeg",
    "image/x-png": "image/png",
    "video/x-mp4": "video/mp4",
    "application/mp4": "video/mp4",
}


class FileService:
    """Store and retrieve files in MinIO."""

    def __init__(self) -> None:
        settings = get_settings()
        self.client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        self.bucket = settings.minio_bucket

    async def ensure_bucket(self) -> None:
        """Create bucket once if it does not exist."""

        def _ensure() -> None:
            if not self.client.bucket_exists(self.bucket):
                self.client.make_bucket(self.bucket)

        await asyncio.to_thread(_ensure)

    async def upload_file(
        self,
        *,
        project_id: str,
        user_id: str,
        filename: str,
        data: bytes,
        content_type: str,
        prefix: str = "projects",
    ) -> dict[str, str | int]:
        """Upload a file and return persisted object metadata."""
        del user_id
        await self.ensure_bucket()
        safe_original = _sanitize_filename(filename)
        _validate_filename_extension(safe_original)
        safe_content_type = _validate_content_type(content_type, safe_original)
        size = len(data)
        if size > _MAX_FILE_SIZE_BYTES:
            raise ValidationError("File exceeds maximum size of 512MB")

        stored_name = f"{uuid4().hex}_{safe_original}"
        minio_key = str(PurePosixPath(prefix) / project_id / stored_name)
        stream = io.BytesIO(data)
        await asyncio.to_thread(
            lambda: self.client.put_object(
                self.bucket,
                minio_key,
                stream,
                length=size,
                content_type=safe_content_type,
            )
        )
        return {
            "minio_bucket": self.bucket,
            "minio_key": minio_key,
            "size_bytes": size,
            "filename": stored_name,
            "original_name": safe_original,
            "content_type": safe_content_type,
        }

    async def download_file(self, *, minio_key: str) -> bytes:
        """Download object bytes and close MinIO response safely."""

        def _download() -> bytes:
            response = self.client.get_object(self.bucket, minio_key)
            try:
                return bytes(response.read())
            finally:
                response.close()
                response.release_conn()

        try:
            return await asyncio.to_thread(_download)
        except S3Error as exc:
            if exc.code in {"NoSuchBucket", "NoSuchKey", "NoSuchObject"}:
                raise NotFoundError("File not found") from exc
            raise

    async def delete_file(self, *, minio_key: str) -> None:
        """Delete one object from MinIO."""
        try:
            await asyncio.to_thread(lambda: self.client.remove_object(self.bucket, minio_key))
        except S3Error as exc:
            if exc.code in {"NoSuchBucket", "NoSuchKey", "NoSuchObject"}:
                raise NotFoundError("File not found") from exc
            raise

    async def get_presigned_url(self, *, minio_key: str, expires_hours: int = 1) -> str:
        """Return temporary object download URL."""
        expires = timedelta(hours=expires_hours)
        return await asyncio.to_thread(
            lambda: self.client.presigned_get_object(self.bucket, minio_key, expires=expires)
        )


def _sanitize_filename(filename: str) -> str:
    normalized = filename.replace("\\", "/")
    base_name = normalized.split("/")[-1].strip()
    if not base_name:
        raise ValidationError("Invalid filename")
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", base_name)
    safe = safe.strip("._")
    if not safe:
        raise ValidationError("Invalid filename")
    return safe


def _validate_filename_extension(filename: str) -> None:
    ext = PurePosixPath(filename).suffix.lower()
    if ext in _DANGEROUS_EXTENSIONS:
        raise ValidationError(f"Disallowed file extension: {ext}")


def _strip_content_type_parameters(content_type: str) -> str:
    """Use only the primary MIME type; multipart parts often include charset/codecs parameters."""
    primary = content_type.strip().lower().split(";", maxsplit=1)[0].strip()
    return primary


def _resolve_content_type(content_type: str, filename: str) -> str:
    primary = _strip_content_type_parameters(content_type)
    normalized = primary
    if normalized and normalized != "application/octet-stream":
        return normalized
    ext = PurePosixPath(filename).suffix.lower()
    if ext:
        fallback = _CONTENT_TYPE_FALLBACK_BY_EXTENSION.get(ext)
        if fallback:
            return fallback
    guessed_content_type, _ = mimetypes.guess_type(filename, strict=False)
    if guessed_content_type:
        return _strip_content_type_parameters(guessed_content_type)
    return normalized


def _validate_content_type(content_type: str, filename: str) -> str:
    resolved_content_type = _resolve_content_type(content_type, filename)
    if not resolved_content_type:
        raise ValidationError("Missing content type")
    resolved_content_type = _CONTENT_TYPE_ALIASES.get(resolved_content_type, resolved_content_type)
    if resolved_content_type in _DANGEROUS_CONTENT_TYPES:
        raise ValidationError(f"Disallowed content type: {resolved_content_type}")
    if resolved_content_type in _ALLOWED_EXACT_CONTENT_TYPES:
        return resolved_content_type
    if resolved_content_type.startswith("image/") or resolved_content_type.startswith("text/"):
        return resolved_content_type
    if resolved_content_type.startswith("video/") or resolved_content_type.startswith("audio/"):
        return resolved_content_type
    raise ValidationError(f"Unsupported content type: {resolved_content_type}")
