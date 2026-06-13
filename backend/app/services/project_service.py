"""Business logic for projects and child entities."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import (
    Project,
    ProjectFile,
    ProjectLink,
    ProjectMilestone,
    ProjectNote,
    ProjectRisk,
    ProjectTask,
)
from app.services.errors import NotFoundError
from app.services.file_service import FileService

_PROJECT_NULLABLE_FIELDS = {"description", "color", "start_date", "target_date", "completed_date"}
_TASK_NULLABLE_FIELDS = {"description", "due_date"}
_MILESTONE_NULLABLE_FIELDS = {"due_date", "completed", "sort_order"}
_RISK_NULLABLE_FIELDS = {"description"}
_NOTE_NULLABLE_FIELDS = {"source"}


class ProjectService:
    """Read and mutate project structures for one user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.file_service = FileService()

    async def list_projects(self, user_id: str, status: str | None = None) -> list[Project]:
        stmt = select(Project).where(Project.user_id == user_id).order_by(Project.updated_at.desc())
        if status is not None:
            stmt = stmt.where(Project.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_project(self, project_id: str, user_id: str) -> Project:
        project_uuid = _parse_uuid(project_id)
        stmt = select(Project).where(Project.project_id == project_uuid, Project.user_id == user_id)
        result = await self.db.execute(stmt)
        project = result.scalar_one_or_none()
        if project is None:
            raise NotFoundError(f"Project not found: {project_id}")
        return project

    async def create_project(self, user_id: str, **kwargs: Any) -> Project:
        payload = {key: value for key, value in kwargs.items() if value is not None}
        project = Project(user_id=user_id, **payload)
        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def update_project(self, project_id: str, user_id: str, **kwargs: Any) -> Project:
        project = await self.get_project(project_id, user_id)
        for key, value in kwargs.items():
            if value is None and key not in _PROJECT_NULLABLE_FIELDS:
                continue
            if hasattr(project, key):
                setattr(project, key, value)
        project.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(project)
        return project

    async def delete_project(self, project_id: str, user_id: str) -> None:
        project = await self.get_project(project_id, user_id)
        files = await self.list_files(project_id=project_id, user_id=user_id)
        for file_entry in files:
            try:
                await self.file_service.delete_file(minio_key=file_entry.minio_key)
            except NotFoundError:
                pass
        await self.db.delete(project)
        await self.db.commit()

    async def list_milestones(self, project_id: str, user_id: str) -> list[ProjectMilestone]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectMilestone)
            .where(
                ProjectMilestone.project_id == project.project_id,
                ProjectMilestone.user_id == user_id,
            )
            .order_by(ProjectMilestone.sort_order.asc(), ProjectMilestone.created_at.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_milestone(
        self,
        project_id: str,
        user_id: str,
        **kwargs: Any,
    ) -> ProjectMilestone:
        project = await self.get_project(project_id, user_id)
        milestone = ProjectMilestone(project_id=project.project_id, user_id=user_id, **kwargs)
        if milestone.completed and milestone.completed_at is None:
            milestone.completed_at = datetime.now(tz=UTC)
        self.db.add(milestone)
        await self.db.commit()
        await self.db.refresh(milestone)
        return milestone

    async def update_milestone(
        self,
        milestone_id: str,
        user_id: str,
        **kwargs: Any,
    ) -> ProjectMilestone:
        milestone = await self._get_milestone(milestone_id=milestone_id, user_id=user_id)
        for key, value in kwargs.items():
            if value is None and key not in _MILESTONE_NULLABLE_FIELDS:
                continue
            if hasattr(milestone, key):
                setattr(milestone, key, value)
        if milestone.completed and milestone.completed_at is None:
            milestone.completed_at = datetime.now(tz=UTC)
        if not milestone.completed:
            milestone.completed_at = None
        await self.db.commit()
        await self.db.refresh(milestone)
        return milestone

    async def delete_milestone(self, milestone_id: str, user_id: str) -> None:
        milestone = await self._get_milestone(milestone_id=milestone_id, user_id=user_id)
        await self.db.delete(milestone)
        await self.db.commit()

    async def list_tasks(
        self,
        project_id: str,
        user_id: str,
        status: str | None = None,
    ) -> list[ProjectTask]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectTask)
            .where(ProjectTask.project_id == project.project_id, ProjectTask.user_id == user_id)
            .order_by(ProjectTask.sort_order.asc(), ProjectTask.created_at.asc())
        )
        if status is not None:
            stmt = stmt.where(ProjectTask.status == status)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_task(self, project_id: str, user_id: str, **kwargs: Any) -> ProjectTask:
        project = await self.get_project(project_id, user_id)
        task = ProjectTask(project_id=project.project_id, user_id=user_id, **kwargs)
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def update_task(self, task_id: str, user_id: str, **kwargs: Any) -> ProjectTask:
        task = await self._get_task(task_id=task_id, user_id=user_id)
        for key, value in kwargs.items():
            if value is None and key not in _TASK_NULLABLE_FIELDS:
                continue
            if hasattr(task, key):
                setattr(task, key, value)
        task.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete_task(self, task_id: str, user_id: str) -> None:
        task = await self._get_task(task_id=task_id, user_id=user_id)
        await self.db.delete(task)
        await self.db.commit()

    async def list_risks(self, project_id: str, user_id: str) -> list[ProjectRisk]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectRisk)
            .where(ProjectRisk.project_id == project.project_id, ProjectRisk.user_id == user_id)
            .order_by(ProjectRisk.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_risk(self, project_id: str, user_id: str, **kwargs: Any) -> ProjectRisk:
        project = await self.get_project(project_id, user_id)
        risk = ProjectRisk(project_id=project.project_id, user_id=user_id, **kwargs)
        self.db.add(risk)
        await self.db.commit()
        await self.db.refresh(risk)
        return risk

    async def update_risk(self, risk_id: str, user_id: str, **kwargs: Any) -> ProjectRisk:
        risk = await self._get_risk(risk_id=risk_id, user_id=user_id)
        for key, value in kwargs.items():
            if value is None and key not in _RISK_NULLABLE_FIELDS:
                continue
            if hasattr(risk, key):
                setattr(risk, key, value)
        risk.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(risk)
        return risk

    async def delete_risk(self, risk_id: str, user_id: str) -> None:
        risk = await self._get_risk(risk_id=risk_id, user_id=user_id)
        await self.db.delete(risk)
        await self.db.commit()

    async def list_notes(self, project_id: str, user_id: str) -> list[ProjectNote]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectNote)
            .where(ProjectNote.project_id == project.project_id, ProjectNote.user_id == user_id)
            .order_by(ProjectNote.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_note(
        self,
        project_id: str,
        user_id: str,
        content: str,
        source: str = "user",
    ) -> ProjectNote:
        project = await self.get_project(project_id, user_id)
        note = ProjectNote(
            project_id=project.project_id, user_id=user_id, content=content, source=source
        )
        self.db.add(note)
        await self.db.commit()
        await self.db.refresh(note)
        return note

    async def delete_note(self, note_id: str, user_id: str) -> None:
        note = await self._get_note(note_id=note_id, user_id=user_id)
        await self.db.delete(note)
        await self.db.commit()

    async def list_links(self, project_id: str, user_id: str) -> list[ProjectLink]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectLink)
            .where(ProjectLink.project_id == project.project_id, ProjectLink.user_id == user_id)
            .order_by(ProjectLink.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_link(self, project_id: str, user_id: str, name: str, url: str) -> ProjectLink:
        project = await self.get_project(project_id, user_id)
        link = ProjectLink(project_id=project.project_id, user_id=user_id, name=name, url=url)
        self.db.add(link)
        await self.db.commit()
        await self.db.refresh(link)
        return link

    async def delete_link(self, link_id: str, user_id: str) -> None:
        link = await self._get_link(link_id=link_id, user_id=user_id)
        await self.db.delete(link)
        await self.db.commit()

    async def list_files(self, project_id: str, user_id: str) -> list[ProjectFile]:
        project = await self.get_project(project_id, user_id)
        stmt = (
            select(ProjectFile)
            .where(ProjectFile.project_id == project.project_id, ProjectFile.user_id == user_id)
            .order_by(ProjectFile.created_at.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create_file(
        self,
        *,
        project_id: str,
        user_id: str,
        filename: str,
        original_name: str,
        content_type: str,
        size_bytes: int,
        minio_bucket: str,
        minio_key: str,
    ) -> ProjectFile:
        project = await self.get_project(project_id, user_id)
        file_row = ProjectFile(
            project_id=project.project_id,
            user_id=user_id,
            filename=filename,
            original_name=original_name,
            content_type=content_type,
            size_bytes=size_bytes,
            minio_bucket=minio_bucket,
            minio_key=minio_key,
        )
        self.db.add(file_row)
        await self.db.commit()
        await self.db.refresh(file_row)
        return file_row

    async def get_file(self, *, project_id: str, file_id: str, user_id: str) -> ProjectFile:
        project_uuid = _parse_uuid(project_id)
        file_uuid = _parse_uuid(file_id)
        stmt = select(ProjectFile).where(
            ProjectFile.file_id == file_uuid,
            ProjectFile.project_id == project_uuid,
            ProjectFile.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        file_row = result.scalar_one_or_none()
        if file_row is None:
            raise NotFoundError(f"File not found: {file_id}")
        return file_row

    async def delete_file_record(self, *, project_id: str, file_id: str, user_id: str) -> None:
        file_row = await self.get_file(project_id=project_id, file_id=file_id, user_id=user_id)
        await self.db.delete(file_row)
        await self.db.commit()

    async def _get_milestone(self, *, milestone_id: str, user_id: str) -> ProjectMilestone:
        milestone_uuid = _parse_uuid(milestone_id)
        stmt = select(ProjectMilestone).where(
            ProjectMilestone.milestone_id == milestone_uuid,
            ProjectMilestone.user_id == user_id,
        )
        result = await self.db.execute(stmt)
        milestone = result.scalar_one_or_none()
        if milestone is None:
            raise NotFoundError(f"Milestone not found: {milestone_id}")
        return milestone

    async def _get_task(self, *, task_id: str, user_id: str) -> ProjectTask:
        task_uuid = _parse_uuid(task_id)
        stmt = select(ProjectTask).where(
            ProjectTask.task_id == task_uuid, ProjectTask.user_id == user_id
        )
        result = await self.db.execute(stmt)
        task = result.scalar_one_or_none()
        if task is None:
            raise NotFoundError(f"Task not found: {task_id}")
        return task

    async def _get_risk(self, *, risk_id: str, user_id: str) -> ProjectRisk:
        risk_uuid = _parse_uuid(risk_id)
        stmt = select(ProjectRisk).where(
            ProjectRisk.risk_id == risk_uuid, ProjectRisk.user_id == user_id
        )
        result = await self.db.execute(stmt)
        risk = result.scalar_one_or_none()
        if risk is None:
            raise NotFoundError(f"Risk not found: {risk_id}")
        return risk

    async def _get_note(self, *, note_id: str, user_id: str) -> ProjectNote:
        note_uuid = _parse_uuid(note_id)
        stmt = select(ProjectNote).where(
            ProjectNote.note_id == note_uuid, ProjectNote.user_id == user_id
        )
        result = await self.db.execute(stmt)
        note = result.scalar_one_or_none()
        if note is None:
            raise NotFoundError(f"Note not found: {note_id}")
        return note

    async def _get_link(self, *, link_id: str, user_id: str) -> ProjectLink:
        link_uuid = _parse_uuid(link_id)
        stmt = select(ProjectLink).where(
            ProjectLink.link_id == link_uuid, ProjectLink.user_id == user_id
        )
        result = await self.db.execute(stmt)
        link = result.scalar_one_or_none()
        if link is None:
            raise NotFoundError(f"Link not found: {link_id}")
        return link


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise NotFoundError(f"Entity not found: {value}") from exc
