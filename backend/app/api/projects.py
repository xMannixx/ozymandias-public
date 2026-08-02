"""Project management API endpoints."""

from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import get_current_user
from app.database import get_db
from app.models.conversation import Conversation
from app.models.project import (
    Project,
    ProjectFile,
    ProjectLink,
    ProjectNote,
    ProjectTask,
)
from app.schemas import AuditEventType, AuditResult, Channel, Sensitivity
from app.schemas.api_models import (
    CreateLinkRequest,
    CreateNoteRequest,
    CreateProjectRequest,
    CreateTaskRequest,
    FileResponse,
    LinkResponse,
    NoteResponse,
    ProjectChatResponse,
    ProjectDetailResponse,
    ProjectResponse,
    TaskResponse,
    UpdateProjectRequest,
    UpdateTaskRequest,
)
from app.services.audit_service import AuditService
from app.services.errors import NotFoundError, ValidationError
from app.services.project_service import ProjectService

router = APIRouter(tags=["projects"])


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectResponse]:
    service = ProjectService(db)
    projects = await service.list_projects(user_id=user_id, status=status_filter)
    return [
        await _project_response(service=service, project=project, user_id=user_id)
        for project in projects
    ]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: CreateProjectRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    service = ProjectService(db)
    audit = AuditService(db)
    project = await service.create_project(user_id=user_id, **payload.model_dump())
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(project.project_id),
        detail="projects.create_project",
        payload={"name": project.name},
    )
    return await _project_response(service=service, project=project, user_id=user_id)


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectDetailResponse:
    service = ProjectService(db)
    try:
        project = await service.get_project(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return await _project_detail_response(service=service, project=project, user_id=user_id)


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    payload: UpdateProjectRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectResponse:
    service = ProjectService(db)
    audit = AuditService(db)
    changes = payload.model_dump(exclude_unset=True)
    try:
        project = await service.update_project(project_id=project_id, user_id=user_id, **changes)
    except (NotFoundError, ValidationError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(project.project_id),
        detail="projects.update_project",
        payload={"changes": list(changes.keys())},
    )
    return await _project_response(service=service, project=project, user_id=user_id)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        await service.delete_project(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=project_id,
        detail="projects.delete_project",
        payload={"project_id": project_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/chats", response_model=list[ProjectChatResponse])
async def list_project_chats(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ProjectChatResponse]:
    service = ProjectService(db)
    try:
        chats = await service.list_conversations(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_chat_response(item) for item in chats]


@router.get("/{project_id}/tasks", response_model=list[TaskResponse])
async def list_tasks(
    project_id: str,
    status_filter: str | None = Query(default=None, alias="status"),
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TaskResponse]:
    service = ProjectService(db)
    try:
        tasks = await service.list_tasks(
            project_id=project_id, user_id=user_id, status=status_filter
        )
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_task_response(item) for item in tasks]


@router.post(
    "/{project_id}/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED
)
async def create_task(
    project_id: str,
    payload: CreateTaskRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        task = await service.create_task(
            project_id=project_id, user_id=user_id, **payload.model_dump()
        )
    except (NotFoundError, ValidationError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(task.task_id),
        detail="projects.create_task",
        payload={"project_id": project_id},
    )
    return _to_task_response(task)


@router.patch("/{project_id}/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    project_id: str,
    task_id: str,
    payload: UpdateTaskRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskResponse:
    del project_id
    service = ProjectService(db)
    audit = AuditService(db)
    changes = payload.model_dump(exclude_unset=True)
    try:
        task = await service.update_task(task_id=task_id, user_id=user_id, **changes)
    except (NotFoundError, ValidationError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(task.task_id),
        detail="projects.update_task",
        payload={"changes": list(changes.keys())},
    )
    return _to_task_response(task)


@router.delete("/{project_id}/tasks/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    project_id: str,
    task_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    del project_id
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        await service.delete_task(task_id=task_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=task_id,
        detail="projects.delete_task",
        payload={"task_id": task_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/notes", response_model=list[NoteResponse])
async def list_notes(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[NoteResponse]:
    service = ProjectService(db)
    try:
        notes = await service.list_notes(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_note_response(item) for item in notes]


@router.post(
    "/{project_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED
)
async def create_note(
    project_id: str,
    payload: CreateNoteRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NoteResponse:
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        note = await service.create_note(
            project_id=project_id,
            user_id=user_id,
            content=payload.content,
            source=payload.source,
        )
    except (NotFoundError, ValidationError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(note.note_id),
        detail="projects.create_note",
        payload={"project_id": project_id},
    )
    return _to_note_response(note)


@router.delete("/{project_id}/notes/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    project_id: str,
    note_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    del project_id
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        await service.delete_note(note_id=note_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=note_id,
        detail="projects.delete_note",
        payload={"note_id": note_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}/links", response_model=list[LinkResponse])
async def list_links(
    project_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[LinkResponse]:
    service = ProjectService(db)
    try:
        links = await service.list_links(project_id=project_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return [_to_link_response(item) for item in links]


@router.post(
    "/{project_id}/links", response_model=LinkResponse, status_code=status.HTTP_201_CREATED
)
async def create_link(
    project_id: str,
    payload: CreateLinkRequest,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LinkResponse:
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        link = await service.create_link(
            project_id=project_id,
            user_id=user_id,
            name=payload.name,
            url=payload.url,
        )
    except (NotFoundError, ValidationError) as exc:
        _raise_http_for_service_error(exc)
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=str(link.link_id),
        detail="projects.create_link",
        payload={"project_id": project_id},
    )
    return _to_link_response(link)


@router.delete("/{project_id}/links/{link_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_link(
    project_id: str,
    link_id: str,
    user_id: str = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    del project_id
    service = ProjectService(db)
    audit = AuditService(db)
    try:
        await service.delete_link(link_id=link_id, user_id=user_id)
    except NotFoundError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    await _log_mutation(
        audit=audit,
        user_id=user_id,
        target_id=link_id,
        detail="projects.delete_link",
        payload={"link_id": link_id},
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _raise_http_for_service_error(exc: Exception) -> None:
    if isinstance(exc, NotFoundError):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    if isinstance(exc, ValidationError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal error"
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


async def _project_response(
    *,
    service: ProjectService,
    project: Project,
    user_id: str,
) -> ProjectResponse:
    project_id = str(project.project_id)
    tasks = await service.list_tasks(project_id=project_id, user_id=user_id)
    files = await service.list_files(project_id=project_id, user_id=user_id)
    chats = await service.list_conversations(project_id=project_id, user_id=user_id)
    return ProjectResponse(
        project_id=project_id,
        name=project.name,
        description=project.description,
        instructions=project.instructions,
        sensitivity=project.sensitivity,
        status=project.status,
        priority=project.priority,
        color=project.color,
        start_date=project.start_date,
        target_date=project.target_date,
        completed_date=project.completed_date,
        task_count=len(tasks),
        task_done_count=sum(1 for item in tasks if item.status == "done"),
        knowledge_count=sum(1 for item in files if item.extract_status == "ok"),
        chat_count=len(chats),
        next_due_task=_next_due_task_name(tasks),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


async def _project_detail_response(
    *,
    service: ProjectService,
    project: Project,
    user_id: str,
) -> ProjectDetailResponse:
    project_id = str(project.project_id)
    tasks = await service.list_tasks(project_id=project_id, user_id=user_id)
    notes = await service.list_notes(project_id=project_id, user_id=user_id)
    files = await service.list_files(project_id=project_id, user_id=user_id)
    links = await service.list_links(project_id=project_id, user_id=user_id)
    chats = await service.list_conversations(project_id=project_id, user_id=user_id)
    base = await _project_response(service=service, project=project, user_id=user_id)
    return ProjectDetailResponse(
        **base.model_dump(),
        tasks=[_to_task_response(item) for item in tasks],
        notes=[_to_note_response(item) for item in notes],
        files=[_to_file_response(item) for item in files],
        links=[_to_link_response(item) for item in links],
        chats=[_to_chat_response(item) for item in chats],
    )


def _to_chat_response(conversation: Conversation) -> ProjectChatResponse:
    return ProjectChatResponse(
        conversation_id=str(conversation.conversation_id),
        title=conversation.title,
        created_at=conversation.created_at,
        updated_at=conversation.updated_at,
    )


def _to_task_response(task: ProjectTask) -> TaskResponse:
    return TaskResponse(
        task_id=str(task.task_id),
        project_id=str(task.project_id),
        name=task.name,
        description=task.description,
        status=task.status,
        priority=task.priority,
        due_date=task.due_date,
        sort_order=task.sort_order,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _to_note_response(note: ProjectNote) -> NoteResponse:
    return NoteResponse(
        note_id=str(note.note_id),
        project_id=str(note.project_id),
        content=note.content,
        source=note.source,
        created_at=note.created_at,
    )


def _to_file_response(file_row: ProjectFile) -> FileResponse:
    return FileResponse(
        file_id=str(file_row.file_id),
        project_id=str(file_row.project_id),
        filename=file_row.filename,
        original_name=file_row.original_name,
        content_type=file_row.content_type,
        size_bytes=file_row.size_bytes,
        extract_status=file_row.extract_status,
        text_chars=file_row.text_chars,
        created_at=file_row.created_at,
    )


def _to_link_response(link: ProjectLink) -> LinkResponse:
    return LinkResponse(
        link_id=str(link.link_id),
        project_id=str(link.project_id),
        name=link.name,
        url=link.url,
        created_at=link.created_at,
    )


def _next_due_task_name(tasks: list[ProjectTask]) -> str | None:
    """Name of the soonest unfinished task that has a date."""
    dated = [item for item in tasks if item.due_date is not None and item.status != "done"]
    if not dated:
        return None
    dated.sort(key=_task_due_date)
    return dated[0].name


def _task_due_date(item: ProjectTask) -> date:
    if item.due_date is None:
        return date.max
    return item.due_date
