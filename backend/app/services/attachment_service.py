"""Text extraction for chat attachments (txt/md/csv/pdf)."""

from __future__ import annotations

import io
from pathlib import PurePosixPath, PureWindowsPath

from pypdf import PdfReader

from app.services.errors import ValidationError

MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_TEXT_CHARS = 50_000

_TEXT_EXTENSIONS = {".txt", ".md", ".csv"}
_PDF_EXTENSIONS = {".pdf"}
SUPPORTED_EXTENSIONS = _TEXT_EXTENSIONS | _PDF_EXTENSIONS


def sanitize_filename(filename: str) -> str:
    """Strip any path components so only the plain file name remains."""
    without_windows_path = PureWindowsPath(filename).name
    return PurePosixPath(without_windows_path).name


def extract_attachment_text(*, filename: str, data: bytes) -> tuple[str, bool]:
    """Return (text, truncated) for one uploaded attachment.

    Raises ValidationError for unsupported types, oversized uploads or
    files without extractable text.
    """
    clean_name = sanitize_filename(filename)
    if not clean_name:
        raise ValidationError("Missing filename")
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValidationError("File too large (max 5 MB)")

    suffix = PurePosixPath(clean_name.lower()).suffix
    if suffix not in SUPPORTED_EXTENSIONS:
        raise ValidationError("Unsupported file type. Supported: .txt, .md, .csv, .pdf")

    if suffix in _PDF_EXTENSIONS:
        text = _extract_pdf_text(data)
    else:
        text = _decode_text(data)

    text = text.strip()
    if not text:
        raise ValidationError("No extractable text found in the file")

    if len(text) > MAX_TEXT_CHARS:
        return text[:MAX_TEXT_CHARS], True
    return text, False


def _decode_text(data: bytes) -> str:
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return data.decode("latin-1", errors="replace")


def _extract_pdf_text(data: bytes) -> str:
    try:
        reader = PdfReader(io.BytesIO(data))
        pages = [page.extract_text() or "" for page in reader.pages]
    except Exception as exc:
        raise ValidationError("Could not read the PDF file") from exc
    return "\n\n".join(part for part in pages if part.strip())
