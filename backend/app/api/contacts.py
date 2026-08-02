"""Contact management API endpoints."""

from __future__ import annotations

import mimetypes
from pathlib import PurePosixPath
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.contact import Contact
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import (
    ContactDetailResponse,
    ContactLinkedProject,
    ContactResponse,
    CreateContactRequest,
    EmailEntry,
    LinkProjectRequest,
    PhoneEntry,
    UpdateContactRequest,
)
from app.services.audit_service import AuditService
from app.services.contact_service import ContactService
from app.services.errors import ConflictError, NotFoundError, ValidationError
from app.services.file_service import FileService

router = APIRouter(tags=["contacts"])

_MAX_AVATAR_BYTES = 5 * 1024 * 1024


def _raise_http_for_service_error(exc: Exception) -> None:
    if isinstance(exc, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, ValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    if isinstance(exc, ConflictError):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal error",
    ) from exc


async def _log_mutation(
    *,
    audit: AuditService,
    user_id: str,
    target_id: str,
    detail: str,
    payload: dict[str, object],
) -> None:
    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=target_id,
        detail=detail,
        payload=payload,
        source_ref=target_id,
        sensitivity=Sensitivity.S1,
    )


def _contact_response(contact: Contact) -> ContactResponse:
    phones_raw = contact.phones if isinstance(contact.phones, list) else []
    emails_raw = contact.emails if isinstance(contact.emails, list) else []
    tags_raw = contact.tags if isinstance(contact.tags, list) else []
    phones = [PhoneEntry.model_validate(item) for item in phones_raw]
    emails = [EmailEntry.model_validate(item) for item in emails_raw]
    tags = [str(t) for t in tags_raw]
    return ContactResponse(
        contact_id=str(contact.contact_id),
        first_name=contact.first_name,
        last_name=contact.last_name,
        company=contact.company,
        role=contact.role,
        phones=phones,
        emails=emails,
        tags=tags,
        has_avatar=bool(contact.avatar_minio_key),
        sensitivity=contact.sensitivity,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )


@router.get("", response_model=list[ContactResponse])
async def list_contacts(
    search: str | None = Query(default=None),
    tag: str | None = Query(default=None),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ContactResponse]:
    service = ContactService(db)
    contacts = await service.list_contacts(user_id=user_id, search=search, tag=tag)
    return [_contact_response(c) for c in contacts]


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(
    payload: CreateContactRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactResponse:
    service = ContactService(db)
    audit = AuditService(db)
    data = payload.model_dump()
    contact = await service.create_contact(user_id=user_id, **data)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(contact.contact_id),
        detail="contacts.create_contact",
        payload={"first_name": contact.first_name, "last_name": contact.last_name or ""},
    )
    return _contact_response(contact)


@router.get("/{contact_id}/projects", response_model=list[ContactLinkedProject])
async def list_linked_projects(
    contact_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ContactLinkedProject]:
    service = ContactService(db)
    try:
        projects = await service.list_linked_projects(contact_id=contact_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [
        ContactLinkedProject(
            project_id=str(p.project_id),
            name=p.name,
            status=p.status,
        )
        for p in projects
    ]


@router.post("/{contact_id}/projects", status_code=status.HTTP_201_CREATED)
async def link_project(
    contact_id: str,
    payload: LinkProjectRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = ContactService(db)
    audit = AuditService(db)
    try:
        await service.link_project(
            contact_id=contact_id,
            project_id=payload.project_id,
            user_id=user_id,
        )
    except (NotFoundError, ConflictError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=contact_id,
        detail="contacts.link_project",
        payload={"project_id": payload.project_id},
    )
    return Response(status_code=status.HTTP_201_CREATED)


@router.delete("/{contact_id}/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unlink_project(
    contact_id: str,
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = ContactService(db)
    audit = AuditService(db)
    try:
        await service.unlink_project(contact_id=contact_id, project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=contact_id,
        detail="contacts.unlink_project",
        payload={"project_id": project_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{contact_id}/avatar", response_model=ContactResponse)
async def upload_avatar(
    contact_id: str,
    file: Annotated[UploadFile, File(...)],
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactResponse:
    service = ContactService(db)
    file_service = FileService()
    audit = AuditService(db)
    data = await file.read()
    if len(data) > _MAX_AVATAR_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar exceeds maximum size of 5MB",
        )
    content_type = file.content_type or ""
    primary = content_type.split(";", maxsplit=1)[0].strip().lower()
    if not primary.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Avatar must be an image",
        )
    try:
        contact = await service.get_contact(contact_id, user_id)
        upload = await file_service.upload_file(
            project_id=str(contact.contact_id),
            user_id=user_id,
            filename=file.filename or "avatar",
            data=data,
            content_type=content_type,
            prefix="contacts",
        )
        contact = await service.set_avatar(
            contact_id,
            user_id,
            str(upload["minio_key"]),
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=contact_id,
        detail="contacts.upload_avatar",
        payload={"minio_key": str(upload["minio_key"])},
    )
    return _contact_response(contact)


@router.delete("/{contact_id}/avatar", status_code=status.HTTP_204_NO_CONTENT)
async def delete_avatar(
    contact_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = ContactService(db)
    audit = AuditService(db)
    try:
        await service.delete_avatar(contact_id=contact_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=contact_id,
        detail="contacts.delete_avatar",
        payload={},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{contact_id}/avatar")
async def download_avatar(
    contact_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    service = ContactService(db)
    file_service = FileService()
    try:
        contact = await service.get_contact(contact_id, user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if not contact.avatar_minio_key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No avatar")
    try:
        body = await file_service.download_file(minio_key=contact.avatar_minio_key)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    suffix = PurePosixPath(contact.avatar_minio_key).suffix
    media_type, _ = mimetypes.guess_type(f"x{suffix}")
    if not media_type or not media_type.startswith("image/"):
        media_type = "application/octet-stream"
    return StreamingResponse(iter([body]), media_type=media_type)


@router.get("/{contact_id}", response_model=ContactDetailResponse)
async def get_contact(
    contact_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactDetailResponse:
    service = ContactService(db)
    try:
        contact = await service.get_contact(contact_id=contact_id, user_id=user_id)
        linked = await service.list_linked_projects(contact_id=contact_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    base = _contact_response(contact)
    linked_models = [
        ContactLinkedProject(project_id=str(p.project_id), name=p.name, status=p.status)
        for p in linked
    ]
    return ContactDetailResponse(
        **base.model_dump(),
        address=contact.address,
        birthday=contact.birthday,
        notes=contact.notes,
        linked_projects=linked_models,
    )


@router.patch("/{contact_id}", response_model=ContactResponse)
async def update_contact(
    contact_id: str,
    payload: UpdateContactRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ContactResponse:
    service = ContactService(db)
    audit = AuditService(db)
    changes = payload.model_dump(exclude_unset=True)
    try:
        contact = await service.update_contact(contact_id=contact_id, user_id=user_id, **changes)
    except NotFoundError as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(contact.contact_id),
        detail="contacts.update_contact",
        payload={"changes": list(changes.keys())},
    )
    return _contact_response(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    contact_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = ContactService(db)
    audit = AuditService(db)
    try:
        await service.delete_contact(contact_id=contact_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=contact_id,
        detail="contacts.delete_contact",
        payload={},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
