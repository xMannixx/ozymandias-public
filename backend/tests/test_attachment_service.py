"""Unit tests for attachment text extraction."""

from __future__ import annotations

import io

import pytest
from pypdf import PdfWriter

from app.services.attachment_service import (
    MAX_TEXT_CHARS,
    MAX_UPLOAD_BYTES,
    extract_attachment_text,
    sanitize_filename,
)
from app.services.errors import ValidationError


def test_extract_plain_text_file() -> None:
    text, truncated = extract_attachment_text(filename="notes.txt", data=b"hello world")
    assert text == "hello world"
    assert truncated is False


def test_extract_markdown_and_csv() -> None:
    md_text, _ = extract_attachment_text(filename="README.md", data=b"# Title\n\nBody")
    assert md_text.startswith("# Title")
    csv_text, _ = extract_attachment_text(filename="data.csv", data=b"a,b\n1,2")
    assert csv_text == "a,b\n1,2"


def test_extract_falls_back_to_latin1_for_non_utf8() -> None:
    text, _ = extract_attachment_text(filename="legacy.txt", data="caf\xe9".encode("latin-1"))
    assert "caf" in text


def test_extract_rejects_unsupported_extension() -> None:
    with pytest.raises(ValidationError, match="Unsupported file type"):
        extract_attachment_text(filename="image.png", data=b"binary")


def test_extract_rejects_oversized_file() -> None:
    with pytest.raises(ValidationError, match="too large"):
        extract_attachment_text(filename="big.txt", data=b"x" * (MAX_UPLOAD_BYTES + 1))


def test_extract_rejects_empty_text() -> None:
    with pytest.raises(ValidationError, match="No extractable text"):
        extract_attachment_text(filename="empty.txt", data=b"   \n  ")


def test_extract_truncates_long_text() -> None:
    text, truncated = extract_attachment_text(
        filename="long.txt", data=b"a" * (MAX_TEXT_CHARS + 100)
    )
    assert truncated is True
    assert len(text) == MAX_TEXT_CHARS


def test_extract_rejects_invalid_pdf() -> None:
    with pytest.raises(ValidationError, match="Could not read the PDF"):
        extract_attachment_text(filename="broken.pdf", data=b"not a pdf at all")


def test_extract_rejects_pdf_without_text() -> None:
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    buffer = io.BytesIO()
    writer.write(buffer)
    with pytest.raises(ValidationError, match="No extractable text"):
        extract_attachment_text(filename="blank.pdf", data=buffer.getvalue())


def test_sanitize_filename_strips_path_components() -> None:
    assert sanitize_filename("C:\\Users\\me\\secret.txt") == "secret.txt"
    assert sanitize_filename("../../etc/passwd.txt") == "passwd.txt"
    assert sanitize_filename("plain.md") == "plain.md"
