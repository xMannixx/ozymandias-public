"""Project-related SQLAlchemy models."""

from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import BigInteger, Date, DateTime, ForeignKey, Index, Integer, Text, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import Base


class Project(Base):
    """Workspace container: instructions, knowledge, tasks, notes and chats."""

    __tablename__ = "projects"
    __table_args__ = (Index("idx_projects_user_status", "user_id", "status"),)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    #: Standing instructions prepended to every chat inside this project.
    instructions: Mapped[str | None] = mapped_column(Text)
    #: Drives routing: S3/S4 keep this project's knowledge on local providers.
    sensitivity: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'S1'"))
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'active'"))
    priority: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'medium'"))
    color: Mapped[str | None] = mapped_column(Text, server_default=text("'#58a6ff'"))
    start_date: Mapped[date | None] = mapped_column(Date)
    target_date: Mapped[date | None] = mapped_column(Date)
    completed_date: Mapped[date | None] = mapped_column(Date)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    tasks: Mapped[list[ProjectTask]] = relationship(back_populates="project")
    notes: Mapped[list[ProjectNote]] = relationship(back_populates="project")
    files: Mapped[list[ProjectFile]] = relationship(back_populates="project")
    links: Mapped[list[ProjectLink]] = relationship(back_populates="project")


class ProjectTask(Base):
    """Project task entries."""

    __tablename__ = "project_tasks"
    __table_args__ = (Index("idx_tasks_project_status", "project_id", "status"),)

    task_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'open'"))
    priority: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'medium'"))
    due_date: Mapped[date | None] = mapped_column(Date)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    project: Mapped[Project] = relationship(back_populates="tasks")


class ProjectNote(Base):
    """Project notes."""

    __tablename__ = "project_notes"
    __table_args__ = (Index("idx_notes_project", "project_id", "created_at"),)

    note_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default=text("'user'"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    project: Mapped[Project] = relationship(back_populates="notes")


class ProjectFile(Base):
    """Project file metadata plus the extracted text used as project knowledge."""

    __tablename__ = "project_files"
    __table_args__ = (Index("idx_files_project", "project_id", "created_at"),)

    file_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    filename: Mapped[str] = mapped_column(Text, nullable=False)
    original_name: Mapped[str] = mapped_column(Text, nullable=False)
    content_type: Mapped[str] = mapped_column(Text, nullable=False)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    minio_bucket: Mapped[str] = mapped_column(Text, nullable=False)
    minio_key: Mapped[str] = mapped_column(Text, nullable=False)
    #: Plain text pulled out of the upload. Only this ever reaches the LLM.
    extracted_text: Mapped[str | None] = mapped_column(Text)
    #: pending | ok | unsupported | failed
    extract_status: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        server_default=text("'pending'"),
    )
    text_chars: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    project: Mapped[Project] = relationship(back_populates="files")


class ProjectLink(Base):
    """Project links."""

    __tablename__ = "project_links"
    __table_args__ = (Index("idx_links_project", "project_id"),)

    link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    )
    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.project_id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(Text, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=text("now()"),
    )

    project: Mapped[Project] = relationship(back_populates="links")
