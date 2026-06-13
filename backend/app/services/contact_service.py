"""Business logic for contacts and project links."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.contact import Contact, ContactProject
from app.models.project import Project
from app.services.errors import ConflictError, NotFoundError
from app.services.file_service import FileService

_CONTACT_NULLABLE_FIELDS = {
    "last_name",
    "company",
    "role",
    "address",
    "birthday",
    "notes",
}


def _parse_uuid(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError as exc:
        raise NotFoundError(f"Invalid id: {value}") from exc


def _json_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, list):
        return value
    return []


class ContactService:
    """Read and mutate contacts for one user."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.file_service = FileService()

    async def list_contacts(
        self,
        user_id: str,
        *,
        search: str | None = None,
        tag: str | None = None,
    ) -> list[Contact]:
        stmt = (
            select(Contact)
            .where(Contact.user_id == user_id)
            .order_by(
                Contact.first_name.asc(),
                Contact.last_name.asc().nulls_last(),
            )
        )
        if search and search.strip():
            pattern = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Contact.first_name.ilike(pattern),
                    Contact.last_name.ilike(pattern),
                    Contact.company.ilike(pattern),
                ),
            )
        if tag and tag.strip():
            stmt = stmt.where(Contact.tags.contains([tag.strip()]))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_contact(self, contact_id: str, user_id: str) -> Contact:
        contact_uuid = _parse_uuid(contact_id)
        stmt = select(Contact).where(Contact.contact_id == contact_uuid, Contact.user_id == user_id)
        result = await self.db.execute(stmt)
        contact = result.scalar_one_or_none()
        if contact is None:
            raise NotFoundError(f"Contact not found: {contact_id}")
        return contact

    async def create_contact(self, user_id: str, **kwargs: Any) -> Contact:
        phones = _json_list(kwargs.pop("phones", []))
        emails = _json_list(kwargs.pop("emails", []))
        tags = _json_list(kwargs.pop("tags", []))
        payload = {key: value for key, value in kwargs.items() if value is not None}
        contact = Contact(
            user_id=user_id,
            phones=phones,
            emails=emails,
            tags=tags,
            **payload,
        )
        self.db.add(contact)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def update_contact(self, contact_id: str, user_id: str, **kwargs: Any) -> Contact:
        contact = await self.get_contact(contact_id, user_id)
        for key, value in kwargs.items():
            if value is None and key not in _CONTACT_NULLABLE_FIELDS:
                continue
            if key == "phones" and value is not None:
                contact.phones = _json_list(value)
                continue
            if key == "emails" and value is not None:
                contact.emails = _json_list(value)
                continue
            if key == "tags" and value is not None:
                contact.tags = _json_list(value)
                continue
            if hasattr(contact, key):
                setattr(contact, key, value)
        contact.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_contact(self, contact_id: str, user_id: str) -> None:
        contact = await self.get_contact(contact_id, user_id)
        if contact.avatar_minio_key:
            try:
                await self.file_service.delete_file(minio_key=contact.avatar_minio_key)
            except NotFoundError:
                pass
        await self.db.delete(contact)
        await self.db.commit()

    async def set_avatar(self, contact_id: str, user_id: str, minio_key: str) -> Contact:
        contact = await self.get_contact(contact_id, user_id)
        if contact.avatar_minio_key and contact.avatar_minio_key != minio_key:
            try:
                await self.file_service.delete_file(minio_key=contact.avatar_minio_key)
            except NotFoundError:
                pass
        contact.avatar_minio_key = minio_key
        contact.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def delete_avatar(self, contact_id: str, user_id: str) -> Contact:
        contact = await self.get_contact(contact_id, user_id)
        if contact.avatar_minio_key:
            try:
                await self.file_service.delete_file(minio_key=contact.avatar_minio_key)
            except NotFoundError:
                pass
        contact.avatar_minio_key = None
        contact.updated_at = datetime.now(tz=UTC)
        await self.db.commit()
        await self.db.refresh(contact)
        return contact

    async def link_project(self, contact_id: str, project_id: str, user_id: str) -> None:
        contact = await self.get_contact(contact_id, user_id)
        project = await self._get_owned_project(project_id, user_id)
        existing = await self.db.execute(
            select(ContactProject).where(
                ContactProject.contact_id == contact.contact_id,
                ContactProject.project_id == project.project_id,
            ),
        )
        if existing.scalar_one_or_none() is not None:
            raise ConflictError("Project already linked to this contact")
        link = ContactProject(contact_id=contact.contact_id, project_id=project.project_id)
        self.db.add(link)
        await self.db.commit()

    async def unlink_project(self, contact_id: str, project_id: str, user_id: str) -> None:
        contact = await self.get_contact(contact_id, user_id)
        project_uuid = _parse_uuid(project_id)
        stmt = select(ContactProject).where(
            ContactProject.contact_id == contact.contact_id,
            ContactProject.project_id == project_uuid,
        )
        result = await self.db.execute(stmt)
        link = result.scalar_one_or_none()
        if link is None:
            raise NotFoundError("Project link not found")
        await self.db.delete(link)
        await self.db.commit()

    async def list_linked_projects(self, contact_id: str, user_id: str) -> list[Project]:
        contact = await self.get_contact(contact_id, user_id)
        stmt = (
            select(Project)
            .join(ContactProject, ContactProject.project_id == Project.project_id)
            .where(
                ContactProject.contact_id == contact.contact_id,
                Project.user_id == user_id,
            )
            .order_by(Project.name.asc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def _get_owned_project(self, project_id: str, user_id: str) -> Project:
        project_uuid = _parse_uuid(project_id)
        stmt = select(Project).where(Project.project_id == project_uuid, Project.user_id == user_id)
        result = await self.db.execute(stmt)
        project = result.scalar_one_or_none()
        if project is None:
            raise NotFoundError(f"Project not found: {project_id}")
        return project
