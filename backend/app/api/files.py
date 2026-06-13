"""File upload and download endpoints for project assets."""

from __future__ import annotations

import io
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import FileResponse
from app.services.audit_service import AuditService
from app.services.errors import NotFoundError, ValidationError
from app.services.file_service import FileService
from app.services.project_service import ProjectService

router = APIRouter(tags=["files"])


@router.post("/{project_id}/upload", response_model=FileResponse)
async def upload_file(
    project_id: str,
    file: Annotated[UploadFile, File(...)],
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FileResponse:
    project_service = ProjectService(db)
    file_service = FileService()
    audit = AuditService(db)

    data = await file.read()
    content_type = file.content_type or ""
    try:
        upload = await file_service.upload_file(
            project_id=project_id,
            user_id=user_id,
            filename=file.filename or "",
            data=data,
            content_type=content_type,
        )
        file_row = await project_service.create_file(
            project_id=project_id,
            user_id=user_id,
            filename=str(upload["filename"]),
            original_name=str(upload["original_name"]),
            content_type=str(upload["content_type"]),
            size_bytes=int(upload["size_bytes"]),
            minio_bucket=str(upload["minio_bucket"]),
            minio_key=str(upload["minio_key"]),
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except ValidationError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=str(file_row.file_id),
        detail="files.upload_file",
        payload={"project_id": project_id, "filename": file_row.original_name},
        source_ref=str(file_row.file_id),
        sensitivity=Sensitivity.S1,
    )
    return FileResponse(
        file_id=str(file_row.file_id),
        project_id=str(file_row.project_id),
        filename=file_row.filename,
        original_name=file_row.original_name,
        content_type=file_row.content_type,
        size_bytes=file_row.size_bytes,
        created_at=file_row.created_at,
    )


@router.get("/{project_id}/files", response_model=list[FileResponse])
async def list_files(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FileResponse]:
    service = ProjectService(db)
    try:
        files = await service.list_files(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [
        FileResponse(
            file_id=str(item.file_id),
            project_id=str(item.project_id),
            filename=item.filename,
            original_name=item.original_name,
            content_type=item.content_type,
            size_bytes=item.size_bytes,
            created_at=item.created_at,
        )
        for item in files
    ]


@router.get("/{project_id}/files/{file_id}/download")
async def download_file(
    project_id: str,
    file_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    project_service = ProjectService(db)
    file_service = FileService()
    try:
        file_row = await project_service.get_file(
            project_id=project_id, file_id=file_id, user_id=user_id
        )
        payload = await file_service.download_file(minio_key=file_row.minio_key)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    safe_name = file_row.original_name.replace('"', "_")
    headers = {"Content-Disposition": f'attachment; filename="{safe_name}"'}
    return StreamingResponse(io.BytesIO(payload), media_type=file_row.content_type, headers=headers)


@router.delete("/{project_id}/files/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(
    project_id: str,
    file_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    project_service = ProjectService(db)
    file_service = FileService()
    audit = AuditService(db)
    try:
        file_row = await project_service.get_file(
            project_id=project_id, file_id=file_id, user_id=user_id
        )
        await file_service.delete_file(minio_key=file_row.minio_key)
        await project_service.delete_file_record(
            project_id=project_id, file_id=file_id, user_id=user_id
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

    await audit.log(
        event_type=AuditEventType.action_executed,
        result=AuditResult.success,
        user_id=user_id,
        channel=Channel.web,
        actor=f"user:{user_id}",
        target_id=file_id,
        detail="files.delete_file",
        payload={"project_id": project_id, "file_id": file_id},
        source_ref=file_id,
        sensitivity=Sensitivity.S1,
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)
